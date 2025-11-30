# Profile API

API endpoints for managing the current authenticated user's profile.

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile/` | Get current user profile |
| PUT | `/profile/` | Update current user profile |
| PUT | `/profile/password` | Change password |

---

## Get Profile

Get the profile of the currently authenticated user.

**Endpoint:** `GET /profile/`

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/profile/
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_active": true,
    "is_superuser": false,
    "created_at": "2025-06-15T10:00:00Z",
    "last_login": "2025-12-01T09:30:00Z",
    "workflow_count": 12,
    "template_count": 3,
    "credential_count": 5
  }
}
```

---

## Update Profile

Update the current user's profile information.

**Endpoint:** `PUT /profile/`

**Request:**
```bash
curl -X PUT http://localhost:8000/profile/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jonathan",
    "last_name": "Doe"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `first_name` | string | No | Updated first name |
| `last_name` | string | No | Updated last name |
| `email` | string | No | New email address |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "Jonathan",
    "last_name": "Doe",
    "is_active": true,
    "is_superuser": false,
    "created_at": "2025-06-15T10:00:00Z"
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Invalid email format |
| 409 | Email already in use |

---

## Change Password

Change the current user's password.

**Endpoint:** `PUT /profile/password`

**Request:**
```bash
curl -X PUT http://localhost:8000/profile/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "old-password-123",
    "new_password": "new-secure-password-456"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `current_password` | string | Yes | Current password for verification |
| `new_password` | string | Yes | New password (min 8 characters) |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password updated successfully",
  "data": null
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | New password too weak |
| 401 | Current password incorrect |

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

---

## Code Examples

### JavaScript/TypeScript

```typescript
// Get profile
const getProfile = async (token: string) => {
  const response = await fetch('http://localhost:8000/profile/', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Update profile
const updateProfile = async (token: string, data: { first_name?: string; last_name?: string }) => {
  const response = await fetch('http://localhost:8000/profile/', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return response.json();
};

// Change password
const changePassword = async (
  token: string, 
  currentPassword: string, 
  newPassword: string
) => {
  const response = await fetch('http://localhost:8000/profile/password', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    })
  });
  return response.json();
};
```

### Python

```python
import requests

BASE_URL = "http://localhost:8000"

def get_profile(token: str) -> dict:
    """Get current user profile."""
    response = requests.get(
        f"{BASE_URL}/profile/",
        headers={"Authorization": f"Bearer {token}"}
    )
    return response.json()

def update_profile(token: str, first_name: str = None, last_name: str = None) -> dict:
    """Update current user profile."""
    data = {}
    if first_name:
        data["first_name"] = first_name
    if last_name:
        data["last_name"] = last_name
    
    response = requests.put(
        f"{BASE_URL}/profile/",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=data
    )
    return response.json()

def change_password(token: str, current_password: str, new_password: str) -> dict:
    """Change current user password."""
    response = requests.put(
        f"{BASE_URL}/profile/password",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json={
            "current_password": current_password,
            "new_password": new_password
        }
    )
    return response.json()

# Usage
token = "your-access-token"

# Get profile
profile = get_profile(token)
print(f"Hello, {profile['data']['first_name']}!")

# Update profile
updated = update_profile(token, first_name="NewName")

# Change password
result = change_password(token, "old-pass", "new-secure-pass")
```

---

## Response Schema

### ProfileDetail

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
  "template_count": "integer",
  "credential_count": "integer"
}
```

---

[← Users API](./users.md) | [Back to API Reference](./README.md)
