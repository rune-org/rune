// Package datetimeops holds helpers shared by the datetime family of nodes
// (dateTimeNow, dateTimeAdd, dateTimeSubtract, dateTimeFormat, dateTimeParse).
//
// The parsing helper always calls time.ParseInLocation so that a naive input
// string is interpreted in the caller-supplied location and any explicit
// offset in the input is honored by the standard library. Callers should then
// call .In(loc) exactly once before formatting or returning components.
package datetimeops

import (
	"fmt"
	"strings"
	"time"

	"rune-worker/pkg/nodes/shared/listops"
)

func LoadLocation(timezone string) (*time.Location, error) {
	name := strings.TrimSpace(timezone)
	if name == "" {
		name = "UTC"
	}
	loc, err := time.LoadLocation(name)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone: %w", err)
	}
	return loc, nil
}

// ParseDateInLocation parses value against the shared CommonTimeFormats list
// (plus any additional layouts the caller passes), always using
// time.ParseInLocation. An explicit offset inside value is honored by the
// standard library; naive strings are interpreted in loc.
//
// Nodes should pass their own configured output format as an extra layout so
// that the formatted result of one datetime node can be piped into another.
func ParseDateInLocation(value string, loc *time.Location, extraFormats ...string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, fmt.Errorf("date value is required")
	}
	for _, format := range extraFormats {
		if strings.TrimSpace(format) == "" {
			continue
		}
		if parsed, err := time.ParseInLocation(format, value, loc); err == nil {
			return parsed, nil
		}
	}
	for _, format := range listops.CommonTimeFormats {
		if parsed, err := time.ParseInLocation(format, value, loc); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported date value: %s", value)
}

// ApplyOffset shifts t by amount*unit. When negate is true the shift is
// subtracted instead of added.
func ApplyOffset(t time.Time, amount int, unit string, negate bool) (time.Time, error) {
	if negate {
		amount = -amount
	}
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case "", "days":
		return t.AddDate(0, 0, amount), nil
	case "seconds":
		return t.Add(time.Duration(amount) * time.Second), nil
	case "minutes":
		return t.Add(time.Duration(amount) * time.Minute), nil
	case "hours":
		return t.Add(time.Duration(amount) * time.Hour), nil
	case "weeks":
		return t.AddDate(0, 0, amount*7), nil
	case "months":
		return t.AddDate(0, amount, 0), nil
	case "years":
		return t.AddDate(amount, 0, 0), nil
	default:
		return time.Time{}, fmt.Errorf("unsupported unit: %s", unit)
	}
}

const DefaultFormat = time.RFC3339
