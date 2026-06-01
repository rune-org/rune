package outlook

import "strings"

func optionalQuery(key, value string) map[string]string {
	if strings.TrimSpace(value) == "" {
		return map[string]string{}
	}
	return map[string]string{key: value}
}

func splitCSV(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

type emailAddress struct {
	Address string `json:"address"`
}

type recipient struct {
	EmailAddress emailAddress `json:"emailAddress"`
}

func buildRecipients(raw string) []recipient {
	parts := splitCSV(raw)
	if len(parts) == 0 {
		return nil
	}
	recipients := make([]recipient, len(parts))
	for i, p := range parts {
		recipients[i] = recipient{
			EmailAddress: emailAddress{Address: p},
		}
	}
	return recipients
}
