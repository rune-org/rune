use axum::{
    extract::{
        State,
        WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    http::HeaderMap,
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use jsonwebtoken::{DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{error, info, warn};

use crate::{api::state::AppState, domain::models::WorkerMessage};

#[derive(Debug, Serialize, Clone, PartialEq)]
pub(crate) struct WsNodeUpdateDto {
    pub(crate) node_id: Option<String>,
    pub(crate) input:   Option<Value>,
    pub(crate) params:  Option<Value>,
    pub(crate) output:  Option<String>,
    pub(crate) status:  Option<String>,
}

impl From<&WorkerMessage> for WsNodeUpdateDto {
    fn from(msg: &WorkerMessage) -> Self {
        match msg {
            WorkerMessage::NodeStatus(s) => Self {
                node_id: Some(s.node_id.clone()),
                input:   s.input.clone(),
                params:  s.parameters.clone(),
                output:  s.output.as_ref().map(ToString::to_string),
                status:  Some(s.status.clone()),
            },
            WorkerMessage::WorkflowCompletion(_c) => Self {
                node_id: None,
                input:   None,
                params:  None,
                output:  None,
                status:  Some("completed".to_string()),
            },
            WorkerMessage::NodeExecution(_) => Self {
                node_id: None,
                input:   None,
                params:  None,
                output:  None,
                status:  Some("unknown error".to_string()),
            },
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    user_id:      String,
    execution_id: String,
    workflow_id:  String,
    exp:          usize,
}

#[derive(Deserialize)]
#[allow(clippy::struct_field_names)]
pub(crate) struct AuthParams {
    pub(crate) user_id:      String,
    pub(crate) execution_id: String,
    pub(crate) workflow_id:  String,
}

pub(crate) async fn ws_handler(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let token = match headers.get("Authorization") {
        Some(value) => value.to_str().unwrap_or("").replace("Bearer ", ""),
        None => {
            return (axum::http::StatusCode::UNAUTHORIZED, "Missing Authorization header")
                .into_response();
        },
    };

    let cfg = crate::config::Config::get();
    let validation = Validation::default();
    let token_data = match decode::<Claims>(
        &token,
        &DecodingKey::from_secret(cfg.jwt_secret.as_bytes()),
        &validation,
    ) {
        Ok(c) => c,
        Err(e) => {
            warn!("Invalid JWT token: {}", e);
            return (axum::http::StatusCode::UNAUTHORIZED, "Invalid Token").into_response();
        },
    };

    let params = AuthParams {
        user_id:      token_data.claims.user_id,
        execution_id: token_data.claims.execution_id,
        workflow_id:  token_data.claims.workflow_id,
    };

    match state
        .token_store
        .validate_access(&params.user_id, Some(&params.execution_id), &params.workflow_id)
        .await
    {
        Ok(true) => ws.on_upgrade(move |socket| handle_socket(socket, state, params)),
        Ok(false) => {
            warn!("Unauthorized WS access attempt for user: {}", params.user_id);
            (axum::http::StatusCode::FORBIDDEN, "Unauthorized").into_response()
        },
        Err(e) => {
            error!("Token validation error: {}", e);
            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "Internal Error").into_response()
        },
    }
}

async fn handle_socket(socket: WebSocket, state: AppState, params: AuthParams) {
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
            for (_lineage_hash, exec) in node.executions {
                let dto = WsNodeUpdateDto {
                    node_id: Some(node_id.clone()),
                    input:   exec.input,
                    params:  exec.parameters,
                    output:  exec.output.as_ref().map(ToString::to_string),
                    status:  exec.status,
                };
                if let Ok(json) = serde_json::to_string(&dto) {
                    if sender.send(Message::Text(json.into())).await.is_err() {
                        return;
                    }
                }
            }
        }
        if let Some(status) = doc.status {
            let dto = WsNodeUpdateDto {
                node_id: None,
                input:   None,
                params:  None,
                output:  None,
                status:  Some(status),
            };
            if let Ok(json) = serde_json::to_string(&dto) {
                if sender.send(Message::Text(json.into())).await.is_err() {
                    return;
                }
            }
        }
    }

    let mut send_task = tokio::spawn(async move {
        let execution_id = params.execution_id.clone();
        while let Ok(msg) = rx.recv().await {
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
