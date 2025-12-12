import pika
import json
import time
import uuid
from datetime import datetime

RABBITMQ_URL = 'amqp://guest:guest@localhost:5672/'

def get_channel():
    connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    return connection.channel()

def publish_token(channel, execution_id, workflow_id, user_id):
    token = {
        "execution_id": execution_id,
        "workflow_id": workflow_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
        "user_id": user_id
    }
    channel.queue_declare(queue='execution.token')
    channel.basic_publish(
        exchange='',
        routing_key='execution.token',
        body=json.dumps(token)
    )
    print(f"Published Token: {token}")

def publish_status(channel, execution_id):
    status_event = {
        "workflow_id": "workflow-1",
        "execution_id": execution_id,
        "node_id": "node-1",
        "node_name": "Start Node",
        "status": "success",
        "input": {"foo": "bar"},
        "parameters": {"param1": "value1"},
        "output": {"result": "ok"},
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
        
        execution_id = "execution-1"
        workflow_id = "workflow-1"
        user_id = "user-1"

        publish_token(channel, execution_id, workflow_id, user_id)
        time.sleep(2)
        publish_status(channel, execution_id)
        time.sleep(2)
        publish_completion(channel, execution_id)
        
        print("Simulation complete.")
    except Exception as e:
        print(f"Error: {e}")
