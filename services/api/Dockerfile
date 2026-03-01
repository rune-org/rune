FROM python:3.13-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.10.7 /uv /uvx /bin/

# Set the working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    && rm -rf /var/lib/apt/lists/*

# Enable bytecode compilation and copy mode (for optimization)
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Copy dependency files first for better layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies only (not the project itself yet)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# Copy the rest of the application
COPY . /app

# Install the project itself
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

EXPOSE 8000

# Use the virtual environment
ENV PATH="/app/.venv/bin:$PATH"

# Run the application using uvicorn from the virtual environment
CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000"]