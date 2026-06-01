package integrations

import "testing"

func TestDecodeArgs(t *testing.T) {
	type args struct {
		ID   string `json:"id"`
		Flag bool   `json:"flag"`
	}

	var out args
	err := DecodeArgs(map[string]any{"id": "abc", "flag": true}, &out)
	if err != nil {
		t.Fatalf("DecodeArgs() error = %v", err)
	}
	if out.ID != "abc" || !out.Flag {
		t.Fatalf("unexpected decoded args: %+v", out)
	}
}

func TestDecodeArgsTypeMismatch(t *testing.T) {
	type args struct {
		Max int `json:"max"`
	}

	var out args
	err := DecodeArgs(map[string]any{"max": "not-a-number"}, &out)
	if err == nil {
		t.Fatal("expected decode error for invalid int")
	}
}
