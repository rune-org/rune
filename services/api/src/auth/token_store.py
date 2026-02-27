from redis.asyncio import Redis

from src.core.config import get_settings
from src.core.exceptions import RedisConnectionError
from src.core.password import verify_password


class TokenStore:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        self.settings = get_settings()

    def _get_token_key(self, user_id: int) -> str:
        """Generate Redis key for a user's refresh token."""
        return f"refresh_token:{user_id}"

    async def store_refresh_token(
        self,
        user_id: int,
        token_hash: str,
        ttl_seconds: int | None = None,
    ) -> None:
        """Store a refresh token for a user. Replaces any existing token."""
        if ttl_seconds is None:
            ttl_seconds = self.settings.refresh_token_expire_days * 24 * 60 * 60

        key = self._get_token_key(user_id)

        try:
            await self.redis.setex(key, ttl_seconds, token_hash)
        except Exception as e:
            raise RedisConnectionError(
                detail=f"Failed to store refresh token: {str(e)}"
            )

    async def get_refresh_token(self, user_id: int, plain_token: str) -> str | None:
        """Retrieve and verify a user's refresh token."""
        try:
            key = self._get_token_key(user_id)
            stored_hash = await self.redis.get(key)

            if stored_hash and verify_password(plain_token, stored_hash):
                return stored_hash

            return None

        except Exception as e:
            raise RedisConnectionError(
                detail=f"Failed to retrieve refresh token: {str(e)}"
            )

    async def revoke_user_tokens(self, user_id: int) -> bool:
        """Revoke all refresh tokens for a user by deleting their token key."""
        try:
            key = self._get_token_key(user_id)
            deleted = await self.redis.delete(key)
            return deleted > 0

        except Exception as e:
            raise RedisConnectionError(detail=f"Failed to revoke user tokens: {str(e)}")
