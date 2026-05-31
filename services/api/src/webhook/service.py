from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.exceptions import NotFound
from src.db.models import Workflow, WebhookRegistration
from src.workflow.queue import WorkflowQueueService
from src.workflow.service import WorkflowService


class WebhookService:
    def __init__(self, db: AsyncSession, queue_service: WorkflowQueueService):
        self.db = db
        self.queue_service = queue_service

    async def trigger(self, guid: str, body: dict) -> str:
        """Look up an active webhook registration by GUID and dispatch a workflow execution.

        Returns the execution_id.
        Raises NotFound if the GUID is unknown or the registration/workflow is inactive.
        """
        stmt = select(WebhookRegistration).where(WebhookRegistration.guid == guid)
        reg = (await self.db.exec(stmt)).first()

        if reg is None or not reg.is_active:
            raise NotFound(detail="Webhook not found")

        wf: Workflow | None = await self.db.get(Workflow, reg.workflow_id)
        if wf is None or not wf.is_active:
            raise NotFound(detail="Webhook not found")

        wf_service = WorkflowService(self.db)
        return await wf_service.queue_workflow_execution(
            workflow=wf,
            user_id=None,
            queue_service=self.queue_service,
            token_service=None,
            accumulated_context={"$trigger": body},
        )
