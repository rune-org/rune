# DSL Code Generator

This directory contains the Domain-Specific Language (DSL) definition and code generator for the Rune workflow platform.

## Overview

The DSL code generator ensures consistency across all three services (Frontend TypeScript, Backend Python, Worker Go) when the workflow DSL evolves. The generator reads `dsl-definition.json` and generates type definitions, schemas, and validation code for each service.

## Directory Structure

```
dsl/
├── dsl-definition.json      # Source of truth for DSL structure
├── README.md                # This file
├── SCOPE.md                 # Files that will/won't be generated
├── MIGRATION.md            # Migration guide from current code
└── generator/
    ├── generate.py         # Main generator script
    ├── cli.py              # CLI interface
    ├── check_dependencies.py # Dependency checker
    ├── requirements.txt    # Python dependencies
    ├── templates/          # Jinja2 templates for code generation
    │   ├── typescript/
    │   ├── python/
    │   └── go/
    └── tests/              # Generator tests
```

## Quick Start

1. **Update DSL Definition**: Edit `dsl-definition.json`
2. **Generate Code**: Run `make dsl-generate` or `python dsl/generator/generate.py --all`
3. **Verify**: Check that all services compile/type-check
4. **Update Manual Files**: See "Manual Updates Required" section below

## DSL Definition Format

The `dsl-definition.json` file defines:
- Core structures (Workflow, Node, Edge, Credential, ErrorHandling)
- Node types and their parameter schemas
- Field types, validation rules, and defaults
- Type mappings between services

See the file itself for the complete schema.

## Generated Files

### Frontend (TypeScript)
- `apps/web/src/lib/workflow-dsl.ts` - Core DSL interfaces
- `apps/web/src/features/canvas/types.ts` - Canvas node data types

### Backend (Python)
- `services/api/src/smith/schemas.py` - Pydantic models (Workflow, WorkflowNode, WorkflowEdge)
- `services/api/src/workflow/schemas.py` - Workflow API schemas (uses generated Workflow type)

### Worker (Go)
- `services/rune-worker/pkg/core/node.go` - Node struct
- `services/rune-worker/pkg/core/workflow.go` - Workflow and Edge structs
- `services/rune-worker/pkg/core/credentials.go` - Credential struct
- `services/rune-worker/pkg/core/error_handling.go` - ErrorHandling struct

## Manual Updates Required

Some files cannot be fully generated due to complexity or framework-specific concerns. When the DSL changes, these files may need manual updates:

### Frontend

#### `apps/web/src/lib/workflow-dsl.ts`
**What to update**: Conversion functions between ReactFlow and DSL formats
- `canvasToWorkflowData()` - Converts ReactFlow graph to DSL format
- `workflowDataToCanvas()` - Converts DSL format to ReactFlow graph
- `toWorkerParameters()` - Maps canvas node data to worker parameters
- `nodeHydrators` - Hydrates canvas node data from DSL parameters

**When to update**: When node parameter structures change, new node types are added, or field names change

**How to update**: 
1. Check generated type definitions for parameter changes
2. Update mapping logic in conversion functions
3. Test with actual workflow data

#### `apps/web/src/lib/credentials.ts`
**What to update**: Credential validation and node type requirements
- `NODE_TYPES_REQUIRING_CREDENTIALS` - Set of node types that require credentials
- `isCredentialRef()` - Type guard for credential references
- `nodeTypeRequiresCredential()` - Checks if a node type needs credentials

**When to update**: When credential structure changes or new node types requiring credentials are added

**How to update**:
1. Check DSL definition for credential structure changes
2. Update `NODE_TYPES_REQUIRING_CREDENTIALS` if new credential-requiring nodes are added
3. Update validation logic if credential structure changes

### Backend

#### `services/api/src/workflow/schemas.py`
**What to update**: Workflow API schemas that use DSL types
- `WorkflowCreate.workflow_data` - Now typed as `Workflow` (generated)
- `WorkflowDetail.workflow_data` - Now typed as `Workflow` (generated)
- `WorkflowUpdateData.workflow_data` - Now typed as `Workflow` (generated)
- `NodeExecutionMessage.workflow_definition` - Now typed as `Workflow` (generated)

