# Users API

API endpoints for user management. These endpoints are typically restricted to administrators.

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/` | List all users |
| POST | `/users/` | Create a new user |
| GET | `/users/{id}` | Get user details |
| PUT | `/users/{id}` | Update a user |
| DELETE | `/users/{id}` | Delete a user |

---

## List Users

Get all users in the system.

**Endpoint:** `GET /users/`

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/users/
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": 1,
      "email": "admin@example.com",
      "first_name": "Admin",
      "last_name": "User",
      "is_active": true,
      "is_superuser": true,
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": 2,
      "email": "user@example.com",
      "first_name": "Regular",
      "last_name": "User",
      "is_active": true,
      "is_superuser": false,
      "created_at": "2025-06-15T10:00:00Z"
    }
  ]
}
```

---

## Create User

Create a new user account.

**Endpoint:** `POST /users/`

**Request:**
```bash
curl -X POST http://localhost:8000/users/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "secure-password-123",
    "first_name": "New",
    "last_name": "User",
    "is_superuser": false
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Unique email address |
| `password` | string | Yes | Password (min 8 characters) |
| `first_name` | string | No | User's first name |
| `last_name` | string | No | User's last name |
| `is_superuser` | boolean | No | Grant admin privileges (default: false) |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 3,
    "email": "newuser@example.com",
    "first_name": "New",
    "last_name": "User",
    "is_active": true,
    "is_superuser": false,
    "created_at": "2025-12-01T10:00:00Z"
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Invalid email format or weak password |
| 409 | Email already registered |

---

## Get User

Get details about a specific user.

**Endpoint:** `GET /users/{user_id}`

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/users/2
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 2,
    "email": "user@example.com",
    "first_name": "Regular",
    "last_name": "User",
    "is_active": true,
    "is_superuser": false,
    "created_at": "2025-06-15T10:00:00Z",
    "last_login": "2025-12-01T09:30:00Z",
    "workflow_count": 5,
    "template_count": 2
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | User not found |

---

## Update User

Update a user's information.

**Endpoint:** `PUT /users/{user_id}`

**Request:**
```bash
curl -X PUT http://localhost:8000/users/2 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Updated",
    "last_name": "Name",
    "is_active": true
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | No | New email address |
| `password` | string | No | New password |
| `first_name` | string | No | Updated first name |
| `last_name` | string | No | Updated last name |
| `is_active` | boolean | No | Enable/disable account |
| `is_superuser` | boolean | No | Grant/revoke admin |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 2,
    "email": "user@example.com",
    "first_name": "Updated",
    "last_name": "Name",
    "is_active": true,
    "is_superuser": false,
    "created_at": "2025-06-15T10:00:00Z"
  }
}
```

---

## Delete User

Delete a user account.

**Endpoint:** `DELETE /users/{user_id}`

**Request:**
```bash
curl -X DELETE http://localhost:8000/users/2 \
  -H "Authorization: Bearer $TOKEN"
```

**Response (204 No Content):**
No response body.

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | User not found |
| 403 | Cannot delete your own account |
| 403 | Cannot delete the last superuser |

**Warning:** Deleting a user will also delete all their:
- Workflows
- Templates
- Credentials

---

## Profile Endpoint

For the current authenticated user's profile, see the [Profile API](./profile.md).

---

## Response Schema

### UserListItem

```json
{
  "id": "integer",
  "email": "string",
  "first_name": "string | null",
  "last_name": "string | null",
  "is_active": "boolean",
  "is_superuser": "boolean",
  "created_at": "datetime"
}
```

### UserDetail

```json
{
  "id": "integer",
  "email": "string",
  "first_name": "string | null",
  "last_name": "string | null",
  "is_active": "boolean",
  "is_superuser": "boolean",
  "created_at": "datetime",
  "last_login": "datetime | null",
  "workflow_count": "integer",
  "template_count": "integer"
}
```

---

[← Credentials API](./credentials.md) | [Back to API Reference](./README.md) | [Profile API →](./profile.md)
