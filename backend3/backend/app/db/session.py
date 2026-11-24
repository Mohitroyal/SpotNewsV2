import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

db_url = settings.DATABASE_URL or ""
is_testing = "pytest" in sys.modules or "unittest" in sys.modules or os.environ.get("TESTING") == "1"

if is_testing:
    db_url = "sqlite:///./test_temp.db"
else:
    # Normalize postgres schema for SQLAlchemy compatibility
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+psycopg2://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    # Supabase Connection Pooler:
    # Port 5432 (Session Mode) is read-write. Port 6543 (Transaction Mode) has transaction_read_only=on in Supabase.
    # Ensure port 5432 is always used so INSERT/UPDATE/DELETE queries succeed.
    if "pooler.supabase.com" in db_url and ":6543/" in db_url:
        db_url = db_url.replace(":6543/", ":5432/", 1)

    if not db_url:
        print("[WARNING] DATABASE_URL is empty or not set. Falling back to local SQLite.")
        db_url = "sqlite:///./newscraft.db"

Base = declarative_base()

if db_url.startswith("sqlite"):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    # Ensure tables exist in SQLite fallback
    try:
        import app.models  # noqa
        Base.metadata.create_all(bind=engine)
    except Exception as _e:
        print(f"[DB] SQLite metadata create note: {_e}")
else:
    engine = create_engine(
        db_url,
        pool_size=15,
        max_overflow=25,
        pool_recycle=300,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
