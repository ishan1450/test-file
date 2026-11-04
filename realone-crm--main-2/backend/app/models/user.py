import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    AGENT = "agent"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default=UserRole.AGENT.value)
    approval_status = Column(String(50), nullable=False, default=ApprovalStatus.PENDING.value)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    approver = relationship("User", remote_side=[id], backref="approved_users")
    assigned_leads = relationship("Lead", back_populates="assigned_agent", foreign_keys="Lead.assigned_agent_id")
    created_leads = relationship("Lead", back_populates="creator", foreign_keys="Lead.created_by")
    activities = relationship("LeadActivity", back_populates="actor", foreign_keys="LeadActivity.actor_id")
