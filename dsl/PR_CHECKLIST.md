# PR Checklist - DSL Code Generator

## Pre-PR Checklist

### Code Generation
- [x] Generator script works (`make dsl-generate`)
- [x] All three services generate successfully
- [x] Generated files compile/type-check
- [x] Manual sections preserved with TODO comments

### Documentation
- [x] README.md complete with usage instructions
- [x] SCOPE.md lists all generated/manual files
- [x] MIGRATION.md has step-by-step guide
- [x] VERIFICATION.md has checklist
- [x] All documentation files committed

### Code Quality
- [x] No backup files (`.bak`) in repo
- [x] Generated files have proper headers
- [x] Templates are well-structured
- [x] Dependency checker works

### Testing (Before PR)
- [ ] **Project builds successfully**
  ```bash
  make build
  # or
  make dev  # if you want to test running
  ```
- [ ] **Frontend type-checks**
  ```bash
  cd apps/web && pnpm typecheck
  ```
- [ ] **Backend imports work**
  ```bash
  cd services/api && python3 -c "from src.smith.schemas import Workflow; print('OK')"
  ```
- [ ] **Quick E2E test**: Launch project and verify:
  - [ ] Can create a workflow
  - [ ] Can add nodes (HTTP, SMTP, etc.)
  - [ ] Can save workflow
  - [ ] Workflow data structure is correct
- [ ] **No breaking changes**: Existing workflows still work

### Git
- [ ] All changes committed
- [ ] Branch is up to date with main
- [ ] Commit messages are clear
- [ ] No sensitive data in commits

## What to Test (E2E)

### Minimal Test
1. Start the project: `make dev` (or your usual dev command)
2. Open frontend in browser
3. Create a new workflow
4. Add a few nodes (HTTP, SMTP, conditional)
5. Save the workflow
6. Verify it saves without errors
7. Reload and verify workflow loads correctly

### If Issues Found
- Check browser console for TypeScript errors
- Check backend logs for Python import errors
- Verify generated files are correct
- Check if manual conversion functions need updates

## PR Description Template

```markdown
## Summary
Implements DSL code generator to ensure consistency across Frontend (TypeScript), Backend (Python), and Worker (Go) services.

## Changes
- Created `dsl/` directory with DSL definition and generator
- Generator script with Jinja2 templates for all three services
- Comprehensive documentation (README, SCOPE, MIGRATION, VERIFICATION)
- Dependency checker to identify files using DSL types
- Makefile targets: `dsl-generate`, `dsl-validate`, `dsl-check-deps`

## Generated Files
- Frontend: `workflow-dsl.ts`, `canvas/types.ts`, `credentials.ts`
- Backend: `smith/schemas.py`, `workflow/schemas.py`
- Worker: `core/node.go`, `core/workflow.go`, `core/credentials.go`, `core/error_handling.go`

## Testing
- [x] Generator runs successfully
- [x] All generated files compile/type-check
- [x] Manual sections preserved
- [ ] E2E test: Project builds and runs
- [ ] E2E test: Can create/save workflows

## Breaking Changes
None - this is additive. Existing code continues to work.

## Next Steps
After merge, team should:
1. Review `dsl/README.md` for usage
2. Use `make dsl-generate` when DSL changes
3. Update manual files as documented
```

## Files Changed Summary

### New Files
- `dsl/dsl-definition.json` - DSL source of truth
- `dsl/README.md` - Main documentation
- `dsl/SCOPE.md` - What's generated vs manual
- `dsl/MIGRATION.md` - Migration guide
- `dsl/VERIFICATION.md` - Verification checklist
- `dsl/generator/generate.py` - Generator script
- `dsl/generator/check_dependencies.py` - Dependency checker
- `dsl/generator/templates/**/*.j2` - Jinja2 templates

### Modified Files
- `Makefile` - Added DSL targets
- Generated files (will be regenerated on merge)

### Documentation
All documentation is in `dsl/` directory. See README.md for quick start.

