from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import Base

DATABASE_URL = "sqlite:///./hotel_reviews.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate()


def _migrate():
    """Add new columns to existing tables without dropping data."""
    migrations = [
        "ALTER TABLE hotels ADD COLUMN photo_url TEXT",
        "ALTER TABLE hotels ADD COLUMN yelp_id TEXT",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists — safe to ignore


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
