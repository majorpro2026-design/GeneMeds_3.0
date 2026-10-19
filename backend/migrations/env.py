from alembic import context

from app.database import engine

# Raw SQL migrations only (no ORM metadata), matching the project's text() style.
target_metadata = None


def run_migrations_online() -> None:
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    raise RuntimeError("Offline mode is not supported in this project.")

run_migrations_online()