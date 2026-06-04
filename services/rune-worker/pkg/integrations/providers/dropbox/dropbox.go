package dropbox

const (
	ListFolderKind       = "integration.dropbox.files.list_folder"
	GetMetadataKind      = "integration.dropbox.files.get_metadata"
	GetTemporaryLinkKind = "integration.dropbox.files.get_temporary_link"
	DeleteKind           = "integration.dropbox.files.delete"
	SearchKind           = "integration.dropbox.files.search"
)

var baseURL = "https://api.dropboxapi.com"
