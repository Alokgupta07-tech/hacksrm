# RoadVision AI Pro — Render Deployment
# Multi-stage build for production

# Stage 1: Install Python dependencies
FROM python:3.11-slim AS python-deps

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY roadvision-ai-pro/backend/requirements.txt .
RUN pip install --no-cache-dir --no-warn-script-location --user -r requirements.txt

# Stage 2: Production image
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=python-deps /root/.local /root/.local

# Copy application code from roadvision-ai-pro
COPY roadvision-ai-pro/backend/ ./backend/
COPY roadvision-ai-pro/static/ ./static/
COPY roadvision-ai-pro/templates/ ./templates/

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONPATH=/app/backend:$PYTHONPATH
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV HOST=0.0.0.0
ENV DEMO_MODE=true

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

EXPOSE ${PORT}

CMD ["sh", "-c", "python -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT} --workers 2"]
