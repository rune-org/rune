# **RFC 005: Merge Node Architecture**

## **1\. Abstract**

This document provides a comprehensive technical specification for the **Merge Node** within the Rune workflow engine. It addresses the challenge of synchronizing distributed, asynchronous execution paths. The design leverages **RabbitMQ** for message transport and **Redis** for atomic state management, barrier synchronization, and mutual exclusion locks. It details two distinct operational modes: wait\_for\_all (Barrier) and wait\_for\_any (Race), along with robust timeout handling mechanisms.

## **2\. Motivation**

In a distributed, event-driven architecture like Rune, workflow branches execute in isolation on separate worker instances. When execution paths split (e.g., via If nodes, parallel branches, or Switch nodes), they must often reconverge to aggregate data or continue a single unified process.

A specialized **Merge Node** is essential to:

1. **Synchronize Concurrent Execution:** Act as a barrier that halts downstream execution until all upstream dependencies are met (wait\_for\_all).  
2. **Resolve Race Conditions:** Arbitrate scenarios where multiple branches could trigger the same downstream logic, ensuring mutual exclusion where only the first arrival wins (wait\_for\_any).  
3. **Unify Data Contexts:** Intelligently merge the accumulated\_context from divergent branches back into a single source of truth.

## **3\. Node Specification (DSL)**

This new node type extends the DSL defined in RFC-002.

**Type Identifier:** merge

**Parameters:**

| Parameter | Type | Default | Description |
| :---- | :---- | :---- | :---- |
| mode | enum | append | append: All incoming payloads are combined into an array. |
| wait\_mode | enum | wait\_for\_all | wait\_for\_all: Synchronization barrier. Waits for *all* configured parent nodes to arrive. wait\_for\_any: First-past-the-post. The first parent to arrive triggers execution; others are ignored/discarded. |
| timeout | integer | 300 | Safety timeout in seconds. If the condition is not met within this window, the node fails. |

**Example JSON Definition:**

{  
  "id": "merge\_1",  
  "type": "merge",  
  "name": "Sync & Combine",  
  "parameters": {  
    "mode": "append",  
    "wait\_mode": "wait\_for\_all",  
    "timeout": 300  
  },  
  "output": {},  
  "error": { "type": "halt" }  
}

## **4\. Architecture & Implementation**

### **4.1 Message Flow & RabbitMQ**

The Merge Node operates as a standard consumer on the workflow.execution queue but implements unique handler logic.

* **Queue:** workflow.execution  
* **Routing:** Standard round-robin distribution to stateless workers.

**Lifecycle:**

1. **Consumption:** Worker receives NodeExecutionMessage.  
2. **Processing:** \* Unlike standard nodes that execute business logic immediately, the Merge Node executes **Infrastructure Logic** (Redis operations).  
   * It checks the state of the barrier or lock.  
3. **Resolution:**  
   * **Condition Met:** The worker publishes a *new* NodeExecutionMessage for the child node(s) and ACKs the input.  
   * **Condition Pending/Failed:** The worker ACKs the input message *without* publishing further execution messages. The execution path effectively "parks" or terminates at this worker.

### **4.2 Redis Data Structures & Schema**

Redis is used as the shared coordination backend. All keys are scoped by execution ID and node ID.

**Key Prefix:** exec:{execution\_id}:node:{merge\_node\_id}

#### **4.2.1 State Keys**

* **Barrier Key (Hash):** {prefix}:barrier  
  * Used for wait\_for\_all.  
  * Stores partial results and arrival records.  
* **Lock Key (String):** {prefix}:lock  
  * Used for wait\_for\_any.  
  * Acts as a mutual exclusion mutex.  
* **Timeout Key (String):** {prefix}:timeout\_active  
  * Flag to indicate if a timeout timer has already been scheduled.

### **4.3 Detailed Execution Strategies**

#### **4.3.1 Strategy A: Wait for All (Barrier Synchronization)**

This mode implements a "Gather" pattern. It must wait for a specific set of parent nodes to complete.

**Prerequisite:** The worker must identify the *expected* number of parents. This is derived statically from the workflow\_definition included in the message payload by inspecting the edges array.

**Algorithm:**

1. **Identify Sender:** Determine from\_node ID from the message envelope.  
2. **Atomic Update (Lua):** Execute merge\_wait\_for\_all.lua.  
   * Add from\_node to an arrived\_set in Redis.  
   * Serialize and store the output from the incoming message into a context\_map in Redis.  
   * Check if SCARD(arrived\_set) \== expected\_count.  
3. **Result Handling:**  
   * **Lua returns NIL:** Barrier is not full. ACK message. Stop.  
   * **Lua returns Data:** Barrier is full.  
     * Construct a new accumulated\_context merging the returned data.  
     * Publish execution message to downstream nodes.  
     * ACK message.

**Lua Script (merge\_wait\_for\_all.lua):**

\-- KEYS\[1\]: barrier\_key ({prefix}:barrier)  
\-- ARGV\[1\]: incoming\_parent\_id  
\-- ARGV\[2\]: incoming\_payload\_json  
\-- ARGV\[3\]: expected\_parent\_count

local barrier\_key \= KEYS\[1\]  
local arrivals\_key \= barrier\_key .. ":arrivals"  
local data\_key \= barrier\_key .. ":data"

\-- 1\. Register Arrival  
redis.call('SADD', arrivals\_key, ARGV\[1\])

\-- 2\. Store Payload  
\-- We prefix with '$' to distinguish node IDs in the map if needed,   
\-- or simply use the ID as the field.  
redis.call('HSET', data\_key, ARGV\[1\], ARGV\[2\])

