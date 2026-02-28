#!/usr/bin/env python3
"""
DSL Code Generator

Generates strongly-typed DSL definitions for TypeScript, Python, and Go
from a type-aware JSON DSL definition.
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional


class DSLGenerator:
    """Generates DSL type definitions for multiple languages."""
    
    def __init__(self, dsl_file: str):
        """Initialize generator with DSL definition file."""
        self.repo_root = Path(__file__).parent.parent.parent
        self.dsl_file = self.repo_root / dsl_file
        self.output_dir = self.repo_root / "dsl" / "generated"
        self.dsl_data = self._load_dsl()
        
    def _load_dsl(self) -> Dict[str, Any]:
        """Load and parse DSL definition JSON."""
        with open(self.dsl_file, 'r') as f:
            return json.load(f)
    
    def _get_type_mapping(self, lang: str) -> Dict[str, str]:
        """Get type mapping for a specific language."""
        mappings = {
            'typescript': {
                'string': 'string',
                'number': 'number',
                'boolean': 'boolean',
                'object': 'Record<string, any>',
                'array': 'any[]',
                'any': 'any',
            },
            'python': {
                'string': 'str',
                'number': 'float',
                'boolean': 'bool',
                'object': 'dict[str, Any]',
                'array': 'list[Any]',
                'any': 'Any',
            },
            'go': {
                'string': 'string',
                'number': 'float64',
                'boolean': 'bool',
                'object': 'map[string]interface{}',
                'array': '[]interface{}',
                'any': 'interface{}',
            }
        }
        return mappings.get(lang, {})
    
    def _get_optional_syntax(self, lang: str, type_name: str, required: bool) -> str:
        """Get optional type syntax for a language."""
        if required:
            return type_name
        
        if lang == 'typescript':
            return f'{type_name} | undefined'
        elif lang == 'python':
            return f'Optional[{type_name}]'
        elif lang == 'go':
            return f'*{type_name}'
        return type_name
    
    def _to_go_field_name(self, name: str) -> str:
        """Convert snake_case to Go exported field name."""
        # Handle special case: 'type' is a reserved keyword in Go
        if name == 'type':
            return 'Type'
        parts = name.split('_')
        return ''.join(word.capitalize() for word in parts)
    
    def _generate_field(self, lang: str, field_name: str, field_def: Dict[str, Any]) -> str:
        """Generate a single field definition."""
        field_type = field_def.get('type', 'any')
        required = field_def.get('required', False)
        description = field_def.get('description', '')
        
        # Handle array items
        if field_type == 'array':
            items_type = field_def.get('items_type', 'any')
            if lang == 'typescript':
                # Map nested types properly
                if items_type in ['Node', 'Edge', 'Credential', 'ErrorHandling', 'SwitchRule', 'EditAssignment']:
                    type_name = f'{items_type}[]'
                else:
                    type_name = f'{self._get_type_mapping(lang).get(items_type, "any")}[]'
            elif lang == 'python':
                if items_type in ['Node', 'Edge', 'Credential', 'ErrorHandling', 'SwitchRule', 'EditAssignment']:
                    type_name = f'list[{items_type}]'
                else:
                    type_name = f'list[{self._get_type_mapping(lang).get(items_type, "Any")}]'
            elif lang == 'go':
                if items_type in ['Node', 'Edge', 'Credential', 'ErrorHandling', 'SwitchRule', 'EditAssignment']:
                    type_name = f'[]{items_type}'
                else:
                    type_name = f'[]{self._get_type_mapping(lang).get(items_type, "interface{}")}'
        else:
            type_name = self._get_type_mapping(lang).get(field_type, 'any')
        
        # Handle enum
        if 'enum' in field_def:
            if lang == 'typescript':
                enum_values = ' | '.join(f'"{v}"' for v in field_def['enum'])
                type_name = enum_values
            elif lang == 'python':
                enum_values = ', '.join(f'"{v}"' for v in field_def['enum'])
                type_name = f'Literal[{enum_values}]'
            elif lang == 'go':
                # Go doesn't have enums, use string with constants
                type_name = 'string'
        
        # Handle nested types
        if field_type in ['Node', 'Edge', 'Credential', 'ErrorHandling', 'SwitchRule', 'EditAssignment']:
            type_name = field_type
        
        final_type = self._get_optional_syntax(lang, type_name, required)
        
        # Generate field with comment
        if lang == 'typescript':
            comment = f'  // {description}' if description else ''
            return f'  {field_name}: {final_type};{comment}'
        elif lang == 'python':
            comment = f'  # {description}' if description else ''
            # Handle Python reserved keywords with Pydantic Field aliases
            python_field_name = field_name
            reserved_keywords = ['from', 'type', 'class', 'def', 'import', 'as', 'if', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'pass', 'break', 'continue', 'return', 'yield', 'lambda', 'and', 'or', 'not', 'is', 'in', 'del', 'global', 'nonlocal', 'assert', 'raise']
            if field_name in reserved_keywords:
                python_field_name = f'{field_name}_'
                # Use Pydantic Field with alias to map back to original JSON field name
                return f'    {python_field_name}: {final_type} = Field(alias="{field_name}"){comment}'
            return f'    {python_field_name}: {final_type}{comment}'
        elif lang == 'go':
            comment = f'  // {description}' if description else ''
            json_tag = f'`json:"{field_name}"`'
            go_field_name = self._to_go_field_name(field_name)
            return f'  {go_field_name} {final_type} {json_tag}{comment}'
        
        return ''
    
    def _generate_class(self, lang: str, class_name: str, fields: Dict[str, Any], description: str = '') -> str:
        """Generate a class/struct definition."""
        lines = []
        
        if lang == 'typescript':
            lines.append(f'export interface {class_name} {{')
            if description:
                lines.append(f'  // {description}')
            for field_name, field_def in fields.items():
                lines.append(self._generate_field(lang, field_name, field_def))
            lines.append('}')
        elif lang == 'python':
            lines.append(f'class {class_name}(BaseModel):')
            if description:
                lines.append(f'    """{description}"""')
            for field_name, field_def in fields.items():
                lines.append(self._generate_field(lang, field_name, field_def))
        elif lang == 'go':
            lines.append(f'type {class_name} struct {{')
            if description:
                lines.append(f'  // {description}')
            for field_name, field_def in fields.items():
                lines.append(self._generate_field(lang, field_name, field_def))
            lines.append('}')
        
        return '\n'.join(lines)
    
    def _generate_sanitization_method(self, lang: str, class_name: str, fields: Dict[str, Any]) -> str:
        """Generate sanitization/validation method for a class."""
        if lang == 'typescript':
            lines = [
                f'export function sanitize{class_name}(obj: {class_name}): {{ valid: boolean; errors: string[] }} {{',
                '  const errors: string[] = [];',
                ''
            ]
            for field_name, field_def in fields.items():
                required = field_def.get('required', False)
                field_type = field_def.get('type', 'any')
                if required:
                    lines.append(f'  if (obj.{field_name} === undefined || obj.{field_name} === null) {{')
                    lines.append(f'    errors.push("{class_name}.{field_name} is required");')
                    lines.append('  }')
                # Type checking
                if field_type == 'string':
                    lines.append(f'  if (obj.{field_name} !== undefined && typeof obj.{field_name} !== "string") {{')
                    lines.append(f'    errors.push("{class_name}.{field_name} must be a string");')
                    lines.append('  }')
                elif field_type == 'number':
                    lines.append(f'  if (obj.{field_name} !== undefined && typeof obj.{field_name} !== "number") {{')
                    lines.append(f'    errors.push("{class_name}.{field_name} must be a number");')
                    lines.append('  }')
                elif field_type == 'boolean':
                    lines.append(f'  if (obj.{field_name} !== undefined && typeof obj.{field_name} !== "boolean") {{')
                    lines.append(f'    errors.push("{class_name}.{field_name} must be a boolean");')
                    lines.append('  }')
            lines.extend([
                '',
                '  return {',
                '    valid: errors.length === 0,',
                '    errors',
                '  };',
                '}'
            ])
            return '\n'.join(lines)
        
        elif lang == 'python':
            lines = [
                f'    def sanitize(self) -> tuple[bool, list[str]]:',
                '        """Validate and sanitize the object."""',
                '        errors: list[str] = []',
                ''
            ]
            for field_name, field_def in fields.items():
                required = field_def.get('required', False)
                field_type = field_def.get('type', 'any')
                # Handle Python reserved keywords
                python_field_name = field_name
                if field_name in ['from', 'type', 'class', 'def', 'import', 'as', 'if', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'pass', 'break', 'continue', 'return', 'yield', 'lambda', 'and', 'or', 'not', 'is', 'in', 'del', 'global', 'nonlocal', 'assert', 'raise']:
                    python_field_name = f'{field_name}_'
                if required:
                    lines.append(f'        if self.{python_field_name} is None:')
                    lines.append(f'            errors.append("{class_name}.{field_name} is required")')
                # Type checking
                if field_type == 'string':
                    lines.append(f'        if self.{python_field_name} is not None and not isinstance(self.{python_field_name}, str):')
                    lines.append(f'            errors.append("{class_name}.{field_name} must be a string")')
                elif field_type == 'number':
                    lines.append(f'        if self.{python_field_name} is not None and not isinstance(self.{python_field_name}, (int, float)):')
                    lines.append(f'            errors.append("{class_name}.{field_name} must be a number")')
                elif field_type == 'boolean':
                    lines.append(f'        if self.{python_field_name} is not None and not isinstance(self.{python_field_name}, bool):')
                    lines.append(f'            errors.append("{class_name}.{field_name} must be a boolean")')
            lines.extend([
                '',
                '        return len(errors) == 0, errors'
            ])
            return '\n'.join(lines)
        
        elif lang == 'go':
            lines = [
                f'func (n *{class_name}) Sanitize() (bool, []string) {{',
                '  var errors []string',
                ''
            ]
            for field_name, field_def in fields.items():
                required = field_def.get('required', False)
                field_type = field_def.get('type', 'any')
                go_field = self._to_go_field_name(field_name)
                if required:
                    if field_type == 'string':
                        lines.append(f'  if n.{go_field} == "" {{')
                        lines.append(f'    errors = append(errors, "{class_name}.{field_name} is required")')
                        lines.append('  }')
                    elif field_type == 'boolean':
                        # Booleans in Go are not pointers by default, but we need to check if it's set
                        # For now, we'll skip boolean validation as they have default values
                        pass
                    elif field_type == 'number':
                        # Numbers in Go are not pointers by default
                        pass
                    elif field_type == 'array':
                        lines.append(f'  if n.{go_field} == nil || len(n.{go_field}) == 0 {{')
                        lines.append(f'    errors = append(errors, "{class_name}.{field_name} is required")')
                        lines.append('  }')
                    else:
                        # For objects and other types that are pointers
                        lines.append(f'  if n.{go_field} == nil {{')
                        lines.append(f'    errors = append(errors, "{class_name}.{field_name} is required")')
                        lines.append('  }')
            lines.extend([
                '',
                '  return len(errors) == 0, errors',
                '}'
            ])
            return '\n'.join(lines)
        
        return ''
    
    def _get_credential_type_default_ts(self, credential_type) -> str:
        """Get TypeScript default value string for credential_type."""
        if credential_type is None:
            return 'undefined'
        elif isinstance(credential_type, list):
            types_str = ' | '.join(f'"{ct}"' for ct in credential_type)
            return f'[{types_str}]'
        else:
            return f'["{credential_type}"]'
    
    def generate_typescript(self) -> str:
        """Generate TypeScript definitions."""
        lines = [
            '// Auto-generated DSL type definitions',
            '// DO NOT EDIT - Generated from dsl/dsl-definition.json',
            '',
            '// Core Structures',
            ''
        ]
        
        # Generate core structures (excluding Node - we'll generate BaseNode + specific nodes)
        for struct_name, struct_def in self.dsl_data['core_structures'].items():
            if struct_name == 'Node':
                continue  # Skip generic Node, we'll generate BaseNode + specific nodes
            fields = struct_def.get('fields', {})
            description = struct_def.get('description', '')
            lines.append(self._generate_class('typescript', struct_name, fields, description))
            lines.append('')
            lines.append(self._generate_sanitization_method('typescript', struct_name, fields))
            lines.append('')
        
        # Generate nested types
        if 'nested_types' in self.dsl_data:
            lines.append('// Nested Types')
            lines.append('')
            for type_name, type_def in self.dsl_data['nested_types'].items():
                fields = type_def.get('fields', {})
                description = type_def.get('description', '')
                lines.append(self._generate_class('typescript', type_name, fields, description))
                lines.append('')
                lines.append(self._generate_sanitization_method('typescript', type_name, fields))
                lines.append('')
        
        # Generate node parameter types
        lines.append('// Node Parameter Types')
        lines.append('')
        for node_type, node_def in self.dsl_data['node_types'].items():
            params = node_def.get('parameters', {})
            if params:
                class_name = f'{node_type.title().replace("_", "")}Parameters'
                description = node_def.get('description', '')
                lines.append(self._generate_class('typescript', class_name, params, description))
                lines.append('')
                lines.append(self._generate_sanitization_method('typescript', class_name, params))
                lines.append('')
        
        # Generate BaseNode interface
        lines.append('// Base Node Interface')
        lines.append('')
        node_def = self.dsl_data['core_structures']['Node']
        base_fields = {
            'id': node_def['fields']['id'],
            'name': node_def['fields']['name'],
            'trigger': node_def['fields']['trigger'],
            'output': node_def['fields']['output'],
            'error': node_def['fields']['error'],
            'credential_type': {
                'type': 'array',
                'items_type': 'string',
                'required': False,
                'description': 'List of allowed credential types for this node (for UI filtering)'
            },
            'credentials': node_def['fields']['credentials']
        }
        lines.append('export interface BaseNode {')
        lines.append('  // Base node with common fields')
        for field_name, field_def in base_fields.items():
            lines.append(self._generate_field('typescript', field_name, field_def))
        lines.append('}')
        lines.append('')
        lines.append(self._generate_sanitization_method('typescript', 'BaseNode', base_fields))
        lines.append('')
        
        # Generate specific node interfaces
        lines.append('// Specific Node Interfaces')
        lines.append('')
        node_types = []
        for node_type, node_def in self.dsl_data['node_types'].items():
            # Convert node_type to interface name
            if node_type == 'ManualTrigger':
                interface_name = 'ManualTriggerNode'
            else:
                interface_name = f'{node_type.title().replace("_", "")}Node'
            
            node_types.append(interface_name)
            
            # Get parameters type
            params = node_def.get('parameters', {})
            if params:
                params_type = f'{node_type.title().replace("_", "")}Parameters'
            else:
                params_type = 'Record<string, any>'
            
            # Get credential_type type
            credential_type = node_def.get('credential_type')
            if credential_type is None:
                credential_type_ts = 'string[] | undefined'
            elif isinstance(credential_type, list):
                types_str = ' | '.join(f'"{ct}"' for ct in credential_type)
                credential_type_ts = f'({types_str})[]'
            else:
                credential_type_ts = f'["{credential_type}"]'
            
            # Generate interface
            lines.append(f'export interface {interface_name} extends BaseNode {{')
            lines.append(f'  // {node_def.get("description", "")}')
            lines.append(f'  type: "{node_type}";')
            lines.append(f'  parameters: {params_type};')
            lines.append(f'  credential_type: {credential_type_ts};')
            lines.append('}')
            lines.append('')
        
        # Generate Union type
        lines.append('// Union type for all nodes')
        lines.append('')
        union_types = ' | '.join(node_types)
        lines.append(f'export type Node = {union_types};')
        lines.append('')
        
        return '\n'.join(lines)
    
    def _get_credential_type_default(self, credential_type) -> str:
        """Get Python default value string for credential_type."""
        if credential_type is None:
            return 'None'
        elif isinstance(credential_type, list):
            types_str = ', '.join(f'"{ct}"' for ct in credential_type)
            return f'[{types_str}]'
        else:
            return f'"{credential_type}"'
    
    def generate_python(self) -> str:
        """Generate Python definitions."""
        lines = [
            '"""Auto-generated DSL type definitions.',
            '',
            'DO NOT EDIT - Generated from dsl/dsl-definition.json',
            '"""',
            '',
            'from typing import Any, Optional, Literal, Union',
            'from pydantic import BaseModel, Field',
            '',
            '# Core Structures',
            ''
        ]
        
        # Generate core structures (excluding Node - we'll generate BaseNode and specific nodes)
        for struct_name, struct_def in self.dsl_data['core_structures'].items():
            if struct_name == 'Node':
                continue  # Skip generic Node, we'll generate BaseNode + specific nodes
            fields = struct_def.get('fields', {})
            description = struct_def.get('description', '')
            lines.append(self._generate_class('python', struct_name, fields, description))
            lines.append('')
            lines.append(self._generate_sanitization_method('python', struct_name, fields))
            lines.append('')
        
        # Generate nested types
        if 'nested_types' in self.dsl_data:
            lines.append('# Nested Types')
            lines.append('')
            for type_name, type_def in self.dsl_data['nested_types'].items():
                fields = type_def.get('fields', {})
                description = type_def.get('description', '')
                lines.append(self._generate_class('python', type_name, fields, description))
                lines.append('')
                lines.append(self._generate_sanitization_method('python', type_name, fields))
                lines.append('')
        
        # Generate node parameter types
        lines.append('# Node Parameter Types')
        lines.append('')
        for node_type, node_def in self.dsl_data['node_types'].items():
            params = node_def.get('parameters', {})
            if params:
                class_name = f'{node_type.title().replace("_", "")}Parameters'
                description = node_def.get('description', '')
                lines.append(self._generate_class('python', class_name, params, description))
                lines.append('')
                lines.append(self._generate_sanitization_method('python', class_name, params))
                lines.append('')
        
        # Generate BaseNode class
        lines.append('# Base Node Class')
        lines.append('')
        node_def = self.dsl_data['core_structures']['Node']
        base_fields = {
            'id': node_def['fields']['id'],
            'name': node_def['fields']['name'],
            'trigger': node_def['fields']['trigger'],
            'output': node_def['fields']['output'],
            'error': node_def['fields']['error'],
            'credential_type': {
                'type': 'array',
                'items_type': 'string',
                'required': False,
                'description': 'List of allowed credential types for this node (for UI filtering)'
            },
            'credentials': node_def['fields']['credentials']
        }
        lines.append('class BaseNode(BaseModel):')
        lines.append('    """Base node class with common fields."""')
        for field_name, field_def in base_fields.items():
            lines.append(self._generate_field('python', field_name, field_def))
        lines.append('')
        lines.append(self._generate_sanitization_method('python', 'BaseNode', base_fields))
        lines.append('')
        
        # Generate specific node classes
        lines.append('# Specific Node Classes')
        lines.append('')
        node_classes = []
        for node_type, node_def in self.dsl_data['node_types'].items():
            # Convert node_type to class name (e.g., "http" -> "HttpNode", "ManualTrigger" -> "ManualTriggerNode")
            if node_type == 'ManualTrigger':
                class_name = 'ManualTriggerNode'
            else:
                class_name = f'{node_type.title().replace("_", "")}Node'
            
            node_classes.append(class_name)
            
            # Get type literal value
            type_literal = f'Literal["{node_type}"]'
            
            # Get parameters class name
            params = node_def.get('parameters', {})
            if params:
                params_class = f'{node_type.title().replace("_", "")}Parameters'
            else:
                params_class = 'dict[str, Any]'
            
            # Get credential_type default
            credential_type = node_def.get('credential_type')
            credential_type_default = self._get_credential_type_default(credential_type)
            
            # Generate class
            lines.append(f'class {class_name}(BaseNode):')
            lines.append(f'    """{node_def.get("description", "")}"""')
            lines.append(f'    type_: {type_literal} = Field(default="{node_type}", alias="type")')
            lines.append(f'    parameters: {params_class}')
            lines.append(f'    credential_type: Optional[list[str]] = {credential_type_default}')
            lines.append('')
            
            # Generate sanitization method that chains base + parameters
            lines.append('    def sanitize(self) -> tuple[bool, list[str]]:')
            lines.append('        """Validate and sanitize the node including parameters."""')
            lines.append('        errors: list[str] = []')
            lines.append('')
            lines.append('        # Validate base fields')
            lines.append('        base_valid, base_errors = super().sanitize()')
            lines.append('        if not base_valid:')
            lines.append('            errors.extend(base_errors)')
            lines.append('')
            if params:
                lines.append('        # Validate parameters')
                lines.append(f'        if hasattr(self.parameters, "sanitize"):')
                lines.append('            params_valid, params_errors = self.parameters.sanitize()')
                lines.append('            if not params_valid:')
                lines.append('                errors.extend(params_errors)')
                lines.append('')
            lines.append('        # Validate credential type matches')
            lines.append('        if self.credentials and self.credential_type:')
            lines.append('            if self.credentials.type_ not in self.credential_type:')
            lines.append(f'                errors.append(f"{class_name}.credentials.type must be one of {{self.credential_type}}")')
            lines.append('')
            lines.append('        return len(errors) == 0, errors')
            lines.append('')
        
        # Generate Union type
        lines.append('# Union type for all nodes')
        lines.append('')
        union_types = ', '.join(node_classes)
        lines.append(f'Node = Union[{union_types}]')
        lines.append('')
        
        return '\n'.join(lines)
    
    def generate_go(self) -> str:
        """Generate Go definitions."""
        lines = [
            '// Auto-generated DSL type definitions',
            '// DO NOT EDIT - Generated from dsl/dsl-definition.json',
            '',
            'package dsl',
            '',
            '// Core Structures',
            ''
        ]
        
        # Generate core structures
        for struct_name, struct_def in self.dsl_data['core_structures'].items():
            fields = struct_def.get('fields', {})
            description = struct_def.get('description', '')
            lines.append(self._generate_class('go', struct_name, fields, description))
            lines.append('')
            lines.append(self._generate_sanitization_method('go', struct_name, fields))
            lines.append('')
        
        # Generate nested types
        if 'nested_types' in self.dsl_data:
            lines.append('// Nested Types')
            lines.append('')
            for type_name, type_def in self.dsl_data['nested_types'].items():
                fields = type_def.get('fields', {})
                description = type_def.get('description', '')
                lines.append(self._generate_class('go', type_name, fields, description))
                lines.append('')
                lines.append(self._generate_sanitization_method('go', type_name, fields))
                lines.append('')
        
        # Generate node parameter types
        lines.append('// Node Parameter Types')
        lines.append('')
        for node_type, node_def in self.dsl_data['node_types'].items():
            params = node_def.get('parameters', {})
            if params:
                class_name = f'{node_type.title().replace("_", "")}Parameters'
                description = node_def.get('description', '')
                lines.append(self._generate_class('go', class_name, params, description))
                lines.append('')
                lines.append(self._generate_sanitization_method('go', class_name, params))
                lines.append('')
        
        # Generate credential type constants
        lines.append('// Node Credential Types')
        lines.append('')
        for node_type, node_def in self.dsl_data['node_types'].items():
            credential_type = node_def.get('credential_type')
            if credential_type is None:
                lines.append(f'var {node_type.upper()}_CREDENTIAL_TYPE []string = nil')
            elif isinstance(credential_type, list):
                lines.append(f'var {node_type.upper()}_CREDENTIAL_TYPE []string = []string{{"{'", "'.join(credential_type)}"}}')
            else:
                lines.append(f'var {node_type.upper()}_CREDENTIAL_TYPE []string = []string{{"{credential_type}"}}')
        lines.append('')
        
        return '\n'.join(lines)
    
    def generate_all(self):
        """Generate all language files."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate TypeScript
        ts_content = self.generate_typescript()
        with open(self.output_dir / 'types.ts', 'w') as f:
            f.write(ts_content)
        print(f'✓ Generated {self.output_dir / "types.ts"}')
        
        # Generate Python
        py_content = self.generate_python()
        with open(self.output_dir / 'types.py', 'w') as f:
            f.write(py_content)
        print(f'✓ Generated {self.output_dir / "types.py"}')
        
        # Generate Go
        go_content = self.generate_go()
        with open(self.output_dir / 'types.go', 'w') as f:
            f.write(go_content)
        print(f'✓ Generated {self.output_dir / "types.go"}')


def main():
    """Main entry point."""
    generator = DSLGenerator('dsl/dsl-definition.json')
    generator.generate_all()
    print('\n✓ All files generated successfully!')


if __name__ == '__main__':
    main()

