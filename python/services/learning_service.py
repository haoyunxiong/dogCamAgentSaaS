import re
from typing import Any, Dict, List, Optional

from .rental_repository import RentalRepository


# Sprint 6: 结构化类目（命中后不进知识库，走 structured_learning_suggestions）
DEFAULT_STRUCTURED_CATEGORIES = ("price", "schedule", "shipping", "aftersale", "booking")

# 关键词（小写匹配；按优先级从高到低）
_KW_PRICE = (
    "砍价", "便宜", "优惠", "少点", "最低", "包邮能再", "押金能少", "打折", "多少钱能",
    "能不能少", "可以便宜", "讲价",
)
_KW_BOOKING = ("下单", "预订", "预定", "锁定", "占档", "定档", "先付", "定金", "先订")
_KW_SCHEDULE = (
    "档期", "有货吗", "明天能", "后天能", "这周末", "下周", "几号到", "取机时间",
    "还机时间", "能租到", "什么时候能取", "什么时候能还",
)
_KW_SHIPPING = (
    "顺丰", "快递", "发货", "物流", "到付", "几天能到", "邮费", "运费", "自取", "门店自提",
)
_KW_AFTERSALE = (
    "坏了", "摔了", "进水", "碎屏", "黑屏", "开不了机", "售后", "赔", "维修", "电池鼓",
    "屏幕裂", "功能异常", "充不进电",
)
_KW_USAGE = (
    "怎么用", "如何使用", "怎么开机", "怎么录", "怎么连", "怎么导出", "操作", "教程",
    "说明书", "怎么开",
)
_KW_COMPAT = ("适配", "兼容", "支不支持", "能不能接", "可以接", "能装", "外接", "转接")
_KW_ACCESSORY = ("配件", "随机", "包含", "附赠", "送", "有没有送", "需不需要另外买", "额外")
_KW_FEATURE = (
    "参数", "像素", "传感器", "对焦", "变焦", "光圈", "视频码率", "分辨率", "帧率",
    "防抖", "画质",
)

# 价格数字（¥100、100元、100块、100 RMB 等）
_RE_PRICE_DIGIT = re.compile(
    r"(?:[¥￥]\s*\d+|\d+\s*(?:元|块|块钱|rmb|人民币))", re.IGNORECASE,
)


def _contains_any(text: str, keywords) -> bool:
    return any(k in text for k in keywords)


def classify_candidate(question: str, answer: str) -> Dict[str, Any]:
    """纯规则分类器。返回 {category, confidence, matched, reason}。

    优先级：price > booking > schedule > shipping > aftersale > compat > accessory >
    feature > usage > faq (fallback)。
    """
    q = (question or "").lower().strip()
    a = (answer or "").lower().strip()
    joined = f"{q}\n{a}"

    # price：关键词 或 含价格数字且短句（砍价场景）
    price_kw_hit = _contains_any(joined, _KW_PRICE)
    price_digit_hit = bool(_RE_PRICE_DIGIT.search(joined))
    if price_kw_hit:
        return {
            "category": "price",
            "confidence": 0.9,
            "matched": [k for k in _KW_PRICE if k in joined][:3],
            "reason": "keyword",
        }
    if price_digit_hit and len(q) <= 40:
        return {
            "category": "price",
            "confidence": 0.7,
            "matched": ["price_digit"],
            "reason": "digit_pattern",
        }

    buckets = [
        ("booking", _KW_BOOKING, 0.85),
        ("schedule", _KW_SCHEDULE, 0.85),
        ("shipping", _KW_SHIPPING, 0.85),
        ("aftersale", _KW_AFTERSALE, 0.85),
        ("compat", _KW_COMPAT, 0.8),
        ("accessory", _KW_ACCESSORY, 0.75),
        ("feature", _KW_FEATURE, 0.7),
        ("usage", _KW_USAGE, 0.7),
    ]
    for cat, kws, conf in buckets:
        hit = [k for k in kws if k in joined]
        if hit:
            return {
                "category": cat,
                "confidence": conf,
                "matched": hit[:3],
                "reason": "keyword",
            }

    return {"category": "faq", "confidence": 0.4, "matched": [], "reason": "fallback"}


