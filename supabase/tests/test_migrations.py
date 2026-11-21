from pathlib import Path


ROOT = Path(__file__).parents[1]


def migration_text() -> str:
    return "\n".join(path.read_text(encoding="utf-8") for path in sorted((ROOT / "migrations").glob("*.sql")))


def test_user_data_tables_enable_row_level_security():
    sql = migration_text().lower()

    for table in ("profiles", "user_settings", "learning_states", "review_events", "piece_progress"):
        assert f"create table public.{table}" in sql
        assert f"alter table public.{table} enable row level security" in sql
        assert f"on public.{table}" in sql


def test_review_event_path_is_idempotent_and_locks_state():
    sql = migration_text().lower()

    assert "event_id uuid primary key" in sql
    assert "for update" in sql
    assert "on conflict (user_id, card_id)" in sql
    assert "create trigger" in sql


def test_review_grades_and_manual_mastery_are_constrained():
    sql = migration_text().lower()

    assert "again" in sql
    assert "hard" in sql
    assert "good" in sql
    assert "easy" in sql
    assert "mastered" in sql
