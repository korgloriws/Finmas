#!/bin/bash

# Script de backup automático para bancos SQLite
# Executar via cron: 0 2 * * * /caminho/para/backup.sh

# Configurações
BACKUP_DIR="/root/backups/finmas"
DATA_DIR="./data/bancos_usuarios"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

# Criar backup com timestamp
BACKUP_FILE="$BACKUP_DIR/finmas_backup_$DATE.tar.gz"

# Fazer backup de todos os bancos SQLite
if [ -d "$DATA_DIR" ]; then
    tar -czf "$BACKUP_FILE" -C "$DATA_DIR" .
    echo "[$(date)] Backup criado: $BACKUP_FILE"
    
    # Verificar tamanho do backup
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Tamanho do backup: $SIZE"
else
    echo "[$(date)] ERRO: Diretório $DATA_DIR não encontrado!"
    exit 1
fi

# Remover backups antigos (manter apenas últimos 7 dias)
find "$BACKUP_DIR" -name "finmas_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Backups antigos removidos (mantidos últimos $RETENTION_DAYS dias)"

# Listar backups atuais
echo "[$(date)] Backups disponíveis:"
ls -lh "$BACKUP_DIR" | grep finmas_backup

