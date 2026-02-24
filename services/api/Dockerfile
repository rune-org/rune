FROM python:3.13-slim

# Set the working directory
WORKDIR /app

# Install system dependencies (libxmlsec1 is required by python3-saml)
RUN apt-get update && apt-get install -y \
    libxml2-dev \
    libxmlsec1-dev \
    libxmlsec1-openssl \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . /app

EXPOSE 8000

# Define environment variable
CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000"]