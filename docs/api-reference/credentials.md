# Credentials API

API endpoints for managing credentials. Credentials securely store authentication details for use in workflow nodes.

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/credentials/` | List all credentials |
| POST | `/credentials/` | Create a credential |
| GET | `/credentials/{id}` | Get credential details |
| PUT | `/credentials/{id}` | Update a credential |
| DELETE | `/credentials/{id}` | Delete a credential |

---

## List Credentials

Get all credentials for the current user. **Note:** Sensitive values are never returned in API responses.

**Endpoint:** `GET /credentials/`

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/credentials/
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": 1,
      "name": "github_api",
      "credential_type": "token",
      "created_at": "2025-11-01T10:00:00Z",
      "updated_at": "2025-11-01T10:00:00Z"
    },
    {
      "id": 2,
      "name": "sendgrid",
      "credential_type": "api_key",
      "created_at": "2025-11-15T14:30:00Z",
      "updated_at": "2025-11-15T14:30:00Z"
    },
    {
      "id": 3,
      "name": "company_email",
      "credential_type": "smtp",
      "created_at": "2025-11-20T09:00:00Z",
      "updated_at": "2025-11-20T09:00:00Z"
    }
  ]
}
```

---

## Create Credential

Create a new credential. The credential data is encrypted before storage.

**Endpoint:** `POST /credentials/`

**Request:**
```bash
curl -X POST http://localhost:8000/credentials/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my_api_credential",
    "credential_type": "api_key",
    "credential_data": {
      "key": "your-secret-api-key-here"
    }
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier for the credential |
| `credential_type` | string | Yes | Type of credential (see types below) |
| `credential_data` | object | Yes | Type-specific credential data |

### Credential Types

#### API Key (`api_key`)

For services that use a simple API key.

```json
{
  "name": "sendgrid_key",
  "credential_type": "api_key",
  "credential_data": {
    "key": "SG.xxxxxxxxxxxxx"
  }
}
```

**Usage in nodes:**
```json
{
  "headers": {
    "Authorization": "Bearer {{$credential.sendgrid_key.key}}"
  }
}
```

#### Token (`token`)

For bearer tokens or access tokens.

```json
{
  "name": "github_token",
  "credential_type": "token",
  "credential_data": {
    "token": "ghp_xxxxxxxxxxxx"
  }
}
```

**Usage in nodes:**
```json
{
  "headers": {
    "Authorization": "token {{$credential.github_token.token}}"
  }
}
```

#### Basic Auth (`basic_auth`)

For HTTP Basic Authentication.

```json
{
  "name": "jenkins_auth",
  "credential_type": "basic_auth",
  "credential_data": {
    "username": "admin",
    "password": "secure-password"
  }
}
```

**Usage in nodes:**
```json
{
  "auth": {
    "type": "basic",
    "credential": "jenkins_auth"
  }
}
```

#### OAuth2 (`oauth2`)

For OAuth2 authentication flows.

```json
{
  "name": "google_oauth",
  "credential_type": "oauth2",
  "credential_data": {
    "client_id": "xxxxx.apps.googleusercontent.com",
    "client_secret": "GOCSPX-xxxxx",
    "access_token": "ya29.xxxxx",
    "refresh_token": "1//xxxxx",
    "token_expiry": "2025-12-01T10:00:00Z"
  }
}
```

**Usage in nodes:**
```json
{
  "auth": {
    "type": "oauth2",
    "credential": "google_oauth"
  }
}
```

#### SMTP (`smtp`)

For email sending via SMTP.

```json
{
  "name": "company_smtp",
  "credential_type": "smtp",
  "credential_data": {
    "host": "smtp.company.com",
    "port": 587,
    "username": "notifications@company.com",
    "password": "smtp-password",
    "use_tls": true,
    "from_email": "notifications@company.com",
    "from_name": "Company Notifications"
  }
}
```

**Usage in email nodes:**
```json
{
  "type": "smtp",
  "credentials": {
    "source": "company_smtp"
  }
}
```

#### Custom (`custom`)

For any other authentication mechanism.

```json
{
  "name": "custom_auth",
  "credential_type": "custom",
  "credential_data": {
    "api_key": "key123",
    "api_secret": "secret456",
    "region": "us-east-1",
    "custom_field": "custom_value"
  }
}
```

**Usage in nodes:**
```json
{
  "headers": {
    "X-Api-Key": "{{$credential.custom_auth.api_key}}",
    "X-Api-Secret": "{{$credential.custom_auth.api_secret}}"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 4,
    "name": "my_api_credential",
    "credential_type": "api_key",
    "created_at": "2025-12-01T10:00:00Z",
    "updated_at": "2025-12-01T10:00:00Z"
  }
}
```

**Note:** The `credential_data` is never returned in responses for security.

---

## Get Credential

Get details about a specific credential.

**Endpoint:** `GET /credentials/{credential_id}`

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/credentials/1
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 1,
    "name": "github_api",
    "credential_type": "token",
    "created_at": "2025-11-01T10:00:00Z",
    "updated_at": "2025-11-01T10:00:00Z"
  }
}
```

