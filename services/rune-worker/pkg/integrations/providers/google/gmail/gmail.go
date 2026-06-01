package gmail

const (
	SendEmailKind    = "integration.google.gmail.send_email"
	ReadEmailKind    = "integration.google.gmail.read_email"
	SearchEmailsKind = "integration.google.gmail.search_emails"
	ListLabelsKind   = "integration.google.gmail.list_labels"
)

var baseURL = "https://gmail.googleapis.com"
