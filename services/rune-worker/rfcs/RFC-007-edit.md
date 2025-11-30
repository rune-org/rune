# **RFC 007: Edit Node Architecture (Data Transformation)**

**Author:** Seif Elwarwary

**Status:** PROPOSED

**Created:** 2025-05-01

**Depends On:** RFC-001, RFC-002, RFC-004

## **1\. Abstract**

This document specifies the architecture for the **Edit Node** (also known as the "Set" or "Transform" node). This node serves as the primary mechanism for data manipulation within a workflow. It allows users to modify the JSON payload of an item as it moves through the graph, supporting operations like adding new fields, renaming keys, keeping only specific fields, and executing dynamic expressions (e.g., calculations or string concatenation).

The implementation relies on a **Stateless Execution Model** combined with a secure **JavaScript Sandbox (Goja)** for evaluating dynamic expressions, ensuring high performance and security.

## **2\. Motivation**

Workflows rarely consist of simple data passing. Data from an HTTP request often needs to be reshaped before being sent to a downstream service (e.g., a CRM that requires a specific format).

Common scenarios include:

* **Projection:** "Keep only id and email from this large user object."  
* **Enrichment:** "Add a processed\_at timestamp field."  
* **Transformation:** "Combine first\_name and last\_name into full\_name."  
* **Calculation:** "Calculate total\_price as quantity \* unit\_price."  
* **Renaming:** Change user\_id to externalId to match a target schema.

The Edit Node provides a declarative interface for these operations, powered by a robust expression engine.

## **3\. Node Specification (DSL)**

This node type extends the DSL defined in RFC-002.

**Type Identifier:** edit

**Parameters:**

| Parameter | Type | Default | Description |
| :---- | :---- | :---- | :---- |
| mode | enum | assignments | Transformation mode. assignments: Add or overwrite specific fields while keeping others (based on keep\_others implicit behavior). keep\_only: Discard all fields *except* those explicitly listed in assignments. |
| assignments | array | \[\] | List of field operations. |
| assignments\[\].name | string | \- | The key to set (e.g., user.address.city). Supports dot-notation for nested objects. |
| assignments\[\].value | string | \- | The value to assign. Supports dynamic expressions (e.g., {{ $json.price \* 1.2 }}). |
| assignments\[\].type | enum | string | Target type casting: string, number, boolean, json. |

**Example JSON:**

{  
  "id": "edit\_node\_1",  
  "type": "edit",  
  "name": "Format User Data",  
  "parameters": {  
    "mode": "assignments",  
    "assignments": \[  
      {  
        "name": "full\_name",  
        "value": "{{ $json.first\_name \+ ' ' \+ $json.last\_name }}",  
        "type": "string"  
      },  
      {  
        "name": "is\_active",  
        "value": "true",  
        "type": "boolean"  
      },  
      {  
        "name": "metadata.source",  
        "value": "api\_v2",  
        "type": "string"  
      },  
      {  
        "name": "calculated\_tax",  
        "value": "{{ $json.subtotal \* 0.2 }}",  
        "type": "number"  
      }  
    \]  
  },  
  "output": {},  
  "error": { "type": "halt" }  
}

## **4\. Architecture & Implementation**

### **4.1 Stateless Execution**

Unlike the Wait or Merge nodes, the Edit Node is **purely functional** and **stateless**.

* **Input:** NodeExecutionMessage containing a payload (and context).  
* **Process:** Apply transformations in memory using the Go worker's CPU.  
* **Output:** New NodeExecutionMessage with the transformed payload.

It does **not** require Redis or external state persistence, making it highly scalable. It can be horizontally scaled across as many workers as needed.

### **4.2 The Execution Pipeline**

When a worker receives a message for an Edit Node, it follows this strict sequence:

1. **Deep Copy:** Create a deep copy of the input payload ($json). This ensures immutability and prevents side effects if the context is theoretically shared (though in our RabbitMQ architecture, messages are distinct).  
2. **Mode Initialization:**  
   * If mode \== keep\_only: Initialize a new, empty map outputMap \= {}.  
   * If mode \== assignments: Initialize outputMap as the cloned input payload.  