\-- 3\. Check Barrier Condition  
local current\_count \= redis.call('SCARD', arrivals\_key)

if tonumber(current\_count) \== tonumber(ARGV\[3\]) then  
    \-- BARRIER OPEN: Retrieve all data  
    local all\_payloads \= redis.call('HGETALL', data\_key)  
      
    \-- Cleanup Keys  
    redis.call('DEL', arrivals\_key, data\_key, barrier\_key)  
      
    return all\_payloads   
else  
    \-- BARRIER PENDING  
    return nil  
end

#### **4.3.2 Strategy B: Wait for Any (Race Condition Handling)**

This mode implements a "First-Past-The-Post" pattern. Only the first branch to reach the node triggers downstream execution.

**Algorithm:**

1. **Atomic Lock Attempt:** Attempt to set the lock key using SETNX.  
2. **Result Handling:**  
   * **Success (1):** This is the winner.  
     * Forward the payload to downstream nodes.  
     * ACK message.  
   * **Failure (0):** The node has already been executed by another branch.  
     * ACK message.  
     * Drop the payload (do nothing).

Redis Command:  
SET {prefix}:lock "executed" NX EX 86400  
(NX \= Only set if not exists, EX \= Expire in 24h to prevent leaks)

## **5\. Timeout Handling Mechanism**

Timeouts are critical to prevent workflows from hanging indefinitely (zombie executions) if a branch fails silently or a message is lost.

### **5.1 Architecture: The "Self-Destruct" Message**

We utilize RabbitMQ's **Dead Letter Exchange (DLX)** capabilities to implement server-side delayed messaging without needing a dedicated scheduler service.

**Components:**

1. **Timeout Queue (workflow.timeout):** A queue with no consumers. Messages sent here sit for a specific TTL.  
2. **DLX Configuration:** The workflow.timeout queue is configured to dead-letter messages to the workflow.timeout.process queue upon expiration.  
3. **Process Queue (workflow.timeout.process):** A standard queue consumed by workers to handle expired timeouts.

### **5.2 Setting the Timeout**

When the Merge Node receives its **first** input (regardless of mode):

1. **Check Active Flag:** Use SETNX {prefix}:timeout\_active "1".  
2. **If New (Result 1):** \* Construct a TimeoutMessage payload: { "exec\_id": "...", "node\_id": "..." }.  
   * Publish to workflow.timeout queue.  
   * Set expiration header to parameters.timeout \* 1000 (ms).

### **5.3 Handling the Timeout Event**

A worker consumes from workflow.timeout.process.

**Logic:**

1. **Verify State:** Check Redis to see if the node is still pending.  
   * *Wait for All:* Check if {prefix}:barrier exists.  
   * *Wait for Any:* Check if {prefix}:lock exists (and if we want to fail on timeout even if successful, though usually wait\_for\_any doesn't strictly timeout if one succeeded. For wait\_for\_any, the timeout is usually relevant if *no one* arrives).

   *Refined Logic:* \* For wait\_for\_all: If barrier keys exist, the merge is incomplete \-\> **FAIL**.

   * For wait\_for\_any: If lock key does *not* exist, no one arrived \-\> **FAIL**.  
2. **Action:**  
   * **If Failed:**  
     * Publish NodeStatusMessage with status: failed, error: "Timeout exceeded".  
     * Publish CompletionMessage (status: failed) if this halts the workflow.  
     * **Cleanup:** Delete all Redis keys (barrier, lock, data) to prevent late arrivals from triggering execution.

## **6\. Message Protocol Updates**

### **6.1 NodeExecutionMessage (Input)**

We extend the envelope to support parent identification.

**New Field:** from\_node (string, optional)

* **Description:** The ID of the node that generated this message.  
* **Requirement:** The Publisher logic in workflow\_publisher.go must be updated to populate this field when sending messages to children.

**Example Payload:**

{  
  "workflow\_id": "wf\_123",  
  "execution\_id": "exec\_abc",  
  "current\_node": "merge\_node\_1",  
  "from\_node": "http\_request\_A",  
  "accumulated\_context": { ... }  
}

### **6.2 NodeStatusMessage (Output)**

The Merge Node emits status updates to provide visibility into the "black box" of waiting.

* **State: Waiting**  
  * Trigger: Input received but barrier closed.  
  * Payload: status: "waiting", details: { "arrived": 1, "expected": 2 }.  
  * UI Behavior: Shows node in a "Pending" or "Yellow" state.  
* **State: Success**  
  * Trigger: Barrier opens or Lock acquired.  
  * Payload: status: "success", output: { ...merged\_data... }.  
  * UI Behavior: Shows node in "Green" state.  
* **State: Timeout**  
  * Trigger: Timeout message processed while pending.  
  * Payload: status: "failed", error: "Operation timed out".  
  * UI Behavior: Shows node in "Red" state.

## **7\. Migration & Implementation Checklist**

### **7.1 Infrastructure**

* \[ \] Create workflow.timeout queue with DLX configuration pointing to workflow.timeout.process.  
* \[ \] Create workflow.timeout.process queue.

### **7.2 Worker Code (rune-worker)**

* \[ \] **Publisher:** Update PublishExecution to accept and set fromNode.  
* \[ \] **Consumer:** Add logic to handle merge node type separately (infrastructure logic vs business logic).  
* \[ \] **Lua Scripts:** Implement and load merge\_wait\_for\_all.lua.  
* \[ \] **Timeout Handler:** Create new consumer for workflow.timeout.process.

### **7.3 DSL (rune-dsl)**

* \[ \] Update JSON Schema to include merge node type and parameters.