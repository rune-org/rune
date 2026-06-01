"""Export the JSON Schema for a ``rune-templates`` bundle entry.

This is the contract between this repo and the ``rune-templates`` repo. CI
in ``rune-templates`` validates every template file against the schema this
script produces; whenever ``TemplateBundleEntry`` (or any model it embeds,
notably ``WorkflowGraph``) changes here, regenerate the schema and sync it
into ``rune-templates``.

Usage::

    uv run python scripts/export_template_schema.py [--output path]

Default output is ``template.schema.json`` in the API package root.
"""

import argparse
import json
import sys
from pathlib import Path

# Make `src.*` importable when this script is run directly (not via pytest).
_API_ROOT = Path(__file__).resolve().parent.parent
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

from src.templates.schemas import TemplateBundleEntry  # noqa: E402


SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema"
DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "template.schema.json"


def build_schema() -> dict:
    """Generate the JSON Schema dict for a template bundle entry."""
    schema = TemplateBundleEntry.model_json_schema()
    schema["$schema"] = SCHEMA_DIALECT
    schema.setdefault(
        "$id",
        "https://github.com/rune-org/rune-templates/schema/template.schema.json",
    )
    return schema


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Path to write the schema (default: {DEFAULT_OUTPUT}).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero if the file on disk differs from the generated schema.",
    )
    args = parser.parse_args()

    schema = build_schema()
    serialized = json.dumps(schema, indent=2, sort_keys=True) + "\n"

    if args.check:
        if not args.output.exists():
            print(f"Schema file missing: {args.output}", file=sys.stderr)
            return 1
        if args.output.read_text() != serialized:
            print(
                "Schema drift detected. Run: uv run python scripts/export_template_schema.py",
                file=sys.stderr,
            )
            return 1
        print(f"Schema up to date: {args.output}")
        return 0

    args.output.write_text(serialized)
    print(f"Wrote template JSON Schema to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
