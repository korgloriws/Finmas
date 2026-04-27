###########################
# Frontend build stage    #
###########################
FROM node:20-bullseye-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend .
RUN node node_modules/vite/bin/vite.js build

###########################
# Backend runtime stage    #
###########################
FROM python:3.11-slim

# Evitar .pyc e forçar logs em stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production \
    PORT=8080

# Dependências básicas (bcrypt/pandas wheels costumam funcionar sem build, mas deixamos build-essential se necessário)
# sqlite3 CLI é usado no entrypoint.sh para wal_checkpoint antes do backup
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl ca-certificates imagemagick sqlite3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependências Python
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copiar backend
COPY backend /app/backend

# Copiar script de entrypoint
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Copiar frontend build para ser servido pelo Flask
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
# Garantir ícones PWA no build caso não existam
RUN mkdir -p /app/frontend/dist/icons \
    && [ -f /app/frontend/dist/icons/icon-192.png ] || convert -size 192x192 canvas:#0f172a /app/frontend/dist/icons/icon-192.png \
    && [ -f /app/frontend/dist/icons/icon-512.png ] || convert -size 512x512 canvas:#0f172a /app/frontend/dist/icons/icon-512.png

RUN mkdir -p /app/cache /app/backend/bancos_usuarios /app/backups /app/logs

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]

# Gunicorn em produção:
# -w 2           : 2 workers (um por vCPU) para paralelismo real + isolamento em caso de crash
# --threads 6    : até 6 threads por worker p/ I/O-bound (yfinance, requests, scrapers)
# -k gthread     : worker class thread-based (permite concorrência I/O com GIL)
# -t 600         : 10 min p/ análises longas (Nginx ainda permite 24h na rota /api/analise/ativos)
# --max-requests 1000 + jitter : recicla worker após N reqs para liberar RAM/FDs
# --preload      : importa app no master ANTES do fork -> economiza RAM e roda
#                  inicializações (WAL, invalidar_sessoes) uma única vez
CMD ["sh", "-c", "cd /app/backend && exec gunicorn -w 2 -k gthread --threads 6 -t 600 --max-requests 1000 --max-requests-jitter 50 --preload -b 0.0.0.0:${PORT:-8080} app:server"]


