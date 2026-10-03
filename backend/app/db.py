"""TerraTrace Database Setup"""
from sqlmodel import SQLModel, Session, create_engine
from .config import settings

# Create engine — use check_same_thread=False for SQLite with async
connect_args = {"check_same_thread": False}
engine = create_engine(settings.DATABASE_URL, echo=settings.DEBUG, connect_args=connect_args)


def create_db_and_tables():
    """Create all database tables."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """Dependency to get a database session."""
    with Session(engine) as session:
        yield session
