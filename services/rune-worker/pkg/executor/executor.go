package executor

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/dsl"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/nodes"
	"rune-worker/pkg/platform/queue"
	"rune-worker/pkg/registry"
	"rune-worker/pkg/resolver"
	"rune-worker/plugin"
)

// Executor evaluates workflow definitions and invokes nodes in order.
// It implements the recursive node-by-node execution model as specified in RFC-001.
type Executor struct {
	registry    *nodes.Registry
	publisher   queue.Publisher
	redisClient interface{}
}

// NewExecutor builds an executor with the provided registry and publisher.
func NewExecutor(reg *nodes.Registry, pub queue.Publisher, redisClient interface{}) *Executor {
	if reg == nil {
		reg = registry.InitializeRegistry()
	}

	return &Executor{
		registry:    reg,
		publisher:   pub,
		redisClient: redisClient,
	}
}

// Execute processes a single node execution message.
// This method handles both initial workflow starts (from master) and recursive
// node executions (from other workers).
//
// Execution sequence per RFC-001 Section 7.2:
//  1. Parse workflow definition
//  2. Lookup node by current_node ID
//  3. Validate node exists and is executable
//  4. Publish NodeStatusMessage(status=running)
//  5. Build ExecutionContext from accumulated_context
//  6. Execute node logic with ExecutionContext
//  7. If successful:
//     a. Publish NodeStatusMessage(status=success)
//     b. Accumulate result into context
//     c. Determine next nodes via graph traversal
//     d. Publish NodeExecutionMessage for each next node OR CompletionMessage
//  8. If failed:
//     a. Publish NodeStatusMessage(status=failed)
//     b. Apply error handling strategy (halt|ignore|branch)
//     c. Publish appropriate next message or completion
func (e *Executor) Execute(ctx context.Context, msg *messages.NodeExecutionMessage) error {
	startTime := time.Now()

	// Step 1 & 2: Get workflow and current node
	node, err := msg.GetCurrentNodeDetails()
	if err != nil {
		slog.Error("failed to get current node", "error", err, "node_id", msg.CurrentNode)
		return fmt.Errorf("get current node: %w", err)
	}

	slog.Info("executing node",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"node_id", node.ID,
		"node_name", node.Name,
		"node_type", node.Type,
	)

	// Step 5 & 6: Build context and execute node
	execContext, usedKeys := e.buildExecutionContext(msg, &node)
	usedInputs := e.filterUsedInputs(execContext.Input, usedKeys)

	// Step 4: Publish "running" status
	if err := e.publishRunningStatus(ctx, msg, &node, execContext.Input, execContext.Parameters, usedKeys, usedInputs); err != nil {
		slog.Error("failed to publish running status", "error", err)
		// Continue execution even if status publish fails
	}

	nodeInstance, err := e.registry.Create(node.Type, execContext)
	if err != nil {
		return e.handleNodeCreationFailure(ctx, msg, &node, err, startTime, execContext.Input, execContext.Parameters, usedKeys, usedInputs)
	}

	output, execErr := nodeInstance.Execute(ctx, execContext)
	duration := time.Since(startTime)

	if execErr != nil {
		return e.handleNodeFailure(ctx, msg, &node, execErr, duration, execContext.Input, execContext.Parameters, usedKeys, usedInputs)
	}

	if node.Type == "wait" {
		return e.handleWaitNode(ctx, msg, &node, output, duration, execContext.Input, execContext.Parameters, usedKeys, usedInputs)
	}

	// Step 7 & 8: Handle execution result
	return e.handleNodeSuccess(ctx, msg, &node, output, duration, startTime, execContext.Input, execContext.Parameters, usedKeys, usedInputs)
}

// handleWaitNode publishes a waiting status and stops further execution for this branch.
func (e *Executor) handleWaitNode(ctx context.Context, msg *messages.NodeExecutionMessage, node *core.Node, output map[string]any, duration time.Duration, input map[string]any, params map[string]any, usedKeys []string, usedInputs map[string]any) error {
	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:       msg.WorkflowID,
		ExecutionID:      msg.ExecutionID,
		NodeID:           node.ID,
		NodeName:         node.Name,
		Status:           messages.StatusWaiting,
		Parameters:       params,
		Output:           output,
		ExecutedAt:       time.Now(),
		DurationMs:       duration.Milliseconds(),
		AllUsedInputKeys: usedKeys,
		UsedInputs:       usedInputs,
	}

	e.enrichStatusWithLineage(statusMsg, msg.LineageStack)

	if err := e.publishStatus(ctx, statusMsg); err != nil {
		slog.Error("failed to publish waiting status", "error", err)
	}

	slog.Info("wait node scheduled and branch suspended",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"node_id", node.ID,
		"resume_at", output["resume_at"],
		"timer_id", output["timer_id"],
	)

	return nil
}

