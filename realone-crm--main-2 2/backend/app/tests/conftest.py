import os
import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.database import Base, get_db
from app.models.user import User, UserRole, ApprovalStatus
from app.models.assignment_state import RoundRobinState
from app.models.meta_integration import MetaIntegration
from app.core.security import get_password_hash, create_access_token
from app.main import app

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "postgresql+psycopg2://ishan@localhost:5432/real_estate_crm_test")

test_engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    # Clean all tables before each test
    session.execute(text("TRUNCATE TABLE lead_activities, leads, meta_sync_logs, meta_integrations, round_robin_state, users RESTART IDENTITY CASCADE;"))
    session.commit()

    # Re-initialize singleton state row
    session.add(RoundRobinState(id=1, total_assigned_count=0))
    session.add(MetaIntegration(
        id=1,
        is_connected=False,
        field_mappings={"full_name": "full_name", "phone_number": "phone", "email": "email"},
        selected_forms=[],
    ))
    session.commit()

    yield session

    session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db):
    user = User(
        full_name="Test Admin",
        email="test_admin@test.com",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.ADMIN.value,
        approval_status=ApprovalStatus.APPROVED.value,
        is_active=True,
        approved_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user):
    return create_access_token(subject=admin_user.id, role=admin_user.role)


@pytest.fixture
def agent1_user(db, admin_user):
    user = User(
        full_name="Agent One",
        email="agent1@test.com",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.AGENT.value,
        approval_status=ApprovalStatus.APPROVED.value,
        is_active=True,
        approved_at=datetime.utcnow(),
        approved_by=admin_user.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def agent1_token(agent1_user):
    return create_access_token(subject=agent1_user.id, role=agent1_user.role)


@pytest.fixture
def agent2_user(db, admin_user):
    user = User(
        full_name="Agent Two",
        email="agent2@test.com",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.AGENT.value,
        approval_status=ApprovalStatus.APPROVED.value,
        is_active=True,
        approved_at=datetime.utcnow(),
        approved_by=admin_user.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def agent2_token(agent2_user):
    return create_access_token(subject=agent2_user.id, role=agent2_user.role)


@pytest.fixture
def agent3_user(db, admin_user):
    user = User(
        full_name="Agent Three",
        email="agent3@test.com",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.AGENT.value,
        approval_status=ApprovalStatus.APPROVED.value,
        is_active=True,
        approved_at=datetime.utcnow(),
        approved_by=admin_user.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def agent3_token(agent3_user):
    return create_access_token(subject=agent3_user.id, role=agent3_user.role)


@pytest.fixture
def pending_user(db):
    user = User(
        full_name="Pending Agent",
        email="pending@test.com",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.AGENT.value,
        approval_status=ApprovalStatus.PENDING.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def deactivated_user(db, admin_user):
    user = User(
        full_name="Deactivated Agent",
        email="deactivated@test.com",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.AGENT.value,
        approval_status=ApprovalStatus.APPROVED.value,
        is_active=False,
        approved_at=datetime.utcnow(),
        approved_by=admin_user.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
