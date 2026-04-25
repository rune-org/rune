import pytest
from httpx import AsyncClient

from src.oauth.credential_patch import merge_oauth2_credential_patch
from src.oauth.credential_tokens import oauth2_worker_public_values
from src.oauth.state import encode_oauth_state


def test_merge_oauth2_clears_tokens_when_scope_changes():
    existing = {
        "client_id": "cid",
        "scope": "a b",
        "access_token": "at",
        "refresh_token": "rt",
        "expires_at": "2099-01-01T00:00:00+00:00",
    }
    merged = merge_oauth2_credential_patch(existing, {"scope": "a b c"})
    assert merged["scope"] == "a b c"
    assert "access_token" not in merged
    assert "refresh_token" not in merged


def test_oauth2_worker_public_values_strips_secrets():
    decrypted = {
        "access_token": "tok",
        "refresh_token": "rt",
        "client_secret": "sec",
        "token_type": "Bearer",
    }
    pub = oauth2_worker_public_values(decrypted)
    assert pub == {"access_token": "tok", "token_type": "Bearer"}


@pytest.mark.asyncio
async def test_oauth_authorize_redirects(authenticated_client: AsyncClient):
    create = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "oauth-flow-test",
            "credential_type": "oauth2",
            "credential_data": {
                "client_id": "client-id",
                "client_secret": "client-secret",
                "auth_url": "https://example.com/oauth/authorize",
                "token_url": "https://example.com/oauth/token",
                "scope": "read",
            },
        },
    )
    assert create.status_code == 201
    cid = create.json()["data"]["id"]

    r = await authenticated_client.get(
        "/oauth/authorize",
        params={"credential_id": cid},
        follow_redirects=False,
    )
    assert r.status_code == 302
    loc = r.headers["location"]
    assert loc.startswith("https://example.com/oauth/authorize")
    assert "client_id=client-id" in loc
    assert "response_type=code" in loc
    assert "state=" in loc


@pytest.mark.asyncio
async def test_oauth_callback_exchanges_and_redirects(
    client: AsyncClient,
    authenticated_client: AsyncClient,
    test_user,
    monkeypatch,
):
    create = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "oauth-callback-test",
            "credential_type": "oauth2",
            "credential_data": {
                "client_id": "client-id",
                "client_secret": "client-secret",
                "auth_url": "https://example.com/oauth/authorize",
                "token_url": "https://example.com/oauth/token",
                "scope": "read",
            },
        },
    )
    assert create.status_code == 201
    cid = create.json()["data"]["id"]

    state = encode_oauth_state(cid, test_user.id)

    async def fake_post(_url, _form):
        return {
            "access_token": "new-access",
            "refresh_token": "new-refresh",
            "expires_in": 3600,
            "token_type": "Bearer",
        }

    import src.oauth.router as oauth_router_mod

    monkeypatch.setattr(oauth_router_mod, "post_oauth_token_form", fake_post)

    r = await client.get(
        "/oauth/callback",
        params={"code": "auth-code", "state": state},
        follow_redirects=False,
    )
    assert r.status_code == 302
    assert "oauth=success" in r.headers["location"]

    listed = await authenticated_client.get("/credentials/")
    rows = listed.json()["data"]
    target = next(x for x in rows if x["id"] == cid)
    assert target.get("oauth_connected") is True


@pytest.mark.asyncio
async def test_oauth2_patch_merge_partial(authenticated_client: AsyncClient):
    create = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "oauth-patch-test",
            "credential_type": "oauth2",
            "credential_data": {
                "client_id": "a",
                "client_secret": "secret",
                "auth_url": "https://example.com/a",
                "token_url": "https://example.com/t",
                "access_token": "at",
            },
        },
    )
    cid = create.json()["data"]["id"]

    patch = await authenticated_client.patch(
        f"/credentials/{cid}",
        json={"credential_data": {"client_id": "a"}},
    )
    assert patch.status_code == 200
    listed1 = await authenticated_client.get("/credentials/")
    t1 = next(x for x in listed1.json()["data"] if x["id"] == cid)
    assert t1.get("oauth_connected") is True

    patch2 = await authenticated_client.patch(
        f"/credentials/{cid}",
        json={"credential_data": {"scope": "s1"}},
    )
    assert patch2.status_code == 200
    listed = await authenticated_client.get("/credentials/")
    target = next(x for x in listed.json()["data"] if x["id"] == cid)
    assert target.get("oauth_connected") is False
