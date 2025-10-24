from fastapi import APIRouter, Depends, status
from typing import List

from src.templates.schemas import (
    TemplateSummary,
    TemplateDetail,
    TemplateCreate,
)
from src.templates.service import TemplateService
from src.core.dependencies import DatabaseDep, get_current_user
from src.core.responses import ApiResponse
from src.db.models import User


router = APIRouter(prefix="/templates", tags=["Templates"])


def get_template_service(db: DatabaseDep) -> TemplateService:
    return TemplateService(db=db)


@router.get("/", response_model=ApiResponse[List[TemplateSummary]])
async def list_templates(
    current_user: User = Depends(get_current_user),
    service: TemplateService = Depends(get_template_service),
) -> ApiResponse[List[TemplateSummary]]:
    """Get all templates accessible to the current user (public + their own)."""
    templates = await service.list_all_accessible_templates(current_user.id)

    summaries = []
    for template in templates:
        # Extract node types for display
        from_node, to_node = service._extract_node_types(template.workflow_data)

        summary = TemplateSummary(
            id=template.id,
            name=template.name,
            description=template.description,
            category=template.category,
            **{"from": from_node, "to": to_node},
            usage_count=template.usage_count,
            is_public=template.is_public,
        )
        summaries.append(summary)

    return ApiResponse(success=True, message="Templates retrieved", data=summaries)


@router.get("/{template_id}", response_model=ApiResponse[TemplateDetail])
async def get_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
    service: TemplateService = Depends(get_template_service),
) -> ApiResponse[TemplateDetail]:
    """Create a new template."""
    template = await service.create_template(current_user.id, payload)
    detail = TemplateDetail.model_validate(template)

    return ApiResponse(success=True, message="Template created", data=detail)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    service: TemplateService = Depends(get_template_service),
) -> None:
    """Delete a template."""
    await service.delete_template(template_id, current_user.id)


@router.post("/{template_id}/use", response_model=ApiResponse[dict])
async def use_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    service: TemplateService = Depends(get_template_service),
) -> ApiResponse[dict]:
    """Mark a template as used (increment usage count) and return its workflow data."""
    template = await service.get_template(template_id, current_user.id)
    await service.increment_usage_count(template_id)

    return ApiResponse(
        success=True,
        message="Template usage recorded",
        data={"workflow_data": template.workflow_data},
    )
