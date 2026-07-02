# ============================================================
# Dockerfile — Backend ChatERP (FastAPI + sentence-transformers)
# ============================================================
# USO:
#   docker build -t chaterp-backend -f backend/Dockerfile .
#   docker run -p 8000:8000 --env-file ./backend/.env chaterp-backend
# ============================================================

# ------------------------
# Stage 1: Builder
# ------------------------
FROM python:3.12-slim AS builder

WORKDIR /build
COPY backend/requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# ------------------------
# Stage 2: Runtime
# ------------------------
FROM python:3.12-slim

# Dependencias del sistema (pymupdf necesita libgl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copiar las dependencias de Python del builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Crear estructura de directorios que coincide con el layout del proyecto
WORKDIR /app

# Código del backend
COPY backend /app/backend

# Contenido educativo (para seed)
COPY contenido /app/contenido

# Scripts de seed
COPY scripts /app/scripts

# Pre-cachear el modelo de embeddings para que no se descargue en el primer request
RUN python <<EOF
from sentence_transformers import SentenceTransformer
SentenceTransformer("all-MiniLM-L6-v2")
print("[Docker] Modelo de embeddings precargado OK")
EOF

# Directorio de trabajo para el backend
WORKDIR /app/backend

EXPOSE 8000

# Render asigna el puerto dinámicamente en $PORT, con fallback a 8000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
