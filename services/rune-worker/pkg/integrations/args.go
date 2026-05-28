package integrations

import (
	"encoding/json"
	"fmt"
)

// DecodeArgs decodes a generic argument map into a typed args struct.
func DecodeArgs(in map[string]any, out any) error {
	payload, err := json.Marshal(in)
	if err != nil {
		return fmt.Errorf("marshal args: %w", err)
	}
	if err := json.Unmarshal(payload, out); err != nil {
		return fmt.Errorf("unmarshal args: %w", err)
	}
	return nil
}
