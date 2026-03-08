# SAML SSO Testing Guide -- Complete A-Z

This guide walks you through setting up and testing SAML SSO from zero.
Follow every step in order. Do not skip steps.

---

## Quick Reference

| Item                   | Value                                      |
| ---------------------- | ------------------------------------------ |
| RUNE API               | `http://localhost:8000`                    |
| Authentik (IdP)        | `http://localhost:9000`                    |
| RUNE admin credentials | `admin@example.com` / `Test123123$`        |
| SP Entity ID           | `http://localhost:8000/auth/saml/metadata` |
| SP ACS URL             | `http://localhost:8000/auth/saml/acs`      |

---

## PART 1 -- Start Authentik

### Step 1 -- Bring Authentik up

Run this from the repo root (`rune/`):

```bash
docker compose -f docker-compose.authentik.yml up -d
```

Wait about 60 seconds for Authentik to finish its startup migrations.
Check it is ready (expected output: `200`):

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/-/health/live/
```

---

### Step 2 -- Authentik first-time setup

> **Only needed after a fresh start** (running with `-v down` deleted all data).
> If your Authentik admin account still exists, skip to Step 3.

1. Open `http://localhost:9000/if/flow/initial-setup/` in your browser.
2. Enter any email and a strong password for the Authentik admin account.
3. Click **Continue** -- you are now logged in to Authentik as admin.

---

## PART 2 -- Configure Authentik as the IdP

### Step 3 -- Create the SAML Provider

1. Inside Authentik, click **Admin Interface** in the top-right corner.
2. Go to **Applications --> Providers --> Create**.
3. Select **SAML Provider** and click **Next**.
4. Fill in every section as shown below.

#### Basic settings

| Field                  | Value                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| **Name**               | `RUNE SAML Provider`                                                      |
| **Authorization flow** | `default-provider-authorization-implicit-consent (Authorize Application)` |

> **Authorization flow is required.** If you leave it empty Authentik will refuse to save.
> Pick the one that says "implicit-consent" from the dropdown -- it means users are not shown
> an extra consent screen on every login.

#### Protocol settings

| Field                        | Value                                 |
| ---------------------------- | ------------------------------------- |
| **ACS URL**                  | `http://localhost:8000/auth/saml/acs` |
| **Issuer**                   | `authentik`                           |
| **Service Provider Binding** | `Post`                                |
| **Audience**                 | _(leave empty)_                       |

> The **Issuer** is Authentik's own entity ID. Leave it as the default `authentik`.
> Do NOT put the RUNE/SP URL here.

#### Advanced flow settings

| Field                   | Value                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| **Authentication flow** | _(leave empty -- optional)_                                      |
| **Invalidation flow**   | `default-provider-invalidation-flow (Logged out of application)` |

#### Advanced protocol settings

| Field                        | Value                                               |
| ---------------------------- | --------------------------------------------------- |
| **Signing Certificate**      | `authentik Self-signed Certificate`                 |
| **Sign assertions**          | **checked** (enabled)                               |
| **Sign responses**           | **checked** (enabled)                               |
| **Verification Certificate** | _(leave empty -- allows unsigned SP requests)_      |
| **Encryption Certificate**   | _(leave empty -- assertions will not be encrypted)_ |
| **Digest algorithm**         | `SHA256`                                            |
| **Signature algorithm**      | `RSA-SHA256`                                        |

#### Property mappings

In the **Selected User Property Mappings** box, make sure all 6 default Authentik
mappings are selected:

- `authentik default SAML Mapping: UPN`
- `authentik default SAML Mapping: Name`
- `authentik default SAML Mapping: Email`
- `authentik default SAML Mapping: Groups`
- `authentik default SAML Mapping: MemberOf`
- `authentik default SAML Mapping: Username`

For **NameID Property Mapping**, select:
`authentik default SAML Mapping: Email`

> This makes Authentik put the user's email address into the SAML NameID field,
> which is what RUNE reads to identify the user.

#### Timing settings (leave all at defaults)

| Field                               | Default value   |
| ----------------------------------- | --------------- |
| **Assertion valid not before**      | `minutes=-5`    |
| **Assertion valid not on or after** | `minutes=5`     |
| **Session valid not on or after**   | `minutes=86400` |
| **Default relay state**             | _(empty)_       |

5. Click **Save**.