class LearningService:
    def __init__(self, repository: RentalRepository, *, config: Optional[Any] = None):
        self.repository = repository
        self.config = config
        raw = None
        if config is not None:
            try:
                raw = config.get("KNOWLEDGE_CATEGORY_BLACKLIST")
            except Exception:
                raw = None
        if raw is None:
            self._structured_categories = set(DEFAULT_STRUCTURED_CATEGORIES)
        else:
            self._structured_categories = {
                p.strip().lower() for p in str(raw).split(",") if p.strip()
            }

    # ------------------------------------------------------------------
    # 公开方法
    # ------------------------------------------------------------------
    def classify(self, question: str, answer: str) -> Dict[str, Any]:
        return classify_candidate(question, answer)

    def _is_structured(self, category: str) -> bool:
        return (category or "").lower() in self._structured_categories

    def infer_model_code(self, item_desc: str, item_id: Optional[str] = None) -> Optional[str]:
        # Sprint 2: 优先查 item_model_mapping 显式绑定
        if item_id:
            mapped = self.repository.get_model_by_item_id(item_id)
            if mapped:
                return mapped
        text = (item_desc or "").lower()
        rules = {
            "DJI_POCKET3": ["pocket 3", "pocket3", "大疆 pocket3", "口袋 3"],
            "INSTA360_ACEPRO2": ["ace pro 2", "acepro2", "影石 ace pro 2"],
            "CANON_G7X": ["g7x"],
            "CANON_G12": ["g12"],
            "CANON_R50": ["r50"],
            "CANON_SX740HS": ["sx740", "sx740hs"],
            "RICOH_GR3": ["gr3", "理光 gr3"],
            "CANON_IXUS": ["ixus", "ccd"],
        }
        for model_code, keywords in rules.items():
            if any(keyword in text for keyword in keywords):
                return model_code
        return None

    def _record_candidate(
        self,
        *,
        session_id: Optional[str],
        item_id: Optional[str],
        model_code: Optional[str],
        question: str,
        answer: str,
        source_message_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """统一落库入口。根据 classify_candidate 结果路由到
        learning_candidates（通用）或 structured_learning_suggestions（结构化）。
        返回 {bucket, id, category}。"""
        cls = classify_candidate(question, answer)
        category = cls["category"]
        if self._is_structured(category):
            new_id = self.repository.create_structured_learning_suggestion(
                session_id=session_id,
                item_id=item_id,
                model_code=model_code,
                category=category,
                user_message=question,
                bot_or_human_reply=answer,
                suggested_slot={"matched": cls.get("matched", []), "confidence": cls.get("confidence")},
                note=f"auto:{cls.get('reason')}",
            )
            return {"bucket": "structured", "id": int(new_id or 0), "category": category}
        scope = "model" if model_code else "global"
        new_id = self.repository.create_learning_candidate(
            session_id=session_id,
            item_id=item_id,
            model_code=model_code,
            question=question,
            final_answer=answer,
            candidate_scope=scope,
            source_message_ids=source_message_ids,
        )
        return {"bucket": "knowledge", "id": int(new_id or 0), "category": category}

    def extract_from_history(self, limit: Optional[int] = None) -> Dict[str, Any]:
        """抽取历史聊天，做"跨会话 + 与历史表 双重去重" + 分类汇总。

        - 归一化 (question, answer) 作为去重 key：去首尾空格、小写、压缩中间空白
        - 同 key 跨不同 session 只生成一条候选，保留首个 session 作 source
        - 与 learning_candidates / structured_learning_suggestions 已存在条目再去重
          （避免多次点"抽取历史"刷重复候选）
        - 返回 stats：{created, knowledge, structured, raw_pairs, deduped, existing_skipped, by_category, by_bucket}
        """
        import re as _re

        def _norm(s: str) -> str:
            return _re.sub(r"\s+", " ", (s or "").strip().lower())

        rows = self.repository.scan_chat_pairs()
        item_desc_map = self.repository.get_item_descriptions()

        # Step 0: 加载已入库候选的归一化集合（历史去重）
        existing_keys: set = set()
        try:
            for p in self.repository.list_learning_candidate_pairs():
                existing_keys.add((_norm(p["question"]), _norm(p["answer"])))
        except Exception:
            pass
        try:
            for p in self.repository.list_structured_suggestion_pairs():
                existing_keys.add((_norm(p["question"]), _norm(p["answer"])))
        except Exception:
            pass

        # Step 1: 顺序扫描，收集 (user, assistant) 相邻对
        pairs: List[Dict[str, Any]] = []
        current_user = None
        current_chat = None
        for row in rows:
            if current_user and row["chat_id"] == current_chat and row["role"] == "assistant":
                pairs.append({
                    "session_id": row["chat_id"],
                    "item_id": row["item_id"],
                    "question": current_user["content"],
                    "answer": row["content"],
                    "source_message_ids": [current_user["id"], row["id"]],
                })
                current_user = None
                continue
            if row["role"] == "user":
                current_user = row
                current_chat = row["chat_id"]
            else:
                current_user = None
                current_chat = None

        # Step 2: 内存去重（同归一化 Q+A 合并为一条；保留首次出现的 session_id）
        seen: Dict[tuple, Dict[str, Any]] = {}
        existing_skipped = 0
        for p in pairs:
            key = (_norm(p["question"]), _norm(p["answer"]))
            if not key[0] or not key[1]:
                continue  # 跳过空白
            if key in existing_keys:
                existing_skipped += 1
                continue
            if key in seen:
                seen[key]["hit_count"] += 1
                if p["session_id"] and p["session_id"] not in seen[key]["session_ids"]:
                    seen[key]["session_ids"].append(p["session_id"])
            else:
                seen[key] = {
                    **p,
                    "hit_count": 1,
                    "session_ids": [p["session_id"]] if p["session_id"] else [],
                }

        stats: Dict[str, Any] = {
            "created": 0,
            "knowledge": 0,
            "structured": 0,
            "raw_pairs": len(pairs),
            "deduped": len(pairs) - len(seen) - existing_skipped,
            "existing_skipped": existing_skipped,
            "by_category": {},
            "by_bucket": {"knowledge": 0, "structured": 0},
        }

        # Step 3: 对去重后的唯一 Q&A 入库
        for p in seen.values():
            if limit and stats["created"] >= limit:
                break
            model_code = self.infer_model_code(
                item_desc_map.get(p["item_id"] or "", ""),
                item_id=p.get("item_id"),
            )
            result = self._record_candidate(
                session_id=p["session_id"],
                item_id=p["item_id"],
                model_code=model_code,
                question=p["question"],
                answer=p["answer"],
                source_message_ids=p["source_message_ids"],
            )
            stats["created"] += 1
            bucket = result["bucket"]
            stats[bucket] += 1
            stats["by_bucket"][bucket] += 1
            cat = result.get("category") or "faq"
            stats["by_category"][cat] = stats["by_category"].get(cat, 0) + 1
        return stats

    def capture_manual_takeover(self, chat_id: str, item_id: Optional[str], question: str, answer: str):
        model_code = self.infer_model_code(
            self.repository.get_item_descriptions().get(item_id or "", ""),
            item_id=item_id,
        )
        result = self._record_candidate(
            session_id=chat_id,
            item_id=item_id,
            model_code=model_code,
            question=question,
            answer=answer,
        )
        # 向后兼容：继续返回 id（int）
        return result.get("id", 0)