// buildExecutionContext creates the plugin.ExecutionContext from the message.
// Credentials are already resolved by the master service and included in the node definition.
// Parameters are resolved using the resolver to handle dynamic references like $node.field.
// It also returns the list of input keys used during parameter resolution.
func (e *Executor) buildExecutionContext(msg *messages.NodeExecutionMessage, node *core.Node) (plugin.ExecutionContext, []string) {
	// Resolve dynamic parameter references before execution
	resolvedParams := node.Parameters
	var usedKeys []string
	if len(node.Parameters) > 0 && msg.AccumulatedContext != nil {
		r := resolver.NewResolver(msg.AccumulatedContext)
		if params, err := r.ResolveParameters(node.Parameters); err == nil {
			resolvedParams = params
			usedKeys = r.GetUsedKeys()
		} else {
			slog.Warn("failed to resolve parameters, using original values",
				"error", err,
				"node_id", node.ID,
			)
		}
	}

	execCtx := plugin.ExecutionContext{
		ExecutionID:  msg.ExecutionID,
		WorkflowID:   msg.WorkflowID,
		NodeID:       node.ID,
		Type:         node.Type,
		Parameters:   resolvedParams,
		Input:        msg.AccumulatedContext,
		FromNode:     msg.FromNode,
		RedisClient:  e.redisClient,
		LineageStack: msg.LineageStack,
		Workflow:     msg.WorkflowDefinition,
	}

	// Set credentials if present (already resolved by master)
	if node.Credentials != nil && node.Credentials.Values != nil {
		execCtx.SetCredentials(node.Credentials.Values)
	}

	return execCtx, usedKeys
}

// filterUsedInputs extracts only the input entries that were referenced during parameter resolution.
func (e *Executor) filterUsedInputs(input map[string]any, usedKeys []string) map[string]any {
	if len(usedKeys) == 0 || len(input) == 0 {
		return nil
	}

	filtered := make(map[string]any)
	for _, key := range usedKeys {
		if val, ok := input[key]; ok {
			filtered[key] = val
		}
	}
	return filtered
}

// publishRunningStatus publishes a "running" status message.
func (e *Executor) publishRunningStatus(ctx context.Context, msg *messages.NodeExecutionMessage, node *core.Node, input map[string]any, params map[string]any, usedKeys []string, usedInputs map[string]any) error {
	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:       msg.WorkflowID,
		ExecutionID:      msg.ExecutionID,
		NodeID:           node.ID,
		NodeName:         node.Name,
		Status:           messages.StatusRunning,
		Parameters:       params,
		AllUsedInputKeys: usedKeys,
		UsedInputs:       usedInputs,
		ExecutedAt:       time.Now(),
		DurationMs:       0,
	}

	e.enrichStatusWithLineage(statusMsg, msg.LineageStack)

	return e.publishStatus(ctx, statusMsg)
}

// handleNodeCreationFailure handles the case when a node cannot be created from the registry.
func (e *Executor) handleNodeCreationFailure(ctx context.Context, msg *messages.NodeExecutionMessage, node *core.Node, err error, startTime time.Time, input map[string]any, params map[string]any, usedKeys []string, usedInputs map[string]any) error {
	duration := time.Since(startTime)
	slog.Error("failed to create node", "error", err, "node_type", node.Type)

	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:  msg.WorkflowID,
		ExecutionID: msg.ExecutionID,
		NodeID:      node.ID,
		NodeName:    node.Name,
		Status:      messages.StatusFailed,
		Parameters:  params,
		Error: &messages.NodeError{
			Message: fmt.Sprintf("failed to create node of type %s", node.Type),
			Code:    "NODE_CREATION_FAILED",
			Details: map[string]interface{}{"error": err.Error()},
		},
		AllUsedInputKeys: usedKeys,
		UsedInputs:       usedInputs,
		ExecutedAt:       time.Now(),
		DurationMs:       duration.Milliseconds(),
	}

	e.enrichStatusWithLineage(statusMsg, msg.LineageStack)

	_ = e.publishStatus(ctx, statusMsg)

	// Node creation failure is always a halt condition
	return e.publishCompletion(ctx, msg, messages.CompletionStatusFailed, startTime, msg.AccumulatedContext)
}

