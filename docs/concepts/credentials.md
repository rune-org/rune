# Credentials

Learn how to securely store and use API keys, tokens, and other sensitive data in your workflows.

---

## Table of Contents

- [What are Credentials?](#what-are-credentials)
- [Creating Credentials](#creating-credentials)
- [Credential Types](#credential-types)
- [Using Credentials in Workflows](#using-credentials-in-workflows)
- [Managing Credentials](#managing-credentials)
- [Security Best Practices](#security-best-practices)

---

## What are Credentials?

Credentials are secure containers for sensitive information like API keys, OAuth tokens, and passwords. Rune:

- **Encrypts** credentials at rest using AES-256
- **Decrypts** only when a workflow runs
- **Never exposes** raw values in the UI or logs
- **Audits** credential usage

```
┌─────────────────────────────────────────────────────────────┐
│                    CREDENTIAL LIFECYCLE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   1. CREATE              2. STORE              3. USE       │
│   ┌─────────┐           ┌─────────┐          ┌─────────┐   │
│   │ User    │──────────▶│Encrypted│─────────▶│ Decrypt │   │
│   │ Input   │           │ Storage │          │ at Run  │   │
│   └─────────┘           └─────────┘          └─────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Creating Credentials

### Via the UI

1. Navigate to **Settings** → **Credentials**
2. Click **"+ Add Credential"**
3. Fill in the details:
   - **Name**: A descriptive name (e.g., "Slack Bot Token")
   - **Type**: Select the credential type
   - **Data**: Enter the sensitive values
4. Click **Save**

### Via the API

```bash
# First, get your access token
TOKEN="your_access_token"

# Create an API Key credential
curl -X POST http://localhost:8000/credentials/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GitHub API Key",
    "credential_type": "api_key",
    "credential_data": {
      "api_key": "ghp_xxxxxxxxxxxxxxxxxxxx"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "GitHub API Key",
    "credential_type": "api_key",
    "created_at": "2025-12-01T10:00:00Z",
    "updated_at": "2025-12-01T10:00:00Z"
  }
}
```

> ⚠️ Note: The API never returns the actual credential data after creation.

---

## Credential Types

Rune supports several credential types, each with specific fields:

### API Key

For simple API key authentication.

```json
{
  "name": "Service API Key",
  "credential_type": "api_key",
  "credential_data": {
    "api_key": "your-api-key-here"
  }
}
```

**Use in workflow:**
```json
{
  "headers": {
    "X-API-Key": "{{$credential.api_key}}"
  }
}
```

### Bearer Token

For OAuth2 access tokens.

```json
{
  "name": "OAuth Access Token",
  "credential_type": "token",
  "credential_data": {
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Use in workflow:**
```json
{
  "headers": {
    "Authorization": "Bearer {{$credential.token}}"
  }
}
```

### Basic Authentication

For HTTP Basic Auth.

```json
{
  "name": "API Basic Auth",
  "credential_type": "basic_auth",
  "credential_data": {
    "username": "api_user",
    "password": "api_password"
  }
}
```

**Use in workflow:**
```json
{
  "headers": {
    "Authorization": "Basic {{$credential.basic_auth}}"
  }
}
```

### OAuth2

For full OAuth2 flows with refresh tokens.

```json
{
  "name": "Google OAuth",
  "credential_type": "oauth2",
  "credential_data": {
    "client_id": "xxxxx.apps.googleusercontent.com",
    "client_secret": "GOCSPX-xxxxx",
    "access_token": "ya29.xxxxx",
    "refresh_token": "1//xxxxx",
    "token_url": "https://oauth2.googleapis.com/token"
  }
}
```

### SMTP

For email sending.

```json
{
  "name": "Email Server",
  "credential_type": "smtp",
  "credential_data": {
    "host": "smtp.gmail.com",
    "port": 587,
    "username": "your-email@gmail.com",
    "password": "your-app-password",
    "use_tls": true
  }
}
```

### Custom

For any other sensitive data.

```json
{
  "name": "Database Connection",
  "credential_type": "custom",
  "credential_data": {
    "host": "db.example.com",
    "port": 5432,
    "database": "production",
    "username": "app_user",
    "password": "super_secret_password"
  }
}
```

---

## Using Credentials in Workflows

### Step 1: Assign Credential to Node

In the workflow editor, select a node and:
1. Open the **Credentials** section
2. Select the credential from the dropdown
3. The credential ID is now linked to this node

### Step 2: Reference Credential Fields

Use the `{{$credential.field}}` syntax in your node parameters:

```json
{
  "id": "call_api",
  "name": "Call External API",
  "type": "http",
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/data",
    "headers": {
      "Authorization": "Bearer {{$credential.api_key}}",
      "X-Custom-Header": "{{$credential.custom_field}}"
    }
  },
  "credentials": {
    "source": "my_api_credentials"
  }
}
```

### Complete Example

**Credential (created separately):**
```json
{
  "name": "Slack Webhook",
  "credential_type": "custom",
  "credential_data": {
    "webhook_url": "https://hooks.slack.com/services/T00/B00/xxxxx",
    "channel": "#alerts"
  }
}
```

**Workflow using the credential:**
```json
{
  "nodes": [
    {
      "id": "send_slack",
      "name": "Send Slack Message",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "{{$credential.webhook_url}}",
        "headers": {
          "Content-Type": "application/json"
        },
        "body": {
          "channel": "{{$credential.channel}}",
          "text": "Hello from Rune!"
        }
      },
      "credentials": {
        "source": "slack_webhook"
      }
    }
  ]
}
```

---

## Managing Credentials

### Listing Credentials

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/credentials/
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "GitHub API Key",
      "credential_type": "api_key",
      "created_at": "2025-12-01T10:00:00Z"
    },
    {
      "id": 2,
      "name": "Slack Webhook",
      "credential_type": "custom",
      "created_at": "2025-12-01T10:05:00Z"
    }
  ]
}
```

### Updating Credentials

Currently, to update a credential, delete and recreate it. This ensures audit trails are maintained.

### Deleting Credentials

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/credentials/1
```

> ⚠️ **Warning**: Deleting a credential will break any workflows that reference it!

### Using Credentials in Dropdowns

For the workflow editor UI, use the dropdown endpoint:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/credentials/dropdown
```

Returns a simplified list for UI dropdowns.

---

## Security Best Practices

### 1. Use Descriptive Names

```
✅ "Production Stripe API Key"
✅ "Staging Database - Read Only"
❌ "Key 1"
❌ "test"
```

### 2. Rotate Credentials Regularly

- Set a reminder to rotate API keys periodically
- When rotating, update the credential before revoking the old key
- Test workflows after rotation

### 3. Use Least Privilege

- Create separate credentials for different environments
- Use read-only tokens when write access isn't needed
- Scope API keys to specific permissions when possible

### 4. Never Log Credentials

Rune automatically masks credentials in logs, but in your own integrations:

```
✅ Log: "Authenticated with API key ending in ...x4f2"
❌ Log: "Using API key: sk_live_xxxxxxxxxxxxx"
```

### 5. Audit Credential Usage

Monitor which workflows use each credential:
- Review credential associations regularly
- Remove unused credentials
- Track failed authentications

### 6. Environment Separation

```
Production Credentials:
  - "Prod - Stripe API Key"
  - "Prod - Database"
  
Staging Credentials:
  - "Staging - Stripe API Key"
  - "Staging - Database"
```

---

## Common Integrations

### Slack

```json
{
  "name": "Slack Bot",
  "credential_type": "token",
  "credential_data": {
    "token": "xoxb-xxxx-xxxx-xxxx"
  }
}
```

### GitHub

```json
{
  "name": "GitHub PAT",
  "credential_type": "token",
  "credential_data": {
    "token": "ghp_xxxxxxxxxxxx"
  }
}
```

### Stripe

```json
{
  "name": "Stripe API",
  "credential_type": "api_key",
  "credential_data": {
    "api_key": "sk_live_xxxxxxxxxxxx"
  }
}
```

### SendGrid

```json
{
  "name": "SendGrid",
  "credential_type": "api_key",
  "credential_data": {
    "api_key": "SG.xxxxxxxxxxxx"
  }
}
```

### AWS

```json
{
  "name": "AWS Credentials",
  "credential_type": "custom",
  "credential_data": {
    "access_key_id": "AKIAIOSFODNN7EXAMPLE",
    "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "region": "us-east-1"
  }
}
```

---

## Troubleshooting

### "Credential not found"

- Verify the credential name matches exactly (case-sensitive)
- Check if the credential was deleted
- Ensure you have permission to access the credential

### "Invalid credential format"

- Review the credential type and required fields
- Check JSON syntax in credential_data
- Verify field names match expected format

### "Authentication failed"

- The credential values may be incorrect or expired
- Check if the API key/token has been revoked
- Verify the credential has necessary permissions

---

## Next Steps

- [Using Nodes](./nodes.md) - Learn about all available node types
- [Templates](./templates.md) - Create reusable workflow patterns
- [API Reference](../api-reference/credentials.md) - Full API documentation

---

[← Back to Concepts](./README.md) | [Templates →](./templates.md)