**When to update**: This file is now GENERATED. If you need to change the structure, update `dsl-definition.json` and regenerate.

**Note**: If you need to accept partial workflow data or handle migration from old `dict[str, Any]` format, you may need to temporarily use `Workflow | dict[str, Any]` union type.

#### `services/api/src/db/models.py`
**What to update**: `CredentialType` enum should match DSL credential types
- The enum values should match credential types in `dsl-definition.json`

**When to update**: When new credential types are added to the DSL

**How to update**:
1. Check `dsl-definition.json` for credential types
2. Add missing enum values to `CredentialType`
3. Ensure enum values match DSL credential type identifiers exactly

**Note**: This file is NOT fully generated because it contains database models. Only the `CredentialType` enum needs manual sync.

#### `services/api/src/credentials/schemas.py`
**What to update**: This file uses `CredentialType` from `db/models.py`
- No direct DSL changes needed, but depends on `CredentialType` enum being in sync

**When to update**: When `CredentialType` enum changes (see above)

#### `apps/web/src/client/types.gen.ts`
**What to update**: `CredentialType` type should match backend enum
- This file is auto-generated from the OpenAPI spec
- The `CredentialType` union type should match the backend `CredentialType` enum

**When to update**: When `CredentialType` enum changes in `db/models.py`

**How to update**:
1. Update `CredentialType` enum in `services/api/src/db/models.py` (see above)
2. Regenerate the OpenAPI client (usually done automatically in CI/CD or via a script)
3. Verify the `CredentialType` type in `types.gen.ts` matches:
   ```typescript
   export type CredentialType = 'api_key' | 'oauth2' | 'basic_auth' | 'token' | 'custom' | 'smtp';
   ```

**Note**: If `types.gen.ts` is not auto-regenerated, you may need to manually update it or run the OpenAPI client generation script. Check your project's build process for how this file is generated.

#### `services/api/src/smith/tools.py`
**What to update**: Workflow validation logic
- `_validate()` - Validates workflow structure (triggers, edges, nodes)
- `create_node()` - Node creation with parameter validation
- `build_workflow()` - Workflow assembly and validation

**When to update**: When validation rules change, new node types are added, or structural constraints change

**How to update**:
1. Review DSL definition for validation rule changes
2. Update validation logic in `_validate()`
3. Update node creation logic if parameter schemas change

#### `services/api/src/smith/prompts.py`
**What to update**: Node schemas for Smith AI agent
- `NODE_SCHEMAS` - Schema definitions for each node type

**When to update**: When node parameter schemas change or new node types are added

**How to update**:
1. Review DSL definition for node parameter changes
2. Update `NODE_SCHEMAS` dictionary
3. Ensure field descriptions match DSL definition

## Contributing to the Generator

### Updating Manual Functions in Templates

If you modify one of the **manual functions** in a generated file (e.g., `canvasToWorkflowData()`, `workflowDataToCanvas()`, validation functions), you should also update the corresponding Jinja2 template to preserve your changes across regenerations.

**Example**: If you update `canvasToWorkflowData()` in `workflow-dsl.ts`:
1. Locate the template: `dsl/generator/templates/typescript/workflow-dsl.ts.j2`
2. Find the section marked with `{% raw %}` or `{# MANUAL SECTION #}` comments
3. Update the template with your changes
4. Test by regenerating: `make dsl-generate`
5. Verify your changes are preserved

**Why**: The generator preserves manual sections, but if the template structure changes, your manual code might be lost. Keeping templates in sync ensures your changes persist.

### Adding New Files That Use DSL Types

If you create a **new file** that imports or interacts with DSL-generated structures, you have two options:

#### Option 1: Add to Generator (Recommended for frequently-used patterns)

If the new file follows a pattern that should be generated (e.g., a new service, a new type definition file):

