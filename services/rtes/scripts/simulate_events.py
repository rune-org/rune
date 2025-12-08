import pika
import json
import time
import uuid

RABBITMQ_URL = 'amqp://guest:guest@localhost:5672/%2f'

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
        "execution_id": execution_id,
        "node_id": "node-1",
        "status": "running",
        "timestamp": int(time.time())
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
        "execution_id": execution_id,
        "status": "completed",
        "timestamp": int(time.time())
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
        
        execution_id = str(uuid.uuid4())
        workflow_id = str(uuid.uuid4())
        user_id = "3"

        publish_token(channel, execution_id, workflow_id, user_id)
        time.sleep(2)
        publish_status(channel, execution_id)
        time.sleep(2)
        publish_completion(channel, execution_id)
        
        print("Simulation complete.")
    except Exception as e:
        print(f"Error: {e}")
