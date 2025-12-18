# ============================================================================
# RUNE Workflow Scheduler - Standalone Service
# ============================================================================
# Alpine-based minimal Python image for reduced footprint
FROM python:3.11-alpine

LABEL maintainer="RUNE Team"
LABEL description="Standalone workflow scheduler service"
LABEL version="1.0"

# Set working directory
WORKDIR /app

# Install runtime dependencies only
# - postgresql-libs: Required for asyncpg
# - libffi: Required for some Python packages
# - tzdata: Required for timezone support
RUN apk add --no-cache \
    postgresql-libs \
    libffi \
    tzdata

# Install build dependencies temporarily for compiling Python packages
# These will be removed after pip install to minimize image size
RUN apk add --no-cache --virtual .build-deps \
    gcc \
    musl-dev \
    postgresql-dev \
    libffi-dev

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    apk del .build-deps

# Copy scheduler application
COPY *.py .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH=/app
ENV LOG_LEVEL=INFO

# Health check - verify the scheduler process is running
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD ps aux | grep -q '[p]ython.*main.py' || exit 1

# Run as non-root user for security
RUN addgroup -g 1000 scheduler && \
    adduser -D -u 1000 -G scheduler scheduler && \
    chown -R scheduler:scheduler /app

USER scheduler

# Run the scheduler
CMD ["python", "-u", "main.py"]
