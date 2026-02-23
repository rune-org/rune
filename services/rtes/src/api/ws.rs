use axum::{
    extract::{
        Query,
        State,
        WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::broadcast::error::RecvError;
use tracing::{error, info, warn};

use crate::{
    api::state::AppState,
    domain::models::{NodeExecutionInstance, StackFrame, WorkerMessage},
};

#[derive(Debug, Serialize, Clone, PartialEq)]
pub(crate) struct WsNodeUpdateDto {
    pub(crate) node_id:          Option<String>,
    pub(crate) input:            Option<Value>,
    pub(crate) params:           Option<Value>,
    pub(crate) output:           Option<Value>,
    pub(crate) status:           Option<String>,
    pub(crate) lineage_hash:     Option<String>,
    pub(crate) lineage_stack:    Option<Vec<StackFrame>>,
    pub(crate) split_node_id:    Option<String>,
    pub(crate) branch_id:        Option<String>,
    pub(crate) item_index:       Option<i32>,
    pub(crate) total_items:      Option<i32>,
    pub(crate) processed_count:  Option<i32>,
    pub(crate) aggregator_state: Option<String>,
    pub(crate) used_inputs:      Option<Value>,
}

impl From<&WorkerMessage> for WsNodeUpdateDto {
    fn from(msg: &WorkerMessage) -> Self {
        match msg {
            WorkerMessage::NodeStatus(s) => Self {
                node_id:          Some(s.node_id.clone()),
                input:            s.input.clone(),
                params:           s.parameters.clone(),
                output:           s.output.clone(),
                status:           Some(s.status.clone()),
                lineage_hash:     s.lineage_hash.clone(),
                lineage_stack:    s.lineage_stack.clone(),
                split_node_id:    s.split_node_id.clone(),
                branch_id:        s.branch_id.clone(),
                item_index:       s.item_index,
                total_items:      s.total_items,
                processed_count:  s.processed_count,
                aggregator_state: s.aggregator_state.clone(),
                used_inputs:      s.used_inputs.clone(),
            },
            WorkerMessage::WorkflowCompletion(_c) => Self {
                node_id:          None,
                input:            None,
                params:           None,
                output:           None,
                status:           Some("completed".to_string()),
                lineage_hash:     None,
                lineage_stack:    None,
                split_node_id:    None,
                branch_id:        None,
                item_index:       None,
                total_items:      None,
                processed_count:  None,
                aggregator_state: None,
                used_inputs:      None,
            },
            WorkerMessage::NodeExecution(_) => Self {
                node_id:          None,
                input:            None,
                params:           None,
                output:           None,
                status:           Some("unknown error".to_string()),
                lineage_hash:     None,
                lineage_stack:    None,
                split_node_id:    None,
                branch_id:        None,
                item_index:       None,
                total_items:      None,
                processed_count:  None,
                aggregator_state: None,
                used_inputs:      None,
            },
        }
    }
}

fn dto_from_execution_instance(node_id: String, exec: NodeExecutionInstance) -> WsNodeUpdateDto {
    WsNodeUpdateDto {
        node_id:          Some(node_id),
        input:            exec.input,
        params:           exec.parameters,
        output:           exec.output,
        status:           exec.status,
        lineage_hash:     exec.lineage_hash,
        lineage_stack:    exec.lineage_stack,
        split_node_id:    exec.split_node_id,
        branch_id:        exec.branch_id,
        item_index:       exec.item_index,
        total_items:      exec.total_items,
        processed_count:  exec.processed_count,
        aggregator_state: exec.aggregator_state,
        used_inputs:      exec.used_inputs,
    }
}

fn dto_with_status(status: String) -> WsNodeUpdateDto {
    WsNodeUpdateDto {
        node_id:          None,
        input:            None,
        params:           None,
        output:           None,
        status:           Some(status),
        lineage_hash:     None,
        lineage_stack:    None,
        split_node_id:    None,
        branch_id:        None,
        item_index:       None,
        total_items:      None,
        processed_count:  None,
        aggregator_state: None,
        used_inputs:      None,
    }
}

/// Query params for WebSocket connection
#[derive(Debug, Deserialize)]
pub(crate) struct WsQueryParams {
    pub(crate) execution_id: String,
    pub(crate) workflow_id:  String,
}

/// Internal params for WebSocket connection
#[derive(Debug)]
pub(crate) struct WsParams {
    pub(crate) execution_id: String,
}

pub(crate) async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQueryParams>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let execution_id = query.execution_id;
    let workflow_id = query.workflow_id;

    info!("WebSocket connection attempt for execution: {} workflow: {}", execution_id, workflow_id);

    // Validate access: execution must have a valid grant in Redis
    // (grants are published via API -> RabbitMQ -> RTES token consumer when /run is
    // called)
    match state
        .token_store
        .validate_execution_access(&execution_id, &workflow_id)
        .await
    {
        Ok(true) => {
            let params = WsParams { execution_id: execution_id.clone() };
            ws.on_upgrade(move |socket| handle_socket(socket, state, params))
        },
        Ok(false) => {
            warn!(
                "Unauthorized WS access attempt for execution: {} workflow: {}",
                execution_id, workflow_id
            );
            (axum::http::StatusCode::FORBIDDEN, "Unauthorized").into_response()
        },
        Err(e) => {
            error!("Token validation error: {}", e);
            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "Internal Error").into_response()
        },
    }
}

