FROM python:3.13-slim

# Set the working directory
WORKDIR /app

RUN apt-get update && apt-get install -y

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000

# Define environment variable
CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000"]