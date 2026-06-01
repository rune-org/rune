from typing import Any


def merge_oauth2_credential_patch(
    existing: dict[str, Any], patch: dict[str, Any]
) -> dict[str, Any]:
    """
    Merge a partial PATCH body into decrypted oauth2 credential_data.

    Unknown keys are ignored. Empty client_secret leaves the stored secret unchanged.
    Consent-invalidating changes clear session tokens.
    """
    merged: dict[str, Any] = {**existing}
    consent_invalidated = False
    allowed = frozenset(
        {"client_id", "auth_url", "token_url", "scope", "client_secret"}
    )

    for key, value in patch.items():
        if key not in allowed:
            continue

        if key == "client_secret":
            if value is None or value == "":
                continue
            merged["client_secret"] = value
            continue

        if key == "client_id":
            old = merged.get("client_id")
            if value is not None and old != value:
                consent_invalidated = True
            if value is not None:
                merged["client_id"] = value
            continue

        if key in ("scope", "auth_url", "token_url"):
            old = merged.get(key)
            if value is not None and old != value:
                consent_invalidated = True
            if value is not None:
                merged[key] = value

    if consent_invalidated:
        for tk in ("access_token", "refresh_token", "expires_at", "token_type"):
            merged.pop(tk, None)

    return merged
