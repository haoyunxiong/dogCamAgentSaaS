import sqlite3
import os
import json
from datetime import datetime
from loguru import logger
from mysql_helper import get_connection


class ChatContextManager:
    """
    聊天上下文管理器
    
    负责存储和检索用户与商品之间的对话历史，使用SQLite数据库进行持久化存储。
    支持按会话ID检索对话历史，以及议价次数统计。
    """
    
    def __init__(self, max_history=100, db_path="data/chat_history.db"):
        """
        初始化聊天上下文管理器
        
        Args:
            max_history: 每个对话保留的最大消息数
            db_path: SQLite数据库文件路径
        """
        self.max_history = max_history
        self.db_path = db_path
        self._init_db()

    @staticmethod
    def _mysql_datetime(value):
        if value is None or value == '':
            return None
        text = str(value).strip()
        if not text:
            return None
        if text.endswith('Z'):
            text = text[:-1]
        return text.replace('T', ' ')
        
    def _init_db(self):
        """初始化数据库表结构"""
        # 确保数据库目录存在
        db_dir = os.path.dirname(self.db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir)
            
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # 创建消息表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            chat_id TEXT
        )
        ''')
        
        # 检查是否需要添加chat_id字段（兼容旧数据库）
        cursor.execute("PRAGMA table_info(messages)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'chat_id' not in columns:
            cursor.execute('ALTER TABLE messages ADD COLUMN chat_id TEXT')
            logger.info("已为messages表添加chat_id字段")
        
        # 创建索引以加速查询
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_user_item ON messages (user_id, item_id)
        ''')
        
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_chat_id ON messages (chat_id)
        ''')
        
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_timestamp ON messages (timestamp)
        ''')
        
        # 创建基于会话ID的议价次数表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_bargain_counts (
            chat_id TEXT PRIMARY KEY,
            count INTEGER DEFAULT 0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # 创建商品信息表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS items (
            item_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            price REAL,
            description TEXT,
            biz_item_code TEXT,
            biz_item_code_source TEXT,
            detail_source TEXT,
            detail_updated_at DATETIME,
            detail_dirty INTEGER DEFAULT 0,
            dirty_reason TEXT,
            last_refresh_attempt_at DATETIME,
            refresh_fail_count INTEGER DEFAULT 0,
            refresh_backoff_until DATETIME,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        cursor.execute("PRAGMA table_info(items)")
        item_columns = {column[1] for column in cursor.fetchall()}
        if 'biz_item_code' not in item_columns:
            cursor.execute('ALTER TABLE items ADD COLUMN biz_item_code TEXT')
        if 'biz_item_code_source' not in item_columns:
            cursor.execute('ALTER TABLE items ADD COLUMN biz_item_code_source TEXT')
        if 'detail_source' not in item_columns:
            cursor.execute('ALTER TABLE items ADD COLUMN detail_source TEXT')
        if 'detail_updated_at' not in item_columns:
            cursor.execute('ALTER TABLE items ADD COLUMN detail_updated_at DATETIME')
        if 'detail_dirty' not in item_columns:
            cursor.execute('ALTER TABLE items ADD COLUMN detail_dirty INTEGER DEFAULT 0')
        if 'dirty_reason' not in item_columns:
            cursor.execute('ALTER TABLE items ADD COLUMN dirty_reason TEXT')
        if 'last_refresh_attempt_at' not in item_columns:
            cursor.execute('ALTER TABLE items ADD COLUMN last_refresh_attempt_at DATETIME')
        if 'refresh_fail_count' not in item_columns:
            cursor.execute('ALTER TABLE items ADD COLUMN refresh_fail_count INTEGER DEFAULT 0')
        if 'refresh_backoff_until' not in item_columns:
            cursor.execute('ALTER TABLE items ADD COLUMN refresh_backoff_until DATETIME')
        
        conn.commit()
        conn.close()
        logger.info(f"聊天历史数据库初始化完成: {self.db_path}")
        

            
    def save_item_info(
        self,
        item_id,
        item_data,
        *,
        biz_item_code=None,
        biz_item_code_source=None,
        detail_source=None,
        detail_updated_at=None,
    ):
        """
        保存商品信息到数据库
        
        Args:
            item_id: 商品ID
            item_data: 商品信息字典
        """
        conn = get_connection()
        cursor = conn.cursor()

        try:
            # 从商品数据中提取有用信息
            try:
                price = float(item_data.get('soldPrice', 0) or 0)
            except (TypeError, ValueError):
                price = 0.0
            description = item_data.get('desc', '')
            now_iso = datetime.now().isoformat()
            detail_updated_value = detail_updated_at or now_iso
            
            # 将整个商品数据转换为JSON字符串
            data_json = json.dumps(item_data, ensure_ascii=False)
            
            cursor.execute(
                """
                INSERT INTO item_cache (
                    item_id, data, price, description, biz_item_code,
                    biz_item_code_source, detail_source, detail_updated_at,
                    detail_dirty, dirty_reason, last_refresh_attempt_at,
                    refresh_fail_count, refresh_backoff_until, last_updated
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, NULL, %s, 0, NULL, %s)
                ON DUPLICATE KEY UPDATE
                    data = VALUES(data),
                    price = VALUES(price),
                    description = VALUES(description),
                    biz_item_code = VALUES(biz_item_code),
                    biz_item_code_source = VALUES(biz_item_code_source),
                    detail_source = VALUES(detail_source),
                    detail_updated_at = VALUES(detail_updated_at),
                    detail_dirty = 0,
                    dirty_reason = NULL,
                    last_refresh_attempt_at = VALUES(last_refresh_attempt_at),
                    refresh_fail_count = 0,
                    refresh_backoff_until = NULL,
                    last_updated = VALUES(last_updated)
                """,
                (
                    item_id, data_json, price, description, biz_item_code,
                    biz_item_code_source, detail_source, self._mysql_datetime(detail_updated_value),
                    self._mysql_datetime(now_iso), self._mysql_datetime(now_iso),
                )
            )

            conn.commit()
            logger.debug(f"商品信息已保存: {item_id}")
        except Exception as e:
            logger.error(f"保存商品信息时出错: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def get_item_info(self, item_id):
        """
        从数据库获取商品信息
        
        Args:
            item_id: 商品ID
            
        Returns:
            dict: 商品信息字典，如果不存在返回None
        """
        record = self.get_item_info_record(item_id)
        return record.get('item_info') if record else None

    def get_item_info_record(self, item_id):
        """获取商品信息及缓存元信息。"""
        conn = get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                """
                  SELECT data, biz_item_code, biz_item_code_source, detail_source, detail_updated_at,
                      detail_dirty, dirty_reason, last_refresh_attempt_at,
                      refresh_fail_count, refresh_backoff_until, last_updated
                FROM item_cache WHERE item_id = %s
                """,
                (item_id,)
            )

            result = cursor.fetchone()
            if not result:
                return None
            return {
                'item_info': json.loads(result['data']),
                'biz_item_code': result['biz_item_code'],
                'biz_item_code_source': result['biz_item_code_source'],
                'detail_source': result['detail_source'],
                'detail_updated_at': result['detail_updated_at'].isoformat() if result['detail_updated_at'] else None,
                'detail_dirty': bool(result['detail_dirty']),
                'dirty_reason': result['dirty_reason'],
                'last_refresh_attempt_at': result['last_refresh_attempt_at'].isoformat() if result['last_refresh_attempt_at'] else None,
                'refresh_fail_count': result['refresh_fail_count'] or 0,
                'refresh_backoff_until': result['refresh_backoff_until'].isoformat() if result['refresh_backoff_until'] else None,
                'last_updated': result['last_updated'].isoformat() if result['last_updated'] else None,
            }
        except Exception as e:
            logger.error(f"获取商品信息时出错: {e}")
            return None
        finally:
            conn.close()

    def get_item_info_age_seconds(self, item_id):
        record = self.get_item_info_record(item_id)
        if not record:
            return None
        dt_text = record.get('detail_updated_at') or record.get('last_updated')
        if not dt_text:
            return None
        try:
            return max((datetime.now() - datetime.fromisoformat(str(dt_text))).total_seconds(), 0.0)
        except Exception:
            return None

    def is_item_info_stale(self, item_id, ttl_seconds=1800):
        record = self.get_item_info_record(item_id)
        if not record:
            return True
        if record.get('detail_dirty'):
            return True
        item_info = record.get('item_info') or {}
        if not item_info:
            return True
        age_seconds = self.get_item_info_age_seconds(item_id)
        if age_seconds is None:
            return True
        return age_seconds >= max(int(ttl_seconds or 0), 0)

    def mark_item_info_dirty(self, item_id, reason='manual'):
        conn = get_connection()
        cursor = conn.cursor()
        now_iso = datetime.now().isoformat()
        try:
            cursor.execute(
                """
                INSERT INTO item_cache (item_id, data, detail_dirty, dirty_reason, last_updated)
                VALUES (%s, %s, 1, %s, %s)
                ON DUPLICATE KEY UPDATE
                    detail_dirty = 1,
                    dirty_reason = VALUES(dirty_reason),
                    refresh_backoff_until = NULL,
                    last_updated = VALUES(last_updated)
                """,
                (item_id, json.dumps({}, ensure_ascii=False), reason, self._mysql_datetime(now_iso))
            )
            conn.commit()
            return True
        except Exception as e:
            logger.error(f"标记商品缓存脏数据失败: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def mark_item_refresh_started(self, item_id):
        conn = get_connection()
        cursor = conn.cursor()
        now_iso = datetime.now().isoformat()
        try:
            cursor.execute(
                """
                INSERT INTO item_cache (item_id, data, last_refresh_attempt_at, last_updated)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    last_refresh_attempt_at = VALUES(last_refresh_attempt_at),
                    last_updated = VALUES(last_updated)
                """,
                (
                    item_id,
                    json.dumps({}, ensure_ascii=False),
                    self._mysql_datetime(now_iso),
                    self._mysql_datetime(now_iso),
                )
            )
            conn.commit()
        except Exception as e:
            logger.error(f"标记商品刷新开始失败: {e}")
            conn.rollback()
        finally:
            conn.close()

    def mark_item_refresh_failed(self, item_id, *, reason='refresh_failed', cooldown_seconds=300):
        conn = get_connection()
        cursor = conn.cursor()
        now = datetime.now()
        now_iso = now.isoformat()
        cooldown_until = now.timestamp() + max(int(cooldown_seconds or 0), 0)
        cooldown_iso = datetime.fromtimestamp(cooldown_until).isoformat()
        try:
            cursor.execute(
                """
                INSERT INTO item_cache (
                    item_id, data, detail_dirty, dirty_reason,
                    last_refresh_attempt_at, refresh_fail_count, refresh_backoff_until, last_updated
                )
                VALUES (%s, %s, 1, %s, %s, 1, %s, %s)
                ON DUPLICATE KEY UPDATE
                    detail_dirty = 1,
                    dirty_reason = VALUES(dirty_reason),
                    last_refresh_attempt_at = VALUES(last_refresh_attempt_at),
                    refresh_fail_count = COALESCE(refresh_fail_count, 0) + 1,
                    refresh_backoff_until = VALUES(refresh_backoff_until),
                    last_updated = VALUES(last_updated)
                """,
                (
                    item_id, json.dumps({}, ensure_ascii=False), reason,
                    self._mysql_datetime(now_iso),
                    self._mysql_datetime(cooldown_iso),
                    self._mysql_datetime(now_iso),
                )
            )
            conn.commit()
        except Exception as e:
            logger.error(f"标记商品刷新失败状态失败: {e}")
            conn.rollback()
        finally:
            conn.close()

    def can_refresh_item_info(self, item_id):
        record = self.get_item_info_record(item_id)
        if not record:
            return True
        backoff_until = record.get('refresh_backoff_until')
        if not backoff_until:
            return True
        try:
            return datetime.now() >= datetime.fromisoformat(str(backoff_until))
        except Exception:
            return True

    def add_message_by_chat(self, chat_id, user_id, item_id, role, content):
        """
        基于会话ID添加新消息到对话历史
        
        Args:
            chat_id: 会话ID
            user_id: 用户ID (用户消息存真实user_id，助手消息存卖家ID)
            item_id: 商品ID
            role: 消息角色 (user/assistant)
            content: 消息内容
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # 插入新消息，使用chat_id作为额外标识
            cursor.execute(
                "INSERT INTO messages (user_id, item_id, role, content, timestamp, chat_id) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, item_id, role, content, datetime.now().isoformat(), chat_id)
            )
            
            # 检查是否需要清理旧消息（基于chat_id）
            cursor.execute(
                """
                SELECT id FROM messages 
                WHERE chat_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?, 1
                """, 
                (chat_id, self.max_history)
            )
            
            oldest_to_keep = cursor.fetchone()
            if oldest_to_keep:
                cursor.execute(
                    "DELETE FROM messages WHERE chat_id = ? AND id < ?",
                    (chat_id, oldest_to_keep[0])
                )
            
            conn.commit()
        except Exception as e:
            logger.error(f"添加消息到数据库时出错: {e}")
            conn.rollback()
        finally:
            conn.close()

    def get_context_by_chat(self, chat_id):
        """
        基于会话ID获取对话历史
        
        Args:
            chat_id: 会话ID
            
        Returns:
            list: 包含对话历史的列表
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                """
                SELECT role, content FROM messages 
                WHERE chat_id = ? 
                ORDER BY timestamp ASC
                LIMIT ?
                """, 
                (chat_id, self.max_history)
            )
            
            messages = [{"role": role, "content": content} for role, content in cursor.fetchall()]
            
            # 获取议价次数并添加到上下文中
            bargain_count = self.get_bargain_count_by_chat(chat_id)
            if bargain_count > 0:
                messages.append({
                    "role": "system", 
                    "content": f"议价次数: {bargain_count}"
                })
            
        except Exception as e:
            logger.error(f"获取对话历史时出错: {e}")
            messages = []
        finally:
            conn.close()
        
        return messages

    def increment_bargain_count_by_chat(self, chat_id):
        """
        基于会话ID增加议价次数
        
        Args:
            chat_id: 会话ID
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # 使用UPSERT语法直接基于chat_id增加议价次数
            cursor.execute(
                """
                INSERT INTO chat_bargain_counts (chat_id, count, last_updated)
                VALUES (?, 1, ?)
                ON CONFLICT(chat_id) 
                DO UPDATE SET count = count + 1, last_updated = ?
                """,
                (chat_id, datetime.now().isoformat(), datetime.now().isoformat())
            )
            
            conn.commit()
            logger.debug(f"会话 {chat_id} 议价次数已增加")
        except Exception as e:
            logger.error(f"增加议价次数时出错: {e}")
            conn.rollback()
        finally:
            conn.close()

    def get_bargain_count_by_chat(self, chat_id):
        """
        基于会话ID获取议价次数
        
        Args:
            chat_id: 会话ID
            
        Returns:
            int: 议价次数
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                "SELECT count FROM chat_bargain_counts WHERE chat_id = ?",
                (chat_id,)
            )
            
            result = cursor.fetchone()
            return result[0] if result else 0
        except Exception as e:
            logger.error(f"获取议价次数时出错: {e}")
            return 0
        finally:
            conn.close() 
