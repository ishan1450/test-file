from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base


class RoundRobinState(Base):
    __tablename__ = "round_robin_state"

    id = Column(Integer, primary_key=True)  # Single row with id=1
    last_assigned_agent_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    last_assignment_at = Column(DateTime, nullable=True)
    total_assigned_count = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    last_assigned_agent = relationship("User", foreign_keys=[last_assigned_agent_id])
