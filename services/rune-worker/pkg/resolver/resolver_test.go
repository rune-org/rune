package resolver

import (
	"testing"
)

func TestResolver_ResolveParameters(t *testing.T) {
	context := map[string]interface{}{
		"$http_node": map[string]interface{}{
			"status": 200,
			"body": map[string]interface{}{
				"user": map[string]interface{}{
					"id":   123,
					"name": "John Doe",
				},
				"values": []interface{}{
					map[string]interface{}{"val": "first"},
					map[string]interface{}{"val": "second"},
				},
			},
		},
		"$trigger": map[string]interface{}{
			"user_id": "456",
			"action":  "login",
		},
	}

	tests := []struct {
		name       string
		parameters map[string]interface{}
		want       map[string]interface{}
		wantErr    bool
	}{
		{
			name: "simple field reference",
			parameters: map[string]interface{}{
				"user_id": "$trigger.user_id",
			},
			want: map[string]interface{}{
				"user_id": "456",
			},
			wantErr: false,
		},
		{
			name: "nested field reference",
			parameters: map[string]interface{}{
				"name": "$http_node.body.user.name",
			},
			want: map[string]interface{}{
				"name": "John Doe",
			},
			wantErr: false,
		},
		{
			name: "array index reference",
			parameters: map[string]interface{}{
				"first_value": "$http_node.body.values[0].val",
			},
			want: map[string]interface{}{
				"first_value": "first",
			},
			wantErr: false,
		},
		{
			name: "multiple references in same string",
			parameters: map[string]interface{}{
				"message": "User $http_node.body.user.name from $trigger.action",
			},
			want: map[string]interface{}{
				"message": "User John Doe from login",
			},
			wantErr: false,
		},
		{
			name: "nested map with references",
			parameters: map[string]interface{}{
				"config": map[string]interface{}{
					"user_id":   "$trigger.user_id",
					"user_name": "$http_node.body.user.name",
				},
			},
			want: map[string]interface{}{
				"config": map[string]interface{}{
					"user_id":   "456",
					"user_name": "John Doe",
				},
			},
			wantErr: false,
		},
		{
			name: "array with references",
			parameters: map[string]interface{}{
				"items": []interface{}{
					"$trigger.user_id",
					"$http_node.body.user.name",
				},
			},
			want: map[string]interface{}{
				"items": []interface{}{
					"456",
					"John Doe",
				},
			},
			wantErr: false,
		},
		{
			name: "no references",
			parameters: map[string]interface{}{
				"static": "value",
				"number": 123,
			},
			want: map[string]interface{}{
				"static": "value",
				"number": 123,
			},
			wantErr: false,
		},
		{
			name: "reference to entire node",
			parameters: map[string]interface{}{
				"trigger_data": "$trigger",
			},
			want: map[string]interface{}{
				"trigger_data": map[string]interface{}{
					"user_id": "456",
					"action":  "login",
				},
			},
			wantErr: false,
		},
		{
			name: "reference to number field",
			parameters: map[string]interface{}{
				"status_code": "$http_node.status",
			},
			want: map[string]interface{}{
				"status_code": 200,
			},
			wantErr: false,
		},
		{
			name: "non-existent node reference",
			parameters: map[string]interface{}{
				"value": "$nonexistent.field",
			},
			wantErr: true,
		},
		{
			name: "non-existent field reference",
			parameters: map[string]interface{}{
				"value": "$trigger.nonexistent",
			},
			wantErr: true,
		},
		{
			name: "out of bounds array index",
			parameters: map[string]interface{}{
				"value": "$http_node.body.values[10].val",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewResolver(context)
			got, err := r.ResolveParameters(tt.parameters)

			if (err != nil) != tt.wantErr {
				t.Errorf("ResolveParameters() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if !deepEqual(got, tt.want) {
					t.Errorf("ResolveParameters() = %v, want %v", got, tt.want)
				}
			}
		})
	}
}

