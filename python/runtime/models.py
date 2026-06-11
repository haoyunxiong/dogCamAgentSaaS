from dataclasses import dataclass
from typing import Any, Optional


@dataclass(slots=True)
class InboundChatEvent:
    session_id: str
    item_id: str
    sender_user_id: str
    sender_user_name: str
    message_text: str
    created_at_ms: Optional[int] = None
    source_mode: str = "api"
    raw_payload: Any = None
