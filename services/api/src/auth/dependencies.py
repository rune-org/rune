"""Shared FastAPI dependency factories for the SAML sub-package.

Centralising these here avoids duplicating the same wiring in both the SAML
router and the main auth router.
"""

from src.auth.saml.service import SAMLService
from src.auth.service import AuthService
from src.auth.token_store import TokenStore
from src.core.dependencies import DatabaseDep, RedisDep


async def get_saml_service(redis: RedisDep) -> SAMLService:
    return SAMLService(redis_client=redis)


async def get_auth_service(db: DatabaseDep, redis: RedisDep) -> AuthService:
    token_store = TokenStore(redis_client=redis)
    return AuthService(db=db, token_store=token_store)
