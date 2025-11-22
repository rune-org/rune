from typing import Any
from .sir import SIRWorkflow, SIRStep, SIROutcome


class WorkflowSerializer:
    def __init__(self, workflow_dsl: dict[str, Any]):
        self.dsl = workflow_dsl
        self.nodes = {n["id"]: n for n in workflow_dsl.get("nodes", [])}
        self.edges = {e["id"]: e for e in workflow_dsl.get("edges", [])}

        # Build adjacency maps
        self.outgoing_edges: dict[str, list[dict[str, Any]]] = {}
        self.incoming_edges: dict[str, list[dict[str, Any]]] = {}

        for edge in workflow_dsl.get("edges", []):
            src = edge["src"]
            dst = edge["dst"]

            if src not in self.outgoing_edges:
                self.outgoing_edges[src] = []
            self.outgoing_edges[src].append(edge)

            if dst not in self.incoming_edges:
                self.incoming_edges[dst] = []
            self.incoming_edges[dst].append(edge)

    def serialize(self) -> SIRWorkflow:
        """Converts the raw DSL into the Semantic Intermediate Representation."""

        start_nodes = [
            n["id"]
            for n in self.dsl.get("nodes", [])
            if n["id"] not in self.incoming_edges
        ]

        sir_steps = []

        for node_data in self.dsl.get("nodes", []):
            step = self._process_node(node_data)
            sir_steps.append(step)

        return SIRWorkflow(
            id=self.dsl.get("id", ""),
            name=self.dsl.get("name", "Untitled Workflow"),
            description=self.dsl.get("description", ""),
            steps=sir_steps,
        )

    def _process_node(self, node: dict[str, Any]) -> SIRStep:
        node_id = node["id"]
        node_name = node.get("name", node_id)
        node_type = node.get("type", "unknown")

        outcomes = []
        if node_id in self.outgoing_edges:
            for edge in self.outgoing_edges[node_id]:
                edge_id = edge["id"]
                target_id = edge["dst"]
                target_node = self.nodes.get(target_id)
                target_name = (
                    target_node.get("name", target_id) if target_node else target_id
                )

                # Determine the label for this outcome
                label = edge.get("label", "Next")
                description = None

                # Check if this edge is referenced in parameters (e.g. conditional)
                params = node.get("parameters", {})
                if params.get("true_edge_id") == edge_id:
                    label = "True"
                    description = f"Condition met: {params.get('condition', '')}"
                elif params.get("false_edge_id") == edge_id:
                    label = "False"
                    description = "Condition not met"
                elif params.get("error_edge") == edge_id:
                    label = "Error"
                    description = "On Failure"

                outcomes.append(
                    SIROutcome(
                        target_step_name=target_name,
                        label=label,
                        description=description,
                    )
                )

        # Determine Previous Step
        prev_name = None
        if node_id in self.incoming_edges and self.incoming_edges[node_id]:
            e = self.incoming_edges[node_id][0]
            src_id = e["src"]
            src_node = self.nodes.get(src_id)
            prev_name = src_node.get("name", src_id) if src_node else src_id

        # Clean and Substitute Parameters
        clean_params = self._clean_parameters(node.get("parameters", {}))

        # Extract Credentials
        creds = node.get("credentials", None)
        cred_type = None
        if creds and isinstance(creds, dict):
            cred_type = creds.get("type")

        return SIRStep(
            id=node_id,
            name=node_name,
            type=node_type,  # Use raw type
            credentials=cred_type,
            parameters=clean_params,
            previous_step_name=prev_name,
            outcomes=outcomes,
        )

    def _clean_parameters(self, params: dict[str, Any]) -> dict[str, Any]:
        """Removes internal IDs or noisy fields and substitutes IDs with Names."""
        clean = {}
        # Remove keys that are not relevant for documentation
        keys_to_remove = ["credentials", "position"]

        for k, v in params.items():
            if k in keys_to_remove:
                continue

            if isinstance(v, str):
                # If value is an edge ID, replace it with the target node name
                if v in self.edges:
                    edge = self.edges[v]
                    target_id = edge["dst"]
                    target_node = self.nodes.get(target_id)
                    target_name = (
                        target_node.get("name", target_id) if target_node else target_id
                    )
                    clean[k] = target_name
                else:
                    clean[k] = v
            elif isinstance(v, dict):
                clean[k] = self._clean_parameters(
                    v
                )  # Recursive for nested dicts (e.g. headers)
            else:
                clean[k] = v

        return clean