---

### Step 4 -- Create an Application and link the provider

This step is required. Without it the metadata URL will not exist.

1. Go to **Applications --> Applications --> Create**.
2. Fill in:

   | Field        | Value                         |
   | ------------ | ----------------------------- |
   | **Name**     | `RUNE`                        |
   | **Slug**     | `rune` (must be exactly this) |
   | **Provider** | select `RUNE SAML Provider`   |

3. Click **Create**.

The IdP metadata is now available at:
`http://localhost:9000/application/saml/rune/metadata/`
Open that URL in your browser to confirm it returns XML.

---

### Step 5 -- Create a test SSO user in Authentik

1. Go to **Directory --> Users --> Create**.
2. Fill in:

   | Field        | Value                  |
   | ------------ | ---------------------- |
   | **Username** | `testuser`             |
   | **Name**     | `Test User`            |
   | **Email**    | `testuser@example.com` |

3. Click **Create**, then **Set Password** and set a password (e.g. `TestPassword123!`).

---

### Step 6 -- Extract the IdP values from Authentik's metadata

Run this script. It downloads Authentik's metadata and prints the exact values
you will paste into RUNE in Step 9.

```bash
python << 'EOF'
import urllib.request, xml.etree.ElementTree as ET, textwrap

url = "http://localhost:9000/application/saml/rune/metadata/"
data = urllib.request.urlopen(url).read()
tree = ET.fromstring(data)
ns = {
    "ds": "http://www.w3.org/2000/09/xmldsig#",
    "md": "urn:oasis:names:tc:SAML:2.0:metadata",
}

entity_id = tree.attrib["entityID"]

sso_el = tree.find(
    './/md:IDPSSODescriptor/md:SingleSignOnService[@Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"]',
    ns,
)
sso_url = sso_el.attrib["Location"] if sso_el is not None else "NOT FOUND"

slo_el = tree.find(
    './/md:IDPSSODescriptor/md:SingleLogoutService[@Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"]',
    ns,
)
slo_url = slo_el.attrib["Location"] if slo_el is not None else None

raw = tree.find(
    './/md:IDPSSODescriptor/md:KeyDescriptor[@use="signing"]/ds:KeyInfo/ds:X509Data/ds:X509Certificate',
    ns,
).text.strip().replace("\n", "").replace(" ", "")
pem = "-----BEGIN CERTIFICATE-----\n" + "\n".join(textwrap.wrap(raw, 64)) + "\n-----END CERTIFICATE-----"

print("=== COPY THESE VALUES ===")
print(f"IDP_ENTITY_ID: {entity_id}")
print(f"IDP_SSO_URL  : {sso_url}")
print(f"IDP_SLO_URL  : {slo_url}")
print()
print("IDP_CERTIFICATE:")
print(pem)
EOF
```

Keep this output open -- you need it in Step 9.

---

## PART 3 -- Configure RUNE

### Step 7 -- Make sure the RUNE API is running

Open a terminal in `services/api/` and run:

```bash
fastapi dev src/app.py
```

Leave it running. Open a **new terminal** for the following steps.

---

### Step 8 -- Login to RUNE and clear any old config

1. Open `http://localhost:8000/docs` in your browser.
2. Find **POST /auth/login**, click **Try it out**.
3. Paste this body and click **Execute**:

   ```json
   {
     "email": "admin@example.com",
     "password": "Test123123$"
   }
   ```

   Expected: `"success": true` and a token in the response. The docs UI sets the session cookie automatically.

4. Find **GET /auth/saml/config**, click **Try it out** --> **Execute**.
   - If it returns 404: no config exists, continue to Step 9.
   - If it returns 200: a stale config exists -- find **DELETE /auth/saml/config**, click **Try it out** --> **Execute** to delete it.

---

### Step 9 -- Create the SAML config in RUNE

1. In the docs UI (`http://localhost:8000/docs`), find **POST /auth/saml/config**, click **Try it out**.
2. Paste the body below exactly as-is -- the real values from Step 6 are already filled in:

