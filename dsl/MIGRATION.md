# DSL Code Generator - Migration Guide

This guide helps you migrate from the current manually-maintained DSL code to the generated code system.

## Overview

The DSL code generator reads `dsl/dsl-definition.json` and generates type definitions, schemas, and validation code for all three services. This ensures consistency when the DSL evolves.

## Migration Steps

### Step 1: Review Current DSL Structure

Before migrating, understand what the current DSL looks like:

1. Review `services/rune-worker/rfcs/RFC-002-workflow-dsl.md` for the DSL specification
2. Check existing type definitions in:
   - `apps/web/src/lib/workflow-dsl.ts`
   - `services/api/src/smith/schemas.py`
   - `services/rune-worker/pkg/core/*.go`

### Step 2: Create DSL Definition

The generator uses `dsl/dsl-definition.json` as the source of truth. This file has been created based on RFC-002 and existing code.

**Action**: Review `dsl/dsl-definition.json` and ensure it matches your current DSL structure.

### Step 3: Run Initial Generation

Generate code for all services:

```bash
make dsl-generate
# or
python3 dsl/generator/generate.py --all
```

### Step 4: Compare Generated vs Current Code

Compare the generated files with your current code:

```bash
# Frontend
git diff apps/web/src/lib/workflow-dsl.ts
git diff apps/web/src/features/canvas/types.ts
git diff apps/web/src/lib/credentials.ts

# Backend
git diff services/api/src/smith/schemas.py
git diff services/api/src/workflow/schemas.py

# Worker
git diff services/rune-worker/pkg/core/node.go
git diff services/rune-worker/pkg/core/workflow.go
git diff services/rune-worker/pkg/core/credentials.go
git diff services/rune-worker/pkg/core/error_handling.go
```

### Step 5: Handle Breaking Changes

If the generated code differs from current code, you have two options:

#### Option A: Update DSL Definition
If the generated code is correct but your current code is outdated:
1. Update `dsl-definition.json` to match current code
2. Regenerate
3. Verify generated code matches current code

#### Option B: Update Current Code
If the DSL definition is correct but current code is outdated:
1. Accept the generated code
2. Update dependent files that use the DSL types
3. Test thoroughly

### Step 6: Preserve Manual Sections

The generator preserves manual sections (conversion functions, validation logic, etc.) with TODO comments. Verify these sections are intact:

- ✅ `workflow-dsl.ts` - Conversion functions preserved
- ✅ `canvas/types.ts` - NODE_SCHEMA preserved
- ✅ `workflow/schemas.py` - Validation functions preserved
- ✅ Go files - Helper methods preserved

### Step 7: Update Dependent Files

Some files that import DSL types may need updates:

**Frontend:**
- `apps/web/src/lib/workflows.ts` - Check for type compatibility
- `apps/web/src/features/canvas/FlowCanvas.tsx` - Usually no changes needed
- `apps/web/src/app/(canvas)/create/app/page.tsx` - Usually no changes needed

**Backend:**
- `services/api/src/smith/tools.py` - May need validation logic updates
- `services/api/src/scryb/serializer.py` - May need serialization updates
- `services/api/src/workflow/service.py` - Check for type compatibility

**Worker:**
- All files using `core.Node`, `core.Workflow`, etc. - Check for field access changes

### Step 8: Update CredentialType Enum

If credential types changed, manually sync the following files:

#### Backend: `services/api/src/db/models.py`

```python
class CredentialType(str, Enum):
    SMTP = "smtp"
    API_KEY = "api_key"
    OAUTH2 = "oauth2"
    USERNAME_PASSWORD = "username_password"
    # ... ensure matches dsl-definition.json
```

#### Frontend: `apps/web/src/client/types.gen.ts`

This file is auto-generated from the OpenAPI spec. After updating the backend `CredentialType` enum:

