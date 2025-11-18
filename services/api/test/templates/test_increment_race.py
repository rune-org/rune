import asyncio
import os
import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.templates.service import TemplateService
from src.db.models import WorkflowTemplate


async def _create_template(engine) -> int:
    """Create a template in the DB using a separate connection and return its id.

    We create the template on a fresh connection/transaction so it's visible to
    other concurrent connections used by the workers.
    """
    conn = await engine.connect()
    try:
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            tpl = WorkflowTemplate(
                name="concurrent-template",
                description="",
                category="test",
                workflow_data={},
                is_public=True,
                created_by=None,
                usage_count=0,
            )
            session.add(tpl)
            await session.commit()
            await session.refresh(tpl)
            return tpl.id
        finally:
            await session.close()
    finally:
        await conn.close()


@pytest.fixture
async def template_id(test_engine):
    return await _create_template(test_engine)


async def _worker_increment(engine, template_id: int):
    conn = await engine.connect()
    try:
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            svc = TemplateService(session)
            await svc.increment_usage_count(template_id)
        finally:
            await session.close()
    finally:
        await conn.close()


async def _read_usage(engine, template_id: int) -> int:
    conn = await engine.connect()
    try:
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            stmt = select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
            result = await session.exec(stmt)
            tpl = result.one()
            return tpl.usage_count
        finally:
            await session.close()
    finally:
        await conn.close()


async def run_concurrent(engine, template_id: int, workers: int):
    tasks = [
        asyncio.create_task(_worker_increment(engine, template_id))
        for _ in range(workers)
    ]
    await asyncio.gather(*tasks)


async def _reset_usage(engine, template_id: int):
    """Reset usage_count to 0 for the given template (used between runs)."""
    conn = await engine.connect()
    try:
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            stmt = select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
            result = await session.exec(stmt)
            tpl = result.one()
            tpl.usage_count = 0
            await session.commit()
        finally:
            await session.close()
    finally:
        await conn.close()


DEFAULT_WORKERS = 200


async def test_increment_usage_count_concurrent(test_engine, template_id):
    """Simulate concurrent increments from multiple database sessions.

    The concurrency level is controlled by the `WORKERS` environment variable
    or the in-file constant `DEFAULT_WORKERS`. To change the number of
    concurrent workers for ad-hoc runs, set the env var in PowerShell before
    running pytest, e.g.:

        $env:WORKERS = '500'
        pytest -q test/templates/test_increment_race.py::test_increment_usage_count_concurrent

    Optionally repeat the measurement multiple times by setting `RACE_RUNS`.
    """
    # prefer explicit env var override, fallback to the constant
    workers = int(os.getenv("WORKERS", str(DEFAULT_WORKERS)))
    runs = int(os.getenv("RACE_RUNS", "1"))

    for i in range(runs):
        # ensure starting from 0
        await _reset_usage(test_engine, template_id)

        # Run concurrent increments
        await run_concurrent(test_engine, template_id, workers)

        # Read final usage_count and assert it equals number of workers
        final = await _read_usage(test_engine, template_id)

        assert final == workers, (
            f"run {i + 1}/{runs}: expected usage_count {workers}, got {final}"
        )
