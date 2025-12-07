# DSL Code Generator - Verification Checklist

This document provides a verification checklist for ensuring the DSL code generator is working correctly after changes.

## Pre-Generation Checks

- [ ] `dsl/dsl-definition.json` is valid JSON
- [ ] DSL definition matches RFC-002 specification
- [ ] All node types are defined
- [ ] All credential types are defined
- [ ] Parameter schemas are complete

## Generation

- [ ] Run `make dsl-generate` or `python3 dsl/generator/generate.py --all`
- [ ] All services generate without errors:
  - [ ] Frontend (TypeScript): 3 files
  - [ ] Backend (Python): 2 files
  - [ ] Worker (Go): 4 files
- [ ] No backup files (`.bak`) left behind

## Compilation & Type Checking

### Frontend (TypeScript)
- [ ] `apps/web/src/lib/workflow-dsl.ts` - No linter errors
- [ ] `apps/web/src/features/canvas/types.ts` - No linter errors
- [ ] `apps/web/src/lib/credentials.ts` - No linter errors
- [ ] Run `cd apps/web && pnpm typecheck` - No type errors

### Backend (Python)
- [ ] `services/api/src/smith/schemas.py` - Compiles successfully
- [ ] `services/api/src/workflow/schemas.py` - Compiles successfully
- [ ] Run `python3 -m py_compile src/smith/schemas.py src/workflow/schemas.py` - No errors

### Worker (Go)
- [ ] `services/rune-worker/pkg/core/node.go` - Syntactically correct
- [ ] `services/rune-worker/pkg/core/workflow.go` - Syntactically correct
- [ ] `services/rune-worker/pkg/core/credentials.go` - Syntactically correct
- [ ] `services/rune-worker/pkg/core/error_handling.go` - Syntactically correct
- [ ] Run `go build ./pkg/core/...` - No compilation errors (if Go toolchain available)

## Manual Sections Preservation

- [ ] `workflow-dsl.ts` - Conversion functions preserved:
  - [ ] `canvasToWorkflowData()` exists
  - [ ] `workflowDataToCanvas()` exists
  - [ ] `toWorkerParameters()` exists
  - [ ] `nodeHydrators` exists
- [ ] `canvas/types.ts` - `NODE_SCHEMA` preserved with hardcoded values
- [ ] `workflow/schemas.py` - Validation functions preserved
- [ ] Go files - Helper methods preserved:
  - [ ] `HasCredentials()` in `node.go`
  - [ ] `HasErrorHandling()` in `node.go`
  - [ ] All helper methods in `workflow.go`

## Generated Content Verification

### TypeScript Interfaces
- [ ] `WorkflowNode` interface generated correctly
- [ ] `WorkflowEdge` interface generated correctly
- [ ] `NodeDataMap` includes all node types
- [ ] Enum types generated correctly (HTTP method, log level)
- [ ] Parameter mappings work (retries, retryDelay, ignoreSSL)
- [ ] `NODE_TYPES_REQUIRING_CREDENTIALS` includes all credential-requiring nodes

### Python Models
- [ ] `WorkflowNode` Pydantic model generated
- [ ] `WorkflowEdge` Pydantic model generated
- [ ] `Workflow` Pydantic model generated
- [ ] `workflow_data` fields use `Workflow` type
- [ ] Type comments include all node types

### Go Structs
- [ ] `Node` struct generated correctly
- [ ] `Workflow` struct generated correctly
- [ ] `Edge` struct generated correctly
- [ ] `Credential` struct generated correctly
- [ ] `ErrorHandling` struct generated correctly
- [ ] Constants generated correctly

## Dependent Files Check

- [ ] Run `make dsl-check-deps` or `python3 dsl/generator/check_dependencies.py`
- [ ] Review list of dependent files (should be ~69 files)
- [ ] Check for any new files that should be added to dependency checker

## Integration Tests

- [ ] Frontend can import generated types without errors
- [ ] Backend can import generated models without errors
- [ ] Worker can import generated structs without errors
- [ ] Conversion functions work with actual workflow data
- [ ] API endpoints accept generated `Workflow` type
- [ ] Workflow creation/update flows work end-to-end

## Documentation

- [ ] `dsl/README.md` is up to date
- [ ] `dsl/SCOPE.md` lists all generated files correctly
- [ ] `dsl/MIGRATION.md` has accurate migration steps
- [ ] All TODO comments in generated files are clear

## Quick Verification Commands

```bash
# Validate DSL definition
make dsl-validate

# Generate all files
make dsl-generate

# Check dependencies
make dsl-check-deps

# Type check frontend
cd apps/web && pnpm typecheck

# Compile Python files
cd services/api && python3 -m py_compile src/smith/schemas.py src/workflow/schemas.py

# Check Go files (if toolchain available)
cd services/rune-worker && go build ./pkg/core/...
```

## Common Issues

### Issue: Generated code doesn't compile
**Check**: DSL definition JSON syntax, type mappings, missing required fields

### Issue: Manual sections lost
**Check**: Template preservation markers, TODO comments

### Issue: Type mismatches
**Check**: Field names, type conversions, parameter mappings

### Issue: Missing node types
**Check**: DSL definition includes all node types, templates iterate correctly

## Post-Verification

After successful verification:
- [ ] Commit generated files with DSL definition
- [ ] Update changelog if DSL structure changed
- [ ] Notify team if breaking changes
- [ ] Update documentation if needed

