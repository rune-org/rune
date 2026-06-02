package outlook

const (
	SendEmailKind    = "integration.microsoft.outlook.send_email"
	ReadEmailKind    = "integration.microsoft.outlook.read_email"
	SearchEmailsKind = "integration.microsoft.outlook.search_emails"
	ListFoldersKind  = "integration.microsoft.outlook.list_folders"
)

var baseURL = "https://graph.microsoft.com"
