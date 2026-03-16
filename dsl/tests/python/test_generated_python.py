"""Tests for generated Python DSL types: import, construct, and sanitize."""

import pytest


def test_import_generated_types():
    """Generated types can be imported without NameError (forward reference fix)."""
    from dsl.generated.types import (
        Workflow,
        Edge,
        HttpNode,
        HttpParameters,
        Node,
    )

    assert Workflow is not None
    assert Edge is not None
    assert HttpNode is not None
    assert HttpParameters is not None
    assert Node is not None


def test_workflow_sanitize_valid():
    """Construct a minimal valid Workflow with nodes and edges; sanitize passes."""
    from dsl.generated.types import (
        Workflow,
        Edge,
        HttpNode,
        HttpParameters,
    )

    http_params = HttpParameters(
        method="GET",
        url="https://api.example.com",
        body=None,
        query=None,
        headers=None,
        retry=None,
        retry_delay=None,
        timeout=None,
        raise_on_status=None,
        ignore_ssl=None,
    )
    http_node = HttpNode(
        id="node_1",
        name="Fetch API",
        trigger=False,
        output={},
        parameters=http_params,
        error=None,
        credentials=None,
    )
    edge = Edge(id="edge_1", src="node_1", dst="node_2")

    workflow = Workflow(
        workflow_id="wf_1",
        execution_id="exec_1",
        nodes=[http_node],
        edges=[edge],
    )

    valid, errors = workflow.sanitize()
    assert valid is True, f"Expected valid workflow, got errors: {errors}"
    assert len(errors) == 0


def test_edge_sanitize_valid():
    """Construct a valid Edge and assert sanitize passes."""
    from dsl.generated.types import Edge

    edge = Edge(id="e1", src="n1", dst="n2")
    valid, errors = edge.sanitize()
    assert valid is True
    assert len(errors) == 0


def test_http_node_sanitize_valid():
    """Construct a valid HttpNode with HttpParameters and assert sanitize passes."""
    from dsl.generated.types import HttpNode, HttpParameters

    params = HttpParameters(
        method="POST",
        url="https://example.com",
        body=None,
        query=None,
        headers=None,
        retry=None,
        retry_delay=None,
        timeout=None,
        raise_on_status=None,
        ignore_ssl=None,
    )
    node = HttpNode(
        id="n1",
        name="POST example",
        trigger=False,
        output={},
        parameters=params,
        error=None,
        credentials=None,
    )
    valid, errors = node.sanitize()
    assert valid is True
    assert len(errors) == 0


def test_workflow_sanitize_invalid():
    """Workflow with missing required fields fails sanitize."""
    from dsl.generated.types import Workflow, Edge, HttpNode, HttpParameters

    params = HttpParameters(
        method="GET",
        url="https://example.com",
        body=None,
        query=None,
        headers=None,
        retry=None,
        retry_delay=None,
        timeout=None,
        raise_on_status=None,
        ignore_ssl=None,
    )
    node = HttpNode(
        id="node_1",
        name="Fetch",
        trigger=False,
        output={},
        parameters=params,
        error=None,
        credentials=None,
    )
    # Build workflow with workflow_id=None via model_construct so sanitize rejects it
    workflow = Workflow.model_construct(
        workflow_id=None,
        execution_id="exec_1",
        nodes=[node],
        edges=[Edge(id="e1", src="node_1", dst="node_2")],
    )

    valid, errors = workflow.sanitize()
    assert valid is False
    assert len(errors) > 0
    assert any("workflow_id" in e for e in errors)
