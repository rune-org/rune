#![allow(missing_docs)]

use rtes::domain::models::{NodeError, NodeStatusMessage, StackFrame};
use serde_json::json;

#[test]
fn node_status_message_roundtrip_preserves_lineage_hash_and_used_inputs() {
    let status = NodeStatusMessage {
        workflow_id:      "wf-1".into(),
        execution_id:     "exec-1".into(),
        node_id:          "node-1".into(),
        node_name:        "Example".into(),
        status:           "success".into(),
        input:            Some(json!({"foo": "bar"})),
        parameters:       Some(json!({"p": 1})),
        output:           Some(json!({"out": 42})),
        error:            None,
        executed_at:      "2025-01-01T00:00:00Z".into(),
        duration_ms:      10,
        branch_id:        None,
        split_node_id:    None,
        item_index:       None,
        total_items:      None,
        processed_count:  None,
        aggregator_state: None,
        lineage_stack:    Some(vec![StackFrame {
            split_node_id: "split-1".into(),
            branch_id:     "A".into(),
            item_index:    0,
            total_items:   1,
        }]),
        lineage_hash:     Some("hash-123".into()),
        used_inputs:      Some(json!({"foo": "bar"})),
    };

    let serialized = serde_json::to_string(&status).expect("serialize");
    let deserialized: NodeStatusMessage = serde_json::from_str(&serialized).expect("deserialize");

    assert_eq!(deserialized.lineage_hash, Some("hash-123".into()));
    assert_eq!(deserialized.used_inputs, Some(json!({"foo": "bar"})));
    assert_eq!(deserialized.lineage_stack.unwrap()[0].branch_id, "A");
    assert_eq!(deserialized.output, Some(json!({"out": 42})));
}

#[test]
fn node_error_roundtrip() {
    let err = NodeError {
        message: "boom".into(),
        code:    "ERR".into(),
        details: Some(json!({"info": "detail"})),
    };
    let ser = serde_json::to_string(&err).expect("serialize");
    let de: NodeError = serde_json::from_str(&ser).expect("deserialize");
    assert_eq!(de.message, "boom");
    assert_eq!(de.code, "ERR");
    assert_eq!(de.details.unwrap()["info"], "detail");
}