3. **Assignment Iteration:** Loop through the configured assignments array sequentially.  
4. **Resolution Logic:** For each assignment:  
   * **Evaluate Expression:** Resolve the value string using the Expression Engine (Section 4.3). This might return a Go primitive (string, float64, bool, nil) or a complex type.  
   * **Type Cast:** Convert the resolved value to the target type defined in the assignment (Section 5.2).  
   * **Set Operation:** Write the value to outputMap at the path specified by name.  
     * *Deep Set:* If name contains dots (e.g., address.city), the engine must strictly parse the path, create nested maps if they don't exist, and set the leaf value.  
5. **Publish:** Wrap the final outputMap in a new execution message and publish to the next node.

### **4.3 Expression Resolution Engine**

The core capabilities of the Edit Node rely on evaluating dynamic expressions enclosed in {{ ... }}.

* **Syntax:** Double curly braces {{ expression }}.  
* **Engine:** We use **Goja** (a pure Go implementation of ECMAScript 5.1/JavaScript). This avoids the overhead and complexity of cgo or managing external Node.js processes.

**Context Injection:**

The JS environment is pre-populated with variables representing the current workflow state:

| Variable | Description | Example Access |
| :---- | :---- | :---- |
| $json | The JSON payload of the item currently being processed. | $json.user.id |
| $prevNode | Access to the output of the immediately preceding node (often alias for $json). | $prevNode.status |
| $\<node\_name\> | Access to the output of **any** specific previous node in the accumulated context. | $http1.body.user.name |

**Security Constraints:**

* **No I/O:** The Goja sandbox must be initialized without access to the standard library's I/O capabilities. No fs (file system), net (network), or os access is permitted.  
* **Timeout:** Script execution must be wrapped in a context with a strict timeout (e.g., 100ms) to prevent infinite loops (e.g., while(true){}) from hanging the worker.  
* **Memory Limit:** While Goja manages memory within the Go heap, extreme allocation patterns should be monitored.

## **5\. Technical Details**

### **5.1 Dot Notation Handling (SetNested)**

The Set operation must handle nested paths intelligently to support structured data manipulation.

**Function Signature:** func SetNested(obj map\[string\]interface{}, path string, value interface{}) error

**Algorithm:**

1. Split path by . into keys: \["address", "geo", "lat"\].  
2. Iterate through keys up to the second-to-last one (address, geo).  
3. For each key:  
   * Check if it exists in the current map level.  
   * If it exists and is a map\[string\]interface{}, traverse into it.  
   * If it exists but is *not* a map (e.g., a string), this is a conflict. Return an error (cannot set property of non-object).  
   * If it does *not* exist, create a new map\[string\]interface{} and assign it to the key.  
4. Set the final key (lat) to value in the deepest map found/created.

### **5.2 Type Casting Table**

The assignments\[\].type parameter dictates the final Go type stored in the JSON map. This ensures downstream nodes receive predictable types.

| Source Value (Resolved) | Target Type | Logic/Result |
| :---- | :---- | :---- |
| "123" (string) | number | 123.0 (float64) via strconv.ParseFloat |
| 123 (int) | string | "123" via fmt.Sprintf |
| "true" (string) | boolean | true (bool) |
| "yes" (string) | boolean | true (bool) |
| 1 (int) | boolean | true (bool) |
| "\[1, 2\]" (string) | json | \[1, 2\] (\[\]interface{}) via json.Unmarshal |
| { "a": 1 } (map) | string | "{ \\"a\\": 1 }" (JSON String) |
| Any | string | Default JSON String representation |

**Error Handling:** If casting fails (e.g., attempting to cast "hello" to number), the node execution should fail and return an error, stopping the branch (unless error handling is set to ignore).

## **6\. Message Handling & Integration**

The Edit Node follows the standard protocol defined in RFC-001 and RFC-004.

### **6.1 Lineage Stack (RFC-004 Compatibility)**

The Edit Node is **"Lineage-Transparent"**.

* **Input:** Receives lineage\_stack in the execution message envelope.  
* **Behavior:** It **MUST** copy the lineage\_stack field from the input message to the output message verbatim.  
* **Why:** The Edit Node does not split or merge execution flows. It processes 1 item and outputs 1 item (1:1 mapping). Therefore, it preserves the parallel context. This ensures that if the Edit Node is inside a "For Each" loop (Fan-Out), the subsequent Aggregator can still correctly identify which index this item belongs to.