```json
{
  "name": "Authentik",
  "idp_entity_id": "authentik",
  "idp_sso_url": "http://localhost:9000/application/saml/rune/sso/binding/redirect/",
  "idp_slo_url": "http://localhost:9000/application/saml/rune/slo/binding/redirect/",
  "idp_certificate": "-----BEGIN CERTIFICATE-----\nMIIFUzCCAzugAwIBAgIQe2UNUbi0T9uIvasE7irMpTANBgkqhkiG9w0BAQsFADAe\nMRwwGgYDVQQDDBNhdXRoZW50aWsgMjAyNC4xMC41MB4XDTI2MDIyMzE4MjUxNVoX\nDTI3MDIyNDE4MjUxNVowVjEqMCgGA1UEAwwhYXV0aGVudGlrIFNlbGYtc2lnbmVk\nIENlcnRpZmljYXRlMRIwEAYDVQQKDAlhdXRoZW50aWsxFDASBgNVBAsMC1NlbGYt\nc2lnbmVkMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAur35v7QoPc9x\nsiUe8nPwYkMSy7KZOvbkYQ7kwQsBVNoTJM96zOaKoi7onTIpCbke7YxKZ1XhZNCq\n3H5+12XwA11Kkt2N/kMig0kmQPWMJFgtV0hKYeKCC6EentxCqROtOb6Q4BJGwV0d\nSVTieKtcKHY/6nI7PWvvPZZiDmpLWhO97K6CI+48q6uYbdB1axrPOqb+wVhvM+iu\n9A6ybZo7gP4JG2QBI8GH19b5KGEAVe7DWr7VUPTngdnqjCvA9/whYY6NKkY7rzRe\n7QwTX3E0o2tCMDL4ZXgrPyPMoQ+4DHRWYGmbKEZjXRbvoiHknMggsfmdPA1PoCIg\n4COe7BTagCR6MfqbCbRRhs5Z7/wxiYHLMRD7S5g0MLzrkkAb3QvoLYUAzXs4gO/s\nccw9sgRttQNJwdnhivUt3LlQB+Fo8qF3Qb4P2eok+xG5CmvqI4lV9FxvZWYlKQoj\n5Yud6tqCgc/6ygn13TsrrvsNknhpLCdk4nfwd2/2nwCK1Uz9wJubTyuWKXSOAdrW\n2dakyP8CbnVpzHOXupyWHEpWjJyi2ZkfdgX9K8WBkn8wlB60S848Z7b3OKHfbZry\n03h5qmrYaIJH8ojTJZuTbQw0zegsUmJWEQR2hsZ/NUcpl3aks0LWaQmBtxyDfHuo\nMDrEFa5rZCBHn463xaucTJQgYL6wU9sCAwEAAaNVMFMwUQYDVR0RAQH/BEcwRYJD\nTm1FV2g4cTFqcXV6a1luaGI1aERZTFdSdUV6cGRGWUx6aE9vZDI0by5zZWxmLXNp\nZ25lZC5nb2F1dGhlbnRpay5pbzANBgkqhkiG9w0BAQsFAAOCAgEAex5Mv++/Wxkp\n/+ZcAcd/GAoYheN4A7W5dMsBs9UV0v6N/0yinq0R9zIwpHkdUp21tGBi5bG4g29J\neuf7nBD0RGEg+6sA4Ilb4ewIsgEt1gKNrO64UjimN+9j2b8urMw1aKPcDYKhZt7D\n811WRZMt3UmYQxZGrL/u7I/1BGN0WyrlFRsJYV83YQcg+BNDlBIecofNgvLTnJ+I\nVrVgC5snUcEXbImQNllBLokMRLglSVup3fS9rjb9jBCTIWZzrurLaLkLkHKgQkbI\nquHz14iS9fHjF1l63VZ/beDuvfE9sWFJc/qm8CAfAmygPeynQDdoR46Pzv/EP+vR\nG2kqvCREeapMOw2hScFVkzSqrwvHtXg9v8yOi5PNArdtdbScpV/8hn1/2Thkq1ip\n+kGZxb2trFvjzf1cLVQiWZgqiWULQYkT4fgsbTJOETLJaJbyj8GtOKOx6C6FN9Pi\ndBErTb/0ZINWeMIej0pt2pzuAGxE9Az2oILgrtp5GbnRE7918CaMGzV2aXuih1c5\nFDXGQwhVZOKgUZjO2yz/t8IzQBTFiKeoG1jBfqieFe8hw6Xzt/utJv6+V1UZ1UFt\ns1LC45uBbXTqIunEJvny5M+gmoEsXgOR4Gkzq+oyCBfte/ipBYuV1DnSJJ1WiTYH\nb+CS905Z2EkQPYiDZS1GrP2YxafGYKQ=\n-----END CERTIFICATE-----",
  "domain_hint": "example.com"
}
```

