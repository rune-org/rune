from aio_pika import RobustConnection

from src.queue.base import BaseQueuePublisher
from src.workflow.schemas import NodeExecutionMessage


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
            execution_id: Unique execution instance identifier
            workflow_data: The resolved workflow definition (nodes and edges)

        Raises:
            ValueError: If workflow has invalid structure
        """
        # Find trigger nodes and the first executable nodes
        nodes = workflow_data.get("nodes", [])
        edges = workflow_data.get("edges", [])

        if not nodes:
            raise ValueError("Workflow has no nodes to execute")

        # Validate trigger nodes - must have exactly one
        trigger_nodes = [node for node in nodes if node.get("trigger", False)]

        if len(trigger_nodes) != 1:
            raise ValueError("Workflow must have exactly one trigger node")

        # Get the single trigger node
        trigger_node = trigger_nodes[0]
        trigger_node_id = trigger_node.get("id")

        # Find the executable nodes the trigger points to
        first_nodes = []

        for edge in edges:
            if edge.get("src") == trigger_node_id:
                dst_node_id = edge.get("dst")
                first_nodes.append(dst_node_id)

        if not first_nodes:
            return None

        # For now, use the first one (in the future, might send multiple messages)
        first_node = first_nodes[0]

        payload = NodeExecutionMessage(
            workflow_id=str(workflow_id),
            execution_id=execution_id,
            current_node=first_node,
            workflow_definition=workflow_data,
        )

        await self._publish(payload, durable=True)