#[allow(clippy::too_many_lines)]
async fn handle_socket(socket: WebSocket, state: AppState, params: WsParams) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();

    let execution_id = params.execution_id.clone();

    // Send history
    if let Ok(Some(doc)) = state
        .execution_store
        .get_execution_document(&execution_id)
        .await
    {
        for (node_id, node) in doc.nodes {
            if !node.lineages.is_empty() {
                for (_, exec) in node.lineages {
                    let dto = dto_from_execution_instance(node_id.clone(), exec);
                    if let Ok(json) = serde_json::to_string(&dto)
                        && sender.send(Message::Text(json.into())).await.is_err()
                    {
                        return;
                    }
                }
            } else if let Some(exec) = node.latest {
                let dto = dto_from_execution_instance(node_id.clone(), exec);
                if let Ok(json) = serde_json::to_string(&dto)
                    && sender.send(Message::Text(json.into())).await.is_err()
                {
                    return;
                }
            }
        }
        if let Some(status) = doc.status {
            let dto = dto_with_status(status);
            if let Ok(json) = serde_json::to_string(&dto)
                && sender.send(Message::Text(json.into())).await.is_err()
            {
                return;
            }
        }
    }

    let mut send_task = tokio::spawn(async move {
        let execution_id = params.execution_id.clone();
        loop {
            let msg = match rx.recv().await {
                Ok(msg) => msg,
                Err(RecvError::Lagged(skipped)) => {
                    warn!(
                        execution_id = %execution_id,
                        skipped,
                        "WebSocket receiver lagged; skipping stale messages"
                    );
                    continue;
                },
                Err(RecvError::Closed) => break,
            };

            let should_send = match &msg {
                WorkerMessage::NodeStatus(s) => s.execution_id == execution_id,
                WorkerMessage::WorkflowCompletion(c) => c.execution_id == execution_id,
                WorkerMessage::NodeExecution(_) => false,
            };

            let outbound = WsNodeUpdateDto::from(&msg);

            if should_send
                && let Ok(json) = serde_json::to_string(&outbound)
                && sender.send(Message::Text(json.into())).await.is_err()
            {
                break;
            }
        }
    });

    let exec_id = execution_id.clone();
    let mut recv_task = tokio::spawn(async move {
        let execution_id = execution_id.clone();
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Close(_) = msg {
                info!("WebSocket close message received for execution: {}", execution_id);
                break;
            }
        }
    });
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    info!("WebSocket disconnected for execution: {}", exec_id);
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{WsNodeUpdateDto, dto_from_execution_instance, dto_with_status};
    use crate::domain::models::{
        CompletionMessage,
        NodeExecutionInstance,
        NodeStatusMessage,
        WorkerMessage,
    };

    #[test]
    fn dto_from_worker_node_status_preserves_core_fields() {
        let message = WorkerMessage::NodeStatus(Box::new(NodeStatusMessage {
            workflow_id:      "wf-1".to_string(),
            execution_id:     "exec-1".to_string(),
            node_id:          "node-1".to_string(),
            node_name:        "Node".to_string(),
            status:           "running".to_string(),
            input:            Some(json!({"a": 1})),
            parameters:       Some(json!({"b": 2})),
            output:           None,
            error:            None,
            executed_at:      "2026-01-01T00:00:00Z".to_string(),
            duration_ms:      5,
            branch_id:        None,
            split_node_id:    None,
            item_index:       None,
            total_items:      None,
            processed_count:  None,
            aggregator_state: None,
            lineage_stack:    None,
            lineage_hash:     None,
            used_inputs:      None,
        }));

        let dto = WsNodeUpdateDto::from(&message);
        assert_eq!(dto.node_id.as_deref(), Some("node-1"));
        assert_eq!(dto.status.as_deref(), Some("running"));
        assert_eq!(dto.input, Some(json!({"a": 1})));
    }

    #[test]
    fn dto_from_worker_completion_sets_completed_status() {
        let message = WorkerMessage::WorkflowCompletion(Box::new(CompletionMessage {
            workflow_id:       "wf-1".to_string(),
            execution_id:      "exec-1".to_string(),
            status:            "completed".to_string(),
            final_context:     json!({}),
            completed_at:      "2026-01-01T00:00:00Z".to_string(),
            total_duration_ms: 10,
            failure_reason:    None,
        }));

        let dto = WsNodeUpdateDto::from(&message);
        assert_eq!(dto.node_id, None);
        assert_eq!(dto.status.as_deref(), Some("completed"));
    }

    #[test]
    fn history_helpers_build_expected_dtos() {
        let exec = NodeExecutionInstance {
            input: Some(json!({"input": true})),
            status: Some("success".to_string()),
            ..NodeExecutionInstance::default()
        };

        let node_dto = dto_from_execution_instance("node-123".to_string(), exec);
        assert_eq!(node_dto.node_id.as_deref(), Some("node-123"));
        assert_eq!(node_dto.status.as_deref(), Some("success"));

        let status_dto = dto_with_status("completed".to_string());
        assert_eq!(status_dto.node_id, None);
        assert_eq!(status_dto.status.as_deref(), Some("completed"));
    }
}