1. **Regenerate the OpenAPI client** (usually done automatically in CI/CD or via a script)
2. **Verify** the `CredentialType` type in `types.gen.ts` matches the backend enum:

```typescript
export type CredentialType = 'api_key' | 'oauth2' | 'basic_auth' | 'token' | 'custom' | 'smtp';
// ... ensure matches backend CredentialType enum
```

**Note**: If `types.gen.ts` is not auto-regenerated, you may need to manually update it or run the OpenAPI client generation script. Check your project's build process for how this file is generated.

### Step 9: Test Everything

Run tests for all services:

```bash
# Frontend
cd apps/web && pnpm typecheck
cd apps/web && pnpm test

# Backend
cd services/api && python -m pytest

# Worker
cd services/rune-worker && go test ./...
```

### Step 10: Update Workflow Data in Database

If `Workflow.workflow_data` type changed from `dict[str, Any]` to `Workflow`:

1. **Backward Compatibility**: The generated `workflow/schemas.py` uses `Workflow` type, but you may need to handle old `dict` format during migration
2. **Database**: No migration needed - JSONB stores both formats
3. **API**: Consider adding validation to accept both formats temporarily

**Temporary Solution** (if needed):
```python
from typing import Union
workflow_data: Union[Workflow, dict[str, Any]] = Field(...)
```

Then gradually migrate to pure `Workflow` type.

## Common Migration Issues

### Issue 1: Type Mismatches

**Symptom**: TypeScript/Python/Go compilation errors after regeneration

**Solution**:
1. Check if field names changed in DSL definition
2. Update field access in dependent files
3. Check if types changed (e.g., `string` to `number`)

### Issue 2: Missing Fields

**Symptom**: Generated code missing fields that exist in current code

**Solution**:
1. Check if field is in `dsl-definition.json`
2. If missing, add to DSL definition
3. Regenerate

### Issue 3: Extra Fields in Generated Code

**Symptom**: Generated code has fields not in current code

**Solution**:
1. Check if field should be in DSL (from RFC-002)
2. If yes, update current code to include it
3. If no, remove from DSL definition

### Issue 4: Conversion Functions Broken

**Symptom**: `canvasToWorkflowData` or `workflowDataToCanvas` not working

**Solution**:
1. Check TODO comments in generated file
2. Review parameter mappings in DSL definition
3. Update conversion logic manually (see `dsl/README.md`)

### Issue 5: Validation Logic Outdated

**Symptom**: `_validate()` in `smith/tools.py` doesn't catch new validation rules

**Solution**:
1. Review DSL definition for validation rules
2. Update `_validate()` function manually
3. Add tests for new validation rules

## Rollback Procedure

If migration causes issues, you can rollback:

```bash
# Restore original files from git
git checkout main -- apps/web/src/lib/workflow-dsl.ts
git checkout main -- services/api/src/smith/schemas.py
# ... etc for other files

# Or restore from backup files (if generator created them)
# Generator creates .bak files before overwriting
```

## Post-Migration Checklist

After successful migration:

- [ ] All generated files compile/type-check
- [ ] All tests pass
- [ ] Manual sections preserved with TODO comments
- [ ] Dependent files updated if needed
- [ ] `CredentialType` enum synced with DSL
- [ ] Documentation updated
- [ ] Team notified of new workflow (use `make dsl-generate`)

## Future Workflow

After migration, when you need to change the DSL:

1. **Edit DSL Definition**: Modify `dsl/dsl-definition.json`
2. **Regenerate**: Run `make dsl-generate`
3. **Review Changes**: Check generated files
4. **Update Manual Files**: See `dsl/README.md` for files needing manual updates
5. **Test**: Run tests for all services
6. **Commit**: Commit both DSL definition and generated files

## See Also

- `dsl/README.md` - Complete documentation
- `dsl/SCOPE.md` - What will/won't be generated
- `dsl/dsl-definition.json` - Source of truth
- RFC-002 - Workflow DSL specification

