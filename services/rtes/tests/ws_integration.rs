#![allow(missing_docs)]

mod common;

use std::{sync::Arc, time::Duration};

use common::{MockExecutionStore, MockTokenStore, build_state, init_test_config, sample_execution};
use futures::StreamExt;
use rtes::domain::models::{NodeStatusMessage, WorkerMessage};
use serde_json::Value;
use tokio::net::TcpListener;
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[tokio::test]
async fn websocket_streams_history_then_live_updates() {
    init_test_config();

    let token_store = Arc::new(MockTokenStore {
        validate_execution_access_result: true,
        ..MockTokenStore::default()
    });
    let execution_store = Arc::new(MockExecutionStore::default());
    {
        let mut docs = execution_store
            .execution_documents_by_id
            .lock()
            .expect("mock execution store mutex should not be poisoned");
        docs.insert("exec-1".to_string(), sample_execution("exec-1", "wf-1", Some("running")));
    }

    let state = build_state(token_store, execution_store);
    let app = rtes::api::routes::app(state.clone());
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("listener should bind");
    let addr = listener.local_addr().expect("address should be available");

    let server = tokio::spawn(async move {
        axum::serve(listener, app)
            .await
            .expect("server should run for websocket test");
    });

    let ws_url = format!("ws://{addr}/rt?execution_id=exec-1&workflow_id=wf-1");
    let (mut ws_stream, _) = connect_async(ws_url)
        .await
        .expect("websocket connection should succeed");

    let history_msg = tokio::time::timeout(Duration::from_secs(3), ws_stream.next())
        .await
        .expect("history message timeout")
        .expect("history message should exist")
        .expect("history frame should be valid");
    let history_json = match history_msg {
        Message::Text(text) => serde_json::from_str::<Value>(&text).expect("history must be JSON"),
        other => panic!("expected text frame, got {other:?}"),
    };
    assert_eq!(history_json["node_id"], "node-1");

    let _ = state
        .tx
        .send(WorkerMessage::NodeStatus(Box::new(NodeStatusMessage {
            workflow_id:      "wf-1".to_string(),
            execution_id:     "exec-1".to_string(),
            node_id:          "node-live".to_string(),
            node_name:        "Node Live".to_string(),
            status:           "running".to_string(),
            input:            None,
            parameters:       None,
            output:           None,
            error:            None,
            executed_at:      "2026-01-01T00:00:00Z".to_string(),
            duration_ms:      1,
            branch_id:        None,
            split_node_id:    None,
            item_index:       None,
            total_items:      None,
            processed_count:  None,
            aggregator_state: None,
            lineage_stack:    None,
            lineage_hash:     None,
            used_inputs:      None,
        })));

    let mut found_live_update = false;
    for _ in 0..5 {
        let message = tokio::time::timeout(Duration::from_secs(3), ws_stream.next())
            .await
            .expect("live message timeout")
            .expect("live message should exist")
            .expect("live frame should be valid");
        let json = match message {
            Message::Text(text) => {
                serde_json::from_str::<Value>(&text).expect("live frame must be JSON")
            },
            _ => continue,
        };
        if json["node_id"] == "node-live" {
            assert_eq!(json["status"], "running");
            found_live_update = true;
            break;
        }
    }
    assert!(found_live_update, "expected websocket to emit the live node update");

    server.abort();
}
