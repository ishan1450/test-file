import pytest
import concurrent.futures
from app.models.lead import Lead
from app.models.user import User, UserRole, ApprovalStatus
from app.models.assignment_state import RoundRobinState
from app.services.assignment_service import assign_lead_round_robin, reassign_lead_manually
from app.services.import_service import process_single_meta_lead
from app.tests.conftest import TestingSessionLocal


def test_six_leads_distributed_two_per_agent(db, agent1_user, agent2_user, agent3_user):
    """
    Verify 6 consecutive unique leads rotate strictly:
    Lead 1 -> Agent 1
    Lead 2 -> Agent 2
    Lead 3 -> Agent 3
    Lead 4 -> Agent 1
    Lead 5 -> Agent 2
    Lead 6 -> Agent 3
    """
    assigned_agents = []
    for i in range(1, 7):
        lead = Lead(full_name=f"Lead {i}", phone=f"+100000000{i}")
        db.add(lead)
        db.flush()
        assigned = assign_lead_round_robin(db, lead)
        db.commit()
        assigned_agents.append(assigned.id)

    expected = [
        agent1_user.id,
        agent2_user.id,
        agent3_user.id,
        agent1_user.id,
        agent2_user.id,
        agent3_user.id,
    ]
    assert assigned_agents == expected

    # State total count
    state = db.query(RoundRobinState).filter(RoundRobinState.id == 1).first()
    assert state.total_assigned_count == 6
    assert state.last_assigned_agent_id == agent3_user.id


def test_rotation_persists_across_restart(db, agent1_user, agent2_user, agent3_user):
    """
    Assign 1 lead (to Agent 1), close session, create new session, assign next lead.
    Must go to Agent 2.
    """
    lead1 = Lead(full_name="Lead 1", phone="+100000001")
    db.add(lead1)
    db.flush()
    assign1 = assign_lead_round_robin(db, lead1)
    db.commit()
    assert assign1.id == agent1_user.id

    # Simulate restart by creating new independent DB session
    new_db = TestingSessionLocal()
    try:
        lead2 = Lead(full_name="Lead 2", phone="+100000002")
        new_db.add(lead2)
        new_db.flush()
        assign2 = assign_lead_round_robin(new_db, lead2)
        new_db.commit()
        assert assign2.id == agent2_user.id
    finally:
        new_db.close()


def test_duplicate_events_do_not_advance_rotation(db, agent1_user, agent2_user, agent3_user):
    """
    Sending duplicate Meta lead IDs must not create duplicate records, nor advance rotation.
    """
    raw_lead = {
        "id": "meta_lead_12345",
        "created_time": "2026-10-17T12:00:00+0000",
        "field_data": [
            {"name": "full_name", "values": ["Alice Cooper"]},
            {"name": "phone_number", "values": ["+1555555555"]},
            {"name": "email", "values": ["alice@example.com"]},
        ],
    }

    # 1st attempt: New lead -> assigned to Agent 1
    l1, status1, _ = process_single_meta_lead(db, raw_lead)
    assert status1 == "success"
    assert l1.assigned_agent_id == agent1_user.id

    # 2nd attempt: Duplicate ID -> skipped
    l2, status2, _ = process_single_meta_lead(db, raw_lead)
    assert status2 == "skipped_duplicate"
    assert l2.id == l1.id
    assert l2.assigned_agent_id == agent1_user.id

    # Next different lead -> must go to Agent 2 (rotation was NOT consumed by duplicate)
    next_raw = {
        "id": "meta_lead_99999",
        "field_data": [{"name": "full_name", "values": ["Bob Dylan"]}, {"name": "phone_number", "values": ["+1666666666"]}],
    }
    l3, status3, _ = process_single_meta_lead(db, next_raw)
    assert status3 == "success"
    assert l3.assigned_agent_id == agent2_user.id


def test_failed_imports_do_not_consume_turn(db, agent1_user, agent2_user):
    # Missing ID causes failure
    invalid_raw = {"field_data": []}
    _, status, err = process_single_meta_lead(db, invalid_raw)
    assert status == "failed"

    # State total count remains 0
    state = db.query(RoundRobinState).filter(RoundRobinState.id == 1).first()
    assert state.total_assigned_count == 0

    # Next valid lead goes to Agent 1
    valid_raw = {
        "id": "meta_lead_valid_1",
        "field_data": [{"name": "full_name", "values": ["Valid Lead"]}, {"name": "phone_number", "values": ["+1777777777"]}],
    }
    lead, status_valid, _ = process_single_meta_lead(db, valid_raw)
    assert status_valid == "success"
    assert lead.assigned_agent_id == agent1_user.id


def test_deactivated_agent_is_skipped(db, agent1_user, agent2_user, agent3_user):
    """
    Lead 1 -> Agent 1.
    Deactivate Agent 2.
    Lead 2 -> Skips Agent 2, goes to Agent 3!
    """
    lead1 = Lead(full_name="L1", phone="+111")
    db.add(lead1)
    db.flush()
    assign_lead_round_robin(db, lead1)
    db.commit()
    assert lead1.assigned_agent_id == agent1_user.id

    # Deactivate Agent 2
    agent2_user.is_active = False
    db.commit()

    # Lead 2 must go to Agent 3
    lead2 = Lead(full_name="L2", phone="+222")
    db.add(lead2)
    db.flush()
    assign_lead_round_robin(db, lead2)
    db.commit()
    assert lead2.assigned_agent_id == agent3_user.id


def test_admin_manual_reassignment_does_not_reset_rotation(db, admin_user, agent1_user, agent2_user, agent3_user):
    # Assign Lead 1 via round robin (Agent 1)
    lead1 = Lead(full_name="L1", phone="+111")
    db.add(lead1)
    db.flush()
    assign_lead_round_robin(db, lead1)
    db.commit()
    assert lead1.assigned_agent_id == agent1_user.id

    # Admin manually reassigns Lead 1 to Agent 3
    reassign_lead_manually(db, lead1, agent3_user.id, admin_user)
    db.commit()
    assert lead1.assigned_agent_id == agent3_user.id

    # Automatic round-robin rotation state was NOT reset:
    # Next automatic lead must still go to Agent 2!
    lead2 = Lead(full_name="L2", phone="+222")
    db.add(lead2)
    db.flush()
    assign_lead_round_robin(db, lead2)
    db.commit()
    assert lead2.assigned_agent_id == agent2_user.id


def test_concurrent_imports_preserve_round_robin(db, agent1_user, agent2_user, agent3_user):
    """
    Concurrency test: Spawns parallel worker threads simulating concurrent webhook events.
    Verifies that with PostgreSQL row locking (with_for_update), each thread gets a unique rotation.
    """
    def import_concurrent_lead(idx):
        db = TestingSessionLocal()
        try:
            raw = {
                "id": f"concurrent_meta_{idx}",
                "field_data": [
                    {"name": "full_name", "values": [f"Concurrent {idx}"]},
                    {"name": "phone_number", "values": [f"+19999999{idx}"]},
                ],
            }
            lead, status, _ = process_single_meta_lead(db, raw)
            return lead.assigned_agent_id if lead else None
        finally:
            db.close()

    # Run 6 parallel imports across thread pool
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(import_concurrent_lead, range(10, 16)))

    assert len(results) == 6
    assert all(r is not None for r in results)
    # Total count across all 6 assigned leads should be balanced across agents
    counts = {agent_id: results.count(agent_id) for agent_id in set(results)}
    # Each agent should get exactly 2 leads
    for aid, cnt in counts.items():
        assert cnt == 2
