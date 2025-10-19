# Custom Nodes Development Guide

Learn how to create custom node types to extend the Rune Workflow Worker functionality.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Step-by-Step Guide](#step-by-step-guide)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

The Rune Workflow Worker uses an **auto-registration system** that automatically discovers and registers custom nodes. This makes adding new functionality simple and maintainable.

### How It Works

1. Create a new package implementing the `plugin.Node` interface
2. Register your node in the `init()` function
3. Import the package in `pkg/registry/init_registry.go`
4. Your node is automatically available in workflows

### Node Interface

```go
type Node interface {
    Execute(ctx context.Context, execCtx ExecutionContext) (map[string]any, error)
}
```

## Quick Start

### Minimal Node Example

```go
package mynode

import (
    "context"
    "rune-worker/pkg/nodes"
    "rune-worker/plugin"
)

type MyNode struct {
    message string
}

func NewMyNode(execCtx plugin.ExecutionContext) *MyNode {
    msg, _ := execCtx.Parameters["message"].(string)
    return &MyNode{message: msg}
}

func (n *MyNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    return map[string]any{
        "result": "success",
        "message": n.message,
    }, nil
}

func init() {
    nodes.RegisterNodeType(RegisterMyNode)
}

func RegisterMyNode(reg *nodes.Registry) {
    reg.Register("mynode", func(execCtx plugin.ExecutionContext) plugin.Node {
        return NewMyNode(execCtx)
    })
}
```

## Step-by-Step Guide

### Step 1: Create Package Structure

```bash
mkdir -p pkg/nodes/custom/mynode
cd pkg/nodes/custom/mynode
touch mynode.go mynode_test.go parameters.go
```

### Step 2: Define Parameters (Optional)

If your node has complex parameters:

```go
// parameters.go
package mynode

type MyNodeParameters struct {
    Message    string            `json:"message"`
    Timeout    int               `json:"timeout,omitempty"`
    Options    map[string]string `json:"options,omitempty"`
    RetryCount int               `json:"retry_count,omitempty"`
}
```

### Step 3: Implement the Node

```go
// mynode.go
package mynode

import (
    "context"
    "fmt"
    "log/slog"
    "time"
    
    "rune-worker/pkg/nodes"
    "rune-worker/plugin"
)

type MyNode struct {
    message    string
    timeout    time.Duration
    options    map[string]string
    retryCount int
}

func NewMyNode(execCtx plugin.ExecutionContext) *MyNode {
    node := &MyNode{
        message:    "default message",
        timeout:    30 * time.Second,
        options:    make(map[string]string),
        retryCount: 0,
    }
    
    // Parse parameters
    if msg, ok := execCtx.Parameters["message"].(string); ok {
        node.message = msg
    }
    
    if timeout, ok := execCtx.Parameters["timeout"].(float64); ok {
        node.timeout = time.Duration(timeout) * time.Second
    }
    
    if opts, ok := execCtx.Parameters["options"].(map[string]interface{}); ok {
        for k, v := range opts {
            if strVal, ok := v.(string); ok {
                node.options[k] = strVal
            }
        }
    }
    
    if retry, ok := execCtx.Parameters["retry_count"].(float64); ok {
        node.retryCount = int(retry)
    }
    
    return node
}

func (n *MyNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    slog.Info("executing mynode",
        "node_id", execCtx.NodeID,
        "message", n.message,
    )
    
    // Create context with timeout
    timeoutCtx, cancel := context.WithTimeout(ctx, n.timeout)
    defer cancel()
    
    // Execute business logic
    result, err := n.performWork(timeoutCtx, execCtx)
    if err != nil {
        return nil, fmt.Errorf("mynode execution failed: %w", err)
    }
    
    // Return output
    return map[string]any{
        "success": true,
        "message": n.message,
        "result":  result,
        "options": n.options,
    }, nil
}

func (n *MyNode) performWork(ctx context.Context, execCtx plugin.ExecutionContext) (string, error) {
    // Your implementation here
    return "work completed successfully", nil
}

func init() {
    nodes.RegisterNodeType(RegisterMyNode)
}

func RegisterMyNode(reg *nodes.Registry) {
    reg.Register("mynode", func(execCtx plugin.ExecutionContext) plugin.Node {
        return NewMyNode(execCtx)
    })
}
```

### Step 4: Write Tests

```go
// mynode_test.go
package mynode

import (
    "context"
    "testing"
    "rune-worker/plugin"
)

func TestMyNode_Execute(t *testing.T) {
    tests := []struct {
        name       string
        params     map[string]interface{}
        wantErr    bool
        wantResult string
    }{
        {
            name: "basic execution",
            params: map[string]interface{}{
                "message": "test message",
            },
            wantErr:    false,
            wantResult: "work completed successfully",
        },
        {
            name: "with options",
            params: map[string]interface{}{
                "message": "test",
                "options": map[string]interface{}{
                    "key1": "value1",
                },
            },
            wantErr:    false,
            wantResult: "work completed successfully",
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            execCtx := plugin.ExecutionContext{
                NodeID:     "test_node",
                Type:       "mynode",
                Parameters: tt.params,
                Input:      make(map[string]interface{}),
            }
            
            node := NewMyNode(execCtx)
            output, err := node.Execute(context.Background(), execCtx)
            
            if (err != nil) != tt.wantErr {
                t.Errorf("Execute() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            
            if !tt.wantErr {
                result, ok := output["result"].(string)
                if !ok || result != tt.wantResult {
                    t.Errorf("Execute() result = %v, want %v", result, tt.wantResult)
                }
            }
        })
    }
}
```

### Step 5: Register in Init Registry

Edit `pkg/registry/init_registry.go`:

```go
package registry

import (
    "log/slog"
    "rune-worker/pkg/nodes"
    
    _ "rune-worker/pkg/nodes/custom/http"
    _ "rune-worker/pkg/nodes/custom/conditional"
    _ "rune-worker/pkg/nodes/custom/mynode"  // Add your node
)

func InitializeRegistry() *nodes.Registry {
    reg := nodes.NewRegistry()
    
    for _, register := range nodes.GetRegisteredNodeTypes() {
        register(reg)
    }
    
    types := reg.GetAllTypes()
    slog.Info("node registry initialized", "registered_nodes", len(types), "types", types)
    
    return reg
}
```

### Step 6: Test and Use

```bash
# Run tests
go test ./pkg/nodes/custom/mynode/... -v

# Build worker
go build -o worker cmd/worker/main.go

# Use in workflow
```

```json
{
  "id": "test_mynode",
  "name": "Test My Node",
  "type": "mynode",
  "parameters": {
    "message": "Hello from custom node",
    "timeout": 60,
    "options": {
      "mode": "production"
    }
  }
}
```

## Advanced Features

### Accessing Previous Node Output

```go
func (n *MyNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    // Access output from previous node
    if userData, ok := execCtx.Input["$fetch_user"].(map[string]interface{}); ok {
        userID, _ := userData["user_id"].(float64)
        slog.Info("processing user", "user_id", userID)
    }
    
    // Access workflow input
    if triggerData, ok := execCtx.Input["$input"].(map[string]interface{}); ok {
        requestID, _ := triggerData["request_id"].(string)
        slog.Info("processing request", "request_id", requestID)
    }
    
    // Your implementation
    return map[string]any{"success": true}, nil
}
```

### Working with Credentials

```go
func (n *MyNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    // Check if credentials are available
    if !execCtx.HasCredentials() {
        return nil, fmt.Errorf("credentials required but not provided")
    }
    
    creds := execCtx.GetCredentials()
    
    // Access credential values
    apiKey, ok := creds["api_key"].(string)
    if !ok {
        return nil, fmt.Errorf("api_key credential not found")
    }
    
    // Use credential
    slog.Debug("using api key", "key_length", len(apiKey))
    
    // Your implementation
    return map[string]any{"authenticated": true}, nil
}
```

### Error Handling with Retries

```go
func (n *MyNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    var lastErr error
    
    for attempt := 0; attempt <= n.retryCount; attempt++ {
        if attempt > 0 {
            slog.Warn("retrying operation",
                "attempt", attempt,
                "max_retries", n.retryCount,
            )
            
            // Exponential backoff
            backoff := time.Duration(attempt) * time.Second
            time.Sleep(backoff)
        }
        
        result, err := n.performWork(ctx, execCtx)
        if err == nil {
            return map[string]any{
                "success":  true,
                "result":   result,
                "attempts": attempt + 1,
            }, nil
        }
        
        lastErr = err
        
        // Check if context was cancelled
        if ctx.Err() != nil {
            return nil, ctx.Err()
        }
    }
    
    return nil, fmt.Errorf("operation failed after %d attempts: %w",
        n.retryCount+1, lastErr)
}
```

### Context Timeout Handling

```go
func (n *MyNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    // Create timeout context
    timeoutCtx, cancel := context.WithTimeout(ctx, n.timeout)
    defer cancel()
    
    // Use channel for result
    resultChan := make(chan string, 1)
    errChan := make(chan error, 1)
    
    go func() {
        result, err := n.performWork(timeoutCtx, execCtx)
        if err != nil {
            errChan <- err
            return
        }
        resultChan <- result
    }()
    
    // Wait for result or timeout
    select {
    case result := <-resultChan:
        return map[string]any{"result": result}, nil
    case err := <-errChan:
        return nil, err
    case <-timeoutCtx.Done():
        return nil, fmt.Errorf("operation timed out after %v", n.timeout)
    }
}
```

### Structured Logging

```go
func (n *MyNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    // Log with context
    slog.Info("starting execution",
        "workflow_id", execCtx.WorkflowID,
        "execution_id", execCtx.ExecutionID,
        "node_id", execCtx.NodeID,
        "node_type", execCtx.Type,
    )
    
    result, err := n.performWork(ctx, execCtx)
    
    if err != nil {
        slog.Error("execution failed",
            "node_id", execCtx.NodeID,
            "error", err,
        )
        return nil, err
    }
    
    slog.Info("execution completed",
        "node_id", execCtx.NodeID,
        "result_length", len(result),
    )
    
    return map[string]any{"result": result}, nil
}
```

## Best Practices

### 1. Parameter Validation

Always validate and provide defaults:

```go
func NewMyNode(execCtx plugin.ExecutionContext) *MyNode {
    node := &MyNode{
        message: "default",  // Default value
        timeout: 30 * time.Second,
    }
    
    // Validate required parameters
    if msg, ok := execCtx.Parameters["message"].(string); ok && msg != "" {
        node.message = msg
    } else {
        // Log warning about using default
        slog.Warn("message parameter not provided, using default")
    }
    
    return node
}
```

### 2. Error Messages

Provide descriptive errors:

```go
if err != nil {
    return nil, fmt.Errorf("failed to process data for node %s: %w",
        execCtx.NodeID, err)
}
```

### 3. Context Handling

Respect context cancellation:

```go
func (n *MyNode) performWork(ctx context.Context, execCtx plugin.ExecutionContext) error {
    for i := 0; i < 100; i++ {
        // Check for cancellation
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
            // Continue work
        }
        
        // Do work
    }
    return nil
}
```

### 4. Output Structure

Return consistent output:

```go
return map[string]any{
    "success":    true,
    "result":     data,
    "timestamp":  time.Now().Unix(),
    "metadata":   metadata,
}, nil
```

### 5. Never Log Secrets

```go
// DON'T do this
slog.Info("using credentials", "api_key", apiKey)

// DO this instead
slog.Info("using credentials", "has_api_key", apiKey != "")
```

### 6. Use Timeouts

```go
func NewMyNode(execCtx plugin.ExecutionContext) *MyNode {
    timeout := 30 * time.Second  // Default timeout
    
    if t, ok := execCtx.Parameters["timeout"].(float64); ok && t > 0 {
        timeout = time.Duration(t) * time.Second
    }
    
    return &MyNode{timeout: timeout}
}
```

### 7. Test Thoroughly

```go
func TestMyNode_ErrorHandling(t *testing.T) {
    // Test success case
    // Test error case
    // Test timeout case
    // Test with missing parameters
    // Test with invalid parameters
    // Test context cancellation
}
```

## Examples

See the built-in node implementations for complete examples:

- **HTTP Node**: `pkg/nodes/custom/http/http_node.go`
- **Conditional Node**: `pkg/nodes/custom/conditional/conditional_node.go`

### Example: Database Query Node

```go
package database

import (
    "context"
    "database/sql"
    "fmt"
    "rune-worker/pkg/nodes"
    "rune-worker/plugin"
)

type DatabaseNode struct {
    query      string
    parameters []interface{}
}

func NewDatabaseNode(execCtx plugin.ExecutionContext) *DatabaseNode {
    node := &DatabaseNode{
        parameters: make([]interface{}, 0),
    }
    
    if query, ok := execCtx.Parameters["query"].(string); ok {
        node.query = query
    }
    
    if params, ok := execCtx.Parameters["parameters"].([]interface{}); ok {
        node.parameters = params
    }
    
    return node
}

func (n *DatabaseNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    // Get database connection from credentials
    if !execCtx.HasCredentials() {
        return nil, fmt.Errorf("database credentials required")
    }
    
    creds := execCtx.GetCredentials()
    connStr := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s",
        creds["username"], creds["password"],
        creds["host"], creds["port"], creds["database"])
    
    db, err := sql.Open("mysql", connStr)
    if err != nil {
        return nil, fmt.Errorf("failed to connect: %w", err)
    }
    defer db.Close()
    
    // Execute query
    rows, err := db.QueryContext(ctx, n.query, n.parameters...)
    if err != nil {
        return nil, fmt.Errorf("query failed: %w", err)
    }
    defer rows.Close()
    
    // Process results
    var results []map[string]interface{}
    // ... (result processing logic)
    
    return map[string]any{
        "rows":       results,
        "row_count":  len(results),
    }, nil
}

func init() {
    nodes.RegisterNodeType(RegisterDatabaseNode)
}

func RegisterDatabaseNode(reg *nodes.Registry) {
    reg.Register("database", func(execCtx plugin.ExecutionContext) plugin.Node {
        return NewDatabaseNode(execCtx)
    })
}
```

---

**Related Documentation:**
- [Node Types Reference](NODE_TYPES.md) - Built-in node documentation
- [Workflow DSL](WORKFLOW_DSL.md) - Using nodes in workflows
- [Testing Guide](TESTING.md) - Testing custom nodes