### **6.2 Status & Completion**

* **Status:** Publishes NodeStatusMessage  
  * status: running (on start)  
  * status: success (on completion, potentially with a small snippet of the output for debugging visibility)  
  * status: failed (on expression evaluation error or type cast failure)  
* **Completion:** If the Edit Node is the **Final Node** in the workflow (no outgoing edges), it triggers the standard completion logic:  
  * It checks the lineage\_stack.  
  * If stack is empty \-\> Publishes CompletionMessage.  
  * If stack is NOT empty \-\> Triggers the **Ghost Signal** (Auto-Resolution) to the parent Aggregator (as defined in RFC-004).

## **7\. Implementation Checklist**

* $$ $$  
  **Core Logic:** Implement EditNode struct satisfying the Node interface.  
* $$ $$  
  **Expression Engine:**  
  * $$ $$  
    Integrate goja library.  
  * $$ $$  
    Implement Evaluate(expression, context) helper function.  
  * $$ $$  
    Add tests for context injection ($json, $http1, etc.).  
  * $$ $$  
    Implement execution timeout (context cancellation).  
* $$ $$  
  **Data Utils:**  
  * $$ $$  
    Implement SetNested(map, path, val).  
  * $$ $$  
    Implement DeepCopy(map).  
  * $$ $$  
    Implement TypeCast(val, type).  
* $$ $$  
  **Validation:**  
  * $$ $$  
    Ensure assignments types match valid enums.  
  * $$ $$  
    Validate mode is supported.  
* $$ $$  
  **Tests:**  
  * $$ $$  
    Unit tests for simple assignment (string \-\> string).  
  * $$ $$  
    Unit tests for keep\_only mode (filtering).  
  * $$ $$  
    Unit tests for nested dot notation setting.  
  * $$ $$  
    Integration test: Edit Node inside a loop (verifying Lineage Stack preservation).

## **8\. Execution Example**

Workflow Scenario:  
We are processing a list of e-commerce orders. We have split the orders (Fan-Out). Now, for one specific order, we want to calculate the tax and format the shipping address using data from a previous HTTP node (http\_fetch\_rates).  
**1\. Workflow Definition (Snippet):**

{  
  "id": "edit\_process\_order",  
  "type": "edit",  
  "parameters": {  
    "mode": "assignments",  
    "assignments": \[  
      {  
        "name": "tax\_amount",  
        "value": "{{ $json.total \* $http\_fetch\_rates.body.tax\_rate }}", // Accessing previous node  
        "type": "number"  
      },  
      {  
        "name": "shipping.full\_address",  
        "value": "{{ $json.shipping.street \+ ', ' \+ $json.shipping.city }}",  
        "type": "string"  
      }  
    \]  
  }  
}

**2\. Input Message (accumulated\_context for this branch):**

{  
  "$json": {  
    "order\_id": "ORD-123",  
    "total": 100.00,  
    "shipping": {  
      "street": "123 Main St",  
      "city": "Cairo",  
      "country": "EG"  
    }  
  },  
  "$http\_fetch\_rates": {  
    "body": {  
      "tax\_rate": 0.15,  
      "currency": "EGP"  
    }  
  }  
}

**3\. Execution Steps:**

* **Step 1 (Deep Copy):** Worker clones $json. outputMap is now identical to input.  
* **Step 2 (Assignment 1):**  
  * Evaluate {{ $json.total \* $http\_fetch\_rates.body.tax\_rate }} \-\> 100.00 \* 0.15 \-\> 15.0.  
  * Cast to number \-\> 15.0 (float64).  
  * Set tax\_amount \-\> outputMap\["tax\_amount"\] \= 15.0.  
* **Step 3 (Assignment 2):**  
  * Evaluate {{ ... }} \-\> "123 Main St, Cairo".  
  * Cast to string.  
  * Set shipping.full\_address \-\>  
    * Traverse shipping.  
    * Set full\_address inside it.

**4\. Resulting Output (accumulated\_context update):**

{  
  "order\_id": "ORD-123",  
  "total": 100.00,  
  "tax\_amount": 15.0, // New Field  
  "shipping": {  
    "street": "123 Main St",  
    "city": "Cairo",  
    "country": "EG",  
    "full\_address": "123 Main St, Cairo" // New Nested Field  
  }  
}