1. **Create a Jinja2 template**: Add a new template in `dsl/generator/templates/` (TypeScript, Python, or Go)
2. **Update generator script**: Modify `dsl/generator/generate.py` to render and write the new template
3. **Test**: Run `make dsl-generate` and verify the new file is generated correctly
4. **Document**: Update `SCOPE.md` to list the new generated file

**Example**: If you add a new `workflow-utils.ts` file with helper functions:
```python
# In generate.py
def generate_typescript(self):
    # ... existing code ...
    
    # Generate workflow-utils.ts
    template = self.env.get_template("typescript/workflow-utils.ts.j2")
    content = template.render(dsl=self.dsl_data)
    output_path = self.repo_root / "apps" / "web" / "src" / "lib" / "workflow-utils.ts"
    self.write_file(output_path, content)
```

#### Option 2: Raise an Issue (For one-off files or complex cases)

If the file is:
- A one-off utility that doesn't follow a pattern
- Too complex to generate (requires significant business logic)
- Framework-specific and not suitable for generation

**Action**: Raise an issue on the repository with:
- File path and description
- Why it uses DSL types
- Whether it should be generated or just documented as a dependent file
- Any relevant code snippets

The maintainers will either:
- Add it to the generator if it's a common pattern
- Document it in `SCOPE.md` as a dependent file
- Provide guidance on how to handle it

**Example Issue Title**: `[DSL Generator] Add workflow-utils.ts to generator or document as dependent file`

### Updating Dependency Checker

If you add a new file that uses DSL types, you may want to update `dsl/generator/check_dependencies.py` to ensure it's detected:

1. Check if existing patterns already match your file
2. If not, add appropriate patterns to detect the new file
3. Test: Run `python3 dsl/generator/check_dependencies.py` and verify your file appears

## Dependent Files

These files import or use generated DSL types and should be verified after regeneration:

### Frontend
- `apps/web/src/lib/workflows.ts`
- `apps/web/src/features/canvas/FlowCanvas.tsx`
- `apps/web/src/app/(canvas)/create/app/page.tsx`
- `apps/web/src/features/canvas/types.ts`
- `apps/web/src/lib/credentials.ts`

### Backend
- `services/api/src/smith/__init__.py`
- `services/api/src/smith/tools.py`
- `services/api/src/smith/service.py`
- `services/api/src/smith/router.py`
- `services/api/src/workflow/schemas.py`
- `services/api/src/scryb/serializer.py`
- `services/api/src/workflow/service.py`

### Worker
- All files importing `core.Node`, `core.Workflow`, `core.Edge`, `core.Credential`, `core.ErrorHandling`
- See `dsl/generator/check_dependencies.py` for complete list

**Note**: To see the complete list of dependent files, run:
```bash
python3 dsl/generator/check_dependencies.py
```

Or save as JSON:
```bash
python3 dsl/generator/check_dependencies.py --json dependencies.json
```

## Verification Checklist

After running the generator:

- [ ] All generated files compile/type-check
- [ ] No import errors in dependent files
- [ ] Type compatibility verified
- [ ] Existing tests pass
- [ ] Manual files updated if needed
- [ ] End-to-end workflow creation tested

## Adding New Node Types

1. Add node type definition to `dsl-definition.json`
2. Define parameter schema with all fields
3. Run generator: `make dsl-generate`
4. Update manual files (see above)
5. Test in all three services

## Troubleshooting

### Generated code doesn't compile
- Check DSL definition JSON syntax
- Verify type mappings are correct
- Check for missing required fields

### Type mismatches after regeneration
- Review dependent files for breaking changes
- Update manual conversion functions
- Check type imports are correct

### Tests failing after regeneration
- Verify generated types match expected structure
- Check for field name changes
- Review validation logic updates

## See Also

- `SCOPE.md` - Detailed list of what will/won't be generated
- `MIGRATION.md` - Guide for migrating from current code
- RFC-002 - Workflow DSL specification