**Note:** For security reasons, `credential_data` is never returned.

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Credential not found |

---

## Update Credential

Update an existing credential.

**Endpoint:** `PUT /credentials/{credential_id}`

**Request:**
```bash
curl -X PUT http://localhost:8000/credentials/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "github_api_updated",
    "credential_type": "token",
    "credential_data": {
      "token": "ghp_new_token_value"
    }
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New name for the credential |
| `credential_type` | string | No | Type of credential |
| `credential_data` | object | No | Updated credential data |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 1,
    "name": "github_api_updated",
    "credential_type": "token",
    "created_at": "2025-11-01T10:00:00Z",
    "updated_at": "2025-12-01T11:00:00Z"
  }
}
```

---

## Delete Credential

Permanently delete a credential.

**Endpoint:** `DELETE /credentials/{credential_id}`

**Request:**
```bash
curl -X DELETE http://localhost:8000/credentials/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Response (204 No Content):**
No response body.

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Credential not found |
| 409 | Credential is in use by workflows |

**Warning:** Deleting a credential that is used by workflows will cause those workflows to fail when executed.

---

## Using Credentials in Workflows

### Referencing Credentials

In workflow nodes, reference credentials using the `credentials` field:

```json
{
  "id": "api_call",
  "name": "Call API",
  "type": "http",
  "parameters": {
    "method": "GET",
    "url": "https://api.github.com/user",
    "headers": {
      "Authorization": "token {{$credential.github_api.token}}"
    }
  },
  "credentials": {
    "source": "github_api"
  }
}
```

### Template Syntax

Access credential fields using the template syntax:

| Syntax | Description |
|--------|-------------|
| `{{$credential.name.field}}` | Access a specific field |
| `{{$credential.api_key.key}}` | API key value |
| `{{$credential.token.token}}` | Token value |
| `{{$credential.basic_auth.username}}` | Basic auth username |
| `{{$credential.basic_auth.password}}` | Basic auth password |
| `{{$credential.smtp.host}}` | SMTP server host |

### Example: Multi-Credential Workflow

```json
{
  "nodes": [
    {
      "id": "fetch_data",
      "name": "Fetch from GitHub",
      "type": "http",
      "parameters": {
        "method": "GET",
        "url": "https://api.github.com/repos/owner/repo/issues",
        "headers": {
          "Authorization": "token {{$credential.github_token.token}}"
        }
      },
      "credentials": {
        "source": "github_token"
      }
    },
    {
      "id": "notify_slack",
      "name": "Notify Slack",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://slack.com/api/chat.postMessage",
        "headers": {
          "Authorization": "Bearer {{$credential.slack_bot.token}}",
          "Content-Type": "application/json"
        },
        "body": {
          "channel": "#dev",
          "text": "Found {{$fetch_data.body.length}} issues"
        }
      },
      "credentials": {
        "source": "slack_bot"
      }
    }
  ],
  "edges": [
    {"id": "e1", "src": "fetch_data", "dst": "notify_slack"}
  ]
}
```

---

## Security Notes

1. **Encryption:** All credential data is encrypted at rest using AES-256
2. **No Exposure:** Credential values are never returned in API responses
3. **Audit Trail:** Credential usage is logged for security auditing
4. **Scope:** Credentials are user-scoped and cannot be accessed by other users
5. **Secure Deletion:** When deleted, credential data is securely wiped

---

## Response Schema

### CredentialListItem

```json
{
  "id": "integer",
  "name": "string",
  "credential_type": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### CredentialTypes

| Type | Description |
|------|-------------|
| `api_key` | Simple API key |
| `token` | Bearer/access token |
| `basic_auth` | Username and password |
| `oauth2` | OAuth2 credentials |
| `smtp` | SMTP server credentials |
| `custom` | Custom key-value pairs |

---

[← Templates API](./templates.md) | [Back to API Reference](./README.md) | [Users API →](./users.md)
