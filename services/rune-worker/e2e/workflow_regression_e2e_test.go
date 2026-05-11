//go:build integration
// +build integration

package e2e

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/messaging"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"
	testutils "rune-worker/test_utils"

	"github.com/google/go-cmp/cmp"
)

type regressionManifest struct {
	Cases []regressionCase `json:"cases"`
}

type regressionCase struct {
	ID                     string         `json:"id"`
	Name                   string         `json:"name"`
	Workflow               string         `json:"workflow"`
	EntryNodeID            string         `json:"entry_node_id"`
	Input                  map[string]any `json:"input"`
	ExpectCompletionStatus string         `json:"expect_completion_status"`
}

type canvasWorkflow struct {
	Nodes []canvasNode `json:"nodes"`
	Edges []canvasEdge `json:"edges"`
}

type canvasNode struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"`
	Position canvasPosition `json:"position"`
	Data     map[string]any `json:"data"`
}

type canvasPosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type canvasEdge struct {
	ID           string `json:"id"`
	Source       string `json:"source"`
	Target       string `json:"target"`
	Type         string `json:"type"`
	SourceHandle string `json:"sourceHandle"`
	Label        string `json:"label"`
}

type normalizedStatus struct {
	NodeID     string              `json:"node_id"`
	NodeName   string              `json:"node_name"`
	Status     string              `json:"status"`
	ItemIndex  *int                `json:"item_index,omitempty"`
	TotalItems *int                `json:"total_items,omitempty"`
	Output     map[string]any      `json:"output,omitempty"`
	Error      *messages.NodeError `json:"error,omitempty"`
}

type normalizedCompletion struct {
	Status        string         `json:"status"`
	FailureReason string         `json:"failure_reason,omitempty"`
	FinalContext  map[string]any `json:"final_context,omitempty"`
}

type executionReport struct {
	WorkflowID     string                `json:"workflow_id"`
	ExecutionID    string                `json:"execution_id"`
	StatusMessages []normalizedStatus    `json:"status_messages"`
	Completion     *normalizedCompletion `json:"completion,omitempty"`
}

type regressionCapture struct {
	workflowID  string
	executionID string
	statuses    []*messages.NodeStatusMessage
	completion  *messages.CompletionMessage
	done        chan struct{}
	once        sync.Once
}

type regressionCollector struct {
	mu       sync.Mutex
	captures map[string]*regressionCapture
}

