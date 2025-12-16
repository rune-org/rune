#!/usr/bin/env python3
"""DSL Code Generator for Rune Workflow Platform.

Generates type definitions, schemas, and validation code for the workflow DSL
across all three services (Frontend TypeScript, Backend Python, Worker Go).
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
import glob

try:
    from jinja2 import Environment, FileSystemLoader, Template
except ImportError:
    print("Error: jinja2 is required. Install with: pip install -r dsl/generator/requirements.txt")
    sys.exit(1)


class DSLGenerator:
    """Main generator class for DSL code generation."""
    
    def __init__(self, dsl_file: str, output_dir: Optional[str] = None):
        """Initialize generator with DSL definition file.
        
        Args:
            dsl_file: Path to dsl-definition.json (relative to repo root or absolute)
            output_dir: Optional output directory (defaults to repo root)
        """
        self.repo_root = Path(__file__).parent.parent.parent
        # Resolve dsl_file relative to repo root if it's a relative path
        dsl_path = Path(dsl_file)
        if not dsl_path.is_absolute():
            # Try relative to repo root first
            self.dsl_file = self.repo_root / dsl_path
            # If that doesn't exist, try relative to current working directory
            if not self.dsl_file.exists():
                self.dsl_file = Path(dsl_file).resolve()
        else:
            self.dsl_file = dsl_path
        self.output_dir = Path(output_dir) if output_dir else self.repo_root
        self.dsl_data: Dict[str, Any] = {}
        
        # Template directories
        self.template_dir = Path(__file__).parent / "templates"
        self.env = Environment(
            loader=FileSystemLoader(str(self.template_dir)),
            trim_blocks=True,
            lstrip_blocks=True,
        )
    
    def load_dsl_definition(self) -> Dict[str, Any]:
        """Load and validate DSL definition JSON.
        
        Returns:
            Parsed DSL definition dictionary
            
        Raises:
            FileNotFoundError: If DSL file doesn't exist
            json.JSONDecodeError: If JSON is invalid
        """
        if not self.dsl_file.exists():
            raise FileNotFoundError(f"DSL definition file not found: {self.dsl_file}")
        
        with open(self.dsl_file, "r", encoding="utf-8") as f:
            self.dsl_data = json.load(f)
        
        return self.dsl_data
    
    def write_file(self, file_path: Path, content: str, backup: bool = True) -> None:
        """Write generated content to file with optional backup.
        
        Args:
            file_path: Target file path
            content: Generated content
            backup: Whether to backup existing file
        """
        # Create backup if file exists
        if backup and file_path.exists():
            backup_path = file_path.with_suffix(file_path.suffix + ".bak")
            with open(backup_path, "w", encoding="utf-8") as f:
                with open(file_path, "r", encoding="utf-8") as original:
                    f.write(original.read())
        
        # Ensure directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write file
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        print(f"Generated: {file_path.relative_to(self.repo_root)}")
    
    def cleanup_backup_files(self) -> None:
        """Delete all .bak backup files created during generation."""
        # Directories where generated files are located
        output_dirs = [
            self.repo_root / "apps" / "web" / "src" / "lib",
            self.repo_root / "apps" / "web" / "src" / "features" / "canvas",
            self.repo_root / "services" / "api" / "src" / "smith",
            self.repo_root / "services" / "api" / "src" / "workflow",
            self.repo_root / "services" / "rune-worker" / "pkg" / "core",
        ]
        
        deleted_count = 0
        for output_dir in output_dirs:
            if output_dir.exists():
                # Find all .bak files in this directory
                for bak_file in output_dir.glob("*.bak"):
                    try:
                        bak_file.unlink()
                        deleted_count += 1
                    except OSError as e:
                        print(f"Warning: Could not delete {bak_file.relative_to(self.repo_root)}: {e}")
        
        if deleted_count > 0:
            print(f"\nCleaned up {deleted_count} backup file(s)")
    
    def generate_typescript(self) -> None:
        """Generate TypeScript interfaces and types."""
        print("\n=== Generating TypeScript ===")
        
        # Generate core workflow-dsl.ts
        template = self.env.get_template("typescript/workflow-dsl.ts.j2")
        content = template.render(dsl=self.dsl_data)
        output_path = self.repo_root / "apps" / "web" / "src" / "lib" / "workflow-dsl.ts"
        self.write_file(output_path, content)
        
        # Generate canvas types.ts
        template = self.env.get_template("typescript/canvas-types.ts.j2")
        content = template.render(dsl=self.dsl_data)
        output_path = self.repo_root / "apps" / "web" / "src" / "features" / "canvas" / "types.ts"
        self.write_file(output_path, content)
        
        # Generate credentials.ts (NODE_TYPES_REQUIRING_CREDENTIALS)
        template = self.env.get_template("typescript/credentials.ts.j2")
        content = template.render(dsl=self.dsl_data)
        output_path = self.repo_root / "apps" / "web" / "src" / "lib" / "credentials.ts"
        self.write_file(output_path, content)
    
    def generate_python(self) -> None:
        """Generate Python Pydantic models."""
        print("\n=== Generating Python ===")
        
        # Generate smith schemas (core DSL types)
        template = self.env.get_template("python/schemas.py.j2")
        content = template.render(dsl=self.dsl_data)
        output_path = self.repo_root / "services" / "api" / "src" / "smith" / "schemas.py"
        self.write_file(output_path, content)
        
        # Generate workflow schemas (uses generated Workflow type)
        template = self.env.get_template("python/workflow-schemas.py.j2")
        content = template.render(dsl=self.dsl_data)
        output_path = self.repo_root / "services" / "api" / "src" / "workflow" / "schemas.py"
        self.write_file(output_path, content)
        
        # Note: credentials/schemas.py uses CredentialType from db/models.py
        # We generate a reference template but db/models.py needs manual update
        # See dsl/README.md for instructions
    
    def generate_go(self) -> None:
        """Generate Go structs."""
        print("\n=== Generating Go ===")
        
        # Generate node.go
        template = self.env.get_template("go/node.go.j2")
        content = template.render(dsl=self.dsl_data)
        output_path = self.repo_root / "services" / "rune-worker" / "pkg" / "core" / "node.go"
        self.write_file(output_path, content)
        
        # Generate workflow.go
        template = self.env.get_template("go/workflow.go.j2")
        content = template.render(dsl=self.dsl_data)
        output_path = self.repo_root / "services" / "rune-worker" / "pkg" / "core" / "workflow.go"
        self.write_file(output_path, content)
        
        # Generate credentials.go
        template = self.env.get_template("go/credentials.go.j2")
        content = template.render(dsl=self.dsl_data)
        output_path = self.repo_root / "services" / "rune-worker" / "pkg" / "core" / "credentials.go"
        self.write_file(output_path, content)
        
        # Generate error_handling.go
        template = self.env.get_template("go/error_handling.go.j2")
        content = template.render(dsl=self.dsl_data)
        output_path = self.repo_root / "services" / "rune-worker" / "pkg" / "core" / "error_handling.go"
        self.write_file(output_path, content)
    
    def generate_all(self) -> None:
        """Generate code for all services."""
        self.load_dsl_definition()
        self.generate_typescript()
        self.generate_python()
        self.generate_go()
        self.cleanup_backup_files()
        print("\n=== Generation Complete ===")


def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate DSL code for Rune services")
    parser.add_argument(
        "--dsl-file",
        default="dsl/dsl-definition.json",
        help="Path to DSL definition JSON file"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Generate code for all services"
    )
    parser.add_argument(
        "--frontend",
        action="store_true",
        help="Generate TypeScript code only"
    )
    parser.add_argument(
        "--backend",
        action="store_true",
        help="Generate Python code only"
    )
    parser.add_argument(
        "--worker",
        action="store_true",
        help="Generate Go code only"
    )
    
    args = parser.parse_args()
    
    generator = DSLGenerator(args.dsl_file)
    
    if args.all or (not args.frontend and not args.backend and not args.worker):
        generator.generate_all()
    else:
        generator.load_dsl_definition()
        if args.frontend:
            generator.generate_typescript()
        if args.backend:
            generator.generate_python()
        if args.worker:
            generator.generate_go()
        # Clean up backup files after any generation
        generator.cleanup_backup_files()


if __name__ == "__main__":
    main()

