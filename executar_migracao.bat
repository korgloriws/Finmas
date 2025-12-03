@echo off
echo ========================================
echo Migracao Neon -^> Supabase
echo ========================================
echo.

REM Verificar se Python esta instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Python nao encontrado!
    echo Por favor, instale o Python 3.8 ou superior
    pause
    exit /b 1
)

REM Verificar se psycopg esta instalado
python -c "import psycopg" >nul 2>&1
if errorlevel 1 (
    echo Instalando psycopg...
    pip install psycopg[binary]
    if errorlevel 1 (
        echo ERRO: Falha ao instalar psycopg
        pause
        exit /b 1
    )
)

echo Executando migracao...
echo.
python migrate_to_supabase.py

if errorlevel 1 (
    echo.
    echo ERRO: Migracao falhou!
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo Migracao concluida com sucesso!
    echo ========================================
)

pause

