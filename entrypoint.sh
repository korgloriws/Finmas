#!/bin/bash
set -e

# Configurações de backup
# Usa variáveis de ambiente se definidas, senão usa padrões do container
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
DATA_DIR="${DATA_DIR:-/app/backend/bancos_usuarios}"
# Variável para controlar se faz backup no startup (útil para produção)
ENABLE_STARTUP_BACKUP="${ENABLE_STARTUP_BACKUP:-true}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

echo "=========================================="
echo "  FINMAS - Iniciando Container"
echo "=========================================="
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Ambiente: ${ENVIRONMENT:-production}"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Diretório de dados: $DATA_DIR"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Diretório de backups: $BACKUP_DIR"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Backup no startup: $ENABLE_STARTUP_BACKUP"

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

# Executar backup antes de iniciar a aplicação (se habilitado)
if [ "$ENABLE_STARTUP_BACKUP" = "true" ]; then
    if [ -d "$DATA_DIR" ] && [ "$(ls -A $DATA_DIR 2>/dev/null)" ]; then
        BACKUP_FILE="$BACKUP_DIR/finmas_backup_$DATE.tar.gz"
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] Criando backup antes de iniciar..."

        # Checkpoint WAL antes do backup: garante que tudo do .db-wal foi escrito
        # no arquivo .db principal, deixando o tar-gz consistente sem copiar WAL/SHM soltos.
        if command -v sqlite3 >/dev/null 2>&1; then
            echo "[$(date +'%Y-%m-%d %H:%M:%S')] Executando PRAGMA wal_checkpoint(FULL) em todos os .db..."
            CHECKPOINT_COUNT=0
            while IFS= read -r -d '' DBFILE; do
                sqlite3 "$DBFILE" "PRAGMA wal_checkpoint(FULL);" >/dev/null 2>&1 && \
                    CHECKPOINT_COUNT=$((CHECKPOINT_COUNT + 1)) || true
            done < <(find "$DATA_DIR" -type f -name "*.db" -print0 2>/dev/null)
            echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✓ Checkpoint aplicado em $CHECKPOINT_COUNT arquivo(s)"
        else
            echo "[$(date +'%Y-%m-%d %H:%M:%S')] AVISO: sqlite3 CLI indisponível, pulando checkpoint WAL"
        fi

        # Fazer backup de todos os bancos SQLite (exclui arquivos auxiliares WAL/SHM
        # para evitar inconsistência — após o checkpoint acima, o .db já contém tudo)
        tar --exclude='*.db-wal' --exclude='*.db-shm' -czf "$BACKUP_FILE" -C "$DATA_DIR" . 2>/dev/null || {
            echo "[$(date +'%Y-%m-%d %H:%M:%S')] AVISO: Não foi possível criar backup completo, continuando..."
        }
        
        if [ -f "$BACKUP_FILE" ]; then
            SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
            echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✓ Backup criado: $BACKUP_FILE ($SIZE)"
            echo "[$(date +'%Y-%m-%d %H:%M:%S')] ℹ Backup salvo em: $(dirname $(readlink -f $BACKUP_FILE 2>/dev/null || echo $BACKUP_FILE))"
        fi
        
        # Remover backups antigos (manter apenas últimos 7 dias)
        find "$BACKUP_DIR" -name "finmas_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✓ Limpeza de backups antigos concluída"
    else
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ℹ Diretório de dados vazio ou não encontrado, pulando backup inicial"
    fi
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ℹ Backup no startup desabilitado (ENABLE_STARTUP_BACKUP=false)"
fi

echo "=========================================="
echo "  Iniciando aplicação Gunicorn..."
echo "=========================================="

# Executar o comando original (gunicorn)
exec "$@"

