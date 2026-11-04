import pytest
from app.models.lead import Lead
from app.models.activity import LeadActivity


def test_lead_visibility_scoping(client, admin_token, agent1_token, agent2_token, agent1_user, agent2_user, db):
    # Create lead 1 for agent 1
    lead1 = Lead(
        full_name="Lead For Agent 1",
        phone="+1111111111",
        email="l1@test.com",
        source="Website",
        assigned_agent_id=agent1_user.id,
    )
    # Create lead 2 for agent 2
    lead2 = Lead(
        full_name="Lead For Agent 2",
        phone="+2222222222",
        email="l2@test.com",
        source="Phone Call",
        assigned_agent_id=agent2_user.id,
    )
    # Create unassigned lead
    lead3 = Lead(
        full_name="Unassigned Lead",
        phone="+3333333333",
        email="l3@test.com",
        source="Referral",
        assigned_agent_id=None,
    )
    db.add_all([lead1, lead2, lead3])
    db.commit()

    # 1. Admin sees all 3 leads
    resp_admin = client.get("/api/v1/leads", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp_admin.status_code == 200
    admin_data = resp_admin.json()
    assert admin_data["total"] == 3

    # 2. Agent 1 sees only lead 1
    resp_agent1 = client.get("/api/v1/leads", headers={"Authorization": f"Bearer {agent1_token}"})
    assert resp_agent1.status_code == 200
    agent1_data = resp_agent1.json()
    assert agent1_data["total"] == 1
    assert agent1_data["items"][0]["id"] == lead1.id

    # 3. Agent 2 sees only lead 2
    resp_agent2 = client.get("/api/v1/leads", headers={"Authorization": f"Bearer {agent2_token}"})
    assert resp_agent2.status_code == 200
    agent2_data = resp_agent2.json()
    assert agent2_data["total"] == 1
    assert agent2_data["items"][0]["id"] == lead2.id


def test_agent_cannot_access_another_agents_lead_details(client, agent1_token, agent2_user, db):
    # Lead assigned to Agent 2
    other_lead = Lead(
        full_name="Secret Lead",
        phone="+9999999999",
        assigned_agent_id=agent2_user.id,
    )
    db.add(other_lead)
    db.commit()

    # Agent 1 attempts to access it by ID in URL
    resp = client.get(
        f"/api/v1/leads/{other_lead.id}",
        headers={"Authorization": f"Bearer {agent1_token}"},
    )
    assert resp.status_code == 403
    assert "not authorized" in resp.json()["detail"].lower()


def test_agent_cannot_reassign_lead(client, agent1_token, agent1_user, agent2_user, db):
    lead = Lead(
        full_name="My Lead",
        phone="+1234567890",
        assigned_agent_id=agent1_user.id,
    )
    db.add(lead)
    db.commit()

    # Agent 1 tries to change assigned_agent_id to Agent 2
    resp = client.put(
        f"/api/v1/leads/{lead.id}",
        headers={"Authorization": f"Bearer {agent1_token}"},
        json={"assigned_agent_id": agent2_user.id},
    )
    assert resp.status_code == 403
    assert "not permitted to reassign" in resp.json()["detail"].lower()


def test_edit_lead_updates_db_and_activity_history(client, agent1_token, agent1_user, db):
    lead = Lead(
        full_name="Initial Name",
        phone="+1234567890",
        status="New",
        assigned_agent_id=agent1_user.id,
    )
    db.add(lead)
    db.commit()

    # Update status and property type
    resp = client.put(
        f"/api/v1/leads/{lead.id}",
        headers={"Authorization": f"Bearer {agent1_token}"},
        json={
            "full_name": "Updated Name",
            "status": "Qualified",
            "property_type": "Penthouse",
        },
    )
    assert resp.status_code == 200

    # Verify lead in DB
    db.refresh(lead)
    assert lead.full_name == "Updated Name"
    assert lead.status == "Qualified"
    assert lead.property_type == "Penthouse"

    # Verify activities recorded
    activities = db.query(LeadActivity).filter(LeadActivity.lead_id == lead.id).all()
    types = [a.activity_type for a in activities]
    assert "status_changed" in types
    assert "lead_edited" in types


def test_lead_archival_and_restoration(client, admin_token, agent1_token, agent1_user, db):
    lead = Lead(
        full_name="Archive Target",
        phone="+1234567890",
        assigned_agent_id=agent1_user.id,
    )
    db.add(lead)
    db.commit()

    # Agent cannot archive
    resp_agent = client.post(
        f"/api/v1/leads/{lead.id}/archive",
        headers={"Authorization": f"Bearer {agent1_token}"},
    )
    assert resp_agent.status_code == 403

    # Admin archives lead
    resp_admin = client.post(
        f"/api/v1/leads/{lead.id}/archive",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_admin.status_code == 200
    assert resp_admin.json()["archived_at"] is not None

    # Lead no longer in default active list
    resp_list = client.get("/api/v1/leads", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp_list.json()["total"] == 0

    # Lead visible in archived_only list
    resp_archived = client.get("/api/v1/leads?archived_only=true", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp_archived.json()["total"] == 1

    # Admin restores lead
    resp_restore = client.post(
        f"/api/v1/leads/{lead.id}/restore",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_restore.status_code == 200
    assert resp_restore.json()["archived_at"] is None
