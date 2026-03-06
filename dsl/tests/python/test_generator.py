"""Tests for the DSL code generator."""

import subprocess
import sys
from pathlib import Path


def test_generator_produces_output_files():
    """Run the generator and assert all three output files exist."""
    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    generator_script = repo_root / "dsl" / "generator" / "generate.py"
    output_dir = repo_root / "dsl" / "generated"

    result = subprocess.run(
        [sys.executable, str(generator_script)],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, f"Generator failed: {result.stderr}"

    types_py = output_dir / "types.py"
    types_ts = output_dir / "types.ts"
    types_go = output_dir / "types.go"

    assert types_py.exists(), "types.py was not generated"
    assert types_ts.exists(), "types.ts was not generated"
    assert types_go.exists(), "types.go was not generated"


def test_generated_files_contain_expected_symbols():
    """Assert generated files contain key symbols to catch gross regressions."""
    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    output_dir = repo_root / "dsl" / "generated"

    types_py = output_dir / "types.py"
    types_ts = output_dir / "types.ts"
    types_go = output_dir / "types.go"

    py_content = types_py.read_text()
    assert "Workflow" in py_content
    assert "Node" in py_content
    assert "Edge" in py_content
    assert "HttpNode" in py_content
    assert "from __future__ import annotations" in py_content

    ts_content = types_ts.read_text()
    assert "Workflow" in ts_content
    assert "Edge" in ts_content
    assert "HttpNode" in ts_content
    assert "sanitizeWorkflow" in ts_content

    go_content = types_go.read_text()
    assert "Workflow" in go_content
    assert "Node" in go_content
    assert "Edge" in go_content
    assert "func (n *Workflow) Sanitize()" in go_content