func TestWorkflowRegressionSuite(t *testing.T) {
	manifestPath := filepath.Join("testdata", "workflows", "manifest.json")
	manifest, err := loadManifest(manifestPath)
	if err != nil {
		t.Fatalf("load manifest: %v", err)
	}

	env := setupE2ETest(t)
	defer env.Cleanup(t)

	env.Reset(t)

	httpServer := newRegressionHTTPServer()
	defer httpServer.Close()

	collector := &regressionCollector{captures: make(map[string]*regressionCapture)}

	statusConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.RabbitMQURL,
		QueueName:   queue.QueueWorkflowNodeStatus,
		Prefetch:    50,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("create status consumer: %v", err)
	}
	defer func() { _ = statusConsumer.Close() }()

	completionConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.RabbitMQURL,
		QueueName:   queue.QueueWorkflowCompletion,
		Prefetch:    20,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("create completion consumer: %v", err)
	}
	defer func() { _ = completionConsumer.Close() }()

	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		RedisURL:    "redis://" + testutils.DefaultRedisAddr + "/0",
		QueueName:   queue.QueueWorkflowExecution,
		Prefetch:    1,
		Concurrency: 1,
	}
	consumer, err := messaging.NewWorkflowConsumer(cfg, env.RedisClient)
	if err != nil {
		t.Fatalf("create workflow consumer: %v", err)
	}
	defer func() { _ = consumer.Close() }()

	suiteCtx, suiteCancel := context.WithCancel(context.Background())
	defer suiteCancel()
	consumerErrs := make(chan error, 3)

	go func() {
		consumerErrs <- statusConsumer.Consume(suiteCtx, collector.handleStatusMessage(t))
	}()
	go func() {
		consumerErrs <- completionConsumer.Consume(suiteCtx, collector.handleCompletionMessage(t))
	}()
	go func() {
		consumerErrs <- consumer.Run(suiteCtx)
	}()

	for _, tc := range manifest.Cases {
		tc := tc
		t.Run(tc.ID, func(t *testing.T) {
			env.Reset(t)

			ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
			defer cancel()

			wfPath := filepath.Join("testdata", "workflows", tc.Workflow)
			canvas, err := loadCanvasWorkflow(wfPath)
			if err != nil {
				t.Fatalf("load workflow: %v", err)
			}

			workflowID := fmt.Sprintf("wf-%s", tc.ID)
			executionID := fmt.Sprintf("exec-%s", tc.ID)

			wf, err := convertCanvasWorkflow(canvas, workflowID, executionID, httpServer.URL)
			if err != nil {
				t.Fatalf("convert workflow: %v", err)
			}

			if _, found := wf.GetNodeByID(tc.EntryNodeID); !found {
				t.Fatalf("entry node not found: %s", tc.EntryNodeID)
			}

			execMsg := &messages.NodeExecutionMessage{
				WorkflowID:         workflowID,
				ExecutionID:        executionID,
				CurrentNode:        tc.EntryNodeID,
				WorkflowDefinition: wf,
				AccumulatedContext: initialContext(tc.Input),
			}

			capture := collector.register(workflowID, executionID)
			defer collector.unregister(workflowID, executionID)

			payload, err := execMsg.Encode()
			if err != nil {
				t.Fatalf("encode execution message: %v", err)
			}

			if err := env.Publisher.Publish(ctx, queue.QueueWorkflowExecution, payload); err != nil {
				t.Fatalf("publish execution message: %v", err)
			}

			select {
			case <-capture.done:
			case err := <-consumerErrs:
				if err != nil && !errors.Is(err, context.Canceled) {
					t.Fatalf("consumer error: %v", err)
				}
			case <-ctx.Done():
				t.Fatalf("test timeout")
			}

			time.Sleep(100 * time.Millisecond)

			nodeTypeByID := make(map[string]string)
			nodeNameByID := make(map[string]string)
			nodeTypeByName := make(map[string]string)
			nodeParamsByID := make(map[string]map[string]any)
			nodeParamsByName := make(map[string]map[string]any)
			for _, node := range wf.Nodes {
				nodeTypeByID[node.ID] = node.Type
				nodeNameByID[node.ID] = node.Name
				nodeParamsByID[node.ID] = node.Parameters
				if node.Name != "" {
					nodeTypeByName[node.Name] = node.Type
					nodeParamsByName[node.Name] = node.Parameters
				}
			}

			statusSnapshot, completionSnapshot := collector.snapshot(workflowID, executionID)

			report := buildReport(workflowID, executionID, statusSnapshot, completionSnapshot, nodeTypeByID, nodeNameByID, nodeTypeByName, nodeParamsByID, nodeParamsByName)

			if tc.ExpectCompletionStatus != "" {
				if report.Completion == nil {
					t.Fatalf("expected completion status %s, got none", tc.ExpectCompletionStatus)
				}
				if report.Completion.Status != tc.ExpectCompletionStatus {
					t.Fatalf("completion status: got %s want %s", report.Completion.Status, tc.ExpectCompletionStatus)
				}
			}

			expectedPath := filepath.Join("testdata", "expected", tc.ID+".json")
			updateSnapshots := shouldUpdateSnapshots()

			if updateSnapshots {
				if err := writeJSON(expectedPath, report); err != nil {
					t.Fatalf("write snapshot: %v", err)
				}
				return
			}

			expected, err := readJSON(expectedPath)
			if err != nil {
				t.Fatalf("read snapshot: %v", err)
			}

			if !reflect.DeepEqual(expected, report) {
				t.Fatalf("snapshot mismatch for %s (-want +got):\n%s", tc.ID, cmp.Diff(expected, report))
			}
		})
	}
}

func loadManifest(path string) (*regressionManifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var manifest regressionManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, err
	}
	return &manifest, nil
}

func (c *regressionCollector) register(workflowID, executionID string) *regressionCapture {
	c.mu.Lock()
	defer c.mu.Unlock()

	capture := &regressionCapture{
		workflowID:  workflowID,
		executionID: executionID,
		done:        make(chan struct{}),
	}
	c.captures[captureKey(workflowID, executionID)] = capture
	return capture
}

func (c *regressionCollector) unregister(workflowID, executionID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.captures, captureKey(workflowID, executionID))
}

