from langchain_google_genai import ChatGoogleGenerativeAI

from src.core.config import get_settings


def build_google_chat_model(
    model: str, temperature: float, **kwargs
) -> ChatGoogleGenerativeAI:
    """Build a Gemini chat model for the configured backend.

    Args:
        model: Gemini model id (e.g. ``gemini-2.0-flash``). The backend is chosen
            by config, so the model id is the bare Google model name with no
            provider prefix.
        temperature: Sampling temperature.
        **kwargs: Extra keyword arguments forwarded to ``ChatGoogleGenerativeAI``.

    Returns:
        A ``ChatGoogleGenerativeAI`` pointed at Google AI Studio or Vertex AI
        according to ``GOOGLE_GENAI_USE_VERTEXAI``.
    """
    settings = get_settings()

    backend_kwargs: dict = {}
    if settings.google_genai_use_vertexai:
        # Vertex AI (Express mode): authenticates with GOOGLE_API_KEY. project /
        # location are optional and only forwarded when explicitly configured.
        backend_kwargs["vertexai"] = True
        if settings.google_cloud_project:
            backend_kwargs["project"] = settings.google_cloud_project
        if settings.google_cloud_location:
            backend_kwargs["location"] = settings.google_cloud_location

    return ChatGoogleGenerativeAI(
        model=model,
        temperature=temperature,
        google_api_key=settings.google_api_key,
        **backend_kwargs,
        **kwargs,
    )
