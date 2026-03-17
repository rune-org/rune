import httpx

from src.config import API_BASE_URL, INTERNAL_API_KEY, log


class ApiClient:
    """HTTP client for calling the internal API endpoints."""

    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    async def start(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=API_BASE_URL,
            headers={"X-Internal-Key": INTERNAL_API_KEY},
            timeout=30.0,
        )
        log.info("API client initialized (base_url=%s)", API_BASE_URL)

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def trigger_workflow(self, workflow_id: int) -> str:
        """POST /internal/workflows/{workflow_id}/run, returns execution_id."""
        response = await self._client.post(f"/internal/workflows/{workflow_id}/run")
        response.raise_for_status()
        return response.json()["data"]
