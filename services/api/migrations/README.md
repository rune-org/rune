# Database Migrations

This project uses [Alembic](https://alembic.sqlalchemy.org/) for database migrations with SQLModel/SQLAlchemy.

## Quick Reference

| Command                                    | Description                           |
| ------------------------------------------ | ------------------------------------- |
| `alembic upgrade head`                     | Apply all pending migrations          |
| `alembic downgrade -1`                     | Rollback last migration               |
| `alembic revision --autogenerate -m "msg"` | Generate migration from model changes |
| `alembic current`                          | Show current database version         |
| `alembic history`                          | Show migration history                |

## How It Works

```
┌─────────────────────┐
│  src/db/models.py   │  ← Source of truth (Python classes)
└──────────┬──────────┘
           │
           │  alembic revision --autogenerate -m "description"
           │  (Compares models vs DB, generates migration file)
           ▼
┌─────────────────────┐
│  migrations/versions│  ← Migration files (version history)
│  2025_11_30_xxx.py  │
└──────────┬──────────┘
           │
           │  alembic upgrade head
           │  (Executes migrations, updates DB)
           ▼
┌─────────────────────┐
│     PostgreSQL      │  ← Database (tables match models)
└─────────────────────┘
```

## Workflow

### Making Schema Changes

1. **Modify models** in `src/db/models.py`
2. **Generate migration**:
   ```bash
   alembic revision --autogenerate -m "add_user_avatar"
   ```
3. **Review** the generated file in `migrations/versions/`
4. **Apply migration**:
   ```bash
   alembic upgrade head
   ```

### Rolling Back

```bash
# Rollback one migration
alembic downgrade -1

# Rollback to specific version
alembic downgrade <revision_id>

# Rollback all migrations
alembic downgrade base
```

### Checking Status

```bash
# Current version
alembic current

# Migration history
alembic history

# Show pending migrations
alembic history --indicate-current
```

## Running Commands

From `services/api` directory with venv activated:

```bash
# Windows PowerShell
.\.venv\Scripts\python.exe -m alembic upgrade head

# Linux/Mac
python -m alembic upgrade head
```

Or use Makefile from project root (Linux/Mac):

```bash
make db-migrate              # Apply migrations
make db-revision msg="xxx"   # Generate new migration
make db-rollback             # Rollback one
make db-reset                # Reset DB completely
```

## File Structure

```
services/api/
├── alembic.ini              # Alembic configuration
├── migrations/
│   ├── env.py               # Migration environment (connects to DB)
│   ├── script.py.mako       # Template for new migrations
│   └── versions/            # Migration files
│       └── 2025_11_30_xxxx_initial_schema.py
└── src/db/
    └── models.py            # SQLModel definitions (source of truth)
```

## Important Notes

1. **Always modify `models.py` first**, then generate migrations
2. **Review generated migrations** before applying - autogenerate isn't perfect
3. **Never edit applied migrations** - create new ones instead
4. **Commit migration files** to version control
5. Running `upgrade head` multiple times is safe - it only applies pending migrations

## Common Issues

### "Can't locate revision 'xxx'"

The database references a migration file that doesn't exist. Fix:

```sql
-- Connect to database and clear version
DELETE FROM alembic_version;
```

Then run `alembic upgrade head` again.

### "Relation already exists"

Tables already exist but Alembic doesn't know. Fix:

```bash
alembic stamp head  # Mark DB as current without running migrations
```

### Migration Not Detecting Changes

- Ensure models are imported in `migrations/env.py`
- Check that models inherit from `SQLModel` with `table=True`
