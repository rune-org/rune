"""On-demand node documentation for the Smith agent.

Each node-creation tool has a sibling Markdown file in ``node_docs/`` named after
the node's exact ``node_type`` (e.g. ``http.md``,
``integration.google.sheets.read_range.md``). The system prompt only carries a
compact index (``build_node_type_index``); the agent calls the ``read_node_doc``
tool to pull the verbose per-node detail on demand.

This module is intentionally separate from ``tools.py`` to avoid an import cycle:
``agent.py`` imports both, but ``docs.py`` depends on neither ``tools`` nor
``nodes``.

Maintenance: adding a node type means dropping one ``<node_type>.md`` file here —
the index regenerates and the prompt never has to change.
"""

from pathlib import Path

from langchain.tools import tool

NODE_DOCS_DIR = Path(__file__).resolve().parent / "node_docs"
# Backwards-compatible private alias (older imports referenced the underscored name).
_NODE_DOCS_DIR = NODE_DOCS_DIR


# Legacy DSL type names → the canonical canvas/node_type names used as the
# ``node_docs/<node_type>.md`` filenames. Shared so every agent that reads the
# docs (Smith, Scryb) resolves a stored node's type to the same doc, and the two
# can never drift apart. Stored workflows may carry either form.
DSL_TO_CANONICAL_NODE_TYPE = {
    "ManualTrigger": "trigger",
    "ScheduledTrigger": "scheduledTrigger",
    "webhook": "webhookTrigger",
    "conditional": "if",
}


def canonical_node_type(raw: str) -> str:
    """Map a (possibly legacy DSL) node type to its canonical doc name.

    Returns ``raw`` unchanged when there is no mapping, so already-canonical
    types and unknown types pass through untouched.
    """
    return DSL_TO_CANONICAL_NODE_TYPE.get(raw, raw)


def _parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """Parse a leading ``---``-fenced ``key: value`` frontmatter block.

    A tiny, dependency-free parser (no PyYAML). It is deliberately tolerant: if
    the text has no well-formed frontmatter block, it returns ``({}, text)`` so a
    malformed or doc-only file still yields usable content.

    A value may span multiple physical lines: a non-blank line that is indented
    (starts with whitespace) is folded onto the most recent key, space-joined.
    This lets a long ``description`` wrap across several lines for readability::

        description:
          First line of the summary
          continued on the next line.

    Args:
        text: Full file contents.

    Returns:
        A ``(metadata, body)`` tuple. ``metadata`` maps frontmatter keys to
        their (stripped) string values; ``body`` is everything after the closing
        fence.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text

    meta: dict[str, str] = {}
    current_key: str | None = None
    for index in range(1, len(lines)):
        line = lines[index]
        if line.strip() == "---":
            body = "\n".join(lines[index + 1 :]).lstrip("\n")
            return {key: value.strip() for key, value in meta.items()}, body

        # An indented, non-blank line continues the most recent key's value.
        if current_key is not None and line[:1].isspace() and line.strip():
            meta[current_key] = f"{meta[current_key]} {line.strip()}".strip()
            continue

        key, sep, value = line.partition(":")
        if sep and key.strip():
            current_key = key.strip()
            meta[current_key] = value.strip()
        # Other lines inside the block are ignored (tolerant).

    # No closing fence -> treat the whole file as body.
    return {}, text


def _node_doc_paths() -> list[Path]:
    """Return the doc files that map to a node type.

    Skips meta files whose stem starts with ``_`` (e.g. ``_CONTRIBUTING.md``,
    the authoring spec) so they never leak into the node-type index or become
    readable via ``read_node_doc``. Every real ``node_type`` begins with a
    letter, so the convention is unambiguous.
    """
    return [p for p in _NODE_DOCS_DIR.glob("*.md") if not p.stem.startswith("_")]


def _available_node_types() -> set[str]:
    """Return the set of node types that have a doc file."""
    return {path.stem for path in _node_doc_paths()}


@tool(
    description=(
        "Read the full documentation (parameters, output shape, and usage "
        "notes) for a single node type before configuring it. Accepts either "
        "the exact node_type string, e.g. 'http', 'dateTimeAdd', or "
        "'integration.google.sheets.read_range', or a doc path as returned by "
        "`glob_search`/`grep_search`, e.g. '/http.md'. Use those search tools "
        "to discover or search across the node docs first."
    )
)
def read_node_doc(node_type: str) -> str:
    """Return the full Markdown doc for ``node_type``.

    Args:
        node_type: The node type stem (the doc file stem), or a doc path as
            emitted by the ``glob_search``/``grep_search`` tools. A leading
            ``/`` and a ``.md`` suffix are tolerated so a search result can be
            passed straight through.

    Returns:
        The document contents, or a helpful message listing the available node
        types when the requested type is unknown. Never raises, so a
        hallucinated type self-corrects.
    """
    # Normalize the virtual paths emitted by glob/grep ("/http.md") down to a
    # bare node-type stem ("http"); bare node types pass through unchanged.
    stem = node_type.strip().lstrip("/").removesuffix(".md")
    path = NODE_DOCS_DIR / f"{stem}.md"
    # Membership check also guards against path traversal via "../" etc.
    if stem not in _available_node_types() or not path.is_file():
        available = ", ".join(sorted(_available_node_types()))
        return (
            f"No documentation found for node type '{node_type}'. "
            f"Available node types: {available}"
        )
    return path.read_text(encoding="utf-8")


def build_node_type_index() -> str:
    """Build the ``## Available Node Types`` section for the system prompt.

    Scans ``node_docs/*.md`` and emits one ``- **<node_type>** — <description>``
    line per file
    Returns:
        The Markdown index section as a string.
    """
    entries: list[str] = []
    for path in sorted(_node_doc_paths()):
        node_type = path.stem
        meta, _ = _parse_frontmatter(path.read_text(encoding="utf-8"))
        description = meta.get("description", "").strip()
        entries.append(
            f"- **{node_type}** — {description}"
            if description
            else f"- **{node_type}**"
        )

    listing = "\n".join(entries)
    return (
        "## Available Node Types\n\n"
        "Every node type, with what it does and when it is used. Each line is "
        "`**<node_type>** — <description>`; the description is your signal for "
        "which node to pick and which doc to open.\n\n"
        f"{listing}"
    )
