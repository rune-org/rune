package datetimeops

import (
	"testing"
	"time"
)

func TestParseDateInLocationNaiveUsesLocation(t *testing.T) {
	ny, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatalf("load location: %v", err)
	}
	parsed, err := ParseDateInLocation("2026-03-08 12:00", ny)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if parsed.Location().String() != "America/New_York" {
		t.Fatalf("naive input should be parsed in loc, got %s", parsed.Location().String())
	}
	if parsed.Year() != 2026 || parsed.Month() != time.March || parsed.Day() != 8 || parsed.Hour() != 12 {
		t.Fatalf("unexpected parsed value: %s", parsed.Format(time.RFC3339))
	}
}

func TestParseDateInLocationHonorsExplicitOffset(t *testing.T) {
	ny, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatalf("load location: %v", err)
	}
	parsed, err := ParseDateInLocation("2026-03-08T15:30:00Z", ny)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if parsed.Unix() != time.Date(2026, 3, 8, 15, 30, 0, 0, time.UTC).Unix() {
		t.Fatalf("explicit offset not honored, got unix %d", parsed.Unix())
	}
}

func TestApplyOffsetUnits(t *testing.T) {
	base := time.Date(2026, 3, 8, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		unit string
		want time.Time
	}{
		{"seconds", base.Add(2 * time.Second)},
		{"minutes", base.Add(2 * time.Minute)},
		{"hours", base.Add(2 * time.Hour)},
		{"days", base.AddDate(0, 0, 2)},
		{"weeks", base.AddDate(0, 0, 14)},
		{"months", base.AddDate(0, 2, 0)},
		{"years", base.AddDate(2, 0, 0)},
	}
	for _, tc := range cases {
		got, err := ApplyOffset(base, 2, tc.unit, false)
		if err != nil {
			t.Fatalf("unit %s: %v", tc.unit, err)
		}
		if !got.Equal(tc.want) {
			t.Fatalf("unit %s: got %s want %s", tc.unit, got, tc.want)
		}
	}
}

func TestApplyOffsetNegate(t *testing.T) {
	base := time.Date(2026, 3, 22, 0, 0, 0, 0, time.UTC)
	got, err := ApplyOffset(base, 2, "weeks", true)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	want := time.Date(2026, 3, 8, 0, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Fatalf("got %s want %s", got, want)
	}
}

func TestApplyOffsetUnsupportedUnit(t *testing.T) {
	if _, err := ApplyOffset(time.Now(), 1, "fortnights", false); err == nil {
		t.Fatal("expected error for unsupported unit")
	}
}

func TestLoadLocationInvalid(t *testing.T) {
	if _, err := LoadLocation("Mars/Base"); err == nil {
		t.Fatal("expected error for invalid timezone")
	}
}
