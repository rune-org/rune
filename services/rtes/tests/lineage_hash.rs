#![allow(missing_docs)]

use rtes::domain::models::{StackFrame, compute_lineage_hash};

#[test]
fn lineage_hash_is_deterministic_and_distinguishes_branches() {
    let stack_a = vec![StackFrame {
        split_node_id: "split-1".into(),
        branch_id:     "A".into(),
        item_index:    0,
        total_items:   2,
    }];

    let stack_b = vec![StackFrame {
        split_node_id: "split-1".into(),
        branch_id:     "B".into(),
        item_index:    1,
        total_items:   2,
    }];

    let hash_a1 = compute_lineage_hash(&stack_a).expect("hash a1");
    let hash_a2 = compute_lineage_hash(&stack_a).expect("hash a2");
    let hash_b = compute_lineage_hash(&stack_b).expect("hash b");

    // Deterministic for the same stack
    assert_eq!(hash_a1, hash_a2);
    // Different stacks yield different hashes
    assert_ne!(hash_a1, hash_b);
}
