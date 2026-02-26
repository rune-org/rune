#![allow(missing_docs)]

mod common;

use std::sync::Arc;

use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use common::{MockExecutionStore, MockTokenStore, build_state, init_test_config, sample_execution};
use jsonwebtoken::{EncodingKey, Header, encode};
use rtes::{api::routes::app, config::Config, domain::models::ExecutionDocument};
use serde::Serialize;
use tower::ServiceExt;

#[derive(Serialize)]
struct JwtClaims {
    sub: String,
    exp: usize,
}

fn jwt_for_user(user_id: &str) -> String {
    encode(
        &Header::default(),
        &JwtClaims { sub: user_id.to_string(), exp: usize::MAX / 2 },
        &EncodingKey::from_secret(Config::get().jwt_secret.as_bytes()),
    )
    .expect("jwt should be generated in tests")
}

#[tokio::test]
async fn health_endpoint_returns_ok() {
    init_test_config();
    let state =
        build_state(Arc::new(MockTokenStore::default()), Arc::new(MockExecutionStore::default()));
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/health")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("router should respond");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn websocket_route_is_get_only() {
    init_test_config();
    let state =
        build_state(Arc::new(MockTokenStore::default()), Arc::new(MockExecutionStore::default()));
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/rt?execution_id=exec-1&workflow_id=wf-1")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("router should respond");

    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
}

#[tokio::test]
async fn get_execution_with_valid_jwt_returns_document() {
    init_test_config();

    let token_store = Arc::new(MockTokenStore {
        validate_access_for_execution_result: true,
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
    let router = app(state);
    let jwt = jwt_for_user("user-1");

    let response = router
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/executions/exec-1")
                .header("Authorization", format!("Bearer {jwt}"))
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("router should respond");

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body should be readable");
    let document: ExecutionDocument =
        serde_json::from_slice(&body).expect("response should be a valid execution document");
    assert_eq!(document.execution_id, "exec-1");
}

#[tokio::test]
async fn get_execution_without_jwt_uses_fallback_token_auth() {
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
        docs.insert("exec-2".to_string(), sample_execution("exec-2", "wf-2", Some("completed")));
    }
    let state = build_state(token_store, execution_store);
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/executions/exec-2")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("router should respond");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn get_workflow_executions_with_valid_jwt_returns_documents() {
    init_test_config();

    let token_store =
        Arc::new(MockTokenStore { validate_access_result: true, ..MockTokenStore::default() });
    let execution_store = Arc::new(MockExecutionStore::default());
    {
        let mut docs = execution_store
            .executions_by_workflow
            .lock()
            .expect("mock execution store mutex should not be poisoned");
        docs.insert(
            "wf-1".to_string(),
            vec![
                sample_execution("exec-1", "wf-1", Some("running")),
                sample_execution("exec-2", "wf-1", Some("completed")),
            ],
        );
    }
    let state = build_state(token_store, execution_store);
    let router = app(state);
    let jwt = jwt_for_user("user-1");

    let response = router
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/workflows/wf-1/executions")
                .header("Authorization", format!("Bearer {jwt}"))
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("router should respond");

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body should be readable");
    let documents: Vec<ExecutionDocument> =
        serde_json::from_slice(&body).expect("response should be a document array");
    assert_eq!(documents.len(), 2);
}

#[tokio::test]
async fn get_workflow_executions_fallback_unauthorized_returns_unauthorized() {
    init_test_config();

    let token_store = Arc::new(MockTokenStore {
        validate_workflow_access_result: false,
        ..MockTokenStore::default()
    });
    let state = build_state(token_store, Arc::new(MockExecutionStore::default()));
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/workflows/wf-1/executions")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("router should respond");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
