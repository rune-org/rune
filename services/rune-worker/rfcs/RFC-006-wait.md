# **RFC 006: Distributed Wait Node & Scheduler Architecture**

## **1\. Abstract**

This document specifies the architecture for the **Wait Node**, enabling workflows to pause execution for a specified duration or until a specific timestamp. The implementation utilizes a **Timerless Architecture** where compute resources are released immediately upon suspension.

It leverages:

1. **Redis Sorted Sets:** For high-performance scheduling of millions of timers.  
2. **Decoupled Scheduler:** A background worker (Poller) that moves due tasks from Redis.  
3. **Unified Execution Queue:** Resumed tasks are published back to the main workflow.execution queue, ensuring a consistent execution path and simplifying the worker consumer logic.  
4. **Branch-Aware Context:** Full support for pausing/resuming specific parallel branches (Fan-Out) without blocking the main workflow, integrated with the Lineage Stack from RFC-004.

## **2\. Motivation**

In a distributed workflow engine, "waiting" poses specific challenges that cannot be solved with simple sleep() calls:

* **Resource Efficiency:** Blocking a Go routine for "3 days" is not viable. State must be serialized and the thread released to the pool.  
* **Concurrency:** If a workflow splits into 100 items (Fan-Out), and Item \#5 waits for 1 hour while Item \#6 finishes instantly, the engine must handle this heterogeneous state without stalling the entire workflow.  
* **Resilience:** Timers must survive service restarts. A crash during a wait should not result in a lost resume event.

## **3\. Node Specification (DSL)**

**Type Identifier:** wait

**Parameters:**

| Parameter | Type | Default | Description |
| :---- | :---- | :---- | :---- |
| resume | enum | time\_interval | Options: time\_interval |
| amount | integer | 1 | Quantity of time (for time\_interval). |
| unit | enum | seconds | Unit of time. Options: seconds, minutes, hours, days. |

**Example JSON:**

{  
  "id": "wait\_node\_1",  
  "type": "wait",  
  "name": "Wait for Approval",  
  "parameters": {  
    "resume": "time\_interval",  
    "amount": 2,  
    "unit": "hours"  
  },  
  "output": {},  
  "error": { "type": "ignore" }  
}

## **4\. Architecture & Data Flow**

### **4.1 System Components**

1. **Executor (Worker):** Consumes workflow.execution. Handles the "Suspend" phase (calculating time, freezing state).  
2. **Redis (Scheduler Store):**  
   * **Priority Queue (ZSET):** Orders timers by epoch milliseconds.  
   * **Payload Store (HASH):** Stores the "Frozen" execution message (Context \+ Lineage) indexed by a unique Timer ID.  
3. **Scheduler (Poller):** A dedicated loop that polls Redis for expired timers and publishes execution messages directly to the main workflow.execution queue.

### **4.2 Redis Data Schema**

To support **RFC-004 (Parallelism)**, we cannot just store execution\_id. We must store a unique **Timer ID** that maps to the specific branch state (Execution ID \+ Node ID \+ Branch/Item Index).

1. **The Schedule (ZSET):** scheduler:timers  
   * **Score:** resume\_at\_epoch\_ms (int64)  
   * **Member:** timer\_id (UUID)  
2. **The Frozen State (HASH):** scheduler:payloads  
   * **Field:** timer\_id  
   * **Value:** JSON(NodeExecutionMessage)  
   * *Note:* This payload contains the full execution\_id, lineage\_stack, accumulated\_context, etc., exactly as it was when the wait started.

### **4.3 Execution Flow Diagram**

sequenceDiagram  
    participant Worker  
    participant Redis  
    participant Scheduler  
    participant RabbitMQ

    Note over Worker: Phase 1: Suspend  
    Worker-\>\>Worker: Calculate resume\_at  
    Worker-\>\>Worker: Serialize Message (Frozen State)  
    Worker-\>\>Redis: HSET scheduler:payloads \<UUID\> \<MsgJSON\>  
    Worker-\>\>Redis: ZADD scheduler:timers \<Time\> \<UUID\>  
    Worker-\>\>RabbitMQ: ACK Execution Message  
    Note over Worker: Worker Exits (Resource Freed)

    Note over Scheduler: Phase 2: Poll (Async Loop)  
    Scheduler-\>\>Redis: ZRANGEBYSCORE (Lua)  
    Redis--\>\>Scheduler: Returns \[UUID\_1, UUID\_2\]  
    Scheduler-\>\>Redis: HGET scheduler:payloads \<UUID\>  
    Scheduler-\>\>Worker: Resolve Next Node (Graph Traversal)  
    Scheduler-\>\>RabbitMQ: Publish to workflow.execution  
    Scheduler-\>\>Redis: DEL payload & timer

    Note over Worker: Phase 3: Resume  
    RabbitMQ-\>\>Worker: Consume Execution Message  
    Worker-\>\>Worker: Normal Execution Logic (Unaware of Wait)  
    Worker-\>\>RabbitMQ: Publish Next Node (workflow.execution)

## **5\. Detailed Execution Logic**

### **5.1 Phase 1: Scheduling (The "Suspend")**

**Context:** Worker consumes NodeExecutionMessage for a wait node.

**Algorithm:**

1. **Time Calculation:**  
   * Compute resume\_at based on amount/unit or date\_time.  
2. **Payload Construction (The "Freeze"):**  
   * Create a struct FrozenState (or reuse NodeExecutionMessage) containing the *current* message data.  
   * **Crucial:** This preserves lineage\_stack (RFC-004) and accumulated\_context. This ensures that when we wake up, we know exactly which parallel branch we are in.  
   * Generate timer\_id \= UUID().  
