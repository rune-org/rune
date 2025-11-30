# **RFC 004: Distributed Fan-Out/Fan-In Execution Pattern**

## **1\. Abstract**

This document specifies the architecture for **Data Parallelism** within the Rune engine. It introduces two infrastructure-level nodes:

1. **Split Node (split):** Implements the "Fan-Out" pattern, splitting array data into independent execution threads ("Mini-Workflows").  
2. **Aggregator Node (aggregator):** Implements the "Fan-In" pattern, acting as a distributed synchronization barrier to recombine parallel threads.

To support complex scenarios like nested loops (e.g., "For every User, iterate their Orders"), this RFC introduces a **Lineage Stack** protocol. This ensures that child branches execute in isolation but maintain the ancestral context required to merge correctly at the right level.

## **2\. Motivation**

The current recursive executor (RFC-001) processes workflows linearly. If a node outputs an array of 10,000 items, the subsequent node receives the entire array as a single payload. This creates two problems:

1. **Performance:** A single worker must process all 10,000 items sequentially.  
2. **Reliability:** If item \#9,999 fails, the entire batch might fail or require complex checkpointing.

By "exploding" the array into 10,000 discrete RabbitMQ messages, we achieve:

* **Horizontal Scaling:** 50 workers can process the batch simultaneously.  
* **Fault Isolation:** Item \#5 failing does not stop Item \#6.  
* **Granular Retry:** Only failed items are retried.

## **3\. Data Structures & Protocol Updates**

### **3.1 The Lineage Stack**

To manage nested splits, we cannot use a simple "Parent ID". We must track the full hierarchy of splits. We extend the NodeExecutionMessage envelope.

**New Field:** lineage\_stack (Array of Objects)

Each entry in the stack represents an active split context.