func (c *regressionCollector) snapshot(workflowID, executionID string) ([]*messages.NodeStatusMessage, *messages.CompletionMessage) {
	c.mu.Lock()
	defer c.mu.Unlock()

	capture := c.captures[captureKey(workflowID, executionID)]
	if capture == nil {
		return nil, nil
	}
	return append([]*messages.NodeStatusMessage(nil), capture.statuses...), capture.completion
}

func (c *regressionCollector) handleStatusMessage(t *testing.T) queue.MessageHandler {
	return func(ctx context.Context, payload []byte) error {
		msg, err := messages.DecodeNodeStatusMessage(payload)
		if err != nil {
			t.Logf("decode status message: %v", err)
			return nil
		}

		c.mu.Lock()
		defer c.mu.Unlock()

		capture := c.captures[captureKey(msg.WorkflowID, msg.ExecutionID)]
		if capture != nil {
			capture.statuses = append(capture.statuses, msg)
		}
		return nil
	}
}

func (c *regressionCollector) handleCompletionMessage(t *testing.T) queue.MessageHandler {
	return func(ctx context.Context, payload []byte) error {
		msg, err := messages.DecodeCompletionMessage(payload)
		if err != nil {
			t.Logf("decode completion message: %v", err)
			return nil
		}

		c.mu.Lock()
		defer c.mu.Unlock()

		capture := c.captures[captureKey(msg.WorkflowID, msg.ExecutionID)]
		if capture != nil {
			capture.completion = msg
			capture.once.Do(func() {
				close(capture.done)
			})
		}
		return nil
	}
}

func captureKey(workflowID, executionID string) string {
	return workflowID + "\x00" + executionID
}

func loadCanvasWorkflow(path string) (*canvasWorkflow, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var workflow canvasWorkflow
	if err := json.Unmarshal(data, &workflow); err != nil {
		return nil, err
	}
	return &workflow, nil
}

func convertCanvasWorkflow(canvas *canvasWorkflow, workflowID, executionID, httpBaseURL string) (core.Workflow, error) {
	if canvas == nil {
		return core.Workflow{}, fmt.Errorf("workflow is nil")
	}

	nodes := make([]core.Node, 0, len(canvas.Nodes))
	for _, n := range canvas.Nodes {
		if isIgnoredNodeType(n.Type) {
			return core.Workflow{}, fmt.Errorf("unsupported node type %s", n.Type)
		}

		nodeType := toWorkerType(n.Type)
		params, err := toWorkerParameters(n, canvas.Edges, httpBaseURL)
		if err != nil {
			return core.Workflow{}, fmt.Errorf("node %s: %w", n.ID, err)
		}

		node := core.Node{
			ID:         n.ID,
			Name:       nodeName(n),
			Trigger:    n.Type == "trigger",
			Type:       nodeType,
			Parameters: params,
			Output:     map[string]any{},
			Position:   []float64{n.Position.X, n.Position.Y},
		}
		nodes = append(nodes, node)
	}

	edges := make([]core.Edge, 0, len(canvas.Edges))
	for _, e := range canvas.Edges {
		edges = append(edges, core.Edge{ID: e.ID, Src: e.Source, Dst: e.Target})
	}

	return core.Workflow{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		Nodes:       nodes,
		Edges:       edges,
	}, nil
}

func isIgnoredNodeType(nodeType string) bool {
	switch nodeType {
	case "agent", "webhookTrigger", "scheduledTrigger", "smtp":
		return true
	default:
		return false
	}
}

func toWorkerType(canvasType string) string {
	switch canvasType {
	case "trigger":
		return "ManualTrigger"
	case "if":
		return "conditional"
	case "switch":
		return "switch"
	default:
		return canvasType
	}
}

func nodeName(n canvasNode) string {
	if label, ok := n.Data["label"].(string); ok && strings.TrimSpace(label) != "" {
		return strings.TrimSpace(label)
	}
	if n.Type == "" {
		return "Node"
	}
	return strings.ToUpper(n.Type[:1]) + n.Type[1:]
}