// handleNodeFailure processes a node execution failure according to error handling strategy.
func (e *Executor) handleNodeFailure(ctx context.Context, msg *messages.NodeExecutionMessage, node *core.Node, execErr error, duration time.Duration, input map[string]any, params map[string]any, usedKeys []string, usedInputs map[string]any) error {
	slog.Error("node execution failed",
		"error", execErr,
		"node_id", node.ID,
		"node_name", node.Name,
	)

	// Publish failed status
	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:  msg.WorkflowID,
		ExecutionID: msg.ExecutionID,
		NodeID:      node.ID,
		NodeName:    node.Name,
		Status:      messages.StatusFailed,
		Parameters:  params,
		Error: &messages.NodeError{
			Message: execErr.Error(),
			Code:    "NODE_EXECUTION_FAILED",
		},
		AllUsedInputKeys: usedKeys,
		UsedInputs:       usedInputs,
		ExecutedAt:       time.Now(),
		DurationMs:       duration.Milliseconds(),
	}

	if err := e.publishStatus(ctx, statusMsg); err != nil {
		slog.Error("failed to publish failed status", "error", err)
	}

	// Apply error handling strategy
	errorStrategy := "halt" // default
	if node.Error != nil && node.Error.Type != "" {
		errorStrategy = node.Error.Type
	}

	switch errorStrategy {
	case "halt":
		return e.publishCompletion(ctx, msg, messages.CompletionStatusHalted, time.Now(), msg.AccumulatedContext)

	case "ignore":
		// Continue to next nodes despite error
		nextNodes := e.determineNextNodes(&msg.WorkflowDefinition, node, nil)
		return e.publishNextNodes(ctx, msg, nextNodes, msg.AccumulatedContext)

	case "branch":
		// Follow error edge if specified
		if node.Error != nil && node.Error.ErrorEdge != "" {
			errorNode := e.getNodeByErrorEdge(&msg.WorkflowDefinition, node.Error.ErrorEdge)
			if errorNode != nil {
				return e.publishNextNodes(ctx, msg, []string{errorNode.ID}, msg.AccumulatedContext)
			}
		}
		// If no error edge, halt
		return e.publishCompletion(ctx, msg, messages.CompletionStatusHalted, time.Now(), msg.AccumulatedContext)

	default:
		slog.Warn("unknown error strategy, halting", "strategy", errorStrategy)
		return e.publishCompletion(ctx, msg, messages.CompletionStatusHalted, time.Now(), msg.AccumulatedContext)
	}
}

