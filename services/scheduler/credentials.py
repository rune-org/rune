"""
Credential resolution for scheduler.
Cloned from API to resolve credentials before workflow execution.
"""

import base64
import copy
import json
import logging
from typing import Any
from cryptography.fernet import Fernet

logger = logging.getLogger("scheduler.credentials")


class CredentialResolver:
    """Resolves workflow credentials from database."""

    def __init__(self, encryptor: Fernet):
        """
        Initialize credential resolver.

        Args:
            encryptor: Fernet instance for decrypting credentials
        """
        self.encryptor = encryptor

    async def resolve_workflow_credentials(
        self, workflow_data: dict[str, Any], db_conn
    ) -> dict[str, Any]:
        """
        Resolve credentials for all nodes in the workflow.
        Cloned from API's workflow_service.py to maintain compatibility.

        Iterates through all nodes, finds credential references,
        fetches from database, decrypts, and embeds the values.

        Args:
            workflow_data: The workflow definition containing nodes and edges
            db_conn: Database connection for fetching credentials

        Returns:
            Updated workflow_data with resolved credentials embedded in nodes
        """
        # Create a deep copy to avoid mutating the original
        resolved_data = copy.deepcopy(workflow_data)

        # Get all nodes from the workflow
        nodes = resolved_data.get("nodes", [])

        logger.info(f"Resolving credentials for {len(nodes)} nodes")

        for node in nodes:
            # Check if this node has a credentials reference
            if "credentials" in node and isinstance(node["credentials"], dict):
                cred_ref = node["credentials"]
                logger.info(
                    f"Node {node.get('name')} has credentials reference: {cred_ref}"
                )

                # If it has an id field, it's a reference that needs resolving
                if "id" in cred_ref:
                    credential_id = cred_ref["id"]

                    # Convert string ID to int if needed
                    if isinstance(credential_id, str):
                        credential_id = int(credential_id)

                    # Fetch the credential from database
                    query = """
                        SELECT id, name, credential_type, credential_data
                        FROM workflow_credentials
                        WHERE id = $1
                    """
                    credential = await db_conn.fetchrow(query, credential_id)

                    if not credential:
                        error_msg = f"Credential with ID {credential_id} not found"
                        logger.error(error_msg)
                        raise ValueError(error_msg)

                    logger.info(
                        f"Found credential: {credential['name']} (type: {credential['credential_type']})"
                    )

                    # Decrypt the credential data (API uses base64 + Fernet)
                    encrypted_data = credential["credential_data"]

                    # Handle both bytes and string formats
                    if isinstance(encrypted_data, str):
                        encrypted_data = encrypted_data.encode()

                    # Decode base64 first, then decrypt with Fernet
                    decoded = base64.b64decode(encrypted_data)
                    decrypted_bytes = self.encryptor.decrypt(decoded)
                    credential_values = json.loads(decrypted_bytes.decode())

                    # Replace the credentials reference with resolved values
                    node["credentials"] = {
                        "id": str(credential["id"]),  # Convert to string for Go worker
                        "name": credential["name"],
                        "type": credential["credential_type"],
                        "values": credential_values,
                    }
                    logger.info(
                        f"Resolved credentials for node {node.get('name')} with {len(credential_values)} values"
                    )

        logger.info("Credential resolution complete")
        return resolved_data