type StackFrame struct {  
    SplitNodeID string \`json:"split\_node\_id"\` // The node that generated this split  
    BranchID    string \`json:"branch\_id"\`     // Unique ID: {exec\_id}\_{split\_node}\_{index}  
    ItemIndex   int    \`json:"item\_index"\`    // 0-based index of this item  
    TotalItems  int    \`json:"total\_items"\`   // Total count in this batch  
}

**Message JSON Example (Nested Context):**

{  
  "execution\_id": "exec\_123",  
  "current\_node": "process\_order\_item",  
  "accumulated\_context": { ... },   
  "lineage\_stack": \[  
    // Bottom: Outer Loop (Users)  
    { "split\_node\_id": "split\_users", "item\_index": 5, "total\_items": 100, ... },  
    // Top: Inner Loop (Orders)  
    { "split\_node\_id": "split\_orders", "item\_index": 2, "total\_items": 5, ... }  
  \]  
}

**Worker Middleware Requirement:** All standard workers (HTTP, SMTP, etc.) **MUST** blindly copy the lineage\_stack from their input message to their output message. They are stateless regarding the stack.

## **4\. Node Specifications**

### **4.1 Split Node (split)**

**Role:** The "Scatter" mechanism.

Parameters:  
| Parameter | Type | Description |  
| :--- | :--- | :--- |  
| input\_array | string | Dynamic reference to the array (e.g., {{ $node.Http.body.users }}). |  
**Execution Logic:**

1. **Resolution:** Evaluate input\_array. Validates result is a Slice/Array. Let $N$ be the length.  
   * *Edge Case:* If Array is empty ($N=0$), see Section 6.1.  
2. **State Initialization:**  
   * Set exec:{id}:split:{my\_id}:expected \= $N$ in Redis.  
   * *TTL:* Set to 24h or Workflow Timeout.  
3. **Fan-Out (Publishing Loop):**  
   * Iterate $i$ from $0$ to $N-1$.  
   * **Context Isolation:** Create a new accumulated\_context. This new context usually promotes the specific item to a top-level key (e.g., $input or $item) so downstream nodes don't need to know the index.  
   * **Stack Manipulation:** \* Clone incoming lineage\_stack.  
     * Push new Frame: { SplitNodeID: my\_id, ItemIndex: i, TotalItems: N }.  
   * **Publish:** Send NodeExecutionMessage to the next node(s).  
4. **Termination:** The Split node **stops**. It does not publish a completion message for itself.

### **4.2 Aggregator Node (aggregator)**

**Role:** The "Gather" mechanism and Synchronization Barrier.

Parameters:  
| Parameter | Type | Default | Description |  
| :--- | :--- | :--- | :--- |  
| timeout | int | 300 | Seconds to wait for all items before failing. |  
**Execution Logic:**

1. **Context Resolution:**  
   * Peek at lineage\_stack\[len-1\] (Top Frame).  
   * *Validation:* If stack is empty, throw error (Aggregator placed outside a split).  
   * Let SplitID \= frame.SplitNodeID.  
2. **Atomic Synchronization (Lua):**  
   * Call aggregate.lua with SplitID, frame.ItemIndex, and frame.TotalItems.  
   * Pass the current accumulated\_context (or just the specific branch result) as the payload.  
3. **Result Handling:**  
   * **Barrier Pending:** \* Worker ACKs message.  
     * Worker emits NodeStatusMessage (Status: "waiting", Summary: "Collected X/N").  
     * Worker **Exits** (Stateless sleep).  
   * **Barrier Complete:**  
     * Lua script returns the full, sorted list of results.  
     * **Stack Pop:** Remove the Top Frame from lineage\_stack.  
     * **Context Merge:** Update accumulated\_context. Usually sets $node\_name \= \[Result\_0, Result\_1, ...\].  
     * **Publish:** Send NodeExecutionMessage to the next node.

## **5\. Technical Implementation Details**

### **5.1 Redis Data Schema**

All keys are scoped by ExecutionID and the SplitNodeID (from the stack). This ensures uniqueness even if multiple Aggregators exist.

* exec:{id}:split:{split\_id}:results (**Hash**)  
  * Field: item\_index (string)  
  * Value: JSON payload  
* exec:{id}:split:{split\_id}:count (**String/Counter**)  
  * Value: integer (Number of items arrived)  
* exec:{id}:split:{split\_id}:expected (**String**)  
  * Value: integer (Total items expected \- set by Split)

### **5.2 The Aggregation Lua Script**

This script ensures atomicity. We cannot read/check/write in Go code due to race conditions.

\-- script: aggregate.lua  
\-- KEYS\[1\]: results\_hash\_key  
\-- KEYS\[2\]: count\_key  
\-- KEYS\[3\]: expected\_key  
\-- ARGV\[1\]: item\_index  
\-- ARGV\[2\]: item\_result\_json

\-- 1\. Save the result for this specific item  
redis.call('HSET', KEYS\[1\], ARGV\[1\], ARGV\[2\])

\-- 2\. Increment the "Arrived" counter  
local current \= redis.call('INCR', KEYS\[2\])

\-- 3\. Fetch the target total (set by Split)  
local total\_str \= redis.call('GET', KEYS\[3\])  
if not total\_str then  
    return redis.error\_reply("ERR\_MISSING\_TOTAL: Split did not initialize expected count")  
end  
local total \= tonumber(total\_str)

\-- 4\. Check Barrier  
if current \== total then  
    \-- BARRIER OPEN\!  
      
    \-- Fetch all items in order 0..N-1  
    local combined \= {}  
    for i=0, (total-1) do  
        local val \= redis.call('HGET', KEYS\[1\], tostring(i))  
        if not val then   
            \-- Should not happen in reliable messaging, but handle gracefully  
            table.insert(combined, "null")   
        else  
            table.insert(combined, val)  
        end  
    end  
      
    \-- Cleanup Keys  
    redis.call('DEL', KEYS\[1\], KEYS\[2\], KEYS\[3\])  
      
    \-- Return JSON array string  
    return cjson.encode(combined)  
else  
    \-- Barrier still closed  
    return nil  
end

### **5.3 Auto-Resolution (Ghost Signal)**

If a user creates a branch that ends (e.g., Split \-\> If \-\> (False: End)) without merging, the Aggregator would hang.

**Mechanism:**

1. **Detection:** When Executor finishes a node and finds **0 outgoing edges**.  
2. **Check:** Is lineage\_stack not empty?  
3. **Action:**  
   * Do **NOT** send CompletionMessage.  
   * Identify the Top Frame (SplitID, Index).  
   * **Ghost Commit:** Execute a variant of aggregate.lua that increments the counter but stores null (or a "skipped" marker) for that index.  
   * **Recursive Check:** If this Ghost Commit triggers the barrier to open (i.e., this was the last item):  
     * The "Virtual Aggregator" logic runs.  
     * Pop the stack.  
     * If stack is now empty \-\> Send CompletionMessage (Workflow Done).  
     * If stack not empty \-\> Repeat Ghost Commit for the *next* parent frame.

## **6\. Edge Cases**

### **6.1 Empty Array (N=0)**

If Split receives an empty list:

* It cannot spawn children.  
* **Action:** It must effectively "Jump" over the split scope.  
* It creates a NodeExecutionMessage for the **next** node (or Aggregator) with an empty array payload immediately.  
* *Note:* This requires the Split to know where the Aggregator is, or simpler: It publishes to the next node with lineage\_stack unchanged. If the next node is Aggregator, it handles empty input instantly.

### **6.2 Partial Failures**

If Item 5 panics or errors:

* **Default:** The error is caught by Executor.  
* **Policy:** The Executor sends an "Error Result" to the Aggregator (e.g., {"error": "timeout"}).  
* **Result:** The Aggregator still finishes (Count reaches N). The output array contains 99 successes and 1 error object.

### **6.3 Aggregator Timeout**

If a worker crashes hard (RabbitMQ message lost before ACK) or logic hangs:

* RabbitMQ DLX handles message retry.  
* If purely logic timeout (e.g., item taking too long), the Aggregator's timeout parameter kicks in via a scheduled check (See RFC-005 Timeout Logic).

## **7\. Observability & Status**

### **7.1 Execution Graph**

The UI needs to understand that one node is running 1,000 times.

* NodeStatusMessage includes lineage\_stack.  
* The UI groups these statuses by SplitNodeID.

### **7.2 Progress Bars**

The Aggregator emits waiting status updates on every arrival.

* Payload: { "processed": 450, "total": 1000 }.  
* Frontend: Uses this to show a live progress bar on the Aggregator node.

## **8\. Implementation Checklist**

* \[ \] **DSL:** Add split and aggregator to schema.  
* \[ \] **Core:** Update MessageEnvelope struct.  
* \[ \] **RabbitMQ:** Ensure prefetch counts are high enough for aggregators (or use standard 1 and rely on fast ACKs).  
* \[ \] **Redis:** Deploy aggregate.lua.  
* \[ \] **Executor:** Add logic to "Auto-Resolve" terminal nodes if stack is present.  
* \[ \] **Tests:** Add integration test for Nested Loops (Split \-\> Split \-\> Agg \-\> Agg).