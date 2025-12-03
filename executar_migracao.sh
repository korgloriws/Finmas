#!/bin/bash

echo "========================================"
echo "Migração Neon -> Supabase"
echo "========================================"
echo ""

# Verificar se Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "ERRO: Python não encontrado!"
    echo "Por favor, instale o Python 3.8 ou superior"
    exit 1
fi

# Verificar se psycopg está instalado
if ! python3 -c "import psycopg" &> /dev/null; then
    echo "Instalando psycopg..."
    pip3 install psycopg[binary]
    if [ $? -ne 0 ]; then
        echo "ERRO: Falha ao instalar psycopg"
        exit 1
    fi
fi

echo "Executando migração..."
echo ""
python3 migrate_to_supabase.py

if [ $? -ne 0 ]; then
    echo ""
    echo "ERRO: Migração falhou!"
    exit 1
else
    echo ""
    echo "========================================"
    echo "Migração concluída com sucesso!"
    echo "========================================"
fi

