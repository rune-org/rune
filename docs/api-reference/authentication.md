# Authentication API

API endpoints for user authentication, token management, and session handling.

---

## Overview

Rune uses JWT (JSON Web Tokens) for authentication:

- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to get new access tokens

```
Login ──▶ Access Token + Refresh Token
              │
              ▼
         API Requests (with Access Token)
              │
              ▼ (token expires)
         Refresh ──▶ New Access Token
```

---

## Endpoints

### Login

Authenticate a user and receive tokens.

**Endpoint:** `POST /auth/login`

**Request:**
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `password` | string | Yes | User's password |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 900
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `access_token` | string | JWT for API authentication |
| `refresh_token` | string | Token for refreshing access |
| `token_type` | string | Always "bearer" |
| `expires_in` | number | Access token lifetime in seconds |

**Error Responses:**

| Status | Description |
|--------|-------------|
| 401 | Invalid email or password |
| 422 | Validation error (missing fields) |

---

### Refresh Token

Get a new access token using a valid refresh token.

**Endpoint:** `POST /auth/refresh`

**Request:**
```bash
curl -X POST http://localhost:8000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `refresh_token` | string | Yes | Valid refresh token |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 900
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 401 | Invalid or expired refresh token |
| 422 | Validation error |

---

### Logout

Logout the current user and revoke the refresh token.

**Endpoint:** `POST /auth/logout`

**Request:**
```bash
curl -X POST http://localhost:8000/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Successfully logged out",
  "data": null
}
```

**Notes:**
- Clears the authentication cookie if set
- Revokes the refresh token

---

## Using Authentication

### Making Authenticated Requests

Include the access token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8000/workflows/
```

### Token Refresh Flow

When the access token expires, use the refresh token to get a new one:

```bash
# Check if request failed with 401
if [ "$STATUS" -eq 401 ]; then
  # Refresh the token
  NEW_TOKEN=$(curl -s -X POST http://localhost:8000/auth/refresh \
    -H "Content-Type: application/json" \
    -d "{\"refresh_token\": \"$REFRESH_TOKEN\"}" \
    | jq -r '.data.access_token')
  
  # Retry the original request
  curl -H "Authorization: Bearer $NEW_TOKEN" \
    http://localhost:8000/workflows/
fi
```

---

## Code Examples

### JavaScript/TypeScript

```typescript
// Login
const login = async (email: string, password: string) => {
  const response = await fetch('http://localhost:8000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('access_token', data.data.access_token);
    localStorage.setItem('refresh_token', data.data.refresh_token);
  }
  
  return data;
};

// Authenticated request
const fetchWorkflows = async () => {
  const token = localStorage.getItem('access_token');
  
  const response = await fetch('http://localhost:8000/workflows/', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.status === 401) {
    // Token expired, refresh it
    await refreshToken();
    return fetchWorkflows();
  }
  
  return response.json();
};

// Refresh token
const refreshToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  
  const response = await fetch('http://localhost:8000/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('access_token', data.data.access_token);
    localStorage.setItem('refresh_token', data.data.refresh_token);
  }
  
  return data;
};
```

### Python

```python
import requests

BASE_URL = "http://localhost:8000"

class RuneClient:
    def __init__(self):
        self.access_token = None
        self.refresh_token = None
    
    def login(self, email: str, password: str) -> dict:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password}
        )
        data = response.json()
        
        if data["success"]:
            self.access_token = data["data"]["access_token"]
            self.refresh_token = data["data"]["refresh_token"]
        
        return data
    
    def _get_headers(self) -> dict:
        return {"Authorization": f"Bearer {self.access_token}"}
    
    def _refresh_token(self):
        response = requests.post(
            f"{BASE_URL}/auth/refresh",
            json={"refresh_token": self.refresh_token}
        )
        data = response.json()
        
        if data["success"]:
            self.access_token = data["data"]["access_token"]
            self.refresh_token = data["data"]["refresh_token"]
    
    def get_workflows(self) -> dict:
        response = requests.get(
            f"{BASE_URL}/workflows/",
            headers=self._get_headers()
        )
        
        if response.status_code == 401:
            self._refresh_token()
            return self.get_workflows()
        
        return response.json()

# Usage
client = RuneClient()
client.login("admin@example.com", "admin123")
workflows = client.get_workflows()
```

---

## Security Considerations

### Token Storage

| Environment | Recommendation |
|-------------|----------------|
| Browser | HttpOnly cookies or secure localStorage |
| Mobile App | Secure storage (Keychain/Keystore) |
| Server | Environment variables or secret manager |

### Best Practices

1. **Never log tokens** - Tokens are sensitive credentials
2. **Use HTTPS** - Always use TLS in production
3. **Handle expiration** - Implement automatic token refresh
4. **Logout on sensitive actions** - Force re-authentication when needed
5. **Rotate refresh tokens** - New refresh token on each refresh

---

## Error Handling

### Common Errors

**Invalid Credentials (401):**
```json
{
  "success": false,
  "message": "Invalid email or password",
  "data": null
}
```

**Expired Token (401):**
```json
{
  "detail": "Token has expired"
}
```

**Invalid Token (401):**
```json
{
  "detail": "Could not validate credentials"
}
```

---

[← Back to API Reference](./README.md) | [Workflows API →](./workflows.md)
