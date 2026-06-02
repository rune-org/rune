import hashlib
import json
from typing import Any


def calculate_workflow_hash(workflow_data: Any) -> str:
    """
    Calculate a deterministic SHA-256 hash for workflow data.

    Args:
        workflow_data: The workflow configuration/structure dictionary.

    Returns:
        A hex digest string of the hash.
    """
    if not workflow_data:
        return hashlib.sha256(b"{}").hexdigest()

    # Use sort_keys=True for deterministic serialization
    canonical_json = json.dumps(
        workflow_data, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")

    return hashlib.sha256(canonical_json).hexdigest()
