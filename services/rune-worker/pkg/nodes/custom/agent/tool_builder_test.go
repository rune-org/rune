package agent

import (
	"testing"
)

func TestBuildHTTPInputSchema_OnlyAgentSlotsBecomeProperties(t *testing.T) {
	cfg := &httpToolConfig{
		Method: "POST",
		URL:    fieldMode{Mode: "fixed", Value: "https://example.com"},
		Headers: []kvField{
			{Key: "Authorization", Value: fieldMode{Mode: "fixed", Value: "Bearer xyz"}},
			{Key: "X-User-Id", Value: fieldMode{Mode: "agent", Agent: &agentField{
				Description: "the user id",
				Type:        "string",
				Required:    true,
			}}},
		},
		Body: []kvField{
			{Key: "city", Value: fieldMode{Mode: "agent", Agent: &agentField{
				Description: "city name",
				Type:        "string",
				Required:    true,
			}}},
			{Key: "limit", Value: fieldMode{Mode: "fixed", Value: float64(10)}},
		},
	}

	schema, slots := buildHTTPInputSchema(cfg)

	if schema.Type != "object" {
		t.Errorf("expected object schema, got %q", schema.Type)
	}
	if len(schema.Properties) != 2 {
		t.Errorf("expected 2 schema properties, got %d", len(schema.Properties))
	}
	if _, ok := schema.Properties["header_X_User_Id"]; !ok {
		t.Errorf("missing X-User-Id slot, got props: %v", schema.Properties)
	}
	if _, ok := schema.Properties["body_city"]; !ok {
		t.Errorf("missing body_city slot, got props: %v", schema.Properties)
	}
	if len(slots) != 2 {
		t.Errorf("expected 2 slots, got %d", len(slots))
	}
	if len(schema.Required) != 2 {
		t.Errorf("expected 2 required props, got %d", len(schema.Required))
	}
}

func TestBuildRequestSpec_MergesFixedAndAgentValues(t *testing.T) {
	cfg := &httpToolConfig{
		Method: "POST",
		URL:    fieldMode{Mode: "fixed", Value: "https://example.com/api"},
		Headers: []kvField{
			{Key: "X-User-Id", Value: fieldMode{Mode: "agent", Agent: &agentField{Type: "string", Required: true}}},
			{Key: "X-Static", Value: fieldMode{Mode: "fixed", Value: "yes"}},
		},
		Body: []kvField{
			{Key: "city", Value: fieldMode{Mode: "agent", Agent: &agentField{Type: "string", Required: true}}},
			{Key: "limit", Value: fieldMode{Mode: "fixed", Value: float64(10)}},
		},
	}
	_, slots := buildHTTPInputSchema(cfg)

	spec, err := buildRequestSpec(cfg, slots, map[string]any{
		"header_X_User_Id": "user-42",
		"body_city":        "Paris",
	}, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if spec.URL != "https://example.com/api" {
		t.Errorf("unexpected url: %q", spec.URL)
	}
	if spec.Headers["X-User-Id"] != "user-42" {
		t.Errorf("expected X-User-Id=user-42, got %q", spec.Headers["X-User-Id"])
	}
	if spec.Headers["X-Static"] != "yes" {
		t.Errorf("expected X-Static=yes, got %q", spec.Headers["X-Static"])
	}
	body, ok := spec.Body.(map[string]any)
	if !ok {
		t.Fatalf("expected body to be a map, got %T", spec.Body)
	}
	if body["city"] != "Paris" {
		t.Errorf("expected body.city=Paris, got %v", body["city"])
	}
	if body["limit"] != float64(10) {
		t.Errorf("expected body.limit=10, got %v", body["limit"])
	}
}