// handleNodeSuccess processes a successful node execution.
func (e *Executor) handleNodeSuccess(ctx context.Context, msg *messages.NodeExecutionMessage, node *core.Node, output map[string]any, duration time.Duration, startTime time.Time, input map[string]any, params map[string]any, usedKeys []string, usedInputs map[string]any) error {
	slog.Info("node execution succeeded",
		"node_id", node.ID,
		"node_name", node.Name,
		"duration_ms", duration.Milliseconds(),
	)

	// Handle Aggregator Barrier early to avoid publishing status for closed barrier branches.
	if node.Type == "aggregator" {
		if _, closed := output["_barrier_closed"]; closed {
			slog.Info("aggregator barrier closed, halting branch", "node_id", node.ID)
			return nil // Do not publish status, next nodes, or completion
		}
	}

	// Publish success status
	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:       msg.WorkflowID,
		ExecutionID:      msg.ExecutionID,
		NodeID:           node.ID,
		NodeName:         node.Name,
		Status:           messages.StatusSuccess,
		Parameters:       params,
		Output:           output,
		ExecutedAt:       time.Now(),
		DurationMs:       duration.Milliseconds(),
		AllUsedInputKeys: usedKeys,
		UsedInputs:       usedInputs,
	}

	e.enrichStatusWithLineage(statusMsg, msg.LineageStack)
	e.applyAggregatorMetadata(statusMsg, node, output)

	if err := e.publishStatus(ctx, statusMsg); err != nil {
		slog.Error("failed to publish success status", "error", err)
	}

	// Accumulate result into context with $<node_name> key
	updatedContext := e.accumulateContext(msg.AccumulatedContext, node.Name, output)

	// Edit node transforms the working payload; propagate to $json for downstream expressions.
	if node.Type == "edit" {
		if json, ok := output["$json"]; ok {
			updatedContext["$json"] = json
		}
	}

	// Merge node returns a unified merged_context for downstream nodes
	if node.Type == "merge" {
		if merged, ok := output["merged_context"].(map[string]any); ok {
			updatedContext = merged
		}
	}

	// Determine next nodes via graph traversal
	nextNodes := e.determineNextNodes(&msg.WorkflowDefinition, node, output)

	// Handle Split Node Fan-Out
	if node.Type == "split" {
		if items, ok := output["_split_items"].([]any); ok {
			return e.handleSplitFanOut(ctx, msg, node, nextNodes, items, updatedContext)
		}
	}

	// Handle Merge waiting/ignored branches
	if node.Type == "merge" {
		if waiting, ok := output["_merge_waiting"].(bool); ok && waiting {
			slog.Info("merge waiting, parking branch", "node_id", node.ID)
			return nil
		}
		if ignored, ok := output["_merge_ignored"].(bool); ok && ignored {
			slog.Info("merge branch ignored due to wait_for_any", "node_id", node.ID)
			return nil
		}
	}

	if len(nextNodes) == 0 {
		// No more nodes to execute - workflow completed
		slog.Info("workflow completed", "workflow_id", msg.WorkflowID, "execution_id", msg.ExecutionID, "final_context_keys", getKeys(updatedContext))
		return e.publishCompletion(ctx, msg, messages.CompletionStatusCompleted, startTime, updatedContext)
	}

	// Publish execution messages for next nodes
	return e.publishNextNodes(ctx, msg, nextNodes, updatedContext)
}

// handleSplitFanOut iterates over items and publishes messages for each.
func (e *Executor) handleSplitFanOut(ctx context.Context, msg *messages.NodeExecutionMessage, node *core.Node, nextNodes []string, items []any, baseContext map[string]interface{}) error {
	slog.Info("handling split fan-out", "node_id", node.ID, "item_count", len(items))

	for i, item := range items {
		// Create new context for this item
		itemContext := make(map[string]interface{}, len(baseContext)+1)
		for k, v := range baseContext {
			itemContext[k] = v
		}

		itemContext["$item"] = item

		// Clone and update lineage stack
		newStack := make([]messages.StackFrame, len(msg.LineageStack)+1)
		copy(newStack, msg.LineageStack)

		newStack[len(msg.LineageStack)] = messages.StackFrame{
			SplitNodeID: node.ID,
			BranchID:    fmt.Sprintf("%s_%s_%d", msg.ExecutionID, node.ID, i),
			ItemIndex:   i,
			TotalItems:  len(items),
		}

		// Publish to next nodes
		for _, nextNodeID := range nextNodes {
			nextMsg := &messages.NodeExecutionMessage{
				WorkflowID:         msg.WorkflowID,
				ExecutionID:        msg.ExecutionID,
				CurrentNode:        nextNodeID,
				WorkflowDefinition: msg.WorkflowDefinition,
				AccumulatedContext: itemContext,
				LineageStack:       newStack,
				FromNode:           node.ID,
			}

			payload, err := nextMsg.Encode()
			if err != nil {
				return fmt.Errorf("encode split message: %w", err)
			}

			if err := e.publisher.Publish(ctx, "workflow.execution", payload); err != nil {
				return fmt.Errorf("publish split message: %w", err)
			}

			slog.Info("published split node message",
				"workflow_id", nextMsg.WorkflowID,
				"execution_id", nextMsg.ExecutionID,
				"target_node", nextNodeID,
				"accumulated_context", nextMsg.AccumulatedContext,
				"node_execution_message", nextMsg,
			)
		}
	}

	return nil
}

// accumulateContext adds the node output to the accumulated context with $<node_name> key.
func (e *Executor) accumulateContext(currentContext map[string]interface{}, nodeName string, output map[string]any) map[string]interface{} {
	updated := make(map[string]interface{}, len(currentContext)+1)
	for k, v := range currentContext {
		updated[k] = v
	}
	if len(output) == 1 {
		for _, v := range output {
			updated[fmt.Sprintf("$%s", nodeName)] = v
			return updated
		}
	}
	updated[fmt.Sprintf("$%s", nodeName)] = output
	return updated
}