func toWorkerParameters(n canvasNode, edges []canvasEdge, httpBaseURL string) (map[string]any, error) {
	switch n.Type {
	case "http":
		return mapHTTPParams(n.Data, httpBaseURL), nil
	case "if":
		return mapIfParams(n, edges), nil
	case "switch":
		return mapSwitchParams(n, edges), nil
	case "log":
		return mapLogParams(n.Data), nil
	case "edit":
		return mapEditParams(n.Data), nil
	case "filter":
		return mapFilterParams(n.Data), nil
	case "sort":
		return mapSortParams(n.Data), nil
	case "limit":
		return mapLimitParams(n.Data), nil
	case "split":
		return mapSplitParams(n.Data), nil
	case "aggregator":
		return map[string]any{}, nil
	case "merge":
		return mapMergeParams(n.Data), nil
	case "dateTimeNow", "dateTimeAdd", "dateTimeSubtract", "dateTimeFormat", "dateTimeParse":
		return mapDateTimeParams(n.Type, n.Data), nil
	case "trigger":
		return map[string]any{}, nil
	default:
		return nil, fmt.Errorf("unsupported node type %s", n.Type)
	}
}

func mapHTTPParams(data map[string]any, httpBaseURL string) map[string]any {
	params := map[string]any{}
	if method, ok := data["method"].(string); ok && method != "" {
		params["method"] = strings.ToUpper(method)
	}
	if url, ok := data["url"].(string); ok && url != "" {
		params["url"] = rewriteRegressionHTTPURL(url, httpBaseURL)
	}
	if headers, ok := data["headers"].(map[string]any); ok {
		params["headers"] = headers
	}
	if query, ok := data["query"].(map[string]any); ok {
		params["query"] = query
	}
	if body, ok := data["body"]; ok {
		params["body"] = body
	}
	if timeout, ok := data["timeout"]; ok {
		params["timeout"] = timeout
	}
	if retry, ok := data["retry"]; ok {
		params["retry"] = retry
	}
	if delay, ok := data["retry_delay"]; ok {
		params["retry_delay"] = delay
	}
	if raise, ok := data["raise_on_status"].(string); ok && raise != "" {
		params["raise_on_status"] = raise
	}
	if ignore, ok := data["ignore_ssl"].(bool); ok {
		params["ignore_ssl"] = ignore
	}
	return params
}

func newRegressionHTTPServer() *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/products", func(w http.ResponseWriter, r *http.Request) {
		writeJSONResponse(w, map[string]any{
			"products": []map[string]any{
				{"id": "p1", "title": "Alpha", "price": 120, "stock": 4},
				{"id": "p2", "title": "Bravo", "price": 80, "stock": 0},
				{"id": "p3", "title": "Charlie", "price": 200, "stock": 2},
				{"id": "p4", "title": "Delta", "price": 150, "stock": 7},
			},
		})
	})
	mux.HandleFunc("/carts/approved", func(w http.ResponseWriter, r *http.Request) {
		writeJSONResponse(w, map[string]any{"order_id": "ord-1001", "risk_score": 42})
	})
	mux.HandleFunc("/carts/rejected", func(w http.ResponseWriter, r *http.Request) {
		writeJSONResponse(w, map[string]any{"order_id": "ord-1002", "risk_score": 92})
	})
	mux.HandleFunc("/carts/summary", func(w http.ResponseWriter, r *http.Request) {
		writeJSONResponse(w, map[string]any{
			"products": []map[string]any{
				{"sku": "A1", "qty": 2, "price": 10},
				{"sku": "B2", "qty": 1, "price": 25},
			},
		})
	})
	mux.HandleFunc("/tickets/high", func(w http.ResponseWriter, r *http.Request) {
		writeJSONResponse(w, map[string]any{"ticket_id": "ticket-1", "priority": "high", "channel": "email"})
	})
	mux.HandleFunc("/tickets/sms", func(w http.ResponseWriter, r *http.Request) {
		writeJSONResponse(w, map[string]any{"ticket_id": "ticket-2", "priority": "normal", "channel": "sms"})
	})
	mux.HandleFunc("/approvals/manager", func(w http.ResponseWriter, r *http.Request) {
		writeJSONResponse(w, map[string]any{"request_id": "approval-1", "source": "manager"})
	})
	mux.HandleFunc("/status/", func(w http.ResponseWriter, r *http.Request) {
		codeText := strings.TrimPrefix(r.URL.Path, "/status/")
		code, err := strconv.Atoi(codeText)
		if err != nil || code < 100 || code > 599 {
			http.Error(w, "invalid status", http.StatusBadRequest)
			return
		}
		w.WriteHeader(code)
	})
	return httptest.NewServer(mux)
}

