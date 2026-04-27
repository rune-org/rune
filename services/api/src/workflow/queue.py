from aio_pika import RobustConnection

from src.queue.base import BaseQueuePublisher
from src.workflow.schemas import NodeExecutionMessage


NO_ACTION_NODES_MESSAGE = "This workflow has no action nodes."


def get_first_executable_node_ids(workflow_data: dict) -> list[str]:
    """Validate a workflow can start and return nodes after the trigger."""
    nodes = workflow_data.get("nodes", [])
    edges = workflow_data.get("edges", [])

    if not nodes:
        raise ValueError("Workflow has no nodes to execute")

    trigger_nodes = [node for node in nodes if node.get("trigger", False)]

    if len(trigger_nodes) != 1:
        raise ValueError("Workflow must have exactly one trigger node")

    trigger_node_id = trigger_nodes[0].get("id")
    if not trigger_node_id:
        raise ValueError("Trigger node must have an id")

    first_nodes = [
        edge.get("dst")
        for edge in edges
        if edge.get("src") == trigger_node_id and edge.get("dst")
    ]

    if not first_nodes:
        raise ValueError(NO_ACTION_NODES_MESSAGE)

    return first_nodes


def validate_workflow_can_run(workflow_data: dict) -> None:
    """Raise ValueError if a workflow cannot be queued for execution."""
    get_first_executable_node_ids(workflow_data)


class WorkflowQueueService(BaseQueuePublisher):
    """Service for publishing workflow execution messages to RabbitMQ."""

    def __init__(self, connection: RobustConnection, queue_name: str):
        """
        Initialize the workflow queue service.

        Args:
            connection: RabbitMQ connection instance
            queue_name: Name of the RabbitMQ queue to publish workflow runs to
        """
        super().__init__(connection, queue_name)

    async def publish_workflow_run(
        self,
        workflow_id: int,
        workflow_version: int,
        workflow_version_id: int,
        execution_id: str,
        workflow_data: dict,
    ) -> None:
        """
        Publish a workflow run message to the queue.

        Creates a NodeExecutionMessage with the proper structure
        including workflow_id, execution_id, current_node (first node), workflow_definition,
        and accumulated_context (with trigger data).

        Args:
            workflow_id: The workflow database ID
            workflow_version: The immutable workflow version number
            workflow_version_id: The immutable workflow version ID
            execution_id: Unique execution instance identifier
            workflow_data: The resolved workflow definition (nodes and edges)

        Raises:
            ValueError: If workflow has invalid structure
        """
        first_nodes = get_first_executable_node_ids(workflow_data)

        # For now, use the first one (in the future, might send multiple messages)
        first_node = first_nodes[0]

        payload = NodeExecutionMessage(
            workflow_id=str(workflow_id),
            workflow_version=workflow_version,
            workflow_version_id=workflow_version_id,
            execution_id=execution_id,
            current_node=first_node,
            workflow_definition=workflow_data,
        )

        await self._publish(payload, durable=True)