// determineNextNodes implements the graph traversal algorithm from RFC-001 Section 7.3.
func (e *Executor) determineNextNodes(wf *core.Workflow, currentNode *core.Node, output map[string]any) []string {
	graph := dsl.BuildGraph(wf)
	outgoingEdges := e.getOutgoingEdges(wf, currentNode.ID)

	switch currentNode.Type {
	case "conditional":
		// Evaluate condition and follow true/false edge
		return e.handleConditionalNode(currentNode, output, wf)

	case "switch":
		return e.handleSwitchNode(currentNode, output, wf)

	case "split":
		// Parallel execution - return all destinations
		nextNodes := make([]string, 0, len(outgoingEdges))
		for _, edge := range outgoingEdges {
			nextNodes = append(nextNodes, edge.Dst)
		}
		return nextNodes

	default:
		// Regular node - return all successor nodes
		return graph.GetNeighbors(currentNode.ID)
	}
}

// getOutgoingEdges returns all edges originating from the given node.
func (e *Executor) getOutgoingEdges(wf *core.Workflow, nodeID string) []core.Edge {
	edges := make([]core.Edge, 0)
	for _, edge := range wf.Edges {
		if edge.Src == nodeID {
			edges = append(edges, edge)
		}
	}
	return edges
}

// handleConditionalNode evaluates a conditional node and returns the appropriate next node.
func (e *Executor) handleConditionalNode(node *core.Node, output map[string]any, wf *core.Workflow) []string {
	// Extract true_edge_id and false_edge_id from parameters
	trueEdgeID, _ := node.Parameters["true_edge_id"].(string)
	falseEdgeID, _ := node.Parameters["false_edge_id"].(string)

	// Get result from output
	result, ok := output["result"].(bool)
	if !ok {
		slog.Warn("conditional node did not return boolean result, defaulting to false", "node_id", node.ID)
		result = false
	}

	var edgeID string
	if result {
		edgeID = trueEdgeID
	} else {
		edgeID = falseEdgeID
	}

	if edgeID == "" {
		return []string{}
	}

	// Find the destination node for this edge
	for _, edge := range wf.Edges {
		if edge.ID == edgeID {
			return []string{edge.Dst}
		}
	}

	slog.Warn("conditional edge not found", "edge_id", edgeID, "node_id", node.ID)
	return []string{}
}

// handleSwitchNode evaluates a switch node and returns the appropriate next node.
func (e *Executor) handleSwitchNode(node *core.Node, output map[string]any, wf *core.Workflow) []string {
	// Get output index
	var outputIndex int
	if val, ok := output["output_index"].(int); ok {
		outputIndex = val
	} else if val, ok := output["output_index"].(float64); ok {
		outputIndex = int(val)
	} else {
		slog.Warn("switch node did not return valid output_index", "node_id", node.ID)
		return []string{}
	}

	// Get routes parameter
	routesParam, ok := node.Parameters["routes"].([]interface{})
	if !ok {
		slog.Warn("switch node missing routes parameter", "node_id", node.ID)
		return []string{}
	}

	if outputIndex < 0 || outputIndex >= len(routesParam) {
		slog.Warn("switch node output_index out of bounds", "index", outputIndex, "routes_len", len(routesParam), "node_id", node.ID)
		return []string{}
	}

	edgeID, ok := routesParam[outputIndex].(string)
	if !ok {
		slog.Warn("invalid route edge ID", "index", outputIndex, "node_id", node.ID)
		return []string{}
	}

	// Find the destination node for this edge
	for _, edge := range wf.Edges {
		if edge.ID == edgeID {
			return []string{edge.Dst}
		}
	}

	slog.Warn("switch edge not found", "edge_id", edgeID, "node_id", node.ID)
	return []string{}
}

// getNodeByErrorEdge finds the destination node of an error edge.
func (e *Executor) getNodeByErrorEdge(wf *core.Workflow, errorEdgeID string) *core.Node {
	for _, edge := range wf.Edges {
		if edge.ID == errorEdgeID {
			if node, found := wf.GetNodeByID(edge.Dst); found {
				return &node
			}
		}
	}
	return nil
}