func rewriteRegressionHTTPURL(rawURL, httpBaseURL string) string {
	const statusPrefix = "https://httpbin.org/status/"
	if strings.HasPrefix(rawURL, statusPrefix) && httpBaseURL != "" {
		return httpBaseURL + "/status/" + strings.TrimPrefix(rawURL, statusPrefix)
	}
	const dummyPrefix = "https://dummyjson.com/"
	if strings.HasPrefix(rawURL, dummyPrefix) && httpBaseURL != "" {
		return httpBaseURL + "/" + strings.TrimPrefix(rawURL, dummyPrefix)
	}
	return rawURL
}

func writeJSONResponse(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func initialContext(input map[string]any) map[string]any {
	if input == nil {
		return map[string]any{}
	}
	return input
}

func mapIfParams(n canvasNode, edges []canvasEdge) map[string]any {
	params := map[string]any{}
	if expr, ok := n.Data["expression"].(string); ok && strings.TrimSpace(expr) != "" {
		params["expression"] = strings.TrimSpace(expr)
	}
	for _, edge := range edges {
		if edge.Source != n.ID {
			continue
		}
		switch edge.SourceHandle {
		case "true":
			params["true_edge_id"] = edge.ID
		case "false":
			params["false_edge_id"] = edge.ID
		}
	}
	return params
}

func mapSwitchParams(n canvasNode, edges []canvasEdge) map[string]any {
	params := map[string]any{}
	rules := make([]any, 0)
	if rawRules, ok := n.Data["rules"].([]any); ok {
		for _, raw := range rawRules {
			ruleMap, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			rule := map[string]any{}
			if val, ok := ruleMap["value"].(string); ok {
				rule["value"] = val
			}
			if op, ok := ruleMap["operator"].(string); ok {
				rule["operator"] = op
			}
			if cmp, ok := ruleMap["compare"].(string); ok {
				rule["compare"] = cmp
			}
			rules = append(rules, rule)
		}
	}
	if len(rules) > 0 {
		params["rules"] = rules
	}

	if len(rules) > 0 {
		routes := make([]any, len(rules)+1)
		for i := range routes {
			routes[i] = nil
		}
		for _, edge := range edges {
			if edge.Source != n.ID {
				continue
			}
			if edge.SourceHandle == "switch-fallback" {
				routes[len(routes)-1] = edge.ID
				continue
			}
			if strings.HasPrefix(edge.SourceHandle, "switch-case-") {
				idx, err := strconv.Atoi(strings.TrimPrefix(edge.SourceHandle, "switch-case-"))
				if err == nil && idx >= 0 && idx < len(rules) {
					routes[idx] = edge.ID
				}
			}
		}
		params["routes"] = routes
	}

	return params
}

func mapLogParams(data map[string]any) map[string]any {
	params := map[string]any{}
	if msg, ok := data["message"].(string); ok && msg != "" {
		params["message"] = msg
	}
	if level, ok := data["level"].(string); ok && level != "" {
		params["level"] = level
	}
	return params
}

func mapEditParams(data map[string]any) map[string]any {
	params := map[string]any{}
	if mode, ok := data["mode"].(string); ok && mode != "" {
		params["mode"] = mode
	}
	if target, ok := data["target_path"].(string); ok && target != "" {
		params["target_path"] = target
	}
	if rawAssignments, ok := data["assignments"].([]any); ok {
		assignments := make([]any, 0)
		for _, raw := range rawAssignments {
			item, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			assignment := map[string]any{}
			if name, ok := item["name"].(string); ok {
				assignment["name"] = name
			}
			if value, ok := item["value"].(string); ok {
				assignment["value"] = value
			}
			if typ, ok := item["type"].(string); ok {
				assignment["type"] = typ
			}
			assignments = append(assignments, assignment)
		}
		params["assignments"] = assignments
	}
	return params
}

func mapFilterParams(data map[string]any) map[string]any {
	params := map[string]any{}
	if input, ok := data["input_array"].(string); ok && input != "" {
		params["input_array"] = input
	}
	if mode, ok := data["match_mode"].(string); ok && mode != "" {
		params["match_mode"] = mode
	}
	if rawRules, ok := data["rules"].([]any); ok {
		rules := make([]any, 0)
		for _, raw := range rawRules {
			item, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			rule := map[string]any{}
			if field, ok := item["field"].(string); ok {
				rule["field"] = field
			}
			if op, ok := item["operator"].(string); ok {
				rule["operator"] = op
			}
			if value, ok := item["value"]; ok {
				rule["value"] = value
			}
			rules = append(rules, rule)
		}
		params["rules"] = rules
	}
	return params
}

func mapSortParams(data map[string]any) map[string]any {
	params := map[string]any{}
	if input, ok := data["input_array"].(string); ok && input != "" {
		params["input_array"] = input
	}
	if rawRules, ok := data["rules"].([]any); ok {
		rules := make([]any, 0)
		for _, raw := range rawRules {
			item, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			rule := map[string]any{}
			if field, ok := item["field"].(string); ok {
				rule["field"] = field
			}
			if direction, ok := item["direction"].(string); ok {
				rule["direction"] = direction
			}
			if typ, ok := item["type"].(string); ok {
				rule["type"] = typ
			}
			rules = append(rules, rule)
		}
		params["rules"] = rules
	}
	return params
}

func mapLimitParams(data map[string]any) map[string]any {
	params := map[string]any{}
	if input, ok := data["input_array"].(string); ok && input != "" {
		params["input_array"] = input
	}
	if count, ok := data["count"]; ok {
		params["count"] = count
	}
	return params
}

func mapSplitParams(data map[string]any) map[string]any {
	params := map[string]any{}
	if input, ok := data["input_array"].(string); ok && input != "" {
		params["input_array"] = input
		return params
	}
	if input, ok := data["array_field"].(string); ok && input != "" {
		params["input_array"] = input
	}
	return params
}

func mapMergeParams(data map[string]any) map[string]any {
	params := map[string]any{}
	if waitMode, ok := data["wait_mode"].(string); ok && waitMode != "" {
		params["wait_mode"] = waitMode
	}
	if timeout, ok := data["timeout"]; ok {
		params["timeout"] = timeout
	}
	if mode, ok := data["mode"].(string); ok && mode != "" {
		params["mode"] = mode
	}
	return params
}

func mapDateTimeParams(nodeType string, data map[string]any) map[string]any {
	params := map[string]any{}
	if date, ok := data["date"].(string); ok && date != "" {
		params["date"] = date
	}
	if timezone, ok := data["timezone"].(string); ok && timezone != "" {
		params["timezone"] = timezone
	}
	if format, ok := data["format"].(string); ok && format != "" {
		params["format"] = format
	}
	if amount, ok := data["amount"]; ok {
		params["amount"] = amount
	}
	if unit, ok := data["unit"].(string); ok && unit != "" {
		params["unit"] = unit
	}
	if nodeType == "dateTimeNow" {
		delete(params, "date")
		delete(params, "amount")
		delete(params, "unit")
	}
	return params
}

func buildReport(workflowID, executionID string, statusMsgs []*messages.NodeStatusMessage, completionMsg *messages.CompletionMessage, nodeTypeByID map[string]string, nodeNameByID map[string]string, nodeTypeByName map[string]string, nodeParamsByID map[string]map[string]any, nodeParamsByName map[string]map[string]any) executionReport {
	normalizedStatuses := normalizeStatusMessages(statusMsgs, nodeTypeByID, nodeNameByID, nodeTypeByName, nodeParamsByID, nodeParamsByName)
	var completion *normalizedCompletion
	if completionMsg != nil {
		completion = &normalizedCompletion{
			Status:        completionMsg.Status,
			FailureReason: completionMsg.FailureReason,
			FinalContext:  normalizeContext(completionMsg.FinalContext, nodeTypeByName, nodeParamsByName),
		}
	}
	return executionReport{
		WorkflowID:     workflowID,
		ExecutionID:    executionID,
		StatusMessages: normalizedStatuses,
		Completion:     completion,
	}
}

func normalizeStatusMessages(msgs []*messages.NodeStatusMessage, nodeTypeByID, nodeNameByID, nodeTypeByName map[string]string, nodeParamsByID map[string]map[string]any, nodeParamsByName map[string]map[string]any) []normalizedStatus {
	filtered := make([]normalizedStatus, 0)
	for _, msg := range msgs {
		if msg == nil || msg.Status == messages.StatusRunning {
			continue
		}
		nodeType := nodeTypeByID[msg.NodeID]
		norm := normalizedStatus{
			NodeID:   msg.NodeID,
			NodeName: nodeNameByID[msg.NodeID],
			Status:   msg.Status,
			Output:   normalizeOutput(nodeType, msg.Output, nodeTypeByName, nodeParamsByName, nodeParamsByID[msg.NodeID]),
			Error:    msg.Error,
		}
		if msg.ItemIndex != nil {
			norm.ItemIndex = msg.ItemIndex
		}
		if msg.TotalItems != nil {
			norm.TotalItems = msg.TotalItems
		}
		filtered = append(filtered, norm)
	}

	sort.SliceStable(filtered, func(i, j int) bool {
		if filtered[i].NodeID != filtered[j].NodeID {
			return filtered[i].NodeID < filtered[j].NodeID
		}
		if filtered[i].ItemIndex != nil && filtered[j].ItemIndex != nil {
			return *filtered[i].ItemIndex < *filtered[j].ItemIndex
		}
		if filtered[i].ItemIndex != nil {
			return true
		}
		if filtered[j].ItemIndex != nil {
			return false
		}
		return filtered[i].Status < filtered[j].Status
	})

	return filtered
}

func normalizeOutput(nodeType string, output map[string]any, nodeTypeByName map[string]string, nodeParamsByName map[string]map[string]any, nodeParams map[string]any) map[string]any {
	if output == nil {
		return nil
	}

	switch nodeType {
	case "http":
		return normalizeMapNumbers(pickKeys(output, []string{"status"}))
	case "log":
		return normalizeMapNumbers(pickKeys(output, []string{"message", "level"}))
	case "conditional":
		normalized := pickKeys(output, []string{"result", "expression"})
		if expr, ok := nodeParams["expression"].(string); ok && expr != "" {
			normalized["expression"] = expr
		}
		return normalizeMapNumbers(normalized)
	case "switch":
		normalized := pickKeys(output, []string{"output_index", "matched_rule", "fallback"})
		if idx, ok := numberAsInt(output["output_index"]); ok {
			if rule, ok := ruleAt(nodeParams["rules"], idx); ok {
				normalized["matched_rule"] = rule
			}
		}
		return normalizeMapNumbers(normalized)
	case "split":
		return normalizeMapNumbers(pickKeys(output, []string{"_split_items"}))
	case "filter":
		return normalizeMapNumbers(pickKeys(output, []string{"$json", "count", "original_count"}))
	case "sort":
		return normalizeMapNumbers(pickKeys(output, []string{"$json", "count"}))
	case "limit":
		return normalizeMapNumbers(pickKeys(output, []string{"$json", "count", "original_count"}))
	case "edit":
		return normalizeMapNumbers(pickKeys(output, []string{"$json"}))
	case "aggregator":
		return normalizeAggregatorOutput(output, nodeTypeByName, nodeParamsByName)
	case "merge":
		return normalizeMergeOutput(output, nodeTypeByName, nodeParamsByName)
	case "dateTimeNow":
		return normalizeMapNumbers(map[string]any{
			"result":   "<dynamic>",
			"iso":      "<dynamic>",
			"unix":     "<dynamic>",
			"timezone": output["timezone"],
		})
	case "dateTimeParse":
		return normalizeMapNumbers(pickKeys(output, []string{"iso", "year", "month", "day", "hour", "minute", "second", "weekday", "timezone"}))
	case "dateTimeFormat":
		return normalizeMapNumbers(pickKeys(output, []string{"result", "timezone"}))
	case "dateTimeAdd":
		return normalizeMapNumbers(pickKeys(output, []string{"result", "timezone"}))
	case "dateTimeSubtract":
		return normalizeMapNumbers(pickKeys(output, []string{"result", "timezone"}))
	default:
		return normalizeMapNumbers(output)
	}
}

func normalizeAggregatorOutput(output map[string]any, nodeTypeByName map[string]string, nodeParamsByName map[string]map[string]any) map[string]any {
	normalized := map[string]any{}
	if aggregated, ok := output["aggregated"].([]any); ok {
		items := make([]any, 0, len(aggregated))
		for _, entry := range aggregated {
			entryMap, ok := mapFromAny(entry)
			if !ok {
				items = append(items, entry)
				continue
			}
			norm := normalizeContext(entryMap, nodeTypeByName, nodeParamsByName)
			items = append(items, normalizeMapNumbers(pickKeys(norm, []string{"$json", "$item"})))
		}
		normalized["aggregated"] = items
	}
	if waiting, ok := output["_barrier_closed"]; ok {
		normalized["_barrier_closed"] = waiting
	}
	if processed, ok := output["_aggregator_processed_count"]; ok {
		normalized["_aggregator_processed_count"] = processed
	}
	return normalizeMapNumbers(normalized)
}

func mapFromAny(value any) (map[string]any, bool) {
	if entryMap, ok := value.(map[string]any); ok {
		return entryMap, true
	}
	if raw, ok := value.(string); ok {
		var parsed map[string]any
		if err := json.Unmarshal([]byte(raw), &parsed); err == nil {
			return parsed, true
		}
	}
	return nil, false
}

func normalizeMergeOutput(output map[string]any, nodeTypeByName map[string]string, nodeParamsByName map[string]map[string]any) map[string]any {
	normalized := map[string]any{}
	if merged, ok := output["merged_context"].(map[string]any); ok {
		normalized["merged_context"] = normalizeContext(merged, nodeTypeByName, nodeParamsByName)
	}
	if payloads, ok := output["_merge_payloads"].([]any); ok {
		items := make([]any, 0, len(payloads))
		for _, entry := range payloads {
			entryMap, ok := entry.(map[string]any)
			if !ok {
				items = append(items, entry)
				continue
			}
			items = append(items, normalizeContext(entryMap, nodeTypeByName, nodeParamsByName))
		}
		normalized["_merge_payloads"] = items
	}
	for _, key := range []string{"_merge_expected", "_merge_winner", "_merge_ignored", "_merge_waiting", "_merge_arrived"} {
		if val, ok := output[key]; ok {
			normalized[key] = val
		}
	}
	return normalizeMapNumbers(normalized)
}

func normalizeContext(ctx map[string]any, nodeTypeByName map[string]string, nodeParamsByName map[string]map[string]any) map[string]any {
	if ctx == nil {
		return nil
	}
	normalized := make(map[string]any, len(ctx))
	for key, val := range ctx {
		if strings.HasPrefix(key, "$") {
			name := strings.TrimPrefix(key, "$")
			nodeType, ok := nodeTypeByName[name]
			if ok {
				outputMap, ok := val.(map[string]any)
				if ok {
					normalized[key] = normalizeOutput(nodeType, outputMap, nodeTypeByName, nodeParamsByName, nodeParamsByName[name])
					continue
				}
			}
		}
		normalized[key] = normalizeNumbers(val)
	}
	return normalized
}

func pickKeys(source map[string]any, keys []string) map[string]any {
	out := map[string]any{}
	for _, key := range keys {
		if val, ok := source[key]; ok {
			out[key] = val
		}
	}
	return out
}

func normalizeNumbers(value any) any {
	switch v := value.(type) {
	case int:
		return float64(v)
	case int8:
		return float64(v)
	case int16:
		return float64(v)
	case int32:
		return float64(v)
	case int64:
		return float64(v)
	case uint:
		return float64(v)
	case uint8:
		return float64(v)
	case uint16:
		return float64(v)
	case uint32:
		return float64(v)
	case uint64:
		return float64(v)
	case float32:
		return float64(v)
	case map[string]any:
		normalized := make(map[string]any, len(v))
		for key, val := range v {
			normalized[key] = normalizeNumbers(val)
		}
		return normalized
	case []any:
		normalized := make([]any, 0, len(v))
		for _, item := range v {
			normalized = append(normalized, normalizeNumbers(item))
		}
		return normalized
	default:
		return value
	}
}

func normalizeMapNumbers(value map[string]any) map[string]any {
	if value == nil {
		return nil
	}
	normalized, ok := normalizeNumbers(value).(map[string]any)
	if !ok {
		return value
	}
	return normalized
}

func numberAsInt(value any) (int, bool) {
	switch v := value.(type) {
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

func ruleAt(value any, idx int) (map[string]any, bool) {
	if idx < 0 {
		return nil, false
	}
	switch rules := value.(type) {
	case []any:
		if idx >= len(rules) {
			return nil, false
		}
		rule, ok := rules[idx].(map[string]any)
		return rule, ok
	case []map[string]any:
		if idx >= len(rules) {
			return nil, false
		}
		return rules[idx], true
	default:
		return nil, false
	}
}

func shouldUpdateSnapshots() bool {
	val := strings.TrimSpace(strings.ToLower(os.Getenv("UPDATE_SNAPSHOTS")))
	return val == "1" || val == "true" || val == "yes"
}

func writeJSON(path string, payload any) error {
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func readJSON(path string) (executionReport, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return executionReport{}, err
	}
	var report executionReport
	if err := json.Unmarshal(data, &report); err != nil {
		return executionReport{}, err
	}
	return report, nil
}
