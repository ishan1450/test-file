from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from app.db.database import Base


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False, index=True)
    email = Column(String(255), nullable=True, index=True)
    source = Column(String(100), nullable=False, default="Other", index=True)

    # Meta specific identifiers
    meta_lead_id = Column(String(100), unique=True, index=True, nullable=True)
    meta_page_id = Column(String(100), nullable=True)
    meta_form_id = Column(String(100), nullable=True)
    meta_campaign_id = Column(String(100), nullable=True)
    meta_campaign_name = Column(String(255), nullable=True)
    meta_ad_id = Column(String(100), nullable=True)
    meta_ad_name = Column(String(255), nullable=True)

    # Real estate preferences
    property_type = Column(String(100), nullable=True, index=True)
    preferred_location = Column(String(255), nullable=True, index=True)
    min_budget = Column(Float, nullable=True)
    max_budget = Column(Float, nullable=True)

    # Lifecycle & Assignment
    status = Column(String(50), nullable=False, default="New", index=True)
    assigned_agent_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    custom_fields = Column(JSON, nullable=True, default=dict)

    # Timestamps & Soft Archival
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    archived_at = Column(DateTime, nullable=True, index=True)

    # Relationships
    assigned_agent = relationship("User", foreign_keys=[assigned_agent_id], back_populates="assigned_leads")
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_leads")
    activities = relationship("LeadActivity", back_populates="lead", cascade="all, delete-orphan", order_by="desc(LeadActivity.created_at)")

    __table_args__ = (
        Index("ix_leads_status_archived", "status", "archived_at"),
        Index("ix_leads_agent_archived", "assigned_agent_id", "archived_at"),
    )
