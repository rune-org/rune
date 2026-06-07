package bootstrap

import (
	_ "rune-worker/pkg/integrations/providers/google/gmail"
	_ "rune-worker/pkg/integrations/providers/google/sheets"
	_ "rune-worker/pkg/integrations/providers/jira"
	_ "rune-worker/pkg/integrations/providers/microsoft/outlook"
	_ "rune-worker/pkg/integrations/providers/slack"
)
