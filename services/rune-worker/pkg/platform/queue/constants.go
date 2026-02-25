package queue

const (
	ExchangeWorkflows = "workflows"

	QueueWorkflowExecution       = "workflow.execution"
	QueueWorkflowResume          = "workflow.resume"
	QueueWorkflowNodeStatus      = "workflow.node.status"
	QueueWorkflowCompletion      = "workflow.completion"
	QueueWorkflowWorkerInitiated = "workflow.worker.initiated"
)
