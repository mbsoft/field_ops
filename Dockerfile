# Stage 1: Build React frontend
ARG PLATFORM=linux/amd64
FROM --platform=$PLATFORM node:20 AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first (cache layer)
COPY frontend/package.json ./
RUN yarn install --network-timeout 120000 --ignore-engines

# Copy frontend source and build
COPY frontend/ ./
ENV REACT_APP_BACKEND_URL=""
RUN yarn build

# Stage 2: Python backend + serve frontend
FROM --platform=$PLATFORM python:3.11-slim

WORKDIR /app

# Install system dependencies for native packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (cache layer)
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend source
COPY backend/ /app/backend/

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

EXPOSE 8080

CMD ["uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8080"]
