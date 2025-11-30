# API Reference

Complete REST API documentation for the Rune platform.

---

## 📚 In This Section

| Endpoint Group | Description |
|----------------|-------------|
| [Authentication](./authentication.md) | Login, logout, token refresh |
| [Workflows](./workflows.md) | Create, manage, and run workflows |
| [Templates](./templates.md) | Template management |
| [Credentials](./credentials.md) | Secure credential storage |
| [Users](./users.md) | User management (admin) |
| [Profile](./profile.md) | Current user profile |

---

## Base URL

```
http://localhost:8000
```

For production, use your deployed API URL.

---

## Interactive Documentation

Rune provides interactive API documentation:

| URL | Description |
|-----|-------------|
| `/docs` | Swagger UI - Interactive testing |
| `/redoc` | ReDoc - Clean reference documentation |
| `/openapi.json` | OpenAPI 3.1 specification |

---

## Authentication

Most endpoints require authentication. Include the JWT token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8000/workflows/
```

### Getting a Token

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "expires_in": 900
  }
}
```

---

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    // Response data here
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "data": null
}
```

### Validation Error

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `204` | Deleted (no content) |
| `400` | Bad request |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not found |
| `422` | Validation error |
| `500` | Server error |

---

## Quick Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login and get tokens |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout and revoke token |

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workflows/` | List all workflows |
| POST | `/workflows/` | Create workflow |
| GET | `/workflows/{id}` | Get workflow details |
| PUT | `/workflows/{id}/name` | Update name |
| PUT | `/workflows/{id}/status` | Enable/disable |
| PUT | `/workflows/{id}/data` | Update nodes & edges |
| DELETE | `/workflows/{id}` | Delete workflow |
| POST | `/workflows/{id}/run` | Run workflow |

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/templates/` | List all templates |
| POST | `/templates/` | Create template |
| GET | `/templates/{id}` | Get template details |
| POST | `/templates/{id}/use` | Use template |
| DELETE | `/templates/{id}` | Delete template |

### Credentials

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/credentials/` | List all credentials |
| POST | `/credentials/` | Create credential |
| GET | `/credentials/dropdown` | List for dropdowns |

### Users (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/` | List all users |
| POST | `/users/` | Create user |
| GET | `/users/{id}` | Get user details |
| PUT | `/users/{id}` | Update user |
| DELETE | `/users/{id}` | Delete user |

### Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile/me` | Get current user profile |
| PUT | `/profile/me` | Update profile |

---

## Examples

### Create and Run a Workflow

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.data.access_token')

# 2. Create workflow
WORKFLOW_ID=$(curl -s -X POST http://localhost:8000/workflows/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hello World",
    "workflow_data": {
      "nodes": [{
        "id": "hello",
        "name": "Say Hello",
        "type": "log",
        "parameters": {"message": "Hello, World!"}
      }],
      "edges": []
    }
  }' | jq -r '.data.id')

# 3. Run workflow
curl -X POST "http://localhost:8000/workflows/$WORKFLOW_ID/run" \
  -H "Authorization: Bearer $TOKEN"
```

### Create a Credential

```bash
curl -X POST http://localhost:8000/credentials/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Key",
    "credential_type": "api_key",
    "credential_data": {
      "api_key": "sk_live_xxxxxxxxxx"
    }
  }'
```

### Create a Template

```bash
curl -X POST http://localhost:8000/templates/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack Notification",
    "description": "Send a message to Slack",
    "category": "notifications",
    "is_public": true,
    "workflow_data": {
      "nodes": [...],
      "edges": [...]
    }
  }'
```

---

## Rate Limiting

Currently, no rate limiting is enforced. For production deployments, consider adding rate limiting at the reverse proxy level (nginx, API gateway).

---

## Pagination

List endpoints return all results. For large datasets, implement client-side pagination or request server-side pagination as a feature.

---

## Next Steps

Explore detailed endpoint documentation:

- [Authentication](./authentication.md) - Complete auth flow
- [Workflows](./workflows.md) - Workflow CRUD operations
- [Templates](./templates.md) - Template management
- [Credentials](./credentials.md) - Secure storage

---

[← Back to Docs Home](../README.md) | [Authentication →](./authentication.md)
