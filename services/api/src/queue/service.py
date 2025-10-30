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

        # Find the first node to execute from the workflow data
        nodes = workflow_data.get("nodes", [])
        edges = workflow_data.get("edges", [])

        if not nodes:
            raise ValueError("Workflow has no nodes to execute")

        # Find the first node (node with no incoming edges)
        incoming_nodes = {edge.get("dst") for edge in edges}
        first_node = None
        for node in nodes:
            if node.get("id") not in incoming_nodes:
                first_node = node.get("id")
                break

        if not first_node:
            # If all nodes have incoming edges, use the first node in the list
            first_node = nodes[0].get("id")

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
