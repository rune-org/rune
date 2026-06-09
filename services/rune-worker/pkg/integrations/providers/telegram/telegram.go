package telegram

const (
	SendMessageKind  = "integration.telegram.bot.send_message"
	SendPhotoKind    = "integration.telegram.bot.send_photo"
	SendDocumentKind = "integration.telegram.bot.send_document"
	GetUpdatesKind   = "integration.telegram.bot.get_updates"
	GetChatIDKind    = "integration.telegram.bot.get_chat_id"
)

var baseURL = "https://api.telegram.org"
