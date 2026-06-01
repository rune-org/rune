"""Seed the bundled rune-templates into the database from the CLI.

This mirrors what the lifespan does on startup when ``SEED_TEMPLATES=true``,
but lets ops/CI run the seed step on demand without restarting the API.

Usage::

    uv run python scripts/seed_templates.py
"""

import asyncio
import sys
from pathlib import Path

_API_ROOT = Path(__file__).resolve().parent.parent
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

from sqlmodel.ext.asyncio.session import AsyncSession  # noqa: E402

from src.core.config import get_settings  # noqa: E402
from src.db.config import get_async_engine, init_db  # noqa: E402
from src.templates.seeder import seed_templates_from_bundle  # noqa: E402


async def main() -> int:
    settings = get_settings()
    bundle_dir = Path(settings.rune_templates_bundle_dir)
    if not bundle_dir.is_absolute():
        bundle_dir = (_API_ROOT / bundle_dir).resolve()

    print(f"Seeding templates from {bundle_dir}")
    await init_db()

    async with AsyncSession(get_async_engine(), expire_on_commit=False) as session:
        result = await seed_templates_from_bundle(session, bundle_dir)

    print(
        f"Done. inserted={result.inserted} updated={result.updated} "
        f"removed={result.removed} total_in_bundle={result.total_in_bundle}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
