# Hugging Face Spaces Dockerfile — Full-Stack (FastAPI + React)
# Serves both the API and the static frontend from a single container on port 7860

# ── Stage 1: Build React Frontend ──────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .

# Point API calls to the same origin (relative path)
ENV VITE_API_URL=""
RUN npm run build

# ── Stage 2: Python Backend + Nginx ────────────────────────────
FROM python:3.12-slim

WORKDIR /workspace

# Install Nginx + system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK data
RUN python -c "import nltk; nltk.download('punkt_tab', quiet=True)"

# Copy backend source
COPY backend/ /workspace/backend/
COPY data/ /workspace/data/

# Copy compiled frontend assets from Stage 1
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Set Python path so imports like `backend.app.main` resolve
ENV PYTHONPATH=/workspace

# Nginx config: serve frontend on / and proxy /api to FastAPI
RUN cat > /etc/nginx/sites-available/default <<'EOF'
server {
    listen 7860;
    server_name _;

    # Serve React frontend
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to FastAPI backend
    location /datasets/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /evaluations/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /annotations/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /docs {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }
}
EOF

# Create entrypoint script
RUN cat > /workspace/start.sh <<'ENTRY'
#!/bin/bash
set -e

# Seed the database
cd /workspace
python -m backend.app.seed || echo "Seed skipped or already done"

# Start FastAPI in background
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 &

# Start Nginx in foreground (HF Spaces expects the process to stay alive)
nginx -g "daemon off;"
ENTRY
RUN chmod +x /workspace/start.sh

EXPOSE 7860

CMD ["/workspace/start.sh"]
