"""
CLI database management router.

Safe endpoints for the RUNE admin shell. Admin authentication required.
Prefix: ``/cli/db``

Endpoints:
    GET  /cli/db/health                — Database health check
    GET  /cli/db/tables                — List tables with statistics
    GET  /cli/db/tables/{name}/data    — Browse table data (read-only)
    POST /cli/db/tables/{name}/truncate — Truncate a single table (admin)

No raw SQL. No schema-dropping operations.
Data manipulation should use the existing domain APIs
(workflows, users, credentials, etc.).
"""

from fastapi import APIRouter, Depends, Query

from src.core.dependencies import require_admin_role
from src.core.exceptions import BadRequest, NotFound
from src.core.responses import ApiResponse
from src.cli.schemas import (
    DBHealthResponse,
    DBTableData,
    DBTableInfo,
)
from src.cli.service import CLIDBService


router = APIRouter(
    prefix="/cli/db",
    tags=["CLI – Database"],
    dependencies=[Depends(require_admin_role)],
)


def _get_service() -> CLIDBService:
    return CLIDBService()


# ------------------------------------------------------------------
# Health
# ------------------------------------------------------------------


@router.get(
    "/health",
    response_model=ApiResponse[DBHealthResponse],
    summary="Database health check",
    description="Comprehensive health check: version, size, latency, counts.",
)
async def db_health(
    service: CLIDBService = Depends(_get_service),
) -> ApiResponse[DBHealthResponse]:
    health = await service.check_health()
    return ApiResponse(
        success=health.connected,
        message="Connected" if health.connected else "Connection failed",
        data=health,
    )


# ------------------------------------------------------------------
# Tables — read-only browsing
# ------------------------------------------------------------------


@router.get(
    "/tables",
    response_model=ApiResponse[list[DBTableInfo]],
    summary="List database tables",
    description="Returns all public tables with estimated row counts and sizes.",
)
async def db_list_tables(
    service: CLIDBService = Depends(_get_service),
) -> ApiResponse[list[DBTableInfo]]:
    tables = await service.list_tables()
    return ApiResponse(
        success=True,
        message=f"Found {len(tables)} tables",
        data=tables,
    )


@router.get(
    "/tables/{table_name}/data",
    response_model=ApiResponse[DBTableData],
    summary="Browse table data",
    description="Retrieve rows from a table (max 500 rows per request).",
)
async def db_table_data(
    table_name: str,
    limit: int = Query(default=100, ge=1, le=500),
    service: CLIDBService = Depends(_get_service),
) -> ApiResponse[DBTableData]:
    try:
        data = await service.get_table_data(table_name, limit=limit)
    except ValueError as exc:
        raise NotFound(detail=str(exc))
    return ApiResponse(
        success=True,
        message=f"Loaded {len(data.rows)} rows from {table_name}",
        data=data,
    )


# ------------------------------------------------------------------
# Data cleanup (admin only, schema-safe)
# ------------------------------------------------------------------


@router.post(
    "/tables/{table_name}/truncate",
    response_model=ApiResponse[str],
    summary="Truncate a single table",
    description=(
        "Deletes all data from the specified table but keeps its schema. "
        "Cannot truncate the migration tracking table."
    ),
)
async def db_truncate_table(
    table_name: str,
    service: CLIDBService = Depends(_get_service),
) -> ApiResponse[str]:
    try:
        await service.truncate_table(table_name)
    except ValueError as exc:
        raise BadRequest(detail=str(exc))
    return ApiResponse(
        success=True,
        message=f"Table '{table_name}' truncated",
        data=f"Truncated {table_name}",
    )
