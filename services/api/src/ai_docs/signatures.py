import dspy


class StepDocSignature(dspy.Signature):
    """Explain an individual workflow step."""

    step_name: str = dspy.InputField(desc="Human-readable step name.")
    step_type: str = dspy.InputField(desc="Node type or action class.")
    parameters_json: str = dspy.InputField(
        desc="Compact JSON of the parameters to include verbatim."
    )
    outcomes_json: str = dspy.InputField(
        desc="JSON array of possible outcomes/edges for this step."
    )
    previous_step: str = dspy.InputField(desc="Name of the previous step or START.")
    credentials: str = dspy.InputField(desc="Credential type if present, otherwise None.")

    step_doc: str = dspy.OutputField(
        desc="2 to 4 sentences describing what this step does and how it branches."
    )
    risks: str = dspy.OutputField(
        desc="Warnings, failure modes, or assumptions. Use 'None' if nothing notable."
    )


class WorkflowDocSignature(dspy.Signature):
    """Assemble a workflow-level document from step sections."""

    workflow_name: str = dspy.InputField()
    workflow_description: str = dspy.InputField(
        desc="Original description or empty if unset."
    )
    ordered_steps: str = dspy.InputField(
        desc="Ordered step sections rendered as text or markdown."
    )
    coverage_notes: str = dspy.InputField(
        desc="Checklist of steps and outcomes."
    )

    workflow_doc: str = dspy.OutputField(
        desc="Structured markdown containing overview and step-by-step details."
    )
    callouts: str = dspy.OutputField(
        desc="Important warnings or assumptions for operators. 'None' if none."
    )
