import pytest
from app.models.user import User, UserRole, ApprovalStatus
from app.core.security import create_access_token


def test_public_registration_creates_pending_account(client, db):
    payload = {
        "full_name": "New Candidate",
        "email": "candidate@example.com",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["role"] == "agent"
    assert data["approval_status"] == "pending"
    assert data["email"] == "candidate@example.com"

    # Verify directly in DB
    user = db.query(User).filter(User.email == "candidate@example.com").first()
    assert user is not None
    assert user.role == UserRole.AGENT.value
    assert user.approval_status == ApprovalStatus.PENDING.value


def test_public_registration_cannot_self_assign_admin(client, db):
    payload = {
        "full_name": "Attacker",
        "email": "attacker@example.com",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!",
        "role": "admin",  # Attacker attempts privilege escalation
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    # Must strictly be assigned agent role regardless of payload
    assert data["role"] == "agent"
    assert data["approval_status"] == "pending"


def test_pending_user_cannot_login_or_access_crm(client, pending_user):
    # Attempt login
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": pending_user.email, "password": "Password123!"},
    )
    assert login_resp.status_code == 403
    assert "pending approval" in login_resp.json()["detail"].lower()

    # Attempt direct token access
    token = create_access_token(subject=pending_user.id, role=pending_user.role)
    leads_resp = client.get(
        "/api/v1/leads",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert leads_resp.status_code == 403
    assert "pending approval" in leads_resp.json()["detail"].lower()


def test_admin_approval_grants_agent_role(client, admin_token, pending_user, db):
    # Admin approves pending user
    response = client.put(
        f"/api/v1/users/{pending_user.id}/approval",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"action": "approve"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["approval_status"] == "approved"
    assert data["role"] == "agent"

    # Now the approved user can log in
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": pending_user.email, "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()


def test_deactivated_account_loses_access(client, deactivated_user, db):
    # Deactivated user cannot log in
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": deactivated_user.email, "password": "Password123!"},
    )
    assert login_resp.status_code == 403
    assert "deactivated" in login_resp.json()["detail"].lower()

    # Existing active token also gets rejected
    token = create_access_token(subject=deactivated_user.id, role=deactivated_user.role)
    leads_resp = client.get(
        "/api/v1/leads",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert leads_resp.status_code == 403
    assert "deactivated" in leads_resp.json()["detail"].lower()


def test_rejected_user_shows_access_denied_and_can_reapply(client, admin_token, pending_user, db):
    # 1. Admin rejects the pending user
    rej_resp = client.put(
        f"/api/v1/users/{pending_user.id}/approval",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"action": "reject"},
    )
    assert rej_resp.status_code == 200
    assert rej_resp.json()["approval_status"] == "rejected"
    assert rej_resp.json()["is_active"] is False

    # 2. When the rejected user tries to log in, it must show Access Denied
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": pending_user.email, "password": "Password123!"},
    )
    assert login_resp.status_code == 403
    error_detail = login_resp.json()["detail"].lower()
    assert "access denied" in error_detail
    assert "rejected" in error_detail
    assert "try again" in error_detail

    # 3. Rejected user tries to re-apply for access via registration endpoint
    reapply_resp = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Updated Candidate Name",
            "email": pending_user.email,
            "password": "NewSecurePassword123!",
            "confirm_password": "NewSecurePassword123!",
        },
    )
    assert reapply_resp.status_code == 201
    assert reapply_resp.json()["approval_status"] == "pending"
    assert reapply_resp.json()["is_active"] is False


def test_cannot_activate_unapproved_or_rejected_agent(client, admin_token, pending_user):
    # Cannot activate a pending user
    act_resp = client.put(
        f"/api/v1/users/{pending_user.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": True},
    )
    assert act_resp.status_code == 400
    assert "cannot activate" in act_resp.json()["detail"].lower()

    # Reject user
    client.put(
        f"/api/v1/users/{pending_user.id}/approval",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"action": "reject"},
    )

    # Cannot activate a rejected user
    act_resp2 = client.put(
        f"/api/v1/users/{pending_user.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": True},
    )
    assert act_resp2.status_code == 400
    assert "cannot activate" in act_resp2.json()["detail"].lower()


def test_rejected_agent_never_in_active_agents_list(client, admin_token, pending_user):
    # Reject user
    client.put(
        f"/api/v1/users/{pending_user.id}/approval",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"action": "reject"},
    )

    # Fetch active agents
    agents_resp = client.get(
        "/api/v1/users/agents",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert agents_resp.status_code == 200
    agent_ids = [a["id"] for a in agents_resp.json()]
    assert pending_user.id not in agent_ids

