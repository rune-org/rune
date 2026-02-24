"""JIT (Just-in-Time) SAML user provisioning.

When a SAML assertion arrives at the ACS endpoint this service either:
1. Loads the matching user (found by NameID + config).
2. Links an existing local account that shares the same email address.
3. Creates a brand-new SSO-only user account.

SAML-provisioned accounts have ``auth_provider == AuthProvider.SAML`` and
``hashed_password == None``.  They may only authenticate via SSO.
"""

from datetime import datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.saml.service import SAMLAttributes
from src.db.models import AuthProvider, SAMLConfiguration, User, UserRole


class SAMLProvisioningService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_or_create_saml_user(
        self,
        attrs: SAMLAttributes,
        config: SAMLConfiguration,
    ) -> User:
        """Return the ``User`` record that corresponds to the SAML assertion.

        Lookup priority:
        1. Exact match on ``(saml_subject, saml_config_id)`` → return as-is.
        2. Email match on an existing local account → convert to SSO-only.
        3. No match → JIT-create a new user.

        In all cases ``last_login_at`` is refreshed.
        """
        # ------------------------------------------------------------------
        # 1. Primary lookup: NameID + config
        # ------------------------------------------------------------------
        result = await self.db.exec(
            select(User).where(
                User.saml_subject == attrs.name_id,
                User.saml_config_id == config.id,
            )
        )
        user = result.first()
        if user:
            user.last_login_at = datetime.now()
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
            return user

        # ------------------------------------------------------------------
        # 2. Email-based fallback: link an existing local account
        # ------------------------------------------------------------------
        email_result = await self.db.exec(select(User).where(User.email == attrs.email))
        existing = email_result.first()
        if existing:
            existing.auth_provider = AuthProvider.SAML
            existing.saml_subject = attrs.name_id
            existing.saml_config_id = config.id
            existing.hashed_password = None  # SSO-only: revoke password login
            existing.last_login_at = datetime.now()
            self.db.add(existing)
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        # ------------------------------------------------------------------
        # 3. JIT provisioning: create a new SSO-only user
        # ------------------------------------------------------------------
        new_user = User(
            name=attrs.name or attrs.email,
            email=attrs.email,
            hashed_password=None,
            auth_provider=AuthProvider.SAML,
            saml_subject=attrs.name_id,
            saml_config_id=config.id,
            role=UserRole.USER,
            is_active=True,
            must_change_password=False,
            last_login_at=datetime.now(),
        )
        self.db.add(new_user)
        await self.db.commit()
        await self.db.refresh(new_user)
        return new_user
