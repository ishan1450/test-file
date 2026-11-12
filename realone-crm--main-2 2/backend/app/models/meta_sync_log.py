from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base


class MetaSyncLog(Base):
    __tablename__ = "meta_sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    integration_id = Column(Integer, ForeignKey("meta_integrations.id", ondelete="CASCADE"), nullable=True, index=True)
    external_lead_id = Column(String(100), nullable=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)  # webhook, manual_sync, historical_import, retry
    status = Column(String(50), nullable=False, index=True)       # success, skipped_duplicate, failed
    attempt_count = Column(Integer, default=1, nullable=False)
    error_message = Column(Text, nullable=True)                   # sanitized error messages, never leaking access tokens
    payload = Column(JSON, nullable=True)                         # sanitized event payload
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    processed_at = Column(DateTime, nullable=True)

    # Relationships
    integration = relationship("MetaIntegration", back_populates="sync_logs")
