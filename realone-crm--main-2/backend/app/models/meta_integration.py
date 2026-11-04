from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from app.db.database import Base


class MetaIntegration(Base):
    __tablename__ = "meta_integrations"

    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(String(100), nullable=True, index=True)
    page_name = Column(String(255), nullable=True)
    instagram_account_id = Column(String(100), nullable=True)
    instagram_username = Column(String(255), nullable=True)
    is_connected = Column(Boolean, default=False, nullable=False)
    
    # Secure access token storage (only used server-side, never returned in user API)
    access_token = Column(Text, nullable=True)
    
    selected_forms = Column(JSON, default=list, nullable=False)
    field_mappings = Column(JSON, default=dict, nullable=False)
    webhook_verified = Column(Boolean, default=False, nullable=False)
    webhook_subscribed_at = Column(DateTime, nullable=True)
    last_sync_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    sync_logs = relationship("MetaSyncLog", back_populates="integration", cascade="all, delete-orphan", order_by="desc(MetaSyncLog.created_at)")
