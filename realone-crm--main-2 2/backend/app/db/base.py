# Import all the models, so that Base has them before being
# imported by Alembic
from app.db.database import Base  # noqa
from app.models.user import User  # noqa
from app.models.lead import Lead  # noqa
from app.models.activity import LeadActivity  # noqa
from app.models.meta_integration import MetaIntegration  # noqa
from app.models.meta_sync_log import MetaSyncLog  # noqa
from app.models.assignment_state import RoundRobinState  # noqa
