import pika
import json
import time
import uuid
from datetime import datetime

RABBITMQ_URL = 'amqp://guest:guest@localhost:5672/'

# Sample workflow pieces used to mirror a realistic execution message
HTTP_NODE_ID = "node-http-1"
HTTP_NODE_NAME = "HTTP Request"
CONDITIONAL_NODE_ID = "node-cond-1"
CONDITIONAL_NODE_NAME = "Check HTTP Status"
SMTP_SUCCESS_NODE_ID = "node-smtp-success"
SMTP_SUCCESS_NODE_NAME = "SMTP Success"
SMTP_FAILURE_NODE_ID = "node-smtp-failure"
SMTP_FAILURE_NODE_NAME = "SMTP Failure"
HTTP_TO_CONDITIONAL_EDGE = "edge-http-cond"
CONDITIONAL_TRUE_EDGE = "edge-cond-true"
CONDITIONAL_FALSE_EDGE = "edge-cond-false"

def get_channel():
    connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    return connection.channel()

def publish_token(channel, execution_id, workflow_id, user_id):
    token = {
        "execution_id": execution_id,
        "workflow_id": workflow_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + 36000,
        "user_id": user_id
    }
    channel.queue_declare(queue='execution.token')
    channel.basic_publish(
        exchange='',
        routing_key='execution.token',
        body=json.dumps(token)
    )
    print(f"Published Token: {token}")

def build_workflow_definition(workflow_id, execution_id):
    return {
        "workflow_id": workflow_id,
        "execution_id": execution_id,
        "nodes": [
            {
                "id": HTTP_NODE_ID,
                "name": HTTP_NODE_NAME,
                "type": "http",
                "parameters": {
                    "method": "GET",
                    "url": "https://httpbin.org/uuid",
                },
            },
            {
                "id": CONDITIONAL_NODE_ID,
                "name": CONDITIONAL_NODE_NAME,
                "type": "conditional",
                "parameters": {
                    "expression": f"${{{HTTP_NODE_NAME}}}.status == 200",
                    "true_edge_id": CONDITIONAL_TRUE_EDGE,
                    "false_edge_id": CONDITIONAL_FALSE_EDGE,
                },
            },
            {
                "id": SMTP_SUCCESS_NODE_ID,
                "name": SMTP_SUCCESS_NODE_NAME,
                "type": "smtp",
                "parameters": {
                    "from": "from@example.com",
                    "to": "to@example.com",
                    "subject": "Workflow Success - UUID Fetched",
                    "body": "The workflow successfully fetched a UUID from httpbin.org!",
                },
                "credentials": {
                    "id": "smtp-test-cred-success",
                    "name": "Test SMTP Credentials",
                    "type": "smtp",
                    "values": {
                        "host": "smtp.example.com",
                        "port": 587,
                        "username": "user",
                        "password": "password",
                    },
                },
            },
            {
                "id": SMTP_FAILURE_NODE_ID,
                "name": SMTP_FAILURE_NODE_NAME,
                "type": "smtp",
                "parameters": {
                    "from": "from@example.com",
                    "to": "to@example.com",
                    "subject": "Workflow Failure - HTTP Request Failed",
                    "body": "The workflow failed to fetch UUID from httpbin.org.",
                },
                "credentials": {
                    "id": "smtp-test-cred-failure",
                    "name": "Test SMTP Credentials",
                    "type": "smtp",
                    "values": {
                        "host": "smtp.example.com",
                        "port": 587,
                        "username": "user",
                        "password": "password",
                    },
                },
            },
        ],
        "edges": [
            {
                "id": HTTP_TO_CONDITIONAL_EDGE,
                "src": HTTP_NODE_ID,
                "dst": CONDITIONAL_NODE_ID,
            },
            {
                "id": CONDITIONAL_TRUE_EDGE,
                "src": CONDITIONAL_NODE_ID,
                "dst": SMTP_SUCCESS_NODE_ID,
            },
            {
                "id": CONDITIONAL_FALSE_EDGE,
                "src": CONDITIONAL_NODE_ID,
                "dst": SMTP_FAILURE_NODE_ID,
            },
        ],
    }

def publish_status(channel, execution_id, node_id, node_name, status, output=None):
    status_event = {
        "workflow_id": "workflow-1" ,
        "execution_id": execution_id,
        "node_id": node_id,
        "node_name": node_name,
        "status": status,
        "input": {"foo": "bar"},
        "parameters": {"param1": "value1"},
        "output": output or {"result": "ok"},
        "error": None,
        "executed_at": datetime.utcnow().isoformat() + "Z",
        "duration_ms": 100,
        "branch_id": None,
        "split_node_id": None,
        "item_index": None,
        "total_items": None,
        "processed_count": None,
        "aggregator_state": None,
        "lineage_stack": [],
        "used_inputs": None
    }
    channel.queue_declare(queue='workflow.node.status')
    channel.basic_publish(
        exchange='',
        routing_key='workflow.node.status',
        body=json.dumps(status_event)
    )
    print(f"Published Status: {status_event}")

def publish_execution(channel, execution_id, workflow_id):
    execution_event = {
        "workflow_id": workflow_id,
        "execution_id": execution_id,
        "current_node": HTTP_NODE_ID,
        "workflow_definition": build_workflow_definition(workflow_id, execution_id),
        "accumulated_context": {},
        "lineage_stack": [],
        "from_node": None,
        "is_worker_initiated": True,
    }
    channel.queue_declare(queue='workflow.worker.initiated')
    channel.basic_publish(
        exchange='',
        routing_key='workflow.worker.initiated',
        body=json.dumps(execution_event)
    )
    print(f"Published Execution: {execution_event}")

def publish_completion(channel, execution_id):
    completion_event = {
        "workflow_id": "workflow-1",
        "execution_id": execution_id,
        "status": "completed",
        "final_context": {"final": "data"},
        "completed_at": datetime.utcnow().isoformat() + "Z",
        "total_duration_ms": 500,
        "failure_reason": None
    }
    channel.queue_declare(queue='workflow.completion')
    channel.basic_publish(
        exchange='',
        routing_key='workflow.completion',
        body=json.dumps(completion_event)
    )
    print(f"Published Completion: {completion_event}")

if __name__ == "__main__":
    try:
        channel = get_channel()
        
        execution_id = "execution-" + str(uuid.uuid4())
        workflow_id = "workflow-1"
        user_id = "user-1"

        publish_token(channel, execution_id, workflow_id, user_id)

        publish_execution(channel, execution_id, workflow_id)

        publish_status(channel, execution_id, HTTP_NODE_ID, HTTP_NODE_NAME, "in_progress")
        time.sleep(0.2)
        publish_status(channel, execution_id, HTTP_NODE_ID, HTTP_NODE_NAME, "success", output={"status": 200})
        publish_status(channel, execution_id, CONDITIONAL_NODE_ID, CONDITIONAL_NODE_NAME, "success")
        publish_status(channel, execution_id, SMTP_SUCCESS_NODE_ID, SMTP_SUCCESS_NODE_NAME, "success")

        publish_completion(channel, execution_id)
        
        print("Simulation complete.")
    except Exception as e:
        print(f"Error: {e}")
