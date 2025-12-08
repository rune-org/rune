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
use serde::Deserialize;
use tracing::{error, info, warn};

use crate::{api::state::AppState, domain::models::WorkerMessage};

#[derive(Deserialize)]
pub(crate) struct AuthParams {
    pub(crate) user_id:      String,
    pub(crate) execution_id: String,
    pub(crate) workflow_id:  String,
}

pub(crate) async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<AuthParams>,
    State(state): State<AppState>,
) -> impl IntoResponse {
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

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let should_send = match &msg {
                WorkerMessage::Status(s) => s.execution_id == execution_id,
                WorkerMessage::Result(r) => r.execution_id == execution_id,
            };

            if should_send && let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            // Handle incoming messages from client if needed (e.g. ping/pong or commands)
            // For now, we just log them
            if let Message::Close(_) = msg {
                break;
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    info!("WebSocket disconnected for execution: {}", params.execution_id);
}
