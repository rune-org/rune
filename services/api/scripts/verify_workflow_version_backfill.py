"""Post-migration verification for workflow version backfill.

Run after applying the workflow versioning migration to verify that workflow
shell pointers and derived state are consistent.
"""

import asyncio
import sys

from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.config import create_database_engine


CHECKS = {
    "missing_latest_pointer_targets": """
        SELECT COUNT(*)
        FROM workflows w
        LEFT JOIN workflow_versions latest ON latest.id = w.latest_version_id
        WHERE w.latest_version_id IS NOT NULL AND latest.id IS NULL
    """,
    "missing_published_pointer_targets": """
        SELECT COUNT(*)
        FROM workflows w
        LEFT JOIN workflow_versions published ON published.id = w.published_version_id
        WHERE w.published_version_id IS NOT NULL AND published.id IS NULL
    """,
    "inactive_flag_mismatch": """
        SELECT COUNT(*)
        FROM workflows
        WHERE is_active <> (published_version_id IS NOT NULL)
    """,
    "latest_pointer_not_max_version": """
        SELECT COUNT(*)
        FROM workflows w
        JOIN workflow_versions latest ON latest.id = w.latest_version_id
        JOIN (
            SELECT workflow_id, MAX(version) AS max_version
            FROM workflow_versions
            GROUP BY workflow_id
        ) mx ON mx.workflow_id = w.id
        WHERE latest.version <> mx.max_version
    """,
}


async def main() -> int:
    engine = create_database_engine()
    async with AsyncSession(engine) as session:
        failures: list[str] = []

        for name, query in CHECKS.items():
            result = await session.exec(text(query))
            count = result.one()[0]
            if count:
                failures.append(f"{name}: {count}")

    await engine.dispose()

    if failures:
        print("Workflow version backfill verification failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print("Workflow version backfill verification passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
