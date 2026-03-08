# SAML Testing — Local Dev (no nginx)

This file is a **diff from [`SAML_TESTING.md`](SAML_TESTING.md)** for the setup where:

- The API runs directly with `fastapi dev src/app.py` (port **8000**, **no TLS**)
- The backing services run via `docker compose -f docker-compose.dev.yml up -d`
- Authentik runs via `docker compose -f docker-compose.authentik.yml up -d` (self-contained, no network prerequisites)
- nginx is **not** running

Read `SAML_TESTING.md` for the full flow. Apply the deltas listed here.

---

## URL map

|              | Full-stack (nginx)                         | Local dev                                  |
| ------------ | ------------------------------------------ | ------------------------------------------ |
| API base     | `https://localhost/api`                    | `http://localhost:8000`                    |
| Frontend     | `https://localhost`                        | `http://localhost:3000`                    |
| Authentik UI | `http://localhost:9000`                    | `http://localhost:9000` (same)             |
| SP entity ID | `https://localhost/api/auth/saml/metadata` | `http://localhost:8000/auth/saml/metadata` |
| ACS URL      | `https://localhost/api/auth/saml/acs`      | `http://localhost:8000/auth/saml/acs`      |
| SP metadata  | `https://localhost/api/auth/saml/metadata` | `http://localhost:8000/auth/saml/metadata` |

---

## `.env` values for this setup

```dotenv
ENVIRONMENT=dev
SAML_SP_BASE_URL=http://localhost:8000
SAML_FRONTEND_URL=http://localhost:3000
```

All other values stay the same as the defaults in `.env.example`.

---

## Start the stack

```bash
# 1. Backing services (Postgres, Redis, RabbitMQ, MongoDB)
#    Run from the repo root.
docker compose -f docker-compose.dev.yml up -d

# 2. Authentik IdP — self-contained, no network prerequisites.
#    Run this only when you need to test SAML.
docker compose -f docker-compose.authentik.yml up -d

# 3. API — hot-reloading dev server (run from services/api/)
fastapi dev src/app.py
```

Wait for Authentik to finish bootstrapping:

```bash
docker compose -f docker-compose.authentik.yml logs authentik-server -f
# Ready when you see: "lifecycle.ASGIServer | Starting server"
```

---

## curl changes

Drop `-sk` (no TLS) and replace the base URL.

**Get an admin JWT**

```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-password"}' \
  -c cookies.txt
```

**View SP metadata**

```bash
curl -s http://localhost:8000/auth/saml/metadata | python3 -m xml.dom.minidom -
```

**Create a SAML config (admin)**

```bash
curl -s -X POST http://localhost:8000/auth/saml/config \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Authentik Dev IdP",
    "idp_entity_id": "<EntityID from Authentik metadata>",
    "idp_sso_url": "<SSO POST URL from Authentik metadata>",
    "idp_slo_url": null,
    "idp_certificate": "<base64 cert — no spaces>",
    "domain_hint": "example.com"
  }' | python3 -m json.tool
```

**Trigger SSO (open in browser)**

```
http://localhost:8000/auth/saml/login
```

**Discovery**

```bash
curl -s "http://localhost:8000/auth/saml/discover?email=user@example.com" | python3 -m json.tool
```

---

## Authentik metadata import — workaround

`SAML_TESTING.md` suggests importing SP metadata directly from the URL.
Authentik is running inside Docker, so `http://localhost:8000` points to the
container's own loopback — **not** your host machine.

**Two options:**

### Option A — configure manually (recommended for dev)

In Authentik's SAML provider form, fill in these fields directly instead of
importing metadata:

| Field                    | Value                                      |
| ------------------------ | ------------------------------------------ |
| ACS URL                  | `http://localhost:8000/auth/saml/acs`      |
| Issuer / Entity ID       | `http://localhost:8000/auth/saml/metadata` |
| Service Provider Binding | `POST`                                     |

### Option B — import via host-gateway hostname

Docker Desktop exposes the host machine as `host.docker.internal`.
Paste this URL in the Authentik "Import metadata" dialog:

```
http://host.docker.internal:8000/auth/saml/metadata
```

> ⚠️ `host.docker.internal` works on Docker Desktop (Windows/macOS).
> On Linux you may need to add `--add-host=host.docker.internal:host-gateway`
> to the Authentik container, or just use Option A.

---

## Post-SSO redirect target

After ACS processing the API redirects to:

```
http://localhost:3000/saml-callback?status=ok&refresh_token=...
```

Make sure your Next.js dev server is running on port 3000.
If the port differs, update `SAML_FRONTEND_URL` in `.env`.

---

## Cookie behaviour in dev

`ENVIRONMENT=dev` makes `cookie_secure=False`, so the `access_token`
cookie is sent over plain HTTP. Browsers accept this on `localhost`.

---

## Tear down Authentik without touching dev services

```bash
# Stop Authentik only — dev backing services keep running
docker compose -f docker-compose.authentik.yml down

# Also remove Authentik's volumes (wipes its Postgres, Redis + config)
docker compose -f docker-compose.authentik.yml down -v
```
