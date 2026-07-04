"""
financeos_core/db/connection.py
--------------------------------
PostgreSQL connection manager for the FinanceOS Core sync engine.

DATABASE_URL is read from the existing .env file (same mechanism as QBO creds).
Add to .env:
    DATABASE_URL=postgresql://user:password@host:5432/dbname

Never logs credentials. Raises a clear error if DATABASE_URL is missing.
"""

import os
import sys
import psycopg2
import psycopg2.extras

# Re-use the existing .env loader — avoids duplicating credential logic.
# This import works because the sync engine is always run from the qbo_extract root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from connectors.quickbooks import load_env


def get_database_url() -> str:
    """
    Returns DATABASE_URL from environment or .env file.
    Raises RuntimeError if not found.
    """
    # Environment variable takes precedence (CI / GitHub Actions)
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    # Fall back to .env file
    try:
        env = load_env()
        url = env.get("DATABASE_URL")
    except SystemExit:
        url = None
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. "
            "Add it to .env or set it as an environment variable before running the sync engine."
        )
    return url


def get_connection() -> psycopg2.extensions.connection:
    """
    Return a new psycopg2 connection to the FinanceOS Core Database.
    Caller is responsible for closing the connection.

    Uses psycopg2.extras.RealDictCursor as default cursor factory so that
    rows behave like dicts everywhere in the sync engine.
    """
    db_url = get_database_url()
    conn = psycopg2.connect(
        db_url,
        cursor_factory=psycopg2.extras.RealDictCursor,
    )
    conn.autocommit = False
    return conn
