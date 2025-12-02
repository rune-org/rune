from aio_pika import RobustConnection, Message
from src.workflow.schemas import NodeExecutionMessage


class WorkflowQueueService:
    """Service for publishing workflow run messages to RabbitMQ."""

    def __init__(self, connection: RobustConnection, queue_name: str):
        """
        Initialize the workflow queue service.

        Args:
            connection: RabbitMQ connection instance
            queue_name: Name of the queue to use
        """
        self.connection = connection
        self.queue_name = queue_name

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
                # This edge comes from the trigger node
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

        # Create a channel for this operation
        channel = await self.connection.channel()

        # Declare the queue (idempotent - safe to call multiple times)
        await channel.declare_queue(self.queue_name, durable=True)

        body_bytes = payload.model_dump_json().encode("utf-8")

        # Publish the message with persistence
        await channel.default_exchange.publish(
            Message(
                body=body_bytes,
                delivery_mode=2,  # Persistent message (survives broker restart)
            ),
            routing_key=self.queue_name,
        )

        # Clean up the channel
        await channel.close()
