# EarRape — Production Dockerfile
FROM python:3.11-slim

# System deps for audio processing & requests
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories that must persist (will be overridden by volumes)
RUN mkdir -p uploads/tracks uploads/covers data static/assets

# Non-root user for security
RUN useradd -m -u 1001 earrape && chown -R earrape:earrape /app
USER earrape

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