3. Click **Execute**.

Expected: HTTP 201 with `"success": true` and `sp_entity_id`, `sp_acs_url` in the response data.

---

### Step 10 -- Verify the SP metadata

```bash
curl -s http://localhost:8000/auth/saml/metadata
```

Expected: XML starting with `<md:EntityDescriptor entityID="http://localhost:8000/auth/saml/metadata"`.
A 404 here means no SAML config exists -- redo Step 9.

---

## PART 4 -- Test the Full SSO Flow

### Step 11 -- Trigger the SSO login

Open this URL in your **browser** (not curl -- the browser must handle the redirects):

```
http://localhost:8000/auth/saml/login
```

Flow:

1. RUNE redirects your browser to `http://localhost:9000/application/saml/rune/sso/...`
2. Authentik shows its login page.
3. Enter credentials: `testuser@example.com` / `TestPassword123!`
4. Authentik POSTs the SAML assertion to `http://localhost:8000/auth/saml/acs`.
5. RUNE validates the assertion, provisions the user, and redirects to `http://localhost:3000/saml-callback?status=ok&...`

> The redirect to `localhost:3000` is expected (that is `SAML_FRONTEND_URL`).
> If the browser shows a connection error at port 3000, look at the URL bar --
> `status=ok` in the URL means **SSO succeeded**.

---

### Step 12 -- Confirm user was provisioned in RUNE

1. Open `http://localhost:8000/docs`.
2. If your session expired, re-run **POST /auth/login** with `admin@example.com` / `Test123123$`.
3. Find **GET /users**, click **Try it out** --> **Execute**.

Look for `"email": "testuser@example.com"` in the response.

---

### Step 13 -- Confirm SSO-only login guard

1. In the docs UI, find **POST /auth/login**, click **Try it out**.
2. Paste this body:
   ```json
   {
     "email": "testuser@example.com",
     "password": "anything"
   }
   ```
3. Click **Execute**.

Expected: a 4xx error response (not a token). SAML-provisioned users must log in through Step 11.

---

## Troubleshooting

### 500 "An internal server error occurred" on /auth/saml/login

The SAML config in the DB is stale (wrong key or corrupt data). Delete and recreate:

```bash
curl -s -b cookies.txt -X DELETE http://localhost:8000/auth/saml/config
# Then redo Step 9
```

### 404 "No active SAML configuration found" on /auth/saml/login

No SAML config exists. Run Steps 8-9.

### 409 "A SAML configuration already exists" on POST /auth/saml/config

Delete the existing one first:

```bash
curl -s -b cookies.txt -X DELETE http://localhost:8000/auth/saml/config
```

### Authentik shows "Invalid request" or "No matching application"

The application slug must be exactly `rune`. In Authentik Admin:
Applications --> Applications --> edit your app --> check the Slug field.

### SAML assertion validation fails (error in RUNE logs)

Check that in the Authentik SAML provider:

- ACS URL is exactly `http://localhost:8000/auth/saml/acs`
- Property Mappings includes `authentik default SAML Mapping: Email`

### Redirect ends at localhost:3000 -- connection refused

That is normal if the frontend is not running. Check the URL bar for
`status=ok` to confirm SSO worked. The access cookie was already set on
`localhost:8000`.

---

## API Quick Reference

All endpoints are in the docs UI at `http://localhost:8000/docs`.
Login once with **POST /auth/login** -- the docs UI keeps the session cookie for all subsequent calls.

| Action               | Docs UI endpoint                                                           |
| -------------------- | -------------------------------------------------------------------------- |
| Admin login          | **POST /auth/login**                                                       |
| Get SAML config      | **GET /auth/saml/config**                                                  |
| Delete SAML config   | **DELETE /auth/saml/config**                                               |
| Create SAML config   | **POST /auth/saml/config**                                                 |
| View SP metadata XML | Open `http://localhost:8000/auth/saml/metadata` in browser                 |
| Test SSO discovery   | **GET /auth/saml/discover** -- set `email` param to `testuser@example.com` |
| List all users       | **GET /users**                                                             |
