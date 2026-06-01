package slack

const (
	PostMessageKind          = "integration.slack.chat.post_message"
	UpdateMessageKind        = "integration.slack.chat.update"
	DeleteMessageKind        = "integration.slack.chat.delete"
	ConversationsHistoryKind = "integration.slack.conversations.history"
	FindMessageKind          = "integration.slack.conversations.find_message"
	LookupByEmailKind        = "integration.slack.users.lookup_by_email"
)

var baseURL = "https://slack.com"
