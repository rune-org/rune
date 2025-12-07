#!/usr/bin/env python3
"""
Dependency checker for DSL-generated files.

This script identifies files that import or use DSL-generated types,
helping developers understand the impact of DSL changes.
"""

import json
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Set
from collections import defaultdict


class DependencyChecker:
    """Checks for files that depend on DSL-generated code."""

    def __init__(self, repo_root: Path):
        self.repo_root = repo_root
        self.dependencies: Dict[str, List[str]] = defaultdict(list)

    def check_typescript(self) -> Dict[str, List[str]]:
        """Find TypeScript files that import DSL types."""
        deps = defaultdict(list)

        # DSL-generated files
        generated_files = [
            "apps/web/src/lib/workflow-dsl.ts",
            "apps/web/src/features/canvas/types.ts",
            "apps/web/src/lib/credentials.ts",
        ]

        # Patterns to search for
        patterns = [
            r'from ["\']@/lib/workflow-dsl["\']',
            r'from ["\']@/features/canvas/types["\']',
            r'from ["\']@/lib/credentials["\']',
            r'import.*workflow-dsl',
            r'import.*canvas/types',
            r'import.*credentials',
            r'WorkflowNode',
            r'WorkflowEdge',
            r'CanvasNode',
            r'NodeKind',
            r'CredentialRef',
        ]

        # Search in TypeScript files
        for ts_file in self.repo_root.rglob("*.ts"):
            if ts_file.is_file() and "node_modules" not in str(ts_file):
                rel_path = str(ts_file.relative_to(self.repo_root))
                
                # Skip generated files themselves
                if any(gen in rel_path for gen in generated_files):
                    continue

                try:
                    content = ts_file.read_text(encoding="utf-8")
                    for pattern in patterns:
                        if re.search(pattern, content):
                            deps[rel_path].append(f"matches pattern: {pattern}")
                            break
                except Exception:
                    pass

        return dict(deps)

    def check_python(self) -> Dict[str, List[str]]:
        """Find Python files that import DSL types."""
        deps = defaultdict(list)

        # DSL-generated files
        generated_files = [
            "services/api/src/smith/schemas.py",
            "services/api/src/workflow/schemas.py",
        ]

        # Patterns to search for
        patterns = [
            r'from src\.smith\.schemas import',
            r'from src\.workflow\.schemas import',
            r'from \.\.smith\.schemas import',
            r'from \.\.workflow\.schemas import',
            r'WorkflowNode',
            r'WorkflowEdge',
            r'Workflow\b',  # Word boundary to avoid matching "WorkflowDetail"
        ]

        # Search in Python files
        for py_file in self.repo_root.rglob("*.py"):
            if py_file.is_file() and "__pycache__" not in str(py_file):
                rel_path = str(py_file.relative_to(self.repo_root))
                
                # Skip generated files themselves
                if any(gen in rel_path for gen in generated_files):
                    continue

                try:
                    content = py_file.read_text(encoding="utf-8")
                    for pattern in patterns:
                        if re.search(pattern, content):
                            deps[rel_path].append(f"matches pattern: {pattern}")
                            break
                except Exception:
                    pass

        return dict(deps)

    def check_go(self) -> Dict[str, List[str]]:
        """Find Go files that import DSL types."""
        deps = defaultdict(list)

        # DSL-generated files
        generated_files = [
            "services/rune-worker/pkg/core/node.go",
            "services/rune-worker/pkg/core/workflow.go",
            "services/rune-worker/pkg/core/credentials.go",
            "services/rune-worker/pkg/core/error_handling.go",
        ]

        # Patterns to search for
        patterns = [
            r'import.*"rune-worker/pkg/core"',
            r'core\.Node',
            r'core\.Workflow',
            r'core\.Edge',
            r'core\.Credential',
            r'core\.ErrorHandling',
        ]

        # Search in Go files
        for go_file in self.repo_root.rglob("*.go"):
            if go_file.is_file():
                rel_path = str(go_file.relative_to(self.repo_root))
                
                # Skip generated files themselves
                if any(gen in rel_path for gen in generated_files):
                    continue

                try:
                    content = go_file.read_text(encoding="utf-8")
                    for pattern in patterns:
                        if re.search(pattern, content):
                            deps[rel_path].append(f"matches pattern: {pattern}")
                            break
                except Exception:
                    pass

        return dict(deps)

    def check_all(self) -> Dict[str, Dict[str, List[str]]]:
        """Check all languages and return combined results."""
        return {
            "typescript": self.check_typescript(),
            "python": self.check_python(),
            "go": self.check_go(),
        }

    def print_report(self, results: Dict[str, Dict[str, List[str]]]):
        """Print a formatted dependency report."""
        print("=" * 70)
        print("DSL Dependency Report")
        print("=" * 70)
        print()

        total_files = 0
        for lang, deps in results.items():
            if deps:
                print(f"\n{lang.upper()} Files ({len(deps)} files):")
                print("-" * 70)
                for file_path, reasons in sorted(deps.items()):
                    print(f"  {file_path}")
                    for reason in reasons:
                        print(f"    - {reason}")
                total_files += len(deps)
            else:
                print(f"\n{lang.upper()} Files: No dependencies found")

        print()
        print("=" * 70)
        print(f"Total files with dependencies: {total_files}")
        print("=" * 70)

    def save_json_report(self, results: Dict[str, Dict[str, List[str]]], output_path: Path):
        """Save dependency report as JSON."""
        output_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
        print(f"\nJSON report saved to: {output_path}")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Check for files that depend on DSL-generated code"
    )
    parser.add_argument(
        "--json",
        type=Path,
        help="Save report as JSON to specified path",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).parent.parent.parent,
        help="Repository root directory (default: auto-detect)",
    )

    args = parser.parse_args()

    checker = DependencyChecker(args.repo_root)
    results = checker.check_all()
    checker.print_report(results)

    if args.json:
        checker.save_json_report(results, args.json)


if __name__ == "__main__":
    main()

