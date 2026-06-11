# python/knowledge_base/retriever.py
import json
import os
import pymysql
from mysql_helper import get_connection
from typing import List, Dict, Optional, Tuple

import numpy as np
import faiss
from loguru import logger
from openai import AsyncOpenAI


# Sprint 2: 默认"不走自动回复"的知识类目
DEFAULT_BLACKLIST_TAGS = {"price", "schedule", "shipping", "aftersale", "booking"}


def _parse_tags(raw: Optional[str]) -> List[str]:
    """解析 knowledge.tags 字段。兼容 JSON 数组、逗号分隔、空值。"""
    if not raw:
        return []
    text = raw.strip()
    if not text:
        return []
    if text.startswith("["):
        try:
            data = json.loads(text)
            if isinstance(data, list):
                return [str(t).strip().lower() for t in data if str(t).strip()]
        except Exception:
            pass
    # 逗号 / 顿号 / 空白分隔
    parts = [p.strip().lower() for p in text.replace("，", ",").replace("、", ",").split(",")]
    return [p for p in parts if p]


class KnowledgeRetriever:
    """
    负责：
    - 懒加载 FAISS 索引到内存
    - 向量化 query 并检索 Top-K 相关 Q&A
    - 知识库为空时优雅降级（返回空列表）
    """

    def __init__(self, config: dict):
        self.config = config
        self.db_path = config["DB_PATH"]
        data_dir = os.path.dirname(self.db_path)
        self.index_path = os.path.join(data_dir, "knowledge.index")
        self.map_path = os.path.join(data_dir, "knowledge_index_map.json")
        self._index: Optional[faiss.Index] = None
        self._id_map: Optional[List[int]] = None
        self._async_client: Optional[AsyncOpenAI] = None
        self._scope_positions: Optional[dict] = None
        self._position_metadata: Optional[dict] = None

    def _ensure_index_state_table(self) -> None:
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS knowledge_index_state (
                      state_key VARCHAR(64) PRIMARY KEY,
                      data_version BIGINT NOT NULL DEFAULT 0,
                      built_version BIGINT NOT NULL DEFAULT 0,
                      dirty TINYINT NOT NULL DEFAULT 1,
                      rebuild_requested_at DATETIME NULL,
                      last_built_at DATETIME NULL,
                      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB
                    """
                )
                cur.execute(
                    """
                    INSERT INTO knowledge_index_state (state_key, data_version, built_version, dirty)
                    VALUES ('knowledge', 0, 0, 1)
                    ON DUPLICATE KEY UPDATE state_key = VALUES(state_key)
                    """
                )
            conn.commit()
        finally:
            conn.close()

    def _get_index_state(self) -> Dict:
        self._ensure_index_state_table()
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT state_key, data_version, built_version, dirty, last_built_at, rebuild_requested_at FROM knowledge_index_state WHERE state_key = 'knowledge'"
                )
                row = cur.fetchone()
        finally:
            conn.close()
        return row or {"data_version": 0, "built_version": 0, "dirty": 1}

    def _is_index_fresh(self) -> bool:
        state = self._get_index_state()
        dirty = bool(state.get("dirty"))
        data_version = int(state.get("data_version") or 0)
        built_version = int(state.get("built_version") or 0)
        if dirty or built_version < data_version:
            logger.info(
                f"[KnowledgeRetriever] 当前索引已过期，跳过检索: dirty={dirty} data_version={data_version} built_version={built_version}"
            )
            return False
        return True

    def _get_client(self) -> AsyncOpenAI:
        if self._async_client is None:
            self._async_client = AsyncOpenAI(
                api_key=self.config.get("API_KEY"),
                base_url=self.config.get("MODEL_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
            )
        return self._async_client

    def invalidate_cache(self):
        """rebuild_index 完成后调用，重置内存索引缓存"""
        self._index = None
        self._id_map = None
        self._scope_positions = None
        self._position_metadata = None

    def _load_index(self) -> bool:
        """加载 FAISS 索引到内存。返回 True 表示成功，False 表示无索引（降级）。"""
        if self._index is not None:
            return True
        if not os.path.exists(self.index_path) or not os.path.exists(self.map_path):
            return False
        try:
            self._index = faiss.read_index(self.index_path)
            with open(self.map_path, encoding="utf-8") as f:
                self._id_map = json.load(f)  # list of SQLite row ids

            # 构建 item_id / biz_item_code / model_code / global → positions 映射
            conn = get_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT id, item_id, scope_type, model_code, biz_item_code FROM knowledge")
                    rows = cur.fetchall()
            finally:
                conn.close()

            metadata = {
                r["id"]: {
                    "item_id": r["item_id"],
                    "scope_type": r["scope_type"],
                    "model_code": r["model_code"],
                    "biz_item_code": r.get("biz_item_code"),
                }
                for r in rows
            }
            self._scope_positions = {}
            self._position_metadata = {}
            for pos, row_id in enumerate(self._id_map):
                meta = metadata.get(row_id, {})
                item_id = meta.get("item_id")
                scope_type = meta.get("scope_type")
                model_code = meta.get("model_code")
                biz_item_code = meta.get("biz_item_code")

                if item_id:
                    scope_key = f"item:{item_id}"
                elif scope_type == "biz_item" and biz_item_code:
                    scope_key = f"biz:{biz_item_code}"
                elif scope_type == "model" and model_code:
                    scope_key = f"model:{model_code}"
                else:
                    scope_key = "__global__"

                self._scope_positions.setdefault(scope_key, set()).add(pos)
                self._position_metadata[pos] = {
                    "row_id": row_id,
                    "scope_key": scope_key,
                    "scope_type": scope_type,
                    "item_id": item_id,
                    "biz_item_code": biz_item_code,
                    "model_code": model_code,
                }
            return True
        except Exception as e:
            logger.warning(f"[KnowledgeRetriever] 加载 FAISS 索引失败: {e}")
            return False

    def _load_item_scope_context(
        self,
        *,
        item_id: Optional[str],
        biz_item_code: Optional[str],
        model_code: Optional[str],
    ) -> Tuple[Optional[str], Optional[str]]:
        resolved_biz_item_code = biz_item_code
        resolved_model_code = model_code
        if (resolved_biz_item_code or resolved_model_code) or not item_id:
            return resolved_biz_item_code, resolved_model_code

        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT biz_item_code, model_code FROM item_model_mapping WHERE item_id = %s LIMIT 1",
                    (item_id,),
                )
                row = cur.fetchone()
        except Exception as e:
            logger.debug(f"[KnowledgeRetriever] 读取商品映射失败: item_id={item_id}, error={e}")
            row = None
        finally:
            conn.close()

        if row:
            resolved_biz_item_code = resolved_biz_item_code or row.get("biz_item_code")
            resolved_model_code = resolved_model_code or row.get("model_code")
        return resolved_biz_item_code, resolved_model_code

    async def search(
        self,
        query: str,
        item_id: Optional[str] = None,
        top_k: int = 3,
        biz_item_code: Optional[str] = None,
        model_code: Optional[str] = None,
    ) -> List[Dict]:
        """
        检索与 query 最相关的 Top-K 知识条目。
        - 先搜 item_id 对应的商品知识
        - 再搜全局知识（item_id=NULL）
        - 合并去重，按相似度排序
        降级：索引不存在或 KNOWLEDGE_ENABLED=False 时返回 []。
        """
        # Fix 5: case-insensitive check so "true", "TRUE", " True " all work
        if self.config.get("KNOWLEDGE_ENABLED", "True").strip().lower() != "true":
            return []

        if not self._is_index_fresh():
            return []

        if not self._load_index():
            return []

        # Fix 4: guard against scope positions being None (e.g. _load_index returned
        # True from the already-loaded branch but a previous load failed mid-way)
        if self._scope_positions is None or self._position_metadata is None:
            return []

        biz_item_code, model_code = self._load_item_scope_context(
            item_id=item_id,
            biz_item_code=biz_item_code,
            model_code=model_code,
        )

        model = self.config.get("EMBEDDING_MODEL", "text-embedding-v3")
        client = self._get_client()
        try:
            response = await client.embeddings.create(input=[query], model=model)
            vec = np.array(response.data[0].embedding, dtype=np.float32)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            query_vec = vec.reshape(1, -1)
        except Exception as e:
            logger.warning(f"[KnowledgeRetriever] embedding 失败，降级跳过检索: {e}")
            return []

        # 搜索全部向量，取更多候选，便于优先级排序后仍有足够结果
        k = min(max(top_k * 8, top_k), self._index.ntotal)
        scores, indices = self._index.search(query_vec, k)
        scores = scores[0].tolist()
        indices = indices[0].tolist()

        # 确定允许的 positions 与优先级
        allowed_positions = set()
        position_priority = {}

        def add_scope(scope_key: Optional[str], priority: int) -> None:
            if not scope_key:
                return
            positions = self._scope_positions.get(scope_key)
            if not positions:
                return
            allowed_positions.update(positions)
            for pos in positions:
                old_priority = position_priority.get(pos)
                if old_priority is None or priority < old_priority:
                    position_priority[pos] = priority

        add_scope(f"item:{item_id}" if item_id else None, 0)
        add_scope(f"biz:{biz_item_code}" if biz_item_code else None, 1)
        add_scope(f"model:{model_code}" if model_code else None, 2)
        add_scope("__global__", 3)

        # 过滤 + 收集候选 row_ids
        candidates = []
        seen_ids = set()
        for idx, score in zip(indices, scores):
            if idx < 0:
                continue
            if idx not in allowed_positions:
                continue
            row_id = self._id_map[idx]
            if row_id in seen_ids:
                continue
            seen_ids.add(row_id)
            candidates.append((row_id, score, position_priority.get(idx, 99)))

        if not candidates:
            return []

        candidates.sort(key=lambda item: (item[2], -item[1]))
        candidates = candidates[:top_k]

        # 从 SQLite 读取完整内容
        row_ids = [c[0] for c in candidates]
        score_map = {c[0]: c[1] for c in candidates}
        priority_map = {c[0]: c[2] for c in candidates}
        placeholders = ",".join("%s" * len(row_ids))
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, question, answer, item_id, biz_item_code, model_code, scope_type, tags, confidence_threshold "
                    f"FROM knowledge WHERE id IN ({placeholders})",
                    row_ids
                )
                rows = cur.fetchall()
        finally:
            conn.close()

        result = []
        for r in rows:
            result.append({
                "id": r["id"],
                "question": r["question"],
                "answer": r["answer"],
                "item_id": r["item_id"],
                "biz_item_code": r.get("biz_item_code") if isinstance(r, dict) else None,
                "model_code": r.get("model_code") if isinstance(r, dict) else None,
                "scope_type": r.get("scope_type") if isinstance(r, dict) else None,
                "tags": _parse_tags(r.get("tags") if isinstance(r, dict) else None),
                "confidence_threshold": r.get("confidence_threshold") if isinstance(r, dict) else None,
                "score": score_map[r["id"]],
                "scope_priority": priority_map[r["id"]],
            })
        result.sort(key=lambda x: (x.get("scope_priority", 99), -x["score"]))
        return result[:top_k]

    # ------------------------------------------------------------------
    # Sprint 2: 带策略的检索 —— 阈值 + 类目黑名单 + 型号绑定
    # ------------------------------------------------------------------
    async def search_with_policy(
        self,
        query: str,
        item_id: Optional[str] = None,
        top_k: int = 3,
        biz_item_code: Optional[str] = None,
        model_code: Optional[str] = None,
        min_score: Optional[float] = None,
        blacklist_tags: Optional[List[str]] = None,
    ) -> Tuple[List[Dict], Dict]:
        """
        返回 (hits, debug_info)。

        策略顺序：
          1. 调底层 search 拿到 Top-K 候选
          2. 低于阈值（逐条优先用 confidence_threshold，否则用 min_score）过滤
          3. 命中黑名单标签的条目过滤（结构化类目不走自动回）
          4. 返回剩余

        debug_info 结构：
          {
            "raw_count": int,
            "min_score": float,
            "blacklist": [str],
            "rejected": [
              {"id": 1, "score": 0.72, "reason": "below_threshold"},
              {"id": 3, "score": 0.88, "reason": "blacklist_tag:price"},
            ],
            "reason": "ok" | "no_hit" | "all_rejected"
          }
        """
        if min_score is None:
            try:
                min_score = float(self.config.get("KNOWLEDGE_MIN_SCORE_DEFAULT", 0.75))
            except (TypeError, ValueError):
                min_score = 0.75
        if blacklist_tags is None:
            raw = self.config.get("KNOWLEDGE_CATEGORY_BLACKLIST")
            if raw is None:
                blacklist_tags = list(DEFAULT_BLACKLIST_TAGS)
            else:
                blacklist_tags = [p.strip().lower() for p in str(raw).split(",") if p.strip()]
        blacklist_set = set(blacklist_tags)

        raw_hits = await self.search(
            query,
            item_id=item_id,
            biz_item_code=biz_item_code,
            model_code=model_code,
            top_k=top_k,
        )
        debug: Dict = {
            "raw_count": len(raw_hits),
            "min_score": min_score,
            "blacklist": sorted(blacklist_set),
            "rejected": [],
            "reason": "ok",
        }
        if not raw_hits:
            debug["reason"] = "no_hit"
            return [], debug

        accepted: List[Dict] = []
        for hit in raw_hits:
            score = float(hit.get("score") or 0.0)
            threshold = hit.get("confidence_threshold")
            try:
                threshold_v = float(threshold) if threshold is not None else min_score
            except (TypeError, ValueError):
                threshold_v = min_score
            if score < threshold_v:
                debug["rejected"].append({
                    "id": hit.get("id"),
                    "score": round(score, 3),
                    "reason": f"below_threshold({threshold_v})",
                })
                continue
            tags = set(hit.get("tags") or [])
            bad = tags & blacklist_set
            if bad:
                debug["rejected"].append({
                    "id": hit.get("id"),
                    "score": round(score, 3),
                    "reason": f"blacklist_tag:{sorted(bad)[0]}",
                })
                continue
            accepted.append(hit)

        if not accepted:
            debug["reason"] = "all_rejected"
        return accepted, debug
