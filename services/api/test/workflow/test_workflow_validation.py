"""Unit tests for workflow validation.

Two layers are exercised:
- Shape validation (the ``RuntimeWorkflowGraph`` Pydantic model): required/
  non-empty fields, types, id uniqueness, non-empty nodes.
- Semantic validation (``validate_workflow_data``): edge endpoints reference
  existing nodes, no self-references, exactly one trigger node.
"""

import re

import pytest
from pydantic import ValidationError as PydanticValidationError

from src.workflow.schemas import RuntimeWorkflowGraph
from src.workflow.validation import validate_workflow_data


def _graph(nodes, edges):
    return {"nodes": nodes, "edges": edges}


TRIGGER = {"id": "t", "type": "trigger", "trigger": True}
ACTION = {"id": "a", "type": "action"}


# ---------------------------------------------------------------------------
# Semantic layer: validate_workflow_data(dict) -> ValidationResult
# ---------------------------------------------------------------------------


def test_valid_single_trigger_graph_passes():
    result = validate_workflow_data(
        _graph([TRIGGER, ACTION], [{"id": "e1", "src": "t", "dst": "a"}])
    )
    assert result.valid is True
    assert result.errors == []


def test_edge_src_references_missing_node():
    result = validate_workflow_data(
        _graph([TRIGGER], [{"id": "e1", "src": "ghost", "dst": "t"}])
    )
    assert result.valid is False
    assert any(
        "src references unknown node 'ghost'" in e.message for e in result.errors
    )


def test_edge_dst_references_missing_node():
    result = validate_workflow_data(
        _graph([TRIGGER], [{"id": "e1", "src": "t", "dst": "ghost"}])
    )
    assert result.valid is False
    assert any(
        "dst references unknown node 'ghost'" in e.message for e in result.errors
    )


def test_self_referencing_edge_is_rejected():
    result = validate_workflow_data(
        _graph([TRIGGER], [{"id": "e1", "src": "t", "dst": "t"}])
    )
    assert result.valid is False
    assert any("Self-referencing edge" in e.message for e in result.errors)


def test_zero_trigger_nodes_is_rejected():
    result = validate_workflow_data(_graph([ACTION], []))
    assert result.valid is False
    assert any(
        e.message == "Workflow must have at least one trigger node"
        for e in result.errors
    )


def test_multiple_trigger_nodes_is_rejected():
    result = validate_workflow_data(
        _graph(
            [TRIGGER, {"id": "t2", "type": "trigger", "trigger": True}],
            [],
        )
    )
    assert result.valid is False
    assert any(
        e.message == "Workflow must have exactly one trigger node"
        for e in result.errors
    )


def test_multiple_semantic_errors_collected_together():
    # No trigger AND an edge pointing at a missing node -> both reported.
    result = validate_workflow_data(
        _graph([ACTION], [{"id": "e1", "src": "a", "dst": "ghost"}])
    )
    assert result.valid is False
    assert len(result.errors) >= 2


# ---------------------------------------------------------------------------
# Shape layer: RuntimeWorkflowGraph (Pydantic)
# ---------------------------------------------------------------------------


def test_empty_nodes_list_rejected():
    with pytest.raises(PydanticValidationError):
        RuntimeWorkflowGraph(nodes=[], edges=[])


def test_duplicate_node_ids_rejected():
    with pytest.raises(
        PydanticValidationError, match=re.escape("Workflow node ids must be unique")
    ):
        RuntimeWorkflowGraph(
            nodes=[{"id": "a", "type": "action"}, {"id": "a", "type": "trigger"}],
            edges=[],
        )


def test_empty_node_id_rejected():
    with pytest.raises(PydanticValidationError):
        RuntimeWorkflowGraph(nodes=[{"id": "", "type": "action"}], edges=[])


def test_missing_node_type_rejected():
    with pytest.raises(PydanticValidationError):
        RuntimeWorkflowGraph(nodes=[{"id": "a"}], edges=[])


def test_empty_node_type_rejected():
    with pytest.raises(PydanticValidationError):
        RuntimeWorkflowGraph(nodes=[{"id": "a", "type": ""}], edges=[])


def test_edge_missing_src_rejected():
    with pytest.raises(PydanticValidationError):
        RuntimeWorkflowGraph(nodes=[TRIGGER], edges=[{"id": "e1", "dst": "t"}])


def test_edge_missing_dst_rejected():
    with pytest.raises(PydanticValidationError):
        RuntimeWorkflowGraph(nodes=[TRIGGER], edges=[{"id": "e1", "src": "t"}])


def test_edge_empty_src_dst_rejected():
    with pytest.raises(PydanticValidationError):
        RuntimeWorkflowGraph(
            nodes=[TRIGGER], edges=[{"id": "e1", "src": "", "dst": ""}]
        )


def test_duplicate_edge_ids_rejected():
    with pytest.raises(
        PydanticValidationError, match=re.escape("Workflow edge ids must be unique")
    ):
        RuntimeWorkflowGraph(
            nodes=[TRIGGER, ACTION],
            edges=[
                {"id": "e1", "src": "t", "dst": "a"},
                {"id": "e1", "src": "a", "dst": "t"},
            ],
        )


def test_valid_graph_round_trips_src_dst_and_extra_keys():
    graph = RuntimeWorkflowGraph(
        nodes=[TRIGGER, {"id": "a", "type": "action", "custom": "kept"}],
        edges=[{"id": "e1", "src": "t", "dst": "a"}],
    )
    dumped = graph.model_dump(exclude_none=True, mode="json")
    assert dumped["edges"][0]["src"] == "t"
    assert dumped["edges"][0]["dst"] == "a"
    # extra="allow" preserves unmodeled frontend keys.
    assert dumped["nodes"][1]["custom"] == "kept"


def test_accepts_runtime_node_shape_from_canvas():
    # The canvas sends position as an [x, y] array plus runtime-only fields;
    # the runtime node model must accept (and preserve) all of it.
    graph = RuntimeWorkflowGraph(
        nodes=[
            {
                "id": "n1",
                "name": "Trigger",
                "type": "trigger",
                "trigger": True,
                "parameters": {},
                "output": {},
                "position": [100, 200],
            },
            {
                "id": "n2",
                "name": "HTTP",
                "type": "http",
                "trigger": False,
                "parameters": {},
                "output": {},
                "position": [300, 200],
            },
        ],
        edges=[{"id": "e1", "src": "n1", "dst": "n2"}],
    )
    dumped = graph.model_dump(exclude_none=True, mode="json")
    assert dumped["nodes"][0]["position"] == [100, 200]
    assert validate_workflow_data(dumped).valid is True
