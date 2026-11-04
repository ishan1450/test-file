#!/usr/bin/env python3
"""
Secure Admin Bootstrap Script
Usage:
    python backend/scripts/bootstrap_admin.py --email admin@example.com --name "System Administrator" --password "SecurePassword123!"
Or interactive:
    python backend/scripts/bootstrap_admin.py
"""
import sys
import os
import argparse
import getpass
from datetime import datetime

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.models.user import User, UserRole, ApprovalStatus
from app.core.security import get_password_hash


def bootstrap_admin(email: str, full_name: str, password: str):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email.lower()).first()
        if existing:
            print(f"[!] User with email {email} already exists. Elevating to approved Admin...")
            existing.role = UserRole.ADMIN.value
            existing.approval_status = ApprovalStatus.APPROVED.value
            existing.is_active = True
            existing.password_hash = get_password_hash(password)
            existing.approved_at = datetime.utcnow()
            db.commit()
            print(f"[✓] User {email} successfully updated to Admin role.")
            return

        admin_user = User(
            full_name=full_name,
            email=email.lower(),
            password_hash=get_password_hash(password),
            role=UserRole.ADMIN.value,
            approval_status=ApprovalStatus.APPROVED.value,
            is_active=True,
            approved_at=datetime.utcnow(),
        )
        db.add(admin_user)
        db.commit()
        print(f"[✓] Admin account created successfully for: {email}")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Bootstrap initial CRM Admin account.")
    parser.add_argument("--email", help="Admin email address")
    parser.add_argument("--name", default="System Administrator", help="Admin full name")
    parser.add_argument("--password", help="Admin password")

    args = parser.parse_args()

    email = args.email or input("Enter Admin Email: ").strip()
    name = args.name or input("Enter Admin Full Name: ").strip()
    password = args.password
    if not password:
        password = getpass.getpass("Enter Admin Password: ").strip()
        confirm = getpass.getpass("Confirm Admin Password: ").strip()
        if password != confirm:
            print("[x] Error: Passwords do not match.")
            sys.exit(1)

    if len(password) < 8:
        print("[x] Error: Password must be at least 8 characters long.")
        sys.exit(1)

    bootstrap_admin(email, name, password)


if __name__ == "__main__":
    main()
