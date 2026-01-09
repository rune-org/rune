FROM python:3.13-alpine


# Set working directory
WORKDIR /app

# Install runtime dependencies only
# - postgresql-libs: Required for asyncpg
# - libffi: Required for some Python packages
RUN apk add --no-cache \
    postgresql-libs \
    libffi

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


# Health check - verify the scheduler process is running
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD ps aux | grep -q '[p]ython.*main.py' || exit 1


# Run the scheduler
CMD ["python", "-u", "main.py"]
