"""Seed bundled templates from a ``rune-templates`` checkout into the database.

The bundle directory contains JSON files organised as
``templates/<category>/<external_id>.json``. On startup (or via the
``api-seed-templates`` CLI), this module:

1. Walks the bundle, parsing each file through ``TemplateBundleEntry`` so any
   invalid template fails the seed atomically.
2. Upserts each row into ``workflow_templates`` keyed by ``external_id``. Entries
   with ``official: true`` land as ``source="official"`` (Official tab); the
   rest land as ``source="user", created_by=None, is_public=True`` (Community
   tab) alongside instance-saved community templates.
3. Removes orphaned bundle rows (rows with an ``external_id`` no longer in the
   bundle). User-saved templates have a NULL ``external_id`` and are never
   touched.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import WorkflowTemplate
from src.templates.schemas import TemplateBundleEntry


logger = logging.getLogger(__name__)


@dataclass(slots=True)
class SeedResult:
    """Summary returned to callers (lifespan log, CLI output, tests)."""

    inserted: int = 0
    updated: int = 0
    removed: int = 0
    skipped: int = 0
    total_in_bundle: int = 0


class BundleParseError(Exception):
    """Raised when a bundle file is structurally invalid.

    The seeder aborts before touching the database so partial state can't leak
    in. The error message names the offending file so contributors can fix it.
    """


def _load_bundle_entries(bundle_dir: Path) -> list[tuple[Path, TemplateBundleEntry]]:
    """Read and validate every ``*.json`` file under ``bundle_dir``.

    The directory layout is conventional but not enforced here - the
    ``rune-templates`` repo's ``validate.mjs`` is responsible for matching
    filename ↔ ``external_id`` and parent-dir ↔ ``category``. This function
    only enforces schema validity so a malformed bundle never reaches the DB.
    """
    if not bundle_dir.exists():
        logger.warning(
            "Templates bundle directory does not exist: %s. "
            "Skipping seed; run `git submodule update --init --recursive` to populate it.",
            bundle_dir,
        )
        return []

    entries: list[tuple[Path, TemplateBundleEntry]] = []
    for path in sorted(bundle_dir.rglob("*.json")):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise BundleParseError(f"{path}: invalid JSON - {e}") from e

        try:
            entry = TemplateBundleEntry.model_validate(raw)
        except ValueError as e:
            raise BundleParseError(f"{path}: does not match schema - {e}") from e

        entries.append((path, entry))

    return entries


def _entry_to_row_values(entry: TemplateBundleEntry) -> dict:
    """Translate a bundle entry into a row payload for upsert.

    Keeps the SQL-level keys aligned with ``WorkflowTemplate`` columns so the
    same dict can drive both ``insert`` and ``on_conflict_do_update``.

    Bundle entries land in one of two row patterns depending on ``official``:
    Rune-curated entries get ``source="official"`` and surface in the Official
    gallery tab; contributor entries get ``source="user"`` with no owner and
    surface in the Community tab alongside instance-saved templates.
    """
    return {
        "external_id": entry.external_id,
        "name": entry.name,
        "description": entry.description,
        "category": entry.category,
        "icon": entry.icon,
        "tags": entry.tags,
        "author_name": entry.author.name if entry.author else None,
        "author_url": entry.author.url if entry.author else None,
        "workflow_data": entry.workflow_data.model_dump(
            exclude_none=True, mode="json"
        ),
        "source": "official" if entry.official else "user",
        "is_public": True,
        "created_by": None,
    }


async def seed_templates_from_bundle(
    db: AsyncSession, bundle_dir: Path
) -> SeedResult:
    """Seed every template in the bundle into the DB and remove orphans.

    The function is idempotent - running it repeatedly with the same bundle
    converges to the same row set. Failures during parsing abort before any
    DB writes happen; failures during the upsert/delete leg are bubbled up to
    the caller so the transaction can be rolled back.
    """
    entries = _load_bundle_entries(Path(bundle_dir))
    if not entries:
        return SeedResult()

    bundled_ids = [entry.external_id for _, entry in entries]

    # Bundle-sourced rows are uniquely identified by ``external_id`` (which is
    # only set on rows the seeder writes). Counting "existed before this run"
    # off ``external_id`` alone keeps the metric correct whether the row was
    # previously seeded as official or as a community contribution.
    existing_ids_stmt = select(WorkflowTemplate.external_id).where(
        WorkflowTemplate.external_id.in_(bundled_ids),
        WorkflowTemplate.external_id.is_not(None),
    )
    existing_ids = set((await db.exec(existing_ids_stmt)).all())

    inserted = 0
    updated = 0
    for _, entry in entries:
        values = _entry_to_row_values(entry)
        # ``WorkflowTemplate.__table__`` exposes the underlying SQLAlchemy
        # ``Table`` so we can use the dialect-specific upsert syntax.
        stmt = pg_insert(WorkflowTemplate.__table__).values(**values)
        update_set = {k: v for k, v in values.items() if k != "external_id"}
        stmt = stmt.on_conflict_do_update(
            index_elements=["external_id"], set_=update_set
        )
        await db.exec(stmt)

        if entry.external_id in existing_ids:
            updated += 1
        else:
            inserted += 1

    # Remove orphaned bundle rows (in the DB with an external_id but no longer
    # present in the bundle). Covers both official and community-bundle rows;
    # user-saved templates have ``external_id IS NULL`` and are untouched.
    orphan_stmt = delete(WorkflowTemplate).where(
        WorkflowTemplate.external_id.is_not(None),
        WorkflowTemplate.external_id.not_in(bundled_ids),
    )
    result = await db.exec(orphan_stmt)
    removed = result.rowcount or 0

    await db.commit()

    return SeedResult(
        inserted=inserted,
        updated=updated,
        removed=removed,
        total_in_bundle=len(entries),
    )