func TestResolver_ResolveString(t *testing.T) {
	context := map[string]interface{}{
		"$node1": map[string]interface{}{
			"name":  "Alice",
			"count": 42,
		},
	}

	tests := []struct {
		name    string
		input   string
		want    interface{}
		wantErr bool
	}{
		{
			name:    "single reference - returns actual type",
			input:   "$node1.count",
			want:    42,
			wantErr: false,
		},
		{
			name:    "interpolated reference - returns string",
			input:   "Count: $node1.count",
			want:    "Count: 42",
			wantErr: false,
		},
		{
			name:    "no reference",
			input:   "plain text",
			want:    "plain text",
			wantErr: false,
		},
		{
			name:    "multiple references",
			input:   "$node1.name has $node1.count items",
			want:    "Alice has 42 items",
			wantErr: false,
		},
		{
			name:    "expression block - should not be resolved",
			input:   "{{ $node1.name + ' ' + $node1.count }}",
			want:    "{{ $node1.name + ' ' + $node1.count }}",
			wantErr: false,
		},
		{
			name:    "expression block with math - should not be resolved",
			input:   "{{ $json.quantity * $json.price }}",
			want:    "{{ $json.quantity * $json.price }}",
			wantErr: false,
		},
		{
			name:    "mixed expression and plain text - only expression preserved",
			input:   "{{ $node1.count * 2 }}",
			want:    "{{ $node1.count * 2 }}",
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewResolver(context)
			got, err := r.resolveString(tt.input)

			if (err != nil) != tt.wantErr {
				t.Errorf("resolveString() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && got != tt.want {
				t.Errorf("resolveString() = %v (%T), want %v (%T)", got, got, tt.want, tt.want)
			}
		})
	}
}

func TestResolver_NavigatePath(t *testing.T) {
	data := map[string]interface{}{
		"user": map[string]interface{}{
			"profile": map[string]interface{}{
				"name": "Bob",
				"tags": []interface{}{"admin", "developer"},
			},
		},
		"items": []interface{}{
			map[string]interface{}{"id": 1, "name": "Item1"},
			map[string]interface{}{"id": 2, "name": "Item2"},
		},
	}

	tests := []struct {
		name    string
		path    string
		want    interface{}
		wantErr bool
	}{
		{
			name:    "simple nested path",
			path:    "user.profile.name",
			want:    "Bob",
			wantErr: false,
		},
		{
			name:    "array in path",
			path:    "user.profile.tags[0]",
			want:    "admin",
			wantErr: false,
		},
		{
			name:    "array of objects",
			path:    "items[1].name",
			want:    "Item2",
			wantErr: false,
		},
		{
			name:    "deep nesting with array",
			path:    "items[0].id",
			want:    1,
			wantErr: false,
		},
		{
			name:    "invalid field",
			path:    "user.nonexistent",
			wantErr: true,
		},
		{
			name:    "invalid array index",
			path:    "items[10].name",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewResolver(nil)
			got, err := r.navigatePath(data, tt.path)

			if (err != nil) != tt.wantErr {
				t.Errorf("navigatePath() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && got != tt.want {
				t.Errorf("navigatePath() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestResolver_ParsePathSegments(t *testing.T) {
	r := NewResolver(nil)

	tests := []struct {
		name string
		path string
		want []pathSegment
	}{
		{
			name: "simple path",
			path: "user.name",
			want: []pathSegment{
				{field: "user", isArray: false},
				{field: "name", isArray: false},
			},
		},
		{
			name: "path with array",
			path: "items[0].name",
			want: []pathSegment{
				{field: "items", isArray: false},
				{isArray: true, arrayIndex: 0},
				{field: "name", isArray: false},
			},
		},
		{
			name: "path with multiple fields after array",
			path: "data[0].user.name",
			want: []pathSegment{
				{field: "data", isArray: false},
				{isArray: true, arrayIndex: 0},
				{field: "user", isArray: false},
				{field: "name", isArray: false},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := r.parsePathSegments(tt.path)
			if len(got) != len(tt.want) {
				t.Errorf("parsePathSegments() length = %d, want %d", len(got), len(tt.want))
				return
			}

			for i, seg := range got {
				if seg != tt.want[i] {
					t.Errorf("parsePathSegments()[%d] = %+v, want %+v", i, seg, tt.want[i])
				}
			}
		})
	}
}

// deepEqual compares two interfaces for deep equality
func deepEqual(a, b interface{}) bool {
	switch va := a.(type) {
	case map[string]interface{}:
		vb, ok := b.(map[string]interface{})
		if !ok || len(va) != len(vb) {
			return false
		}
		for k, v := range va {
			if !deepEqual(v, vb[k]) {
				return false
			}
		}
		return true

	case []interface{}:
		vb, ok := b.([]interface{})
		if !ok || len(va) != len(vb) {
			return false
		}
		for i, v := range va {
			if !deepEqual(v, vb[i]) {
				return false
			}
		}
		return true

	default:
		return a == b
	}
}
