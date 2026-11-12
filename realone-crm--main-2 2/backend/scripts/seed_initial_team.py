#!/usr/bin/env python3
"""
Seed script to initialize 1 Admin and 3 Agents for development & testing.
Default password for all seeded users: "Password123!"
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.models.user import User, UserRole, ApprovalStatus
from app.models.assignment_state import RoundRobinState
from app.models.meta_integration import MetaIntegration
from app.core.security import get_password_hash


def seed_team():
    db = SessionLocal()
    default_pw = get_password_hash("Password123!")
    try:
        # 1. Admin
        admin = db.query(User).filter(User.email == "admin@realestate.com").first()
        if not admin:
            admin = User(
                full_name="Alex Vance (Admin)",
                email="admin@realestate.com",
                password_hash=default_pw,
                role=UserRole.ADMIN.value,
                approval_status=ApprovalStatus.APPROVED.value,
                is_active=True,
                approved_at=datetime.utcnow(),
            )
            db.add(admin)
            db.flush()
            print("[✓] Seeded Admin: admin@realestate.com")

        # 2. Three Agents
        agents_data = [
            ("Sarah Jenkins", "sarah.agent@realestate.com"),
            ("Michael Chang", "michael.agent@realestate.com"),
            ("Priya Patel", "priya.agent@realestate.com"),
        ]

        for name, email in agents_data:
            agent = db.query(User).filter(User.email == email).first()
            if not agent:
                agent = User(
                    full_name=name,
                    email=email,
                    password_hash=default_pw,
                    role=UserRole.AGENT.value,
                    approval_status=ApprovalStatus.APPROVED.value,
                    is_active=True,
                    approved_at=datetime.utcnow(),
                    approved_by=admin.id,
                )
                db.add(agent)
                print(f"[✓] Seeded Agent: {email}")

        # 3. One pending user to demonstrate approvals
        pending_user = db.query(User).filter(User.email == "david.new@realestate.com").first()
        if not pending_user:
            pending_user = User(
                full_name="David Ross",
                email="david.new@realestate.com",
                password_hash=default_pw,
                role=UserRole.AGENT.value,
                approval_status=ApprovalStatus.PENDING.value,
                is_active=True,
            )
            db.add(pending_user)
            print("[✓] Seeded Pending User: david.new@realestate.com")

        # 4. Round Robin state
        rr_state = db.query(RoundRobinState).filter(RoundRobinState.id == 1).first()
        if not rr_state:
            rr_state = RoundRobinState(id=1, total_assigned_count=0)
            db.add(rr_state)
            print("[✓] Initialized RoundRobinState id=1")

        # 5. Meta Integration initial record
        meta_int = db.query(MetaIntegration).first()
        if not meta_int:
            meta_int = MetaIntegration(
                is_connected=False,
                selected_forms=[],
                field_mappings={
                    "full_name": "full_name",
                    "phone_number": "phone",
                    "email": "email",
                    "property_type": "property_type",
                    "preferred_location": "preferred_location",
                    "budget": "max_budget",
                },
            )
            db.add(meta_int)
            print("[✓] Initialized MetaIntegration settings")

        db.commit()
        print("\n[SUCCESS] Seeded 1 Admin, 3 Agents, and 1 Pending User.")
        print("Default password: Password123!")

    finally:
        db.close()


if __name__ == "__main__":
    seed_team()
