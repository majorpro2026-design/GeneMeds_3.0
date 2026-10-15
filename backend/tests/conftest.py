import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
from app.database import engine
from app.auth.security import create_access_token
from app.auth.dependencies import SESSION_COOKIE_NAME

@pytest.fixture(scope="session")
def db_engine():
    """Provides session-wide database engine."""
    return engine

@pytest.fixture(scope="session")
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def auth_headers_and_cookies():
    """Generate authentication cookies for an existing or test doctor/HCP."""
    # HCP id 1 or doctor_id from core.hcp_account
    from sqlalchemy import text
    with engine.connect() as conn:
        hcp_id = conn.execute(text("SELECT id FROM core.hcp_account WHERE is_active = true ORDER BY id LIMIT 1")).scalar()
        if not hcp_id:
            hcp_id = 1
    token = create_access_token(hcp_id=hcp_id)
    return {
        "cookies": {SESSION_COOKIE_NAME: token},
        "hcp_id": hcp_id,
    }
