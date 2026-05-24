from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.dependencies import require_password_changed
from src.core.responses import ApiResponse
from src.db.models import User
from src.templates.categories import (
    TemplateCategory,
    TemplateScope,
    TemplateSort,
    TemplateSource,
    humanise_category,
)
from src.templates.dependencies import get_template_service
from src.templates.schemas import (
    TemplateCategorySummary,
    TemplateCreate,
    TemplateDetail,
    TemplateSummary,
    TemplateWorkflowData,
)
from src.templates.service import TemplateService

router = APIRouter(prefix="/templates", tags=["Templates"])


@router.get("/", response_model=ApiResponse[List[TemplateSummary]])
async def list_templates(
    category: Optional[str] = Query(
        None,
        description="Filter by category slug. Accepts both canonical TemplateCategory values and legacy strings.",
    ),
    source: Optional[TemplateSource] = Query(
        None,
        description="Lower-level filter by storage origin (official or user). Most callers should use ``scope``.",
    ),
    scope: Optional[TemplateScope] = Query(
        None,
        description="Filter by user-facing bucket: official, community (instance-wide public), or personal (only yours).",
    ),
    tags: Optional[List[str]] = Query(
        None,
        description="Filter to templates that have at least one of the given tag slugs.",
    ),
    search: Optional[str] = Query(
        None,
        description="Case-insensitive substring search across name and description.",
    ),
    sort: TemplateSort = Query(
        TemplateSort.FEATURED, description="Ordering applied to the result set."
    ),
    current_user: User = Depends(require_password_changed),
    service: TemplateService = Depends(get_template_service),
) -> ApiResponse[List[TemplateSummary]]:
    """List templates the current user can see, with optional filters and sort."""
    templates = await service.list_all_accessible_templates(
        current_user.id,
        category=category,
        source=source.value if source else None,
        scope=scope,
        tags=tags,
        search=search,
        sort=sort,
    )
    summaries = [TemplateSummary.model_validate(template) for template in templates]
    return ApiResponse(success=True, message="Templates retrieved", data=summaries)


@router.get(
    "/categories",
    response_model=ApiResponse[List[TemplateCategorySummary]],
)
async def list_categories(
    scope: Optional[TemplateScope] = Query(
        None,
        description=(
            "Restrict counts to a single scope (official, community, personal). "
            "Omit to count across every template the user can see."
        ),
    ),
    current_user: User = Depends(require_password_changed),
    service: TemplateService = Depends(get_template_service),
) -> ApiResponse[List[TemplateCategorySummary]]:
    """Enumerate the canonical TemplateCategory values with per-category counts.

    Counts honour ``scope`` so the gallery's category chips reflect what the
    user will actually see in the currently-selected tab. Legacy categories
    (free-form strings stored before the enum) are not surfaced here - the
    gallery UI renders strictly from this enum.
    """
    counts = await service.count_templates_by_category(current_user.id, scope=scope)
    summaries = [
        TemplateCategorySummary(
            value=category.value,
            label=humanise_category(category.value),
            count=counts.get(category.value, 0),
        )
        for category in TemplateCategory
    ]
    return ApiResponse(
        success=True, message="Template categories retrieved", data=summaries
    )


@router.get("/{template_id}", response_model=ApiResponse[TemplateDetail])
async def get_template(
    template_id: int,
    current_user: User = Depends(require_password_changed),
    service: TemplateService = Depends(get_template_service),
) -> ApiResponse[TemplateDetail]:
    """Get a specific template by ID."""
    template = await service.get_template(template_id, current_user.id)
    detail = TemplateDetail.model_validate(template)

    return ApiResponse(success=True, message="Template retrieved", data=detail)


@router.post(
    "/", response_model=ApiResponse[TemplateDetail], status_code=status.HTTP_201_CREATED
)
async def create_template(
    payload: TemplateCreate,
    current_user: User = Depends(require_password_changed),
    service: TemplateService = Depends(get_template_service),
) -> ApiResponse[TemplateDetail]:
    """Create a new template."""
    try:
        template = await service.create_template(current_user.id, payload)
        detail = TemplateDetail.model_validate(template)

        return ApiResponse(success=True, message="Template created", data=detail)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    current_user: User = Depends(require_password_changed),
    service: TemplateService = Depends(get_template_service),
) -> None:
    """Delete a template."""
    await service.delete_template(template_id, current_user.id)


@router.post("/{template_id}/use", response_model=ApiResponse[TemplateWorkflowData])
async def use_template(
    template_id: int,
    current_user: User = Depends(require_password_changed),
    service: TemplateService = Depends(get_template_service),
) -> ApiResponse[TemplateWorkflowData]:
    """Mark a template as used (increment usage count) and return its workflow data."""
    template = await service.get_template(template_id, current_user.id)
    await service.increment_usage_count(template_id)

    workflow_response = TemplateWorkflowData(workflow_data=template.workflow_data)
    return ApiResponse(
        success=True,
        message="Template usage recorded",
        data=workflow_response,
    )
