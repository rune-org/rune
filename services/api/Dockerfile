FROM python:3.13-slim

# Set the working directory
WORKDIR /app

# Install timezone data and other dependencies
RUN apt-get update && apt-get install -y \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000

# Define environment variable
CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000"]