// publishNextNodes publishes NodeExecutionMessages for all next nodes.
func (e *Executor) publishNextNodes(ctx context.Context, msg *messages.NodeExecutionMessage, nextNodeIDs []string, updatedContext map[string]interface{}) error {
	for _, nextNodeID := range nextNodeIDs {
		nextMsg := &messages.NodeExecutionMessage{
			WorkflowID:         msg.WorkflowID,
			ExecutionID:        msg.ExecutionID,
			CurrentNode:        nextNodeID,
			WorkflowDefinition: msg.WorkflowDefinition,
			AccumulatedContext: updatedContext,
			LineageStack:       msg.LineageStack, // Propagate stack
			FromNode:           msg.CurrentNode,
		}

		payload, err := nextMsg.Encode()
		if err != nil {
			slog.Error("failed to encode next node message", "error", err, "next_node", nextNodeID)
			return fmt.Errorf("encode next node message: %w", err)
		}

		if err := e.publisher.Publish(ctx, "workflow.execution", payload); err != nil {
			slog.Error("failed to publish next node message", "error", err, "next_node", nextNodeID)
			return fmt.Errorf("publish next node message: %w", err)
		}

		slog.Info("published next node message",
			"workflow_id", nextMsg.WorkflowID,
			"execution_id", nextMsg.ExecutionID,
			"next_node", nextNodeID,
			"accumulated_context", nextMsg.AccumulatedContext,
			"node_execution_message", nextMsg,
		)
	}

	return nil
}

// publishStatus publishes a NodeStatusMessage to the status queue.
func (e *Executor) publishStatus(ctx context.Context, msg *messages.NodeStatusMessage) error {
	payload, err := msg.Encode()
	if err != nil {
		return fmt.Errorf("encode status message: %w", err)
	}

	return e.publisher.Publish(ctx, "workflow.node.status", payload)
}

func (e *Executor) enrichStatusWithLineage(status *messages.NodeStatusMessage, stack []messages.StackFrame) {
	if status == nil || len(stack) == 0 {
		return
	}

	status.LineageStack = append(status.LineageStack, stack...)
	top := stack[len(stack)-1]
	status.BranchID = top.BranchID
	status.SplitNodeID = top.SplitNodeID
	status.ItemIndex = intPointer(top.ItemIndex)
	status.TotalItems = intPointer(top.TotalItems)
}

func (e *Executor) applyAggregatorMetadata(status *messages.NodeStatusMessage, node *core.Node, output map[string]any) {
	if status == nil || node == nil || node.Type != "aggregator" {
		return
	}

	if output != nil {
		if processed, ok := extractInt(output, "_aggregator_processed_count"); ok {
			status.ProcessedCount = intPointer(processed)
		}
		if _, waiting := output["_barrier_closed"]; waiting {
			status.AggregatorState = messages.AggregatorStateWaiting
		} else if _, released := output["aggregated"]; released {
			status.AggregatorState = messages.AggregatorStateReleased
		}
	}

	if status.AggregatorState == "" {
		status.AggregatorState = messages.AggregatorStateReleased
	}

	if status.AggregatorState == messages.AggregatorStateReleased && status.ProcessedCount == nil && status.TotalItems != nil {
		status.ProcessedCount = intPointer(*status.TotalItems)
	}
}

func extractInt(data map[string]any, key string) (int, bool) {
	if data == nil {
		return 0, false
	}
	val, ok := data[key]
	if !ok {
		return 0, false
	}
	switch v := val.(type) {
	case int:
		return v, true
	case int64:
		return int(v), true
	case float64:
		return int(v), true
	default:
		return 0, false
	}
}

func intPointer(value int) *int {
	v := value
	return &v
}

// publishCompletion publishes a CompletionMessage to the completion queue.
func (e *Executor) publishCompletion(ctx context.Context, msg *messages.NodeExecutionMessage, status string, startTime time.Time, finalContext map[string]interface{}) error {
	totalDuration := time.Since(startTime)

	completionMsg := &messages.CompletionMessage{
		WorkflowID:      msg.WorkflowID,
		ExecutionID:     msg.ExecutionID,
		Status:          status,
		FinalContext:    finalContext,
		CompletedAt:     time.Now(),
		TotalDurationMs: totalDuration.Milliseconds(),
	}

	payload, err := completionMsg.Encode()
	if err != nil {
		return fmt.Errorf("encode completion message: %w", err)
	}

	if err := e.publisher.Publish(ctx, "workflow.completion", payload); err != nil {
		return fmt.Errorf("publish completion message: %w", err)
	}

	slog.Info("published completion message",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"status", status,
		"duration_ms", totalDuration.Milliseconds(),
	)

	return nil
}