3. **Atomic Persistence (Redis Pipeline):**  
   * HSET scheduler:payloads {timer\_id} {json\_string}  
   * ZADD scheduler:timers {resume\_at} {timer\_id}  
4. **Status Update:**  
   * Publish NodeStatusMessage (status: "waiting", resume\_at: ...).  
5. **Termination:**  
   * **ACK** the original RabbitMQ message.  
   * **Stop.** Do *not* execute the next node. The execution path for this branch ends here.

### **5.2 Phase 2: The Tick (The "Scheduler")**

**Context:** A standalone Scheduler service/goroutine running a time.Ticker (e.g., 500ms).

**Algorithm:**

1. **Poll (Lua):** Call poll\_timers.lua with now\_ms.  
   * This script fetches timer\_ids where score \<= now.  
   * It **removes** them from the ZSET (claiming the task) to prevent race conditions if multiple schedulers are running.  
   * It returns the claimed timer\_ids.  
2. **Fetch & Dispatch:**  
   * For each timer\_id:  
     * Retrieve payload: HGET scheduler:payloads {timer\_id}.  
     * **Deserialization:** Parse the JSON into NodeExecutionMessage.  
     * **Graph Traversal:**  
       * Identify current\_node (the Wait node).  
       * Find the **Next Node(s)** from the workflow\_definition (edges).  
       * *Note:* If multiple edges exist, we must Fan-Out here (publish multiple messages).  
     * **Publish:** \* Update the message current\_node to the ID of the *next* node.  
       * Publish the message(s) to the workflow.execution queue.  
     * **Cleanup:** HDEL scheduler:payloads {timer\_id} (Ideally, only after successful publish confirmation).

**Lua Script (poll\_timers.lua):**

\-- KEYS\[1\]: scheduler:timers  
\-- ARGV\[1\]: current\_epoch\_ms  
\-- ARGV\[2\]: batch\_size (e.g., 50\)

\-- 1\. Find due items  
local ids \= redis.call('ZRANGEBYSCORE', KEYS\[1\], '-inf', ARGV\[1\], 'LIMIT', 0, ARGV\[2\])

if \#ids \> 0 then  
    \-- 2\. Remove from schedule (Claim them)  
    redis.call('ZREM', KEYS\[1\], unpack(ids))  
end

return ids

### **5.3 Phase 3: Resumption (The "Wake")**

**Context:** A standard Worker consumes from workflow.execution.

**Algorithm:**

1. **Standard Execution:** The worker receives a message. It sees current\_node is (e.g.) http\_request\_2.  
2. **Transparency:** The worker is completely unaware that this message was "sleeping" for 3 days. It processes it as a normal execution step.  
3. **Lineage Continuity:** Because the lineage\_stack was preserved in the frozen payload and passed to this new message, the worker correctly participates in any parent Aggregation barriers (RFC-004) further down the line.

## **6\. Message Type Handling Strategy**

### **6.1 NodeExecutionMessage**

* **Input (Phase 1):** Triggers the Suspend logic. The worker identifies type: "wait" and executes the scheduling logic instead of business logic.  
* **Output (Phase 2 \- Scheduler):** The Scheduler acts as a pseudo-worker. It generates the *next* NodeExecutionMessage pointing to the successor node and injects it back into the stream.

### **6.2 NodeStatusMessage**

* **Phase 1 (Sleep):** Emits waiting. Used by UI to show a "Pause" icon or timer countdown.  
  * Payload: { "node\_id": "wait\_1", "status": "waiting", "metadata": { "resume\_at": 171693... } }  
* **Phase 2 (Scheduler \- Wake):** \* The Scheduler should emit a NodeStatusMessage for the *Wait Node* itself: { "node\_id": "wait\_1", "status": "success" }.  
  * *Why?* To turn the Wait Node "Green" in the UI before the next node starts.

### **6.3 CompletionMessage**

* **Phase 1:** Never sent.  
* **Phase 3:** \* Handled naturally by the subsequent nodes.  
  * **Edge Case:** If the Wait Node is the **Last Node** (no outgoing edges):  
    * The Scheduler (Phase 2\) detects no next nodes.  
    * Instead of publishing an Execution Message, it must trigger the **Auto-Resolution** logic (RFC-004) or publish a CompletionMessage directly if the lineage\_stack is empty.

## **7\. Resilience & Edge Cases**

### **7.1 "The Lost Resume" (Scheduler Crash)**

* **Scenario:** Scheduler pops from ZSET, crashes before publishing to RabbitMQ.  
* **Mitigation:**  
  * **Atomic Pop-Push:** Ideally, move the item from scheduler:timers to a scheduler:processing ZSET in the Lua script.  
  * **Ack:** Only remove from scheduler:processing after RabbitMQ confirms publish.  
  * **Recovery:** On boot, the Scheduler checks scheduler:processing for items with score \< (now \- timeout) and re-processes them.

### **7.3 High Concurrency**

* Redis ZSET operations are $O(\\log(N))$. With 1 million timers, ZADD and ZRANGE are still sub-millisecond.  
* The bottleneck is the Go Scheduler loop.  
* **Scaling:** Run multiple Scheduler instances. The Lua script guarantees only one instance claims a specific batch of tasks (competing consumers pattern on the ZSET).

## **8\. Implementation Checklist**

* \[ \] **Infrastructure:**  
  * \[ \] Redis instance ready and configured.  
* \[ \] **Data Types:**  
  * \[ \] Define FrozenState struct (wraps NodeExecutionMessage).  
* \[ \] **Worker (Wait Node):**  
  * \[ \] Implement Execute (Phase 1\) in WaitNode handler.  
  * \[ \] Ensure lineage\_stack serialization works correctly.  
* \[ \] **Scheduler:**  
  * \[ \] Implement poll\_timers.lua.  
  * \[ \] Implement Ticker Loop with configurable interval.