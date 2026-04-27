"""Unit tests for workflow queue start-node validation."""

import re

import pytest

from src.workflow.queue import (
    NO_ACTION_NODES_MESSAGE,
    get_first_executable_node_ids,
)


def test_trigger_only_workflow_is_rejected():
    with pytest.raises(ValueError, match=re.escape(NO_ACTION_NODES_MESSAGE)):
        get_first_executable_node_ids(
            {
                "nodes": [{"id": "trigger", "type": "trigger", "trigger": True}],
                "edges": [],
            }
        )


def test_first_executable_nodes_follow_trigger_edges():
    first_nodes = get_first_executable_node_ids(
        {
            "nodes": [
                {"id": "trigger", "type": "trigger", "trigger": True},
                {"id": "action-1", "type": "action", "trigger": False},
                {"id": "action-2", "type": "action", "trigger": False},
            ],
            "edges": [
                {"id": "edge-1", "src": "trigger", "dst": "action-1"},
                {"id": "edge-2", "src": "trigger", "dst": "action-2"},
            ],
        }
    )

    assert first_nodes == ["action-1", "action-2"]
