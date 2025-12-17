import threading
import pandas as pd
import yfinance as yf
from flask import Flask
from flask_caching import Cache
import time
import sqlite3
from datetime import datetime, timedelta
import bcrypt
import os
import json
import secrets
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
try:
    import psycopg
except Exception:
    psycopg = None


USUARIO_ATUAL = None  
SESSION_LOCK = threading.Lock()

# ==================== ADAPTADOR DE BANCO (SQLite local x Postgres em produção) ====================

def _sanitize_db_url(url: str) -> str:
    if not url:
        return url
    try:
        from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
        parsed = urlparse(url)
        query_pairs = dict(parse_qsl(parsed.query))

        if query_pairs.get("channel_binding", "").lower() == "require":
            query_pairs.pop("channel_binding", None)

        if not query_pairs.get("sslmode"):
            query_pairs["sslmode"] = "require"
        new_query = urlencode(query_pairs)
        parsed = parsed._replace(query=new_query)
        return urlunparse(parsed)
    except Exception:
        return url

DATABASE_URL = _sanitize_db_url(os.getenv("DATABASE_URL") or os.getenv("USUARIOS_DB_URL"))

def _is_postgres() -> bool:
    is_pg = bool(DATABASE_URL) and psycopg is not None
    print(f"_is_postgres: DATABASE_URL={bool(DATABASE_URL)}, psycopg={psycopg is not None}, resultado={is_pg}")
    return is_pg

def _get_pg_conn():
    print(f"_get_pg_conn: Conectando ao PostgreSQL")
    try:
        conn = psycopg.connect(DATABASE_URL)
        print(f"_get_pg_conn: Conexão estabelecida")
        try:
            conn.autocommit = True
            print(f"_get_pg_conn: Autocommit configurado")
        except Exception as e:
            print(f"_get_pg_conn: Erro ao configurar autocommit: {e}")
        return conn
    except Exception as e:
        print(f"_get_pg_conn: Erro ao conectar ao PostgreSQL: {e}")
        raise

def _pg_schema_for_user(username: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9_]", "_", (username or "anon").lower())
    if not base:
        base = "anon"
    schema = f"u_{base}"
    print(f"_pg_schema_for_user: Schema gerado para usuário {username}: {schema}")
    
    # Verificar se o schema é válido para PostgreSQL
    if len(schema) > 63:  # Limite do PostgreSQL para identificadores
        schema = schema[:63]
        print(f"_pg_schema_for_user: Schema truncado para {schema}")
    
    return schema

def _pg_use_schema(conn, username: str):
    schema = _pg_schema_for_user(username)
    print(f"_pg_use_schema: Usando schema {schema} para usuário {username}")
    with conn.cursor() as cur:
        try:
            cur.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
            print(f"_pg_use_schema: Schema {schema} criado/verificado")
        except Exception as e:
            print(f"_pg_use_schema: Erro ao criar schema {schema}: {e}")
            raise
        
        try:
            cur.execute(f"SET search_path TO {schema}")
            print(f"_pg_use_schema: Search path configurado para {schema}")
        except Exception as e:
            print(f"_pg_use_schema: Erro ao configurar search_path: {e}")
            raise
            
        # Verificar se o schema foi criado corretamente
        try:
            cur.execute("SELECT current_schema()")
            current_schema = cur.fetchone()[0]
            print(f"_pg_use_schema: Schema atual: {current_schema}")
        except Exception as e:
            print(f"_pg_use_schema: Erro ao verificar schema atual: {e}")
            raise
            
    print(f"_pg_use_schema: Schema {schema} configurado com sucesso")
    return schema

def _pg_conn_for_user(username: str):
    print(f"_pg_conn_for_user: Conectando para usuário {username}")
    conn = _get_pg_conn()
    try:
        _pg_use_schema(conn, username)
        print(f"_pg_conn_for_user: Conexão estabelecida para usuário {username}")
        return conn
    except Exception as e:
        print(f"_pg_conn_for_user: Erro ao configurar schema para usuário {username}: {e}")
        try:
            conn.close()
        except:
            pass
        raise

def _ensure_rebalance_schema():

    usuario = get_usuario_atual()
    if not usuario:
        return
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                try:
                    c.execute('''
                        CREATE TABLE IF NOT EXISTS rebalance_config (
                            id SERIAL PRIMARY KEY,
                            periodo TEXT NOT NULL,
                            targets_json TEXT NOT NULL,
                            start_date TEXT,
                            last_rebalance_date TEXT,
                            updated_at TEXT NOT NULL
                        )
                    ''')
                except Exception:
                    pass
                try:
                    c.execute('ALTER TABLE rebalance_config ADD COLUMN IF NOT EXISTS last_rebalance_date TEXT')
                except Exception:
                    pass
                try:
                    c.execute('''
                        CREATE TABLE IF NOT EXISTS rebalance_history (
                            id SERIAL PRIMARY KEY,
                            data TEXT NOT NULL,
                            created_at TEXT NOT NULL
                        )
                    ''')
                except Exception:
                    pass
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            try:
                cur.execute('''
                    CREATE TABLE IF NOT EXISTS rebalance_config (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        periodo TEXT NOT NULL,
                        targets_json TEXT NOT NULL,
                        start_date TEXT,
                        last_rebalance_date TEXT,
                        updated_at TEXT NOT NULL
                    )
                ''')
            except Exception:
                pass
            try:
                cur.execute('ALTER TABLE rebalance_config ADD COLUMN IF NOT EXISTS last_rebalance_date TEXT')
            except Exception:
                pass
            try:
                cur.execute('''
                    CREATE TABLE IF NOT EXISTS rebalance_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        data TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                ''')
            except Exception:
                pass
            conn.commit()
        finally:
            conn.close()

def _ensure_asset_types_schema():
    usuario = get_usuario_atual()
    if not usuario:
        return
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('''
                    CREATE TABLE IF NOT EXISTS asset_types (
                        id SERIAL PRIMARY KEY,
                        nome TEXT UNIQUE NOT NULL,
                        created_at TEXT NOT NULL
                    )
                ''')
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            cur.execute('''
                CREATE TABLE IF NOT EXISTS asset_types (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT UNIQUE NOT NULL,
                    created_at TEXT NOT NULL
                )
            ''')
            conn.commit()
        finally:
            conn.close()

def list_asset_types():
    usuario = get_usuario_atual()
    if not usuario:
        return []
    _ensure_asset_types_schema()
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('SELECT nome FROM asset_types ORDER BY nome ASC')
                rows = c.fetchall()
                return [r[0] for r in rows]
        finally:
            conn.close()
    db_path = get_db_path(usuario, "carteira")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        cur = conn.cursor()
        cur.execute('SELECT nome FROM asset_types ORDER BY nome ASC')
        rows = cur.fetchall()
        return [r[0] for r in rows]
    finally:
        conn.close()

def _ensure_indexador_schema():

    usuario = get_usuario_atual()
    if not usuario:
        return
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                try:
                    c.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS indexador TEXT')
                except Exception:
                    pass
                try:
                    c.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS indexador_pct NUMERIC')
                except Exception:
                    pass
                try:
                    c.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS indexador_base_preco NUMERIC')
                except Exception:
                    pass
                try:
                    c.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS indexador_base_data TEXT')
                except Exception:
                    pass
                try:
                    c.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS preco_medio NUMERIC')
                except Exception:
                    pass
                # Campos adicionais de Renda Fixa
                try:
                    c.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS data_aplicacao TEXT')
                except Exception:
                    pass
                try:
                    c.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS vencimento TEXT')
                except Exception:
                    pass
                try:
                    c.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS isento_ir BOOLEAN')
                except Exception:
                    pass
                try:
                    c.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS liquidez_diaria BOOLEAN')
                except Exception:
                    pass
                try:
                    c.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS preco_compra DECIMAL(10,2)')
                except Exception:
                    pass
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            try:
                cur.execute('ALTER TABLE carteira ADD COLUMN indexador TEXT')
            except Exception:
                pass
            try:
                cur.execute('ALTER TABLE carteira ADD COLUMN indexador_pct REAL')
            except Exception:
                pass
            try:
                cur.execute('ALTER TABLE carteira ADD COLUMN indexador_base_preco REAL')
            except Exception:
                pass
            try:
                cur.execute('ALTER TABLE carteira ADD COLUMN indexador_base_data TEXT')
            except Exception:
                pass
            try:
                cur.execute('ALTER TABLE carteira ADD COLUMN preco_medio REAL')
            except Exception:
                pass
            
            try:
                cur.execute('ALTER TABLE carteira ADD COLUMN data_aplicacao TEXT')
            except Exception:
                pass
            try:
                cur.execute('ALTER TABLE carteira ADD COLUMN vencimento TEXT')
            except Exception:
                pass
            try:
                cur.execute('ALTER TABLE carteira ADD COLUMN isento_ir INTEGER')
            except Exception:
                pass
            try:
                cur.execute('ALTER TABLE carteira ADD COLUMN liquidez_diaria INTEGER')
            except Exception:
                pass
            try:
                cur.execute('ALTER TABLE carteira ADD COLUMN preco_compra REAL')
            except Exception:
                pass
            conn.commit()
        finally:
            conn.close()

def create_asset_type(nome: str):
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Não autenticado"}
    if not nome or not nome.strip():
        return {"success": False, "message": "Nome inválido"}
    _ensure_asset_types_schema()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('INSERT INTO asset_types (nome, created_at) VALUES (%s, %s) ON CONFLICT (nome) DO NOTHING', (nome.strip(), now))
        finally:
            conn.close()
        return {"success": True}
    db_path = get_db_path(usuario, "carteira")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        cur = conn.cursor()
        try:
            cur.execute('INSERT OR IGNORE INTO asset_types (nome, created_at) VALUES (?, ?)', (nome.strip(), now))
            conn.commit()
        finally:
            conn.close()
        return {"success": True}
    except Exception as e:
        return {"success": False, "message": str(e)}

def rename_asset_type(old: str, new: str):
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Não autenticado"}
    if not old or not new or not new.strip():
        return {"success": False, "message": "Nome inválido"}
    _ensure_asset_types_schema()
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('UPDATE asset_types SET nome=%s WHERE nome=%s', (new.strip(), old))
                # Atualizar carteira para refletir novo nome
                c.execute('UPDATE carteira SET tipo=%s WHERE tipo=%s', (new.strip(), old))
        finally:
            conn.close()
        return {"success": True}
    db_path = get_db_path(usuario, "carteira")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        cur = conn.cursor()
        cur.execute('UPDATE asset_types SET nome=? WHERE nome=?', (new.strip(), old))
        cur.execute('UPDATE carteira SET tipo=? WHERE tipo=?', (new.strip(), old))
        conn.commit()
        return {"success": True}
    finally:
        conn.close()

def _validate_rf_catalog_item(item: dict):
    print(f"DEBUG: _validate_rf_catalog_item: Validando item: {item}")

    if not item.get('nome') or not str(item.get('nome')).strip():
        print("DEBUG: Nome é obrigatório")
        return { 'valid': False, 'message': 'Nome é obrigatório' }
    if not item.get('emissor') or not str(item.get('emissor')).strip():
        print("DEBUG: Emissor é obrigatório")
        return { 'valid': False, 'message': 'Emissor é obrigatório' }
    if not item.get('tipo') or not str(item.get('tipo')).strip():
        print("DEBUG: Tipo é obrigatório")
        return { 'valid': False, 'message': 'Tipo é obrigatório' }
    if not item.get('indexador') or not str(item.get('indexador')).strip():
        print("DEBUG: Indexador é obrigatório")
        return { 'valid': False, 'message': 'Indexador é obrigatório' }
    

    try:
        quantidade_val = float(item.get('quantidade', 0)) if item.get('quantidade') else 0
        preco_val = float(item.get('preco', 0)) if item.get('preco') else 0
        taxa_percentual_val = float(item.get('taxa_percentual', 100)) if item.get('taxa_percentual') else 100
        taxa_fixa_val = float(item.get('taxa_fixa', 0)) if item.get('taxa_fixa') else 0
        print(f"DEBUG: Valores convertidos - quantidade: {quantidade_val}, preco: {preco_val}, taxa_percentual: {taxa_percentual_val}, taxa_fixa: {taxa_fixa_val}")
    except (ValueError, TypeError) as e:
        print(f"DEBUG: Erro na conversão de valores: {e}")
        return { 'valid': False, 'message': 'Quantidade, preço e taxas devem ser números válidos' }
    
    if quantidade_val <= 0:
        print("DEBUG: Quantidade deve ser maior que zero")
        return { 'valid': False, 'message': 'Quantidade deve ser maior que zero' }
    if preco_val <= 0:
        print("DEBUG: Preço deve ser maior que zero")
        return { 'valid': False, 'message': 'Preço deve ser maior que zero' }
    if taxa_percentual_val < 0 or taxa_percentual_val > 1000:
        print("DEBUG: Taxa percentual deve estar entre 0 e 1000")
        return { 'valid': False, 'message': 'Taxa percentual deve estar entre 0 e 1000' }
    if taxa_fixa_val < 0 or taxa_fixa_val > 50:
        print("DEBUG: Taxa fixa deve estar entre 0 e 50%")
        return { 'valid': False, 'message': 'Taxa fixa deve estar entre 0 e 50%' }
    

    liquidez_diaria = bool(item.get('liquidez_diaria', False))
    isento_ir = bool(item.get('isento_ir', False))
    

    data = {
        'nome': str(item.get('nome')).strip(),
        'emissor': str(item.get('emissor')).strip(),
        'tipo': str(item.get('tipo')).strip(),
        'indexador': str(item.get('indexador')).strip(),
        'taxa_percentual': taxa_percentual_val,
        'taxa_fixa': taxa_fixa_val,
        'quantidade': quantidade_val,
        'preco': preco_val,
        'data_inicio': item.get('data_inicio') or None,
        'vencimento': item.get('vencimento') or None,
        'liquidez_diaria': liquidez_diaria,
        'isento_ir': isento_ir,
        'observacao': str(item.get('observacao', '')).strip() or None
    }
    
    print(f"DEBUG: Dados validados: {data}")
    return { 'valid': True, 'data': data }

def _ensure_rf_catalog_schema():
    print("DEBUG: _ensure_rf_catalog_schema chamada")

    usuario = get_usuario_atual()
    if not usuario:
        print("_ensure_rf_catalog_schema: Usuário não autenticado")
        return False
    
    print(f"DEBUG: _ensure_rf_catalog_schema: Usuário {usuario} autenticado")
    

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                try:
                    print(f"_ensure_rf_catalog_schema: Criando tabela para usuário {usuario}")
                   
                    # Verificar se a tabela já existe
                    c.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = current_schema() 
                            AND table_name = 'rf_catalog'
                        )
                    """)
                    table_exists = c.fetchone()[0]
                    print(f"_ensure_rf_catalog_schema: Tabela existe? {table_exists}")
                    
                    if not table_exists:
                        c.execute('''
                        CREATE TABLE rf_catalog (
                            id SERIAL PRIMARY KEY,
                            nome TEXT NOT NULL,
                            emissor TEXT,
                            tipo TEXT,
                            indexador TEXT,
                            taxa_percentual NUMERIC,
                            taxa_fixa NUMERIC,
                            quantidade NUMERIC,
                            preco NUMERIC,
                            data_inicio TEXT,
                            vencimento TEXT,
                            liquidez_diaria INTEGER DEFAULT 0,
                            isento_ir INTEGER DEFAULT 0,
                            observacao TEXT,
                            created_at TEXT,
                            updated_at TEXT
                        )
                    ''')
                        print(f"_ensure_rf_catalog_schema: Tabela PostgreSQL criada com sucesso")
                    else:
                        print(f"_ensure_rf_catalog_schema: Tabela PostgreSQL já existe")
                    
                    return True
                except Exception as e:
                    print(f"Erro ao criar tabela rf_catalog PostgreSQL: {e}")
                    import traceback
                    traceback.print_exc()
                    return False
        finally:
            try:
                conn.close()
            except:
                pass
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
          
            cur.execute('''
                CREATE TABLE IF NOT EXISTS rf_catalog (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    emissor TEXT,
                    tipo TEXT,
                    indexador TEXT,
                    taxa_percentual NUMERIC,
                    taxa_fixa NUMERIC,
                    quantidade NUMERIC,
                    preco NUMERIC,
                    data_inicio TEXT,
                    vencimento TEXT,
                    liquidez_diaria INTEGER DEFAULT 0,
                    isento_ir INTEGER DEFAULT 0,
                    observacao TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            ''')
            conn.commit()
            print(f"_ensure_rf_catalog_schema: Tabela SQLite criada/verificada com sucesso")
            return True
        except Exception as e:
            print(f"Erro ao criar tabela rf_catalog SQLite: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            try:
                conn.close()
            except:
                pass

def rf_catalog_list():

    usuario = get_usuario_atual()
    if not usuario:
        print("rf_catalog_list: Usuário não autenticado")
        return []
    
    schema_created = _ensure_rf_catalog_schema()
    if not schema_created:
        print("rf_catalog_list: Falha ao criar/verificar schema")
        return []
    
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                try:
                    # Verificar se a tabela existe
                    c.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = current_schema() 
                            AND table_name = 'rf_catalog'
                        )
                    """)
                    table_exists = c.fetchone()[0]
                    print(f"rf_catalog_list: Tabela existe? {table_exists}")
                    
                    if not table_exists:
                        print(f"rf_catalog_list: Tabela não existe, criando...")
                        _ensure_rf_catalog_schema()
                    
                    c.execute('''
                        SELECT id, nome, emissor, tipo, indexador, taxa_percentual, taxa_fixa, 
                               quantidade, preco, data_inicio, vencimento, liquidez_diaria, 
                               isento_ir, observacao 
                        FROM rf_catalog 
                        ORDER BY nome ASC
                    ''')
                    rows = c.fetchall()
                    print(f"rf_catalog_list: Encontrados {len(rows)} itens para usuário {usuario}")
                    
                    def safe_convert(value, convert_func):
                        try:
                            return convert_func(value) if value is not None else None
                        except (ValueError, TypeError):
                            return None
                    
                    result = [
                        {
                            'id': r[0], 
                            'nome': r[1], 
                            'emissor': r[2], 
                            'tipo': r[3], 
                            'indexador': r[4],
                            'taxa_percentual': safe_convert(r[5], float),
                            'taxa_fixa': safe_convert(r[6], float),
                            'quantidade': safe_convert(r[7], float),
                            'preco': safe_convert(r[8], float),
                            'data_inicio': str(r[9]) if r[9] else None,
                            'vencimento': str(r[10]) if r[10] else None,
                            'liquidez_diaria': bool(r[11]) if r[11] else False,
                            'isento_ir': bool(r[12]) if r[12] else False,
                            'observacao': r[13]
                        } for r in rows
                    ]
                    print(f"rf_catalog_list: Retornando {len(result)} itens")
                    return result
                except Exception as e:
                    print(f"Erro ao listar rf_catalog PostgreSQL: {e}")
                    import traceback
                    traceback.print_exc()
                    return []
        finally:
            try:
                conn.close()
            except:
                pass
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            cur.execute('''
                SELECT id, nome, emissor, tipo, indexador, taxa_percentual, taxa_fixa, 
                       quantidade, preco, data_inicio, vencimento, liquidez_diaria, 
                       isento_ir, observacao 
                FROM rf_catalog 
                ORDER BY nome ASC
            ''')
            rows = cur.fetchall()
            
            def safe_float(value):
                try:
                    return float(value) if value is not None else None
                except (ValueError, TypeError):
                    return None
            
            result = [
                {
                    'id': r[0], 
                    'nome': r[1], 
                    'emissor': r[2], 
                    'tipo': r[3], 
                    'indexador': r[4],
                    'taxa_percentual': safe_float(r[5]),
                    'taxa_fixa': safe_float(r[6]),
                    'quantidade': safe_float(r[7]),
                    'preco': safe_float(r[8]),
                    'data_inicio': r[9], 
                    'vencimento': r[10],
                    'liquidez_diaria': bool(r[11]) if r[11] else False,
                    'isento_ir': bool(r[12]) if r[12] else False,
                    'observacao': r[13]
                } for r in rows
            ]
            print(f"rf_catalog_list: Retornando {len(result)} itens SQLite")
            return result
        except Exception as e:
            print(f"Erro ao listar rf_catalog SQLite: {e}")
            import traceback
            traceback.print_exc()
            return []
        finally:
            try:
                conn.close()
            except:
                pass
def rf_catalog_create(item: dict):
    print(f"DEBUG: rf_catalog_create chamada com item: {item}")

    usuario = get_usuario_atual()
    if not usuario:
        print("DEBUG: Usuário não autenticado")
        return { 'success': False, 'message': 'Não autenticado' }
    
    print(f"DEBUG: Usuário autenticado: {usuario}")
    
    schema_created = _ensure_rf_catalog_schema()
    if not schema_created:
        print("DEBUG: Falha ao criar/verificar schema")
        return { 'success': False, 'message': 'Falha ao criar/verificar schema' }
    
    print("DEBUG: Schema verificado com sucesso")

    validation_result = _validate_rf_catalog_item(item)
    if not validation_result['valid']:
        print(f"DEBUG: Validação falhou: {validation_result['message']}")
        return { 'success': False, 'message': validation_result['message'] }
    
    print("DEBUG: Validação passou")

    data = validation_result['data']
    print(f"DEBUG: Dados validados: {data}")
    
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                try:
                    # Verificar se a tabela existe
                    c.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = current_schema() 
                            AND table_name = 'rf_catalog'
                        )
                    """)
                    table_exists = c.fetchone()[0]
                    print(f"rf_catalog_create: Tabela existe? {table_exists}")
                    
                    if not table_exists:
                        print(f"rf_catalog_create: Tabela não existe, criando...")
                        _ensure_rf_catalog_schema()

                    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    c.execute('''
                        INSERT INTO rf_catalog (nome, emissor, tipo, indexador, taxa_percentual, taxa_fixa, 
                                               quantidade, preco, data_inicio, vencimento, liquidez_diaria, 
                                               isento_ir, observacao, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    ''', (
                        data['nome'], data['emissor'], data['tipo'], data['indexador'],
                        data['taxa_percentual'], data['taxa_fixa'], data['quantidade'], data['preco'],
                        data['data_inicio'], data['vencimento'], data['liquidez_diaria'], 
                        data['isento_ir'], data['observacao'], now, now
                    ))
                    new_id = c.fetchone()[0]
                    print(f"rf_catalog_create: Item PostgreSQL criado com ID {new_id}")
                    return { 'success': True, 'id': new_id }
                except Exception as e:
                    print(f"Erro ao inserir em rf_catalog PostgreSQL: {e}")
                    import traceback
                    traceback.print_exc()
                    return { 'success': False, 'message': f'Erro ao inserir: {str(e)}' }
        finally:
            try:
                conn.close()
            except:
                pass
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
      
            cur.execute('''
                INSERT INTO rf_catalog (nome, emissor, tipo, indexador, taxa_percentual, taxa_fixa, 
                                       quantidade, preco, data_inicio, vencimento, liquidez_diaria, 
                                       isento_ir, observacao, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                data['nome'], data['emissor'], data['tipo'], data['indexador'],
                data['taxa_percentual'], data['taxa_fixa'], data['quantidade'], data['preco'],
                data['data_inicio'], data['vencimento'], data['liquidez_diaria'], 
                data['isento_ir'], data['observacao'], now, now
            ))
            conn.commit()
            new_id = cur.lastrowid
            print(f"rf_catalog_create: Item SQLite criado com ID {new_id}")
            return { 'success': True, 'id': new_id }
        except Exception as e:
            print(f"Erro ao inserir em rf_catalog SQLite: {e}")
            import traceback
            traceback.print_exc()
            return { 'success': False, 'message': f'Erro ao inserir: {str(e)}' }
        finally:
            try:
                conn.close()
            except:
                pass

def rf_catalog_update(id_: int, item: dict):

    usuario = get_usuario_atual()
    if not usuario:
        return { 'success': False, 'message': 'Não autenticado' }
    
    schema_created = _ensure_rf_catalog_schema()
    if not schema_created:
        return { 'success': False, 'message': 'Falha ao criar/verificar schema' }
    
  
    validation_result = _validate_rf_catalog_item(item)
    if not validation_result['valid']:
        return { 'success': False, 'message': validation_result['message'] }
    

    data = validation_result['data']
    
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                try:
                    print(f"rf_catalog_update: Atualizando item {id_} PostgreSQL para usuário {usuario}")

                    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    c.execute('''
                        UPDATE rf_catalog SET nome=%s, emissor=%s, tipo=%s, indexador=%s, taxa_percentual=%s, 
                                             taxa_fixa=%s, quantidade=%s, preco=%s, data_inicio=%s, vencimento=%s, 
                                             liquidez_diaria=%s, isento_ir=%s, observacao=%s, updated_at=%s
                        WHERE id=%s
                    ''', (
                        data['nome'], data['emissor'], data['tipo'], data['indexador'],
                        data['taxa_percentual'], data['taxa_fixa'], data['quantidade'], data['preco'],
                        data['data_inicio'], data['vencimento'], data['liquidez_diaria'], 
                        data['isento_ir'], data['observacao'], now, id_
                    ))
                    print(f"rf_catalog_update: Item {id_} PostgreSQL atualizado com sucesso")
                    return { 'success': True }
                except Exception as e:
                    print(f"Erro ao atualizar rf_catalog PostgreSQL: {e}")
                    import traceback
                    traceback.print_exc()
                    return { 'success': False, 'message': f'Erro ao atualizar: {str(e)}' }
        finally:
            try:
                conn.close()
            except:
                pass
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            cur.execute('''
                UPDATE rf_catalog SET nome=?, emissor=?, tipo=?, indexador=?, taxa_percentual=?, 
                                     taxa_fixa=?, quantidade=?, preco=?, data_inicio=?, vencimento=?, 
                                     liquidez_diaria=?, isento_ir=?, observacao=?, updated_at=?
                WHERE id=?
            ''', (
                data['nome'], data['emissor'], data['tipo'], data['indexador'],
                data['taxa_percentual'], data['taxa_fixa'], data['quantidade'], data['preco'],
                data['data_inicio'], data['vencimento'], data['liquidez_diaria'], 
                data['isento_ir'], data['observacao'], now, id_
            ))
            conn.commit()
            print(f"rf_catalog_update: Item {id_} SQLite atualizado com sucesso")
            return { 'success': True }
        except Exception as e:
            print(f"Erro ao atualizar rf_catalog SQLite: {e}")
            import traceback
            traceback.print_exc()
            return { 'success': False, 'message': f'Erro ao atualizar: {str(e)}' }
        finally:
            try:
                conn.close()
            except:
                pass

def rf_catalog_delete(id_: int):

    usuario = get_usuario_atual()
    if not usuario:
        return { 'success': False, 'message': 'Não autenticado' }
    
    schema_created = _ensure_rf_catalog_schema()
    if not schema_created:
        return { 'success': False, 'message': 'Falha ao criar/verificar schema' }
    
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                try:
                    print(f"rf_catalog_delete: Removendo item {id_} PostgreSQL para usuário {usuario}")
                    c.execute('DELETE FROM rf_catalog WHERE id=%s', (id_,))
                    print(f"rf_catalog_delete: Item {id_} PostgreSQL removido com sucesso")
                    return { 'success': True }
                except Exception as e:
                    print(f"Erro ao deletar rf_catalog PostgreSQL: {e}")
                    import traceback
                    traceback.print_exc()
                    return { 'success': False, 'message': f'Erro ao deletar: {str(e)}' }
        finally:
            try:
                conn.close()
            except:
                pass
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            print(f"rf_catalog_delete: Removendo item {id_} SQLite para usuário {usuario}")
            cur.execute('DELETE FROM rf_catalog WHERE id=?', (id_,))
            conn.commit()
            print(f"rf_catalog_delete: Item {id_} SQLite removido com sucesso")
            return { 'success': True }
        except Exception as e:
            print(f"Erro ao deletar rf_catalog SQLite: {e}")
            import traceback
            traceback.print_exc()
            return { 'success': False, 'message': f'Erro ao deletar: {str(e)}' }
        finally:
            try:
                conn.close()
            except:
                pass
def delete_asset_type(nome: str):
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Não autenticado"}
    if not nome:
        return {"success": False, "message": "Nome inválido"}
    _ensure_asset_types_schema()
   
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('SELECT COUNT(1) FROM carteira WHERE tipo=%s', (nome,))
                cnt = c.fetchone()[0]
                if cnt and int(cnt) > 0:
                    return {"success": False, "message": "Existem ativos com esse tipo"}
                c.execute('DELETE FROM asset_types WHERE nome=%s', (nome,))
        finally:
            conn.close()
        return {"success": True}
    db_path = get_db_path(usuario, "carteira")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        cur = conn.cursor()
        cur.execute('SELECT COUNT(1) FROM carteira WHERE tipo=?', (nome,))
        cnt = cur.fetchone()[0]
        if cnt and int(cnt) > 0:
            conn.close()
            return {"success": False, "message": "Existem ativos com esse tipo"}
        cur.execute('DELETE FROM asset_types WHERE nome=?', (nome,))
        conn.commit()
        return {"success": True}
    finally:
        conn.close()
def set_usuario_atual(username):
   
    global USUARIO_ATUAL
    with SESSION_LOCK:
        USUARIO_ATUAL = username

def _create_sessions_table_if_needed():
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            with conn.cursor() as c:
                c.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.sessoes (
                        token TEXT PRIMARY KEY,
                        username TEXT NOT NULL,
                        expira_em BIGINT NOT NULL
                    )
                    """
                )
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        try:
            c = conn.cursor()
            c.execute(
                '''CREATE TABLE IF NOT EXISTS sessoes (
                    token TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    expira_em INTEGER NOT NULL
                )'''
            )
            conn.commit()
        finally:
            conn.close()

def criar_sessao(username: str, duracao_segundos: int = 3600) -> str:
  
    _create_sessions_table_if_needed()
    token = secrets.token_urlsafe(32)
    expira_em = int(time.time()) + int(duracao_segundos)
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            with conn.cursor() as c:
                c.execute('INSERT INTO public.sessoes (token, username, expira_em) VALUES (%s, %s, %s) ON CONFLICT (token) DO UPDATE SET username = EXCLUDED.username, expira_em = EXCLUDED.expira_em', (token, username, expira_em))
            return token
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        try:
            c = conn.cursor()
            c.execute('INSERT OR REPLACE INTO sessoes (token, username, expira_em) VALUES (?, ?, ?)', (token, username, expira_em))
            conn.commit()
            return token
        finally:
            conn.close()

def invalidar_sessao(token: str) -> None:
    try:
        if _is_postgres():
            conn = _get_pg_conn()
            try:
                with conn.cursor() as c:
                    c.execute('DELETE FROM public.sessoes WHERE token = %s', (token,))
            finally:
                conn.close()
        else:
            conn = sqlite3.connect(USUARIOS_DB_PATH)
            c = conn.cursor()
            c.execute('DELETE FROM sessoes WHERE token = ?', (token,))
            conn.commit()
    except Exception:
        pass
    finally:
        try:
            conn.close()
        except Exception:
            pass

def invalidar_todas_sessoes() -> None:
    
    try:
        _create_sessions_table_if_needed()
        if _is_postgres():
            conn = _get_pg_conn()
            try:
                with conn.cursor() as c:
                    c.execute('DELETE FROM public.sessoes')
            finally:
                conn.close()
        else:
            conn = sqlite3.connect(USUARIOS_DB_PATH)
            c = conn.cursor()
            c.execute('DELETE FROM sessoes')
            conn.commit()
    except Exception:
        pass
    finally:
        try:
            conn.close()
        except Exception:
            pass
def get_usuario_atual():
    print("DEBUG: get_usuario_atual chamada")
   
    try:
        from flask import request, g
    except Exception:
        request = None
        g = None
   
    if g is not None:
        try:
            cached_user = getattr(g, "_usuario_atual_cached")
            print(f"DEBUG: get_usuario_atual: Usuário em cache: {cached_user}")
            return cached_user
        except Exception:
            pass
    try:
        token = request.cookies.get('session_token') if request else None
        print(f"DEBUG: get_usuario_atual: Token encontrado: {bool(token)}")
        if not token:
            print("DEBUG: get_usuario_atual: Nenhum token encontrado")
            if g is not None:
                try:
                    setattr(g, "_usuario_atual_cached", None)
                except Exception:
                    pass
            return None
        _create_sessions_table_if_needed()
        if _is_postgres():
            conn = _get_pg_conn()
            try:
                with conn.cursor() as c:
                    c.execute('SELECT username, expira_em FROM public.sessoes WHERE token = %s', (token,))
                    row = c.fetchone()
                    if not row:
                        print("DEBUG: get_usuario_atual: Token não encontrado no banco")
                        if g is not None:
                            try:
                                setattr(g, "_usuario_atual_cached", None)
                            except Exception:
                                pass
                        return None
                    username, expira_em = row
                    print(f"DEBUG: get_usuario_atual: Token encontrado para usuário {username}, expira em {expira_em}")
                    if int(expira_em) < int(time.time()):
                        print("DEBUG: get_usuario_atual: Token expirado")
                        try:
                            c.execute('DELETE FROM public.sessoes WHERE token = %s', (token,))
                        except Exception:
                            pass
                        if g is not None:
                            try:
                                setattr(g, "_usuario_atual_cached", None)
                            except Exception:
                                pass
                        return None
                    if g is not None:
                        try:
                            setattr(g, "_usuario_atual_cached", username)
                        except Exception:
                            pass
                    print(f"DEBUG: get_usuario_atual: Retornando usuário {username}")
                    return username
            finally:
                try:
                    conn.close()
                except Exception:
                    pass
        else:
            conn = sqlite3.connect(USUARIOS_DB_PATH)
            try:
                c = conn.cursor()
                c.execute('SELECT username, expira_em FROM sessoes WHERE token = ?', (token,))
                row = c.fetchone()
                if not row:
                    print("DEBUG: get_usuario_atual: Token não encontrado no banco SQLite")
                    if g is not None:
                        try:
                            setattr(g, "_usuario_atual_cached", None)
                        except Exception:
                            pass
                    return None
                username, expira_em = row
                print(f"DEBUG: get_usuario_atual: Token encontrado para usuário {username}, expira em {expira_em}")
                if expira_em < int(time.time()):
                    print("DEBUG: get_usuario_atual: Token expirado")
                    try:
                        c.execute('DELETE FROM sessoes WHERE token = ?', (token,))
                        conn.commit()
                    except Exception:
                        pass
                    if g is not None:
                        try:
                            setattr(g, "_usuario_atual_cached", None)
                        except Exception:
                            pass
                    return None
                if g is not None:
                    try:
                        setattr(g, "_usuario_atual_cached", username)
                    except Exception:
                        pass
                print(f"DEBUG: get_usuario_atual: Retornando usuário {username}")
                return username
            finally:
                conn.close()
    except Exception as e:
        print(f"DEBUG: get_usuario_atual: Exceção: {e}")
        return None

def limpar_cache_usuario(username):
    """
    Limpa todo o cache relacionado a um usuário específico.
    Esta função deve ser chamada no logout para garantir que nenhum dado
    do usuário permaneça em cache após o logout.
    
    Args:
        username: Nome do usuário cujo cache deve ser limpo
    """
    if not username or not cache:
        return
    
    try:
        # Lista de todas as chaves de cache conhecidas que usam username
        # Chaves fixas (sem parâmetros variáveis)
        chaves_fixas = [
            f"carteira:{username}",
            f"carteira_insights:{username}",
            f"goals:{username}",
        ]
        
        # Limpar chaves fixas
        for chave in chaves_fixas:
            try:
                cache.delete(chave)
            except Exception:
                pass
        
        # Chaves com parâmetros variáveis (mes, ano, periodo)
        # Vamos tentar limpar as combinações mais comuns dos últimos 2 anos
        from datetime import datetime
        ano_atual = datetime.now().year
        anos = [str(ano_atual - 1), str(ano_atual), str(ano_atual + 1)]
        meses = [f"{i:02d}" for i in range(1, 13)]
        periodos = ['1m', '3m', '6m', '12m']
        
        # Limpar chaves com parâmetros (mes, ano)
        # Padrões: movimentacoes, marmitas, receitas, outros, saldo, receitas_despesas, home_resumo
        prefixos_mes_ano = [
            f"movimentacoes:{username}",
            f"marmitas:{username}",
            f"receitas:{username}",
            f"outros:{username}",
            f"saldo:{username}",
            f"receitas_despesas:{username}",
            f"home_resumo:{username}",
        ]
        
        for prefixo in prefixos_mes_ano:
            for ano in anos:
                for mes in meses:
                    chave = f"{prefixo}:{mes}:{ano}"
                    try:
                        cache.delete(chave)
                    except Exception:
                        pass
                # Também tentar sem mes (string vazia)
                chave = f"{prefixo}::{ano}"
                try:
                    cache.delete(chave)
                except Exception:
                    pass
        
        # Limpar chaves com período (marmitas_gastos)
        for periodo in periodos:
            chave = f"marmitas_gastos:{username}:{periodo}"
            try:
                cache.delete(chave)
            except Exception:
                pass
        
        # Limpar cache do Flask g (request-scoped, mas por segurança)
        try:
            from flask import g
            if g is not None:
                try:
                    # Se o usuário em cache é o que está fazendo logout, limpar
                    cached_user = getattr(g, "_usuario_atual_cached", None)
                    if cached_user == username:
                        setattr(g, "_usuario_atual_cached", None)
                except Exception:
                    pass
        except Exception:
            pass
        
        print(f"[SEGURANÇA] Cache limpo para usuário: {username}")
        
    except Exception as e:
        # Não falhar o logout se houver erro ao limpar cache
        print(f"[AVISO] Erro ao limpar cache do usuário {username}: {e}")
        pass

def limpar_sessoes_expiradas():
    try:
        _create_sessions_table_if_needed()
        agora = int(time.time())
        if _is_postgres():
            conn = _get_pg_conn()
            try:
                with conn.cursor() as c:
                    c.execute('DELETE FROM public.sessoes WHERE expira_em < %s', (agora,))
            finally:
                conn.close()
        else:
            conn = sqlite3.connect(USUARIOS_DB_PATH)
            c = conn.cursor()
            c.execute('DELETE FROM sessoes WHERE expira_em < ?', (agora,))
            conn.commit()
    except Exception:
        pass
    finally:
        try:
            conn.close()
        except Exception:
            pass

def get_db_path(usuario, tipo_db):

    if not usuario:
        raise ValueError("Usuário não especificado")
    

    current_dir = os.path.dirname(os.path.abspath(__file__))
    

    db_dir = os.path.join(current_dir, "bancos_usuarios", usuario)
    os.makedirs(db_dir, exist_ok=True)
    
    db_path = os.path.join(db_dir, f"{tipo_db}.db")
    return db_path



_base_dir = os.path.dirname(os.path.abspath(__file__))
_legacy_path = os.path.join(_base_dir, "usuarios.db")  
_auth_dir = os.path.join(_base_dir, "bancos_usuarios", "_auth")
try:
    os.makedirs(_auth_dir, exist_ok=True)
except Exception:
    pass
_default_persist_path = os.path.join(_auth_dir, "usuarios.db")


env_db = os.getenv("USUARIOS_DB_PATH")
if env_db:
    USUARIOS_DB_PATH = env_db
else:
    USUARIOS_DB_PATH = _legacy_path if os.path.exists(_legacy_path) else _default_persist_path




try:
    from .assets_lists import LISTA_ACOES, LISTA_FIIS, LISTA_BDRS
except ImportError:
    from assets_lists import LISTA_ACOES, LISTA_FIIS, LISTA_BDRS

df_ativos = None
carregamento_em_andamento = False
lock = threading.Lock()  


cache = Cache(config={'CACHE_TYPE': 'SimpleCache'})

global_state = {"df_ativos": None, "carregando": False}

def carregar_ativos():
    acoes = LISTA_ACOES
    fiis = LISTA_FIIS
    bdrs = LISTA_BDRS
    
    try:
        print("🔄 Iniciando carregamento de ativos...")
        


        acoes_filtradas = processar_ativos(acoes, 'Ação')
        bdrs_filtradas = processar_ativos(bdrs, 'BDR')
        fiis_filtradas = processar_ativos(fiis, 'FII')



        ativos_filtrados = acoes_filtradas + bdrs_filtradas + fiis_filtradas

        if not ativos_filtrados:
            print(" Nenhum ativo foi carregado. Algo deu errado!")
            return

        df_ativos = pd.DataFrame(ativos_filtrados)
        
        if df_ativos.empty:
            print(" O DataFrame gerado está vazio! Verifique os filtros.")
        else:
            print(f" Carregamento concluído! {len(df_ativos)} ativos carregados.")
            print(f" Colunas disponíveis: {df_ativos.columns.tolist()}")

        global_state["df_ativos"] = df_ativos

    except Exception as e:
        print(f" Erro no carregamento dos ativos: {e}")


@cache.memoize(timeout=1800)  # Cache de 30 minutos para preços históricos
def obter_preco_historico(ticker, data, max_retentativas=3):

    def to_float_or_none(valor):
        try:
            result = float(valor)
            return result if result != float('inf') and result > 0 else None
        except (ValueError, TypeError):
            return None

    tentativas = 0
    while tentativas < max_retentativas:
        try:
            print(f"🔍 Buscando preço histórico para {ticker} na data {data}...")
            
        
            ticker_yf = ticker.strip().upper()
            if '-' not in ticker_yf and '.' not in ticker_yf and len(ticker_yf) <= 6:
                ticker_yf += '.SA'
            
            acao = yf.Ticker(ticker_yf)
            
         
            if isinstance(data, str):
                data_obj = datetime.strptime(data[:10], '%Y-%m-%d').date()
            else:
                data_obj = data
            
       
            start_date = data_obj - timedelta(days=30)
            end_date = data_obj + timedelta(days=1)
            
            historico = acao.history(start=start_date.isoformat(), end=end_date.isoformat())
            
            if historico is None or historico.empty:
                print(f"[ERRO] Nenhum historico encontrado para {ticker}")
                return None
            
           
            preco_encontrado = None
            for idx, row in historico[::-1].iterrows():
                data_historico = idx.date()
                if data_historico <= data_obj:
                    preco_encontrado = to_float_or_none(row.get('Close') or row.get('Adj Close'))
                    if preco_encontrado:
                        print(f"[OK] Preco encontrado: R$ {preco_encontrado:.2f} em {data_historico}")
                        return {
                            "preco": preco_encontrado,
                            "data_historico": data_historico.isoformat(),
                            "data_solicitada": data_obj.isoformat(),
                            "ticker": ticker
                        }
            
            print(f"[ERRO] Nenhum preco valido encontrado para {ticker} na data {data}")
            return None
            
        except Exception as e:
            tentativas += 1
            print(f"[AVISO] Tentativa {tentativas} falhou para {ticker}: {str(e)}")
            if tentativas >= max_retentativas:
                print(f"[ERRO] Falha definitiva ao buscar preco historico para {ticker}")
                return None
            time.sleep(1)
    
    return None

def obter_preco_atual(ticker, max_retentativas=3):

    tentativas = 0
    while tentativas < max_retentativas:
        try:
            print(f"🔍 Buscando preço atual para {ticker}...")
            
         
            ticker_yf = ticker.strip().upper()
            if '-' not in ticker_yf and '.' not in ticker_yf and len(ticker_yf) <= 6:
                ticker_yf += '.SA'
            
            acao = yf.Ticker(ticker_yf)
            info = acao.info
            
            if not info:
                return None
            
            preco_atual = info.get("currentPrice")
            if preco_atual is None:
                preco_atual = info.get("regularMarketPrice")
            
            if preco_atual and preco_atual > 0:
                print(f"[OK] Preco atual encontrado: R$ {preco_atual:.2f}")
                return {
                    "preco": float(preco_atual),
                    "data": datetime.now().strftime('%Y-%m-%d'),
                    "ticker": ticker
                }
            
            return None
            
        except Exception as e:
            tentativas += 1
            print(f"[AVISO] Tentativa {tentativas} falhou para {ticker}: {str(e)}")
            if tentativas >= max_retentativas:
                return None
            time.sleep(1)
    
    return None

def obter_informacoes(ticker, tipo_ativo, max_retentativas=3):
    def to_float_or_inf(valor):
        try:
            result = float(valor)
            return result if result != float('inf') else None
        except (ValueError, TypeError):
            return None

    tentativas = 0
    while tentativas < max_retentativas:
        try:
            print(f"🔍 Buscando informações para {ticker}...")

            acao = yf.Ticker(ticker)
            info = acao.info

           
            if not info:
                return None


            if tipo_ativo == 'FII':
                if not info.get("longName") and not info.get("shortName"):
                    print(f" Ativo {ticker} não encontrado na API do Yahoo Finance. Ignorando...")
                    return None
            else:

                if "sector" not in info:
                    print(f" Ativo {ticker} não encontrado na API do Yahoo Finance. Ignorando...")
                    return None

            preco_atual = info.get("currentPrice")
            if preco_atual is None:
                preco_atual = info.get("regularMarketPrice") or 0.0
            roe_raw = info.get("returnOnEquity", 0.0)
            dividend_yield_api = info.get("dividendYield")
            average_volume = info.get("averageVolume") or 0  
            liquidez_diaria = preco_atual * average_volume

            trailing_pe_raw = info.get("trailingPE")
            price_to_book_raw = info.get("priceToBook")

            pl = to_float_or_inf(trailing_pe_raw)
            if pl is None:
                pl = float('inf') if tipo_ativo != 'FII' else 0.0
            pvp = to_float_or_inf(price_to_book_raw)
            if pvp is None:
                pvp = float('inf') if tipo_ativo != 'FII' else 0.0

            roe = round(roe_raw * 100, 2) if roe_raw else 0.0
            

            if dividend_yield_api is None:
                dividend_yield = 0.0
            elif tipo_ativo == 'FII':
                dividend_yield = round((dividend_yield_api * 100) if dividend_yield_api < 1 else dividend_yield_api, 2)
            else:
                dividend_yield = round(dividend_yield_api, 6)
                
            setor = info.get("sector", "").strip() or "Desconhecido"

            return {
                "ticker": ticker,
                "nome_completo": info.get("longName", ""),
                "setor": setor,
                "industria": info.get("industry", ""),
                "website": info.get("website", ""),
                "roe": roe,
                "preco_atual": preco_atual,
                "dividend_yield": dividend_yield,
                "pl": pl,
                "pvp": pvp,
                "pais": info.get("country", ""),
                "tipo": tipo_ativo,
                "liquidez_diaria": liquidez_diaria,
                "volume_medio": average_volume,
            }

        except Exception as e:
            msg_erro = str(e).lower()
            if "too many requests" in msg_erro or "rate limited" in msg_erro:
                print(f"[AVISO] Rate limit detectado para {ticker}. Aguardando 60s e tentando novamente...")
                time.sleep(60)
                tentativas += 1
            else:
                print(f" Erro ao obter informações para {ticker}: {e}")
                return None

    print(f"[AVISO] Nao foi possivel obter {ticker} apos {max_retentativas} tentativas. Ignorando...")
    return None
def aplicar_filtros_acoes(dados):

    return sorted([
        ativo for ativo in dados if (
            ativo['roe'] >= 15 and
            ativo['dividend_yield'] > 12 and
            1 <= ativo['pl'] <= 15 and
            ativo['pvp'] <= 2
        )
    ], key=lambda x: x['dividend_yield'], reverse=True)[:10]


def aplicar_filtros_bdrs(dados):

    return sorted([
        ativo for ativo in dados if (
            ativo['roe'] >= 15 and
            ativo['dividend_yield'] > 3 and
            1 <= ativo['pl'] <= 15 and
            ativo['pvp'] <= 3
        )
    ], key=lambda x: x['dividend_yield'], reverse=True)[:10]


def aplicar_filtros_fiis(dados):
    return sorted([
        ativo for ativo in dados if (
            12 <= ativo['dividend_yield'] <= 15 and
            ativo.get("liquidez_diaria", 0) > 1000_000
        )
    ], key=lambda x: x['dividend_yield'], reverse=True)[:10]



def processar_ativos(lista, tipo):
    """Processa lista de ativos em paralelo para melhor performance"""
    if not lista:
        return []
    
    # OTIMIZAÇÃO: Aumentado para 200 workers (com 8GB RAM e 2 vCPUs, suporta bem)
    # Processa muito mais rápido sem sobrecarregar o yfinance
    dados = []
    max_workers = min(len(lista), 200)  # Até 200 workers simultâneos
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submete todas as tarefas
        future_to_ticker = {
            executor.submit(obter_informacoes, ticker, tipo): ticker 
            for ticker in lista
        }
        
        # Coleta resultados conforme terminam
        # Delay menor (a cada 50 requisições) para não sobrecarregar yfinance
        completed_count = 0
        for future in as_completed(future_to_ticker):
            try:
                resultado = future.result()
                if resultado is not None:
                    dados.append(resultado)
                completed_count += 1
                # Delay a cada 50 requisições para evitar rate limit do yfinance
                if completed_count % 50 == 0:
                    time.sleep(0.1)  # 100ms de pausa
            except Exception as e:
                ticker = future_to_ticker[future]
                print(f"Erro ao processar {ticker}: {str(e)}")
                continue 

    print(f"🔍 {tipo}: {len(dados)} ativos recuperados antes dos filtros.")

    if not dados:
        print(f" Nenhum ativo válido foi encontrado para {tipo}. Verifique a API.")
        return []

    ativos_filtrados = (
        aplicar_filtros_acoes(dados) if tipo == 'Ação' else
        aplicar_filtros_bdrs(dados) if tipo == 'BDR' else
        aplicar_filtros_fiis(dados) if tipo == 'FII' else
        []
    )


    ativos_rejeitados = set(d['ticker'] for d in dados) - set(d['ticker'] for d in ativos_filtrados)
    print(f" {len(ativos_rejeitados)} {tipo}s foram rejeitados pelos filtros: {ativos_rejeitados}")

    print(f" {len(ativos_filtrados)} {tipo}s passaram nos filtros.")
    return ativos_filtrados



def formatar_dados(ativos):

    for ativo in ativos:
        ativo['preco_atual_display'] = formatar_numero(ativo.get('preco_atual', 0), 'preco')
        ativo['roe_display'] = formatar_numero(ativo.get('roe', 0), 'percentual')
        if ativo["dividend_yield"] is not None:
            ativo["dividend_yield_display"] = f"{ativo['dividend_yield'] * 100:.2f}%".replace(".", ",")
        else:
            ativo["dividend_yield_display"] = "N/A"  


    return ativos


def formatar_numero(numero, tipo='preco'):

    if tipo == 'preco':
        return f'R$ {numero:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    elif tipo == 'percentual':
        return f'{numero:.2f}%'.replace('.', ',')
    return numero


def obter_todas_informacoes(ticker):
    try:
        acao = yf.Ticker(ticker)
        print(f"Obtendo informações brutas para {ticker}...")
        info = acao.info
        historico = acao.history(period="max")

        return {
            "info": info if info else {},
            "historico": historico,
            "dividends": acao.dividends,
            "splits": acao.splits,
            "recomendacoes": acao.recommendations,
            "sustainability": acao.sustainability,
            "holders": acao.major_holders,
            "earnings": acao.earnings,
            "quarterly_earnings": acao.quarterly_earnings,
            "balance_sheet": acao.balance_sheet,
            "cashflow": acao.cashflow,
            "quarterly_balance_sheet": acao.quarterly_balance_sheet,
            "quarterly_cashflow": acao.quarterly_cashflow,
            "financials": acao.financials,
            "quarterly_financials": acao.quarterly_financials
        }
    except Exception as e:
        print(f"Erro ao obter informações para {ticker}: {e}")
        return None



def criar_tabela_usuarios():
    """Cria a tabela de usuários e adiciona campos role e email se não existirem (migration)"""
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            with conn.cursor() as c:
                c.execute('''
                    CREATE TABLE IF NOT EXISTS public.usuarios (
                        id SERIAL PRIMARY KEY,
                        nome TEXT NOT NULL,
                        username TEXT UNIQUE NOT NULL,
                        senha_hash TEXT NOT NULL,
                        pergunta_seguranca TEXT,
                        resposta_seguranca_hash TEXT,
                        data_cadastro TIMESTAMP NOT NULL
                    )
                ''')
                # Adicionar campos role e email se não existirem (migration)
                try:
                    c.execute('ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS role TEXT DEFAULT \'usuario\'')
                except Exception:
                    pass
                try:
                    c.execute('ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS email TEXT')
                except Exception:
                    pass
                # Adicionar campo auth_provider para identificar tipo de login (google/proprietario)
                try:
                    c.execute('ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT \'proprietario\'')
                except Exception:
                    pass
                conn.commit()
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                username TEXT UNIQUE NOT NULL,
                senha_hash TEXT NOT NULL,
                pergunta_seguranca TEXT,
                resposta_seguranca_hash TEXT,
                data_cadastro TEXT NOT NULL
            )
        ''')
        conn.commit()
        
        # Adicionar campos role e email se não existirem (migration)
        try:
            c.execute('ALTER TABLE usuarios ADD COLUMN role TEXT DEFAULT \'usuario\'')
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Coluna já existe
        
        try:
            c.execute('ALTER TABLE usuarios ADD COLUMN email TEXT')
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Coluna já existe
        
        # Adicionar campo auth_provider para identificar tipo de login (google/proprietario)
        try:
            c.execute('ALTER TABLE usuarios ADD COLUMN auth_provider TEXT DEFAULT \'proprietario\'')
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Coluna já existe
        
        conn.close()

def cadastrar_usuario(nome, username, senha, pergunta_seguranca=None, resposta_seguranca=None, email=None, role='usuario'):
    """Cadastra um novo usuário. Por padrão, role é 'usuario'. Admins devem ser criados manualmente."""
    senha_hash = bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    data_cadastro = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    resposta_hash = None
    if pergunta_seguranca and resposta_seguranca:
        resposta_hash = bcrypt.hashpw(resposta_seguranca.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            with conn.cursor() as c:
                try:
                    c.execute('''
                        INSERT INTO public.usuarios (nome, username, senha_hash, pergunta_seguranca, resposta_seguranca_hash, data_cadastro, email, role, auth_provider)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (nome, username, senha_hash, pergunta_seguranca, resposta_hash, data_cadastro, email, role, 'proprietario'))
                    conn.commit()
                    return True
                except Exception:
                    return False
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        c = conn.cursor()
        try:
            c.execute('''INSERT INTO usuarios (nome, username, senha_hash, pergunta_seguranca, resposta_seguranca_hash, data_cadastro, email, role, auth_provider) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                      (nome, username, senha_hash, pergunta_seguranca, resposta_hash, data_cadastro, email, role, 'proprietario'))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
        finally:
            conn.close()

def buscar_usuario_por_username(username):
    """Busca usuário por username, incluindo role e email"""
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            with conn.cursor() as c:
                # Buscar todos os campos, incluindo role, email e auth_provider
                c.execute('''
                    SELECT id, nome, username, senha_hash, pergunta_seguranca, resposta_seguranca_hash, data_cadastro,
                           COALESCE(role, 'usuario') as role, email, COALESCE(auth_provider, 'proprietario') as auth_provider
                    FROM public.usuarios WHERE username = %s
                ''', (username,))
                row = c.fetchone()
                if row:
                    return {
                        'id': row[0],
                        'nome': row[1],
                        'username': row[2],
                        'senha_hash': row[3],
                        'pergunta_seguranca': row[4],
                        'resposta_seguranca_hash': row[5],
                        'data_cadastro': row[6],
                        'role': row[7] if len(row) > 7 else 'usuario',
                        'email': row[8] if len(row) > 8 else None,
                        'auth_provider': row[9] if len(row) > 9 else 'proprietario'
                    }
                return None
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        c = conn.cursor()
        # Buscar todos os campos, incluindo role, email e auth_provider
        c.execute('''
            SELECT id, nome, username, senha_hash, pergunta_seguranca, resposta_seguranca_hash, data_cadastro,
                   COALESCE(role, 'usuario') as role, email, COALESCE(auth_provider, 'proprietario') as auth_provider
            FROM usuarios WHERE username = ?
        ''', (username,))
        row = c.fetchone()
        conn.close()
        if row:
            return {
                'id': row[0],
                'nome': row[1],
                'username': row[2],
                'senha_hash': row[3],
                'pergunta_seguranca': row[4],
                'resposta_seguranca_hash': row[5],
                'data_cadastro': row[6],
                'role': row[7] if len(row) > 7 else 'usuario',
                'email': row[8] if len(row) > 8 else None,
                'auth_provider': row[9] if len(row) > 9 else 'proprietario'
            }
        return None

def buscar_usuario_por_email(email):
    """Busca usuário por email (para Google OAuth)"""
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            with conn.cursor() as c:
                c.execute('''
                    SELECT id, nome, username, senha_hash, pergunta_seguranca, resposta_seguranca_hash, data_cadastro,
                           COALESCE(role, 'usuario') as role, email, COALESCE(auth_provider, 'proprietario') as auth_provider
                    FROM public.usuarios WHERE email = %s
                ''', (email,))
                row = c.fetchone()
                if row:
                    return {
                        'id': row[0],
                        'nome': row[1],
                        'username': row[2],
                        'senha_hash': row[3],
                        'pergunta_seguranca': row[4],
                        'resposta_seguranca_hash': row[5],
                        'data_cadastro': row[6],
                        'role': row[7] if len(row) > 7 else 'usuario',
                        'email': row[8] if len(row) > 8 else None,
                        'auth_provider': row[9] if len(row) > 9 else 'proprietario'
                    }
                return None
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        c = conn.cursor()
        c.execute('''
            SELECT id, nome, username, senha_hash, pergunta_seguranca, resposta_seguranca_hash, data_cadastro,
                   COALESCE(role, 'usuario') as role, email, COALESCE(auth_provider, 'proprietario') as auth_provider
            FROM usuarios WHERE email = ?
        ''', (email,))
        row = c.fetchone()
        conn.close()
        if row:
            return {
                'id': row[0],
                'nome': row[1],
                'username': row[2],
                'senha_hash': row[3],
                'pergunta_seguranca': row[4],
                'resposta_seguranca_hash': row[5],
                'data_cadastro': row[6],
                'role': row[7] if len(row) > 7 else 'usuario',
                'email': row[8] if len(row) > 8 else None,
                'auth_provider': row[9] if len(row) > 9 else 'proprietario'
            }
        return None

def criar_usuario_google(nome, email, google_id=None):
    """Cria um novo usuário a partir do login Google. Username será derivado do email."""
    # Gerar username a partir do email (parte antes do @)
    username_base = email.split('@')[0].lower()
    username = username_base
    
    # Se username já existe, adicionar sufixo numérico
    contador = 1
    while buscar_usuario_por_username(username):
        username = f"{username_base}{contador}"
        contador += 1
    
    # Criar senha hash vazio (usuários Google não têm senha)
    # Usar um hash aleatório para evitar problemas com NULL
    senha_hash = bcrypt.hashpw(b"google_oauth_no_password", bcrypt.gensalt()).decode('utf-8')
    data_cadastro = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            with conn.cursor() as c:
                try:
                    c.execute('''
                        INSERT INTO public.usuarios (nome, username, senha_hash, pergunta_seguranca, resposta_seguranca_hash, data_cadastro, email, role, auth_provider)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (nome, username, senha_hash, None, None, data_cadastro, email, 'usuario', 'google'))
                    conn.commit()
                    return username
                except Exception as e:
                    print(f"Erro ao criar usuário Google: {e}")
                    return None
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        c = conn.cursor()
        try:
            c.execute('''INSERT INTO usuarios (nome, username, senha_hash, pergunta_seguranca, resposta_seguranca_hash, data_cadastro, email, role, auth_provider) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                      (nome, username, senha_hash, None, None, data_cadastro, email, 'usuario', 'google'))
            conn.commit()
            return username
        except sqlite3.IntegrityError as e:
            print(f"Erro ao criar usuário Google: {e}")
            return None
        finally:
            conn.close()

def verificar_senha(username, senha):
    usuario = buscar_usuario_por_username(username)
    if usuario:
        return bcrypt.checkpw(senha.encode('utf-8'), usuario['senha_hash'].encode('utf-8'))
    return False

def verificar_resposta_seguranca(username, resposta):
  
    usuario = buscar_usuario_por_username(username)
    if not usuario or not usuario['resposta_seguranca_hash']:
        return False
    
    return bcrypt.checkpw(resposta.encode('utf-8'), usuario['resposta_seguranca_hash'].encode('utf-8'))



def alterar_senha_direta(username, nova_senha):

    nova_senha_hash = bcrypt.hashpw(nova_senha.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            with conn.cursor() as c:
                c.execute('UPDATE public.usuarios SET senha_hash = %s WHERE username = %s', (nova_senha_hash, username))
                return True
        except Exception as e:
            print(f"Erro ao alterar senha: {e}")
            return False
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        c = conn.cursor()
        try:
            c.execute('UPDATE usuarios SET senha_hash = ? WHERE username = ?', (nova_senha_hash, username))
            conn.commit()
            return True
        except Exception as e:
            print(f"Erro ao alterar senha: {e}")
            return False
        finally:
            conn.close()

def atualizar_pergunta_seguranca(username, pergunta, resposta):
  
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            resposta_hash = bcrypt.hashpw(resposta.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            with conn.cursor() as c:
                c.execute('UPDATE public.usuarios SET pergunta_seguranca = %s, resposta_seguranca_hash = %s WHERE username = %s',
                          (pergunta, resposta_hash, username))
                return True
        except Exception as e:
            print(f"Erro ao atualizar pergunta de segurança: {e}")
            return False
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        c = conn.cursor()
        try:
            resposta_hash = bcrypt.hashpw(resposta.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            c.execute('UPDATE usuarios SET pergunta_seguranca = ?, resposta_seguranca_hash = ? WHERE username = ?', 
                      (pergunta, resposta_hash, username))
            conn.commit()
            return True
        except Exception as e:
            print(f"Erro ao atualizar pergunta de segurança: {e}")
            return False
        finally:
            conn.close()

def processar_ativos_com_filtros_geral(lista_ativos, tipo_ativo, roe_min, dy_min, pl_min, pl_max, pvp_max, liq_min=None, setor=None):
    """Processa lista de ativos com filtros em paralelo para melhor performance"""
    if not lista_ativos:
        return []
    
    # OTIMIZAÇÃO: Aumentado para 200 workers para processar muito mais rápido
    dados = []
    max_workers = min(len(lista_ativos), 200)  # Até 200 workers simultâneos
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submete todas as tarefas
        future_to_ticker = {
            executor.submit(obter_informacoes, ticker, tipo_ativo): ticker 
            for ticker in lista_ativos
        }
        
        # Coleta resultados conforme terminam
        for future in as_completed(future_to_ticker):
            try:
                resultado = future.result()
                if resultado is not None:
                    dados.append(resultado)
            except Exception as e:
                ticker = future_to_ticker[future]
                print(f"Erro ao processar {ticker}: {str(e)}")
                continue
    filtrados = [
        ativo for ativo in dados if (
            ativo['roe'] >= (roe_min or 0) and
            ativo['dividend_yield'] > (dy_min or 0) and
            (pl_min or 0) <= ativo['pl'] <= (pl_max or float('inf')) and
            ativo['pvp'] <= (pvp_max or float('inf')) and
            (ativo.get('liquidez_diaria', 0) > (liq_min or 0)) and
            (not setor or ativo.get('setor', '').strip() == setor.strip())
        )
    ]
    return sorted(filtrados, key=lambda x: x['dividend_yield'], reverse=True)[:10]

def processar_ativos_acoes_com_filtros(roe_min, dy_min, pl_min, pl_max, pvp_max, liq_min=None, setor=None):
    # Respeitar exatamente o valor informado pelo usuário (sem piso obrigatório)
    liq_threshold = int(liq_min or 0)
    return processar_ativos_com_filtros_geral(LISTA_ACOES, 'Ação', roe_min, dy_min, pl_min, pl_max, pvp_max, liq_threshold, setor)

def processar_ativos_bdrs_com_filtros(roe_min, dy_min, pl_min, pl_max, pvp_max, liq_min=None, setor=None):
    # Respeitar exatamente o valor informado pelo usuário (sem piso obrigatório)
    liq_threshold = int(liq_min or 0)
    return processar_ativos_com_filtros_geral(LISTA_BDRS, 'BDR', roe_min, dy_min, pl_min, pl_max, pvp_max, liq_threshold, setor)

def processar_ativos_fiis_com_filtros(dy_min, dy_max, liq_min, tipo_fii=None, segmento_fii=None):
    """Processa lista de FIIs com filtros em paralelo para melhor performance"""
    fiis = LISTA_FIIS
    if not fiis:
        return []
    
    # OTIMIZAÇÃO: Aumentado para 200 workers para processar muito mais rápido
    dados = []
    max_workers = min(len(fiis), 200)  # Até 200 workers simultâneos
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submete todas as tarefas
        future_to_ticker = {
            executor.submit(obter_informacoes, ticker, 'FII'): ticker 
            for ticker in fiis
        }
        
        # Coleta resultados conforme terminam
        for future in as_completed(future_to_ticker):
            try:
                resultado = future.result()
                if resultado is not None:
                    dados.append(resultado)
            except Exception as e:
                ticker = future_to_ticker[future]
                print(f"Erro ao processar FII {ticker}: {str(e)}")
                continue
    

    filtrados = [
        ativo for ativo in dados if (
            ativo['dividend_yield'] >= (dy_min or 0) and
            ativo['dividend_yield'] <= (dy_max or float('inf')) and
            ativo.get('liquidez_diaria', 0) > (liq_min or 0)
        )
    ]
    

    if tipo_fii or segmento_fii:
        filtrados_final = []
        for ativo in filtrados:
            ticker = ativo.get('ticker', '')
            

            try:
                from fii_scraper import obter_dados_fii_fundsexplorer
                metadata = obter_dados_fii_fundsexplorer(ticker)
                
                if metadata:
                    ativo_tipo = metadata.get('tipo')
                    ativo_segmento = metadata.get('segmento')
                    

                    if tipo_fii and ativo_tipo != tipo_fii:
                        continue
                        

                    if segmento_fii and ativo_segmento != segmento_fii:
                        continue
                        
                    # Adicionar metadados ao ativo
                    ativo['tipo_fii'] = ativo_tipo
                    ativo['segmento_fii'] = ativo_segmento
                    
                else:
                    # Se não conseguiu obter metadados, incluir apenas se não há filtros específicos
                    if not tipo_fii and not segmento_fii:
                        ativo['tipo_fii'] = None
                        ativo['segmento_fii'] = None
                    else:
                        continue
                        
            except Exception:
                # Em caso de erro, incluir apenas se não há filtros específicos
                if not tipo_fii and not segmento_fii:
                    ativo['tipo_fii'] = None
                    ativo['segmento_fii'] = None
                else:
                    continue
            
            filtrados_final.append(ativo)
        
        filtrados = filtrados_final
    
    return sorted(filtrados, key=lambda x: x['dividend_yield'], reverse=True)[:10]

# ==================== FUNÇÕES DE CARTEIRA ====================

def init_carteira_db(usuario=None):
    """Inicializar banco de dados de carteira para um usuário específico"""
    if not usuario:
        usuario = get_usuario_atual()
        if not usuario:
            raise ValueError("Usuário não especificado")
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS carteira (
                        id SERIAL PRIMARY KEY,
                        ticker TEXT NOT NULL,
                        nome_completo TEXT NOT NULL,
                        quantidade NUMERIC NOT NULL,
                        preco_atual NUMERIC NOT NULL,
                        valor_total NUMERIC NOT NULL,
                        data_adicao TEXT NOT NULL,
                        tipo TEXT DEFAULT 'Desconhecido',
                        dy NUMERIC,
                        pl NUMERIC,
                        pvp NUMERIC,
                        roe NUMERIC
                    )
                ''')
                # Garantir colunas adicionais usadas pelos selects da carteira
                try:
                    cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS preco_compra NUMERIC')
                    cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS preco_medio NUMERIC')
                    cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS indexador TEXT')
                    cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS indexador_pct NUMERIC')
                    cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS data_aplicacao TEXT')
                    cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS vencimento TEXT')
                    cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS isento_ir BOOLEAN')
                    cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS liquidez_diaria BOOLEAN')
                except Exception as _:
                    pass
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS historico_carteira (
                        id SERIAL PRIMARY KEY,
                        data TEXT NOT NULL,
                        valor_total NUMERIC NOT NULL
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS movimentacoes (
                        id SERIAL PRIMARY KEY,
                        data TEXT NOT NULL,
                        ticker TEXT NOT NULL,
                        nome_completo TEXT,
                        quantidade NUMERIC NOT NULL,
                        preco NUMERIC NOT NULL,
                        tipo TEXT NOT NULL
                    )
                ''')
                # ==================== ÍNDICES OTIMIZADOS PARA PERFORMANCE ====================
                # OTIMIZAÇÃO: Índices criados dentro do schema do usuário (isolamento garantido)
                
                # CARTEIRA - Índices críticos (maior impacto)
                # 1. valor_total DESC - usado em ORDER BY (query mais frequente)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_carteira_valor_total_desc ON carteira(valor_total DESC)")
                # 2. ticker - usado em WHERE e UPDATE (busca/atualização de ativos)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_carteira_ticker ON carteira(ticker)")
                # 3. tipo - usado em WHERE e COUNT (filtros por tipo)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_carteira_tipo ON carteira(tipo)")
                # 4. data_adicao - usado em ordenações e filtros temporais
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_carteira_data_adicao ON carteira(data_adicao)")
                # 5. indexador - usado em filtros de renda fixa
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_carteira_indexador ON carteira(indexador)")
                # 6. vencimento - usado em filtros de renda fixa
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_carteira_vencimento ON carteira(vencimento)")
                
                # MOVIMENTACOES - Índices críticos
                # 7. ticker + data (composto) - usado em WHERE ticker = ? ORDER BY data ASC (busca preço de compra)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_movimentacoes_ticker_data ON movimentacoes(ticker, data ASC)")
                # 8. data - usado em filtros por mês/ano (WHERE data >= ? AND data < ?)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(data)")
                # 9. ticker (individual) - usado em queries simples por ticker
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_movimentacoes_ticker ON movimentacoes(ticker)")
                # Configuração de rebalanceamento (uma linha por usuário)
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS rebalance_config (
                        id SERIAL PRIMARY KEY,
                        periodo TEXT NOT NULL,
                        targets_json TEXT NOT NULL,
                        start_date TEXT,
                        last_rebalance_date TEXT,
                        updated_at TEXT NOT NULL
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS rebalance_history (
                        id SERIAL PRIMARY KEY,
                        data TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                ''')
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        cursor = conn.cursor()
        # Tabela de carteira
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS carteira (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                nome_completo TEXT NOT NULL,
                quantidade INTEGER NOT NULL,
                preco_atual REAL NOT NULL,
                valor_total REAL NOT NULL,
                data_adicao TEXT NOT NULL,
                tipo TEXT DEFAULT 'Desconhecido',
                dy REAL,
                pl REAL,
                pvp REAL,
                roe REAL
            )
        ''')
        # Tabela de histórico
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS historico_carteira (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL,
                valor_total REAL NOT NULL
            )
        ''')
        # Tabela de movimentações
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS movimentacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL,
                ticker TEXT NOT NULL,
                nome_completo TEXT,
                quantidade REAL NOT NULL,
                preco REAL NOT NULL,
                tipo TEXT NOT NULL
            )
        ''')
        # Otimizações SQLite
        try:
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA synchronous=NORMAL;")
            cursor.execute("PRAGMA temp_store=MEMORY;")
        except Exception:
            pass
        # MOVIMENTACOES - Índices críticos (SQLite)
        # Índice composto ticker + data (usado em WHERE ticker = ? ORDER BY data ASC)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_movimentacoes_ticker_data ON movimentacoes(ticker, data ASC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(data)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_movimentacoes_ticker ON movimentacoes(ticker)")
        # OTIMIZAÇÃO: Índice DESC para ORDER BY valor_total DESC (query mais frequente)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_carteira_valor_total_desc ON carteira(valor_total DESC)")
        
        # Índices críticos para performance SQLite
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_carteira_ticker ON carteira(ticker)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_carteira_tipo ON carteira(tipo)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_carteira_data_adicao ON carteira(data_adicao)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_carteira_indexador ON carteira(indexador)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_carteira_vencimento ON carteira(vencimento)")
        # Configuração de rebalanceamento (uma linha por usuário)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rebalance_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                periodo TEXT NOT NULL,
                targets_json TEXT NOT NULL,
                start_date TEXT,
                last_rebalance_date TEXT,
                updated_at TEXT NOT NULL
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rebalance_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        ''')
        conn.commit()
        conn.close()

def obter_cotacao_dolar():

    try:
        cotacao = yf.Ticker("BRL=X").info.get("regularMarketPrice")
        return cotacao if cotacao else 5.0
    except:
        return 5.0

def _normalize_ticker_for_yf(ticker: str) -> str:

    try:
        t = (ticker or "").strip().upper()
        if not t:
            return t

        if '-' in t or '.' in t:
            return t
        
        if len(t) <= 6:
            return t + '.SA'
        return t
    except Exception:
        return (ticker or "").upper()

@cache.memoize(timeout=300)  # Cache de 5 minutos para preços individuais
def obter_informacoes_ativo(ticker):

    try:
       
        normalized = _normalize_ticker_for_yf(ticker)
        acao = yf.Ticker(normalized)
        info = acao.info or {}
        
        if not info and normalized != ticker:
            acao = yf.Ticker(ticker)
            info = acao.info or {}
        preco_atual = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
        
        tipo_map = {
            "EQUITY": "Ação",
            "ETF": "FII",
            "CRYPTOCURRENCY": "Criptomoeda",
            "CURRENCY": "Criptomoeda",
        }
        tipo_raw = info.get("quoteType", "Desconhecido")
        tipo = tipo_map.get(tipo_raw, "Desconhecido")
        
        if preco_atual is None:
            return None
            

        cotacao_brl = obter_cotacao_dolar()
        if tipo == "Criptomoeda":
            try:
                preco_atual = float(preco_atual) * float(cotacao_brl)
            except Exception:
                pass
            
        return {
            "ticker": ticker.upper(),
            "nome_completo": info.get("longName", "Desconhecido"),
            "preco_atual": preco_atual,
            "tipo": tipo,
            "pl": info.get("trailingPE"),
            "pvp": info.get("priceToBook"),
            "dy": info.get("dividendYield"),
            "roe": info.get("returnOnEquity"),
        }
    except Exception as e:
        print(f"Erro ao obter informações de {ticker}: {e}")
        return None

def obter_taxas_indexadores():
    """Obtém as taxas atuais dos indexadores (SELIC, CDI, IPCA)"""
    try:
        import requests
        from datetime import datetime, timedelta
        
        def sgs_last(series_id, use_range=False):
            try:
                if use_range:
                    end_date = datetime.now()
                    start_date = end_date - timedelta(days=90)
                    url = (f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series_id}/dados?"
                           f"formato=json&dataInicial={start_date.strftime('%d/%m/%Y')}"
                           f"&dataFinal={end_date.strftime('%d/%m/%Y')}")
                    r = requests.get(url, timeout=10)
                    r.raise_for_status()
                    arr = r.json()
                    return float(arr[-1]['valor']) if arr else None
                else:
                    url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series_id}/dados/ultimos/1?formato=json"
                    r = requests.get(url, timeout=10)
                    r.raise_for_status()
                    arr = r.json()
                    return float(arr[0]['valor']) if arr else None
            except Exception:
                return None
        
        # SELIC (série 432) - taxa anual
        selic = sgs_last(432, use_range=True)
        # CDI (série 12) - taxa anual
        cdi = sgs_last(12, use_range=True)
        # IPCA (série 433) - taxa mensal
        ipca = sgs_last(433)
        
        print(f"DEBUG: Taxas obtidas - SELIC: {selic}%, CDI: {cdi}%, IPCA: {ipca}%")
        
        # CORREÇÃO: Se as taxas estão muito baixas, usar valores padrão
        if cdi and cdi < 1.0:  # Se CDI < 1%, provavelmente está em decimal
            cdi = cdi * 100  # Converter para percentual
            print(f"DEBUG: CDI convertido de {cdi/100}% para {cdi}%")
        
        if selic and selic < 1.0:  # Se SELIC < 1%, provavelmente está em decimal
            selic = selic * 100  # Converter para percentual
            print(f"DEBUG: SELIC convertido de {selic/100}% para {selic}%")
        
        # FALLBACK: Se não conseguir obter taxas, usar valores padrão
        if not cdi or cdi < 5.0:  # CDI muito baixo, usar padrão
            cdi = 13.65
            print(f"DEBUG: CDI não obtido ou muito baixo, usando padrão: {cdi}%")
        
        if not selic or selic < 5.0:  # SELIC muito baixo, usar padrão
            selic = 13.75
            print(f"DEBUG: SELIC não obtido ou muito baixo, usando padrão: {selic}%")
        
        if not ipca or ipca < 0.1:  # IPCA muito baixo, usar padrão
            ipca = 0.5  # IPCA mensal padrão
            print(f"DEBUG: IPCA não obtido ou muito baixo, usando padrão: {ipca}%")
        
        return {
            "SELIC": selic,
            "CDI": cdi,
            "IPCA": ipca
        }
    except Exception as e:
        print(f"Erro ao obter taxas dos indexadores: {e}")
        return {"SELIC": None, "CDI": None, "IPCA": None}

def _obter_taxa_media_historica(indexador, data_inicio):
    """Obtém a taxa média histórica de um indexador desde uma data específica"""
    try:
        import requests
        from datetime import datetime, timedelta
        
        # Determinar série do indexador
        if indexador == "CDI":
            serie_id = 12
        elif indexador == "SELIC":
            serie_id = 432
        else:
            return 13.0  # Taxa padrão se não reconhecer
        
        # Calcular período desde a data de início
        data_fim = datetime.now()
        dias_periodo = (data_fim - data_inicio).days
        
        if dias_periodo <= 0:
            return 13.0
        
        # Buscar dados históricos do Banco Central
        try:
            url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie_id}/dados"
            params = {
                'formato': 'json',
                'dataInicial': data_inicio.strftime('%d/%m/%Y'),
                'dataFinal': data_fim.strftime('%d/%m/%Y')
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            dados = response.json()
            
            if not dados:
                print(f"DEBUG: Nenhum dado histórico encontrado para {indexador}")
                return 13.0
            
            # Calcular média das taxas
            taxas = []
            for item in dados:
                try:
                    taxa = float(item['valor'])
                    if taxa > 0:
                        taxas.append(taxa)
                except (ValueError, KeyError):
                    continue
            
            if not taxas:
                print(f"DEBUG: Nenhuma taxa válida encontrada para {indexador}")
                return 13.0
            
            # Calcular média ponderada (mais recente tem mais peso)
            if len(taxas) == 1:
                taxa_media = taxas[0]
            else:
                # Peso decrescente para dados mais recentes
                pesos = [i + 1 for i in range(len(taxas))]
                taxa_media = sum(t * p for t, p in zip(taxas, pesos)) / sum(pesos)
            
            print(f"DEBUG: Taxa média histórica {indexador} desde {data_inicio.strftime('%Y-%m-%d')}: {taxa_media:.2f}%")
            return taxa_media
            
        except Exception as e:
            print(f"DEBUG: Erro ao buscar dados históricos para {indexador}: {e}")
            return 13.0
            
    except Exception as e:
        print(f"DEBUG: Erro geral ao obter taxa média histórica: {e}")
        return 13.0
def _obter_ipca_medio_historico(data_inicio):
    """Obtém o IPCA médio mensal histórico desde uma data específica"""
    try:
        import requests
        from datetime import datetime
        
        # Buscar IPCA mensal (série 433)
        try:
            url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados"
            params = {
                'formato': 'json',
                'dataInicial': data_inicio.strftime('%d/%m/%Y'),
                'dataFinal': datetime.now().strftime('%d/%m/%Y')
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            dados = response.json()
            
            if not dados:
                print("DEBUG: Nenhum dado histórico de IPCA encontrado")
                return 0.5  # IPCA mensal padrão
            
            # Calcular média do IPCA mensal
            ipcas = []
            for item in dados:
                try:
                    ipca = float(item['valor'])
                    if ipca > 0:
                        ipcas.append(ipca)
                except (ValueError, KeyError):
                    continue
            
            if not ipcas:
                print("DEBUG: Nenhum IPCA válido encontrado")
                return 0.5
            
            ipca_medio = sum(ipcas) / len(ipcas)
            print(f"DEBUG: IPCA médio mensal desde {data_inicio.strftime('%Y-%m-%d')}: {ipca_medio:.2f}%")
            return ipca_medio
            
        except Exception as e:
            print(f"DEBUG: Erro ao buscar IPCA histórico: {e}")
            return 0.5
            
    except Exception as e:
        print(f"DEBUG: Erro geral ao obter IPCA médio: {e}")
        return 0.5

def _obter_taxa_atual_indexador(indexador):
    """Obtém a taxa atual de um indexador usando a mesma abordagem que já funciona"""
    try:
        import requests
        from datetime import datetime, timedelta
        
        # Determinar série do indexador
        if indexador == "CDI":
            serie_id = 12
        elif indexador == "SELIC":
            serie_id = 432
        elif indexador == "IPCA":
            serie_id = 433
        else:
            return 13.0  # Taxa padrão se não reconhecer
        
        # Buscar dados atuais do Banco Central
        try:
            url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie_id}/dados/ultimos/1?formato=json"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            dados = response.json()
            
            if not dados:
                print(f"DEBUG: Nenhum dado atual encontrado para {indexador}")
                return 13.0 if indexador in ["CDI", "SELIC"] else 0.5
            
            # Obter a taxa mais recente
            taxa = float(dados[0]['valor'])
            
            # Para IPCA, já vem em percentual mensal
            if indexador == "IPCA":
                print(f"DEBUG: IPCA atual: {taxa}% mensal")
                return taxa
            
            # Para CDI/SELIC, verificar se está em decimal
            if taxa < 1.0:  # Se está em decimal, converter para percentual
                taxa = taxa * 100
                print(f"DEBUG: {indexador} convertido de decimal para percentual: {taxa}%")
            
            print(f"DEBUG: {indexador} atual: {taxa}% a.a.")
            return taxa
            
        except Exception as e:
            print(f"DEBUG: Erro ao buscar taxa atual para {indexador}: {e}")
            return 13.0 if indexador in ["CDI", "SELIC"] else 0.5
            
    except Exception as e:
        print(f"DEBUG: Erro geral ao obter taxa atual: {e}")
        return 13.0 if indexador in ["CDI", "SELIC"] else 0.5

def calcular_preco_com_indexador(preco_inicial, indexador, indexador_pct, data_adicao):
    """Calcula o preço atual baseado no indexador e percentual - USANDO ABORDAGEM QUE JÁ FUNCIONA"""
    from math import isfinite
    try:
        # CONVERSÃO EXPLÍCITA E VALIDAÇÃO CRÍTICA DE TIPOS (fix para PostgreSQL)
        # PostgreSQL pode retornar NUMERIC como Decimal ou string, precisamos garantir float
        try:
            preco_inicial = float(preco_inicial) if preco_inicial is not None else None
        except (ValueError, TypeError):
            print(f"[ERRO CRITICO] Preco inicial invalido: {preco_inicial} (tipo: {type(preco_inicial)})")
            return None
        
        try:
            indexador_pct = float(indexador_pct) if indexador_pct is not None else None
        except (ValueError, TypeError):
            print(f"[ERRO CRITICO] Indexador_pct invalido: {indexador_pct} (tipo: {type(indexador_pct)})")
            return preco_inicial
        
        # Validações básicas
        if preco_inicial is None or preco_inicial <= 0:
            print(f"[ERRO] Preco inicial invalido ou zero: {preco_inicial}")
            return preco_inicial if preco_inicial else None
        
        if not indexador or indexador_pct is None:
            print(f"[ERRO] Indexador ou percentual faltando: indexador={indexador}, pct={indexador_pct}")
            return preco_inicial
        
        # VALIDAÇÃO CRÍTICA: indexador_pct deve ser um valor razoável (entre 0.1 e 1000)
        # Valores muito altos ou muito baixos indicam erro de conversão
        if indexador_pct < 0.1 or indexador_pct > 1000:
            print(f"[ERRO CRITICO] Indexador_pct fora do range esperado: {indexador_pct}% (esperado: 0.1-1000%)")
            return preco_inicial
        
        # Converter data de adição para datetime (aceitar múltiplos formatos)
        from datetime import datetime
        data_adicao_dt = None
        try:
            if isinstance(data_adicao, str):
                s = data_adicao.strip()
                # Remover sufixo 'Z' se presente e tentar múltiplos formatos comuns
                s_clean = s.replace('Z', '')
                for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
                    try:
                        data_adicao_dt = datetime.strptime(s_clean, fmt)
                        break
                    except Exception:
                        pass
                if data_adicao_dt is None:
                    try:
                        data_adicao_dt = datetime.fromisoformat(s_clean)
                    except Exception:
                        pass
            elif isinstance(data_adicao, datetime):
                data_adicao_dt = data_adicao
        except Exception:
            data_adicao_dt = None
        if data_adicao_dt is None:
            # Como último recurso, considerar hoje menos um dia para evitar zero dias
            data_adicao_dt = datetime.now()
        
        # Calcular dias desde a adição
        dias_totais = max((datetime.now() - data_adicao_dt).days, 0)
        
        # VALIDAÇÃO CRÍTICA: Verificar se a data não está no futuro
        if (datetime.now() - data_adicao_dt).days < 0:
            print(f"[ERRO] Data de adicao esta no futuro: {data_adicao_dt}. Retornando preco inicial.")
            return preco_inicial
        
        # VALIDAÇÃO CRÍTICA: Limitar dias a um máximo razoável (10 anos = 3650 dias)
        # Se a data for muito antiga, pode gerar cálculos absurdos
        if dias_totais > 3650:
            print(f"[AVISO] Data muito antiga ({dias_totais} dias = {dias_totais/365:.1f} anos). Limitando a 10 anos para calculo.")
            dias_totais = 3650
        
        if dias_totais <= 0:
            return preco_inicial
        
        print(f"DEBUG: Calculando valorização para {indexador} desde {data_adicao} ({dias_totais} dias)")
        print(f"DEBUG: Valores recebidos - preco_inicial: {preco_inicial} (tipo: {type(preco_inicial).__name__}), indexador_pct: {indexador_pct} (tipo: {type(indexador_pct).__name__})")
        
        # Aplicar percentual do indexador (ex: 110% = 1.1)
        # GARANTIR que indexador_pct é float antes da divisão
        fator_percentual = float(indexador_pct) / 100.0
        if fator_percentual <= 0 or fator_percentual > 10:
            print(f"[ERRO CRITICO] Fator percentual invalido: {fator_percentual} (indexador_pct={indexador_pct})")
            return preco_inicial

        # USAR A MESMA ABORDAGEM QUE JÁ FUNCIONA NA TELA DE DETALHES
        if indexador in ["SELIC", "CDI"]:
            # Usar a mesma lógica da função obter_historico_carteira_comparado
            taxa_anual = _obter_taxa_atual_indexador(indexador)
            print(f"DEBUG: Taxa atual {indexador}: {taxa_anual}% a.a.")
            
            # Aplicar taxa anual com percentual do indexador
            taxa_anual_indexada = taxa_anual * fator_percentual
            taxa_diaria = (1 + taxa_anual_indexada / 100) ** (1/252) - 1
            # Aproximação de dias úteis (252 por ano)
            dias_uteis_aprox = int(round(dias_totais * 252.0 / 365.0))
            fator_correcao = (1 + taxa_diaria) ** dias_uteis_aprox
            
            print(f"DEBUG: {indexador} taxa={taxa_anual}% | indexada={taxa_anual_indexada}% | diaria={taxa_diaria:.8f} | dias_uteis~={dias_uteis_aprox} | fator={fator_correcao:.6f}")
            
        elif indexador == "CDI+":
            # CDI+: CDI atual + taxa fixa prefixada
            taxa_cdi_atual = _obter_taxa_atual_indexador("CDI")
            taxa_fixa_anual = (indexador_pct or 0)
            taxa_total_anual = taxa_cdi_atual + taxa_fixa_anual
            
            taxa_diaria = (1 + taxa_total_anual / 100) ** (1/252) - 1
            dias_uteis_aprox = int(round(dias_totais * 252.0 / 365.0))
            fator_correcao = (1 + taxa_diaria) ** dias_uteis_aprox
            
            print(f"DEBUG: CDI+ CDI={taxa_cdi_atual}% + fixa={taxa_fixa_anual}% = {taxa_total_anual}% | diaria={taxa_diaria:.8f} | dias_uteis~={dias_uteis_aprox} | fator={fator_correcao:.6f}")
            
        elif indexador == "IPCA":
            # Para IPCA: usar IPCA atual mensal
            ipca_atual_mensal = _obter_taxa_atual_indexador("IPCA")
            meses_desde_adicao = dias_totais / 30.44
            taxa_mensal_indexada = ipca_atual_mensal * fator_percentual
            fator_correcao = (1 + taxa_mensal_indexada / 100) ** meses_desde_adicao
            
            print(f"DEBUG: IPCA mensal={ipca_atual_mensal}% | indexada={taxa_mensal_indexada}% | meses={meses_desde_adicao:.2f} | fator={fator_correcao:.6f}")
            
        elif indexador == "IPCA+":
            # IPCA+: IPCA atual + taxa fixa prefixada
            ipca_atual_mensal = _obter_taxa_atual_indexador("IPCA")
            taxa_fixa_mensal = (indexador_pct or 0) / 12  
            taxa_mensal_total = ipca_atual_mensal + taxa_fixa_mensal
            meses_desde_adicao = dias_totais / 30.44
            fator_correcao = (1 + taxa_mensal_total / 100) ** meses_desde_adicao
            
            print(f"DEBUG: IPCA+ IPCA={ipca_atual_mensal}% + fixa_mensal={taxa_fixa_mensal}% = {taxa_mensal_total}% | meses={meses_desde_adicao:.2f} | fator={fator_correcao:.6f}")
            
        elif indexador == "PREFIXADO":

            taxa_anual_decimal = (indexador_pct or 0) / 100.0
            taxa_diaria = (1 + taxa_anual_decimal) ** (1/365) - 1
            fator_correcao = (1 + taxa_diaria) ** dias_totais
            
            print(f"DEBUG: PREFIXADO anual={indexador_pct}% | diaria={taxa_diaria:.8f} | fator={fator_correcao:.6f}")
            
        else:
            print(f"DEBUG: Indexador não reconhecido: {indexador}")
            return preco_inicial
        
        # Preço final - GARANTIR que ambos são float antes da multiplicação
        preco_final = float(preco_inicial) * float(fator_correcao)
        
        # VALIDAÇÃO CRÍTICA FINAL: Verificar se o preço calculado é válido
        if preco_final <= 0 or not isinstance(preco_final, (int, float)) or not isfinite(preco_final):
            print(f"[ERRO CRITICO] Preco calculado invalido: {preco_final} (tipo: {type(preco_final).__name__}). Retornando preco inicial.")
            return preco_inicial
        
        # Validação do fator: para renda fixa, mesmo com 10 anos, o fator máximo seria ~3.5x (115% CDI)
        # Mas permitir até 20x para casos extremos (múltiplas aplicações ou períodos muito longos)
        if not (0.01 <= fator_correcao <= 20.0):
            print(f"[ERRO CRITICO] Fator de correcao absurdo: {fator_correcao}. Retornando preco inicial.")
            return preco_inicial
        
        # VALIDAÇÃO ADICIONAL: Preço final não pode ser muito diferente do inicial
        # Se o preço final for menor que 20% do inicial ou maior que 20x, há algo errado
        if preco_final < preco_inicial * 0.2 or preco_final > preco_inicial * 20.0:
            print(f"[ERRO CRITICO] Preco final fora do range esperado: inicial={preco_inicial}, final={preco_final} (fator={preco_final/preco_inicial:.4f}x). Retornando preco inicial.")
            return preco_inicial
        
        print(f"DEBUG: Preço inicial: {preco_inicial}, fator: {fator_correcao:.6f}, preço final: {preco_final}")
        
        return round(float(preco_final), 4)
        
    except Exception as e:
        print(f"[ERRO] Erro ao calcular preco com indexador: {e}")
        import traceback
        traceback.print_exc()
        return preco_inicial

@cache.memoize(timeout=300)  # Cache de 5 minutos para taxa USD/BRL
def obter_taxa_usd_brl():
    """
    Obtém a taxa de câmbio USD/BRL em tempo real
    Retorna o valor de 1 USD em BRL
    """
    try:
        print(" Buscando taxa USD/BRL...")
        
        # Buscar taxa USD/BRL usando yfinance
        usd_brl = yf.Ticker("BRL=X")
        info = usd_brl.info
        
        if info and 'currentPrice' in info and info['currentPrice']:
            taxa = float(info['currentPrice'])
            print(f" Taxa USD/BRL obtida: {taxa:.4f}")
            return taxa
        else:
            # Fallback: usar histórico mais recente
            hist = usd_brl.history(period="1d")
            if not hist.empty:
                taxa = float(hist['Close'].iloc[-1])
                print(f" Taxa USD/BRL (histórico): {taxa:.4f}")
                return taxa
            else:
                print(" Não foi possível obter taxa USD/BRL, usando taxa padrão")
                return 5.20  # Taxa padrão de fallback
                
    except Exception as e:
        print(f"[ERRO] Erro ao obter taxa USD/BRL: {e}")
        return 5.20  # Taxa padrão de fallback

def is_crypto_ticker(ticker):
    """
    Identifica se um ticker é uma criptomoeda
    """
    crypto_tickers = [
        'BTC', 'ETH', 'ADA', 'DOT', 'LINK', 'UNI', 'AAVE', 'COMP', 'MKR', 'SNX',
        'YFI', 'SUSHI', 'CRV', '1INCH', 'BAL', 'LRC', 'BAT', 'ZRX', 'REP', 'KNC',
        'BTC-USD', 'ETH-USD', 'ADA-USD', 'DOT-USD', 'LINK-USD', 'UNI-USD',
        'AAVE-USD', 'COMP-USD', 'MKR-USD', 'SNX-USD', 'YFI-USD', 'SUSHI-USD',"USDC-USD"
    ]
    
    ticker_upper = ticker.upper()
    return any(crypto in ticker_upper for crypto in crypto_tickers)

def converter_crypto_usd_para_brl(preco_usd, taxa_usd_brl=None):
    """
    Converte preço de criptomoeda de USD para BRL
    """
    if taxa_usd_brl is None:
        taxa_usd_brl = obter_taxa_usd_brl()
    
    return preco_usd * taxa_usd_brl

def obter_precos_batch(tickers):
    """
    Obtém preços de múltiplos tickers em uma única requisição
    Muito mais eficiente que fazer 1 requisição por ticker
    """
    if not tickers:
        return {}
    
    try:
        print(f"🔄 Buscando preços em batch para {len(tickers)} tickers...")
        
        # Obter taxa USD/BRL uma vez para todas as criptomoedas
        taxa_usd_brl = None
        tem_crypto = any(is_crypto_ticker(ticker) for ticker in tickers)
        if tem_crypto:
            taxa_usd_brl = obter_taxa_usd_brl()
        
        # OTIMIZAÇÃO: Processar em lotes de 200 tickers (limite seguro do yfinance)
        # yfinance suporta até ~2000 req/min, então 200 por batch com delay de 0.1s é seguro
        batch_size = 200
        precos_totais = {}
        
        for i in range(0, len(tickers), batch_size):
            batch_tickers = tickers[i:i + batch_size]
            print(f"🔄 Processando lote {i//batch_size + 1}/{(len(tickers) + batch_size - 1)//batch_size} ({len(batch_tickers)} tickers)")
            
            # Normalizar tickers para o formato do Yahoo Finance
            normalized_tickers = [_normalize_ticker_for_yf(ticker) for ticker in batch_tickers]
            
            # Buscar todos os preços de uma vez usando yfinance (batch nativo)
            ticker_objects = yf.Tickers(' '.join(normalized_tickers))
            
            # Processar cada ticker do lote atual em paralelo usando ThreadPoolExecutor
            def processar_ticker(idx, ticker):
                try:
                    normalized = normalized_tickers[idx]
                    ticker_obj = ticker_objects.tickers[normalized]
                
                    # Obter informações do ticker
                    info = ticker_obj.info
                    preco_usd = None
                    
                    if info and 'currentPrice' in info and info['currentPrice']:
                        preco_usd = float(info['currentPrice'])
                    else:
                        # Fallback: tentar obter preço do histórico
                        hist = ticker_obj.history(period="1d")
                        if not hist.empty:
                            preco_usd = float(hist['Close'].iloc[-1])
                    
                    if preco_usd is not None:
                        # Verificar se é criptomoeda e converter USD → BRL
                        if is_crypto_ticker(ticker) and taxa_usd_brl:
                            preco_brl = converter_crypto_usd_para_brl(preco_usd, taxa_usd_brl)
                            print(f" {ticker}: ${preco_usd:.2f} USD → R$ {preco_brl:.2f} BRL (taxa: {taxa_usd_brl:.4f})")
                            preco_final = preco_brl
                        else:
                            preco_final = preco_usd
                        
                        return (ticker, {
                            'preco_atual': preco_final,
                            'dy': info.get('dividendYield', None) if info else None,
                            'pl': info.get('trailingPE', None) if info else None,
                            'pvp': info.get('priceToBook', None) if info else None,
                            'roe': info.get('returnOnEquity', None) if info else None
                        })
                    else:
                        print(f"[AVISO] Nao foi possivel obter preco para {ticker}")
                        return None
                            
                except Exception as e:
                    print(f"[AVISO] Erro ao obter preco para {ticker}: {e}")
                    return None
            
            # Processar em paralelo com até 200 workers (um por ticker no batch)
            max_workers = min(len(batch_tickers), 200)
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {
                    executor.submit(processar_ticker, idx, ticker): ticker 
                    for idx, ticker in enumerate(batch_tickers)
                }
                
                for future in as_completed(futures):
                    resultado = future.result()
                    if resultado:
                        ticker, dados = resultado
                        precos_totais[ticker] = dados
            
            # Pequena pausa entre lotes para evitar rate limits (reduzido para 0.1s)
            if i + batch_size < len(tickers):
                time.sleep(0.1)  # 100ms de pausa entre lotes (suficiente com batch maior)
        
        print(f"[OK] Batch concluido: {len(precos_totais)} precos obtidos de {len(tickers)} tickers")
        return precos_totais
        
    except Exception as e:
        print(f"[ERRO] Erro no batch de precos: {e}")
        return {}

def atualizar_precos_indicadores_carteira():
  
    try:
        usuario = get_usuario_atual()
        if not usuario:
            return {"success": False, "message": "Usuário não autenticado"}
        
        print(f"DEBUG: Iniciando atualização de preços para usuário {usuario}")
        _ensure_indexador_schema()
        atualizados = 0
        erros = []
        
        # NOVA ABORDAGEM: Batch de preços
        tickers_para_buscar = []
        if _is_postgres():
            conn = _pg_conn_for_user(usuario)
            try:
                with conn.cursor() as c:
                    c.execute('SELECT id, ticker, quantidade, preco_atual, data_adicao, indexador, indexador_pct, indexador_base_preco, indexador_base_data, preco_compra, preco_medio FROM carteira')
                    rows = c.fetchall()
                    
                    # Coletar todos os tickers únicos
                    for row in rows:
                        _ticker = str(row[1] or '')
                        if _ticker and _ticker not in tickers_para_buscar:
                            tickers_para_buscar.append(_ticker)
                    
                    # Buscar todos os preços de uma vez
                    print(f"🔄 Buscando preços em batch para {len(tickers_para_buscar)} tickers...")
                    precos_batch = obter_precos_batch(tickers_para_buscar)
                    
                    # Processar cada ativo com os preços já obtidos
                    for row in rows:
                        _id, _ticker, _qtd = row[0], str(row[1] or ''), float(row[2] or 0)
                        _preco_atual = float(row[3] or 0)
                        _data_adicao = row[4]
                        _indexador = row[5]
                        # CONVERSÃO ROBUSTA para PostgreSQL (pode vir como Decimal, string, etc)
                        _indexador_pct_raw = row[6]
                        if _indexador_pct_raw is not None:
                            try:
                                # Tentar converter para float diretamente
                                if isinstance(_indexador_pct_raw, (int, float)):
                                    _indexador_pct = float(_indexador_pct_raw)
                                elif isinstance(_indexador_pct_raw, str):
                                    _indexador_pct = float(_indexador_pct_raw.replace(',', '.'))
                                else:
                                    # Para Decimal ou outros tipos do PostgreSQL
                                    _indexador_pct = float(str(_indexador_pct_raw))
                                
                                # Validação: deve ser um valor razoável
                                if _indexador_pct < 0.1 or _indexador_pct > 1000:
                                    print(f"[ERRO] Indexador_pct fora do range: {_indexador_pct}% para {_ticker}. Usando None.")
                                    _indexador_pct = None
                            except (ValueError, TypeError, AttributeError) as e:
                                print(f"[ERRO] Erro ao converter indexador_pct para {_ticker}: {_indexador_pct_raw} (tipo: {type(_indexador_pct_raw).__name__}) - {e}")
                                _indexador_pct = None
                        else:
                            _indexador_pct = None
                        base_preco = float(row[7]) if (len(row) > 7 and row[7] is not None) else None
                        base_data = row[8] if (len(row) > 8) else None
                        _preco_compra = float(row[9]) if (len(row) > 9 and row[9] is not None) else None
                        _preco_medio = float(row[10]) if (len(row) > 10 and row[10] is not None) else None
                        
                        if not _ticker:
                            continue
                        
                        # Determinar novo preco_atual e métricas
                        # CORREÇÃO CRÍTICA: Se tem indexador, calcular SEMPRE (mesmo que não esteja no batch)
                        if _indexador and _indexador_pct:
                            print(f"DEBUG: Ativo {_ticker} tem indexador {_indexador} com {_indexador_pct}%")
                            # Preço base - ORDEM DE PRIORIDADE CRÍTICA:
                            # 1. indexador_base_preco (se configurado explicitamente)
                            # 2. preco_compra (preço de compra original)
                            # 3. preco_medio (preço médio ponderado)
                            # 4. Primeira movimentação (último recurso)
                            # NUNCA usar preco_atual como base!
                            if base_preco is not None and base_data:
                                preco_inicial = base_preco
                                _data_adicao = base_data
                                print(f"DEBUG: Usando indexador_base_preco: {preco_inicial}")
                            elif _preco_compra is not None and _preco_compra > 0:
                                preco_inicial = _preco_compra
                                print(f"DEBUG: Usando preco_compra: {preco_inicial}")
                            elif _preco_medio is not None and _preco_medio > 0:
                                preco_inicial = _preco_medio
                                print(f"DEBUG: Usando preco_medio: {preco_inicial}")
                            else:
                                # Último recurso: buscar primeira movimentação
                                c.execute('SELECT preco FROM movimentacoes WHERE ticker = %s ORDER BY data ASC LIMIT 1', (_ticker,))
                                mov_row = c.fetchone()
                                if mov_row and mov_row[0] and float(mov_row[0]) > 0:
                                    preco_inicial = float(mov_row[0])
                                    print(f"DEBUG: Usando primeira movimentação: {preco_inicial}")
                                else:
                                    # Se não encontrou nada, pular este ativo (não atualizar)
                                    print(f"[ERRO CRITICO] Nao foi possivel determinar preco inicial para {_ticker} com indexador. Pulando atualizacao.")
                                    continue
                            
                            print(f"DEBUG: Preço inicial encontrado: {preco_inicial}, data: {_data_adicao}")
                            
                            # VALIDAÇÃO PRÉ-CÁLCULO: Garantir que preco_inicial é válido
                            if preco_inicial is None or preco_inicial <= 0 or not isinstance(preco_inicial, (int, float)):
                                print(f"[ERRO CRITICO] Preco inicial invalido para {_ticker}: {preco_inicial}. Pulando atualizacao.")
                                continue
                            
                            preco_atual = calcular_preco_com_indexador(preco_inicial, _indexador, _indexador_pct, _data_adicao)
                            

                            if preco_atual is None or not isinstance(preco_atual, (int, float)) or preco_atual <= 0:
                                print(f"[ERRO CRITICO] Preco calculado invalido (None/zero/nao-numerico) para {_ticker}: {preco_atual}. Mantendo preco inicial.")
                                preco_atual = preco_inicial
                            elif preco_atual < preco_inicial * 0.2 or preco_atual > preco_inicial * 20.0:
                                print(f"[ERRO CRITICO] Preco calculado absurdo para {_ticker}: inicial={preco_inicial}, calculado={preco_atual} (fator={preco_atual/preco_inicial:.4f}x). Mantendo preco inicial para evitar corrupcao.")
                                preco_atual = preco_inicial  # CORREÇÃO: Manter preço inicial, não o atual (que pode estar corrompido)
                            else:
                                print(f"DEBUG: Preço calculado com indexador: {preco_atual} (inicial: {preco_inicial}, fator: {preco_atual/preco_inicial:.4f}x)")
                            dy = None; pl = None; pvp = None; roe = None
                        elif _ticker in precos_batch:
                            # Se não tem indexador, usar preços do batch (yfinance)
                            dados_preco = precos_batch[_ticker]
                            preco_atual = dados_preco.get('preco_atual', _preco_atual)
                            dy = dados_preco.get('dy')
                            pl = dados_preco.get('pl')
                            pvp = dados_preco.get('pvp')
                            roe = dados_preco.get('roe')
                        else:
                            # Se não tem indexador e não está no batch, manter preço atual
                            preco_atual = _preco_atual
                            dy = None; pl = None; pvp = None; roe = None

                        # Persistir atualização
                        valor_total = preco_atual * _qtd
                        c.execute(
                            'UPDATE carteira SET preco_atual=%s, valor_total=%s, dy=%s, pl=%s, pvp=%s, roe=%s WHERE id=%s',
                            (preco_atual, valor_total, dy, pl, pvp, roe, _id)
                        )
                        atualizados += 1
                conn.commit()
            finally:
                conn.close()
        else:
            db_path = get_db_path(usuario, "carteira")
            conn = sqlite3.connect(db_path, check_same_thread=False)
            try:
                cur = conn.cursor()
                cur.execute('SELECT id, ticker, quantidade, preco_atual, data_adicao, indexador, indexador_pct, indexador_base_preco, indexador_base_data, preco_compra, preco_medio FROM carteira')
                rows = cur.fetchall()
                
                # Coletar todos os tickers únicos para SQLite também
                tickers_para_buscar = []
                for row in rows:
                    _ticker = str(row[1] or '')
                    if _ticker and _ticker not in tickers_para_buscar:
                        tickers_para_buscar.append(_ticker)
                
                # Buscar todos os preços de uma vez
                print(f"🔄 Buscando preços em batch para {len(tickers_para_buscar)} tickers (SQLite)...")
                precos_batch = obter_precos_batch(tickers_para_buscar)
                
                for row in rows:
                    _id, _ticker, _qtd = row[0], str(row[1] or ''), float(row[2] or 0)
                    _preco_atual = float(row[3] or 0)
                    _data_adicao = row[4]
                    _indexador = row[5]
                    # CONVERSÃO ROBUSTA para SQLite (consistência com PostgreSQL)
                    _indexador_pct_raw = row[6]
                    if _indexador_pct_raw is not None:
                        try:
                            if isinstance(_indexador_pct_raw, (int, float)):
                                _indexador_pct = float(_indexador_pct_raw)
                            elif isinstance(_indexador_pct_raw, str):
                                _indexador_pct = float(_indexador_pct_raw.replace(',', '.'))
                            else:
                                _indexador_pct = float(str(_indexador_pct_raw))
                            
                            # Validação: deve ser um valor razoável
                            if _indexador_pct < 0.1 or _indexador_pct > 1000:
                                print(f"[ERRO] Indexador_pct fora do range: {_indexador_pct}% para {_ticker}. Usando None.")
                                _indexador_pct = None
                        except (ValueError, TypeError, AttributeError) as e:
                            print(f"[ERRO] Erro ao converter indexador_pct para {_ticker}: {_indexador_pct_raw} (tipo: {type(_indexador_pct_raw).__name__}) - {e}")
                            _indexador_pct = None
                    else:
                        _indexador_pct = None
                    base_preco = float(row[7]) if (len(row) > 7 and row[7] is not None) else None
                    base_data = row[8] if (len(row) > 8) else None
                    _preco_compra = float(row[9]) if (len(row) > 9 and row[9] is not None) else None
                    _preco_medio = float(row[10]) if (len(row) > 10 and row[10] is not None) else None
                    
                    if not _ticker:
                        continue
                    
                    # CORREÇÃO CRÍTICA: Se tem indexador, calcular SEMPRE (mesmo que não esteja no batch)
                    if _indexador and _indexador_pct:
                        print(f"DEBUG: Ativo {_ticker} tem indexador {_indexador} com {_indexador_pct}%")
                        
                        # Preço base - ORDEM DE PRIORIDADE CRÍTICA:
                        # 1. indexador_base_preco (se configurado explicitamente)
                        # 2. preco_compra (preço de compra original)
                        # 3. preco_medio (preço médio ponderado)
                        # 4. Primeira movimentação (último recurso)
                        # NUNCA usar preco_atual como base!
                        if base_preco is not None and base_data:
                            preco_inicial = base_preco
                            _data_adicao = base_data
                            print(f"DEBUG: Usando indexador_base_preco: {preco_inicial}")
                        elif _preco_compra is not None and _preco_compra > 0:
                            preco_inicial = _preco_compra
                            print(f"DEBUG: Usando preco_compra: {preco_inicial}")
                        elif _preco_medio is not None and _preco_medio > 0:
                            preco_inicial = _preco_medio
                            print(f"DEBUG: Usando preco_medio: {preco_inicial}")
                        else:
                            # Último recurso: buscar primeira movimentação
                            cur.execute('SELECT preco FROM movimentacoes WHERE ticker = ? ORDER BY data ASC LIMIT 1', (_ticker,))
                            mov_row = cur.fetchone()
                            if mov_row and mov_row[0] and float(mov_row[0]) > 0:
                                preco_inicial = float(mov_row[0])
                                print(f"DEBUG: Usando primeira movimentação: {preco_inicial}")
                            else:
                                # Se não encontrou nada, pular este ativo (não atualizar)
                                print(f"[ERRO CRITICO] Nao foi possivel determinar preco inicial para {_ticker} com indexador. Pulando atualizacao.")
                                continue
                        
                        print(f"DEBUG: Preço inicial encontrado: {preco_inicial}, data: {_data_adicao}")
                        
                        # VALIDAÇÃO PRÉ-CÁLCULO: Garantir que preco_inicial é válido
                        if preco_inicial is None or preco_inicial <= 0 or not isinstance(preco_inicial, (int, float)):
                            print(f"[ERRO CRITICO] Preco inicial invalido para {_ticker}: {preco_inicial}. Pulando atualizacao.")
                            continue
                        
                        preco_atual = calcular_preco_com_indexador(preco_inicial, _indexador, _indexador_pct, _data_adicao)
                        
                        # VALIDAÇÃO CRÍTICA: Verificar se o preço calculado é razoável
                        # Não pode ser menor que 20% do inicial (queda absurda) nem maior que 20x (crescimento absurdo mesmo para 10 anos)
                        # Para renda fixa, mesmo com 10 anos a 115% CDI, o fator máximo seria ~3.5x, então 20x é seguro
                        if preco_atual is None or not isinstance(preco_atual, (int, float)) or preco_atual <= 0:
                            print(f"[ERRO CRITICO] Preco calculado invalido (None/zero/nao-numerico) para {_ticker}: {preco_atual}. Mantendo preco inicial.")
                            preco_atual = preco_inicial
                        elif preco_atual < preco_inicial * 0.2 or preco_atual > preco_inicial * 20.0:
                            print(f"[ERRO CRITICO] Preco calculado absurdo para {_ticker}: inicial={preco_inicial}, calculado={preco_atual} (fator={preco_atual/preco_inicial:.4f}x). Mantendo preco inicial para evitar corrupcao.")
                            preco_atual = preco_inicial  # CORREÇÃO: Manter preço inicial, não o atual (que pode estar corrompido)
                        else:
                            print(f"DEBUG: Preço calculado com indexador: {preco_atual} (inicial: {preco_inicial}, fator: {preco_atual/preco_inicial:.4f}x)")
                        
                        dy = None
                        pl = None 
                        pvp = None
                        roe = None
                    elif _ticker in precos_batch:
                        # Se não tem indexador, usar preços do batch (yfinance)
                        dados_preco = precos_batch[_ticker]
                        preco_atual = dados_preco.get('preco_atual', _preco_atual)
                        dy = dados_preco.get('dy')
                        pl = dados_preco.get('pl')
                        pvp = dados_preco.get('pvp')
                        roe = dados_preco.get('roe')
                    else:
                        # Se não tem indexador e não está no batch, manter preço atual
                        print(f"[AVISO] Preco nao encontrado em batch para {_ticker}, mantendo preco atual")
                        preco_atual = _preco_atual
                        dy = None
                        pl = None
                        pvp = None
                        roe = None
                    
                    valor_total = preco_atual * _qtd
                    cur.execute(
                        'UPDATE carteira SET preco_atual = ?, valor_total = ?, dy = ?, pl = ?, pvp = ?, roe = ? WHERE id = ?',
                        (preco_atual, valor_total, dy, pl, pvp, roe, _id)
                    )
                    atualizados += 1
                conn.commit()
            finally:
                conn.close()
        
        print(f"DEBUG: Atualização PostgreSQL concluída. {atualizados} ativos atualizados, {len(erros)} erros")
        return {"success": True, "updated": atualizados, "errors": erros}
    except Exception as e:
        return {"success": False, "message": f"Erro ao atualizar carteira: {str(e)}"}

def _calcular_status_vencimento(vencimento):

    if not vencimento:
        return {'status': 'sem_vencimento', 'dias': None}
    
    try:
        from datetime import datetime, date
        hoje = date.today()
        
        # Converter vencimento para date se for string
        if isinstance(vencimento, str):
            vencimento_date = datetime.strptime(vencimento[:10], '%Y-%m-%d').date()
        else:
            vencimento_date = vencimento
        
        # Calcular diferença em dias
        dias_restantes = (vencimento_date - hoje).days
        
        if dias_restantes < 0:
            return {'status': 'vencido', 'dias': abs(dias_restantes)}
        elif dias_restantes == 0:
            return {'status': 'vence_hoje', 'dias': 0}
        elif dias_restantes <= 30:
            return {'status': 'vence_em_poucos_dias', 'dias': dias_restantes}
        else:
            return {'status': 'vence_em_dias', 'dias': dias_restantes}
            
    except Exception as e:
        print(f"DEBUG: Erro ao calcular vencimento: {e}")
        return {'status': 'erro_calculo', 'dias': None}

def _determinar_preco_compra(ticker, preco_inicial, data_aplicacao, tipo):
    
    if preco_inicial is not None and float(preco_inicial) > 0:
        preco_manual = float(preco_inicial)
        
        # Verificar se é criptomoeda e converter USD → BRL se necessário
        if is_crypto_ticker(ticker):
            try:
                cotacao_brl = obter_cotacao_dolar()
                preco_brl = converter_crypto_usd_para_brl(preco_manual, cotacao_brl)
                print(f"DEBUG: Convertendo preço manual de criptomoeda {ticker}: ${preco_manual:.2f} USD → R$ {preco_brl:.2f} BRL")
                return preco_brl
            except Exception as e:
                print(f"DEBUG: Erro ao converter preço manual de criptomoeda {ticker}: {e}")
                return preco_manual
        
        print(f"DEBUG: Usando preço manual para {ticker}: {preco_manual}")
        return preco_manual
    
    # Verificar se é renda fixa - para renda fixa, sempre usar preço manual ou 1.0 como fallback
    tipo_lc = (tipo or '').strip().lower()
    is_renda_fixa = any(k in tipo_lc for k in ['renda fixa', 'tesouro', 'cdb', 'lci', 'lca', 'debênture', 'debture'])
    
    if is_renda_fixa:
        # Para renda fixa, se não há preço manual, usar 1.0 como valor unitário
        print(f"DEBUG: Ativo de renda fixa {ticker} - usando valor unitário 1.0")
        return 1.0
    
    # 2. Se data de aplicação fornecida, buscar preço histórico (apenas para RV)
    if data_aplicacao:
        try:
            from datetime import datetime, timedelta
            base_date = datetime.strptime(str(data_aplicacao)[:10], '%Y-%m-%d').date()
            start = base_date - timedelta(days=14)
            end = base_date + timedelta(days=1)
            
            # Normalizar ticker para yfinance
            t = ticker.strip().upper()
            t_yf = t + '.SA' if ('-' not in t and '.' not in t and len(t) <= 6) else t
            
            hist = yf.Ticker(t_yf).history(start=start.isoformat(), end=end.isoformat())
            if hist is not None and not hist.empty:
                close_val = None
                for idx, row in hist[::-1].iterrows():
                    d = idx.date()
                    if d <= base_date:
                        close_val = float(row.get('Close') or row.get('Adj Close') or 0)
                        break
                if close_val and close_val > 0:
                    # Verificar se é criptomoeda e converter USD → BRL se necessário
                    if is_crypto_ticker(ticker):
                        try:
                            cotacao_brl = obter_cotacao_dolar()
                            close_val_brl = converter_crypto_usd_para_brl(close_val, cotacao_brl)
                            print(f"DEBUG: Convertendo preço histórico de criptomoeda {ticker} em {data_aplicacao}: ${close_val:.2f} USD → R$ {close_val_brl:.2f} BRL")
                            return close_val_brl
                        except Exception as e:
                            print(f"DEBUG: Erro ao converter preço histórico de criptomoeda {ticker}: {e}")
                            return close_val
                    
                    print(f"DEBUG: Usando preço histórico para {ticker} em {data_aplicacao}: {close_val}")
                    return close_val
        except Exception as e:
            print(f"DEBUG: Erro ao buscar preço histórico para {ticker}: {e}")
    
    # 3. Buscar preço atual do yfinance (apenas para RV)
    try:
        info = obter_informacoes_ativo(ticker)
        if info and info.get('preco_atual'):
            preco_atual = float(info['preco_atual'])
            if preco_atual > 0:
                print(f"DEBUG: Usando preço atual para {ticker}: {preco_atual}")
                return preco_atual
    except Exception as e:
        print(f"DEBUG: Erro ao buscar preço atual para {ticker}: {e}")
    
    # 4. Fallback: 0.0 (será tratado como erro)
    print(f"DEBUG: Não foi possível determinar preço para {ticker}, usando 0.0")
    return 0.0
def adicionar_ativo_carteira(ticker, quantidade, tipo=None, preco_inicial=None, nome_personalizado=None, indexador=None, indexador_pct=None, data_aplicacao=None, vencimento=None, isento_ir=None, liquidez_diaria=None, sobrescrever=False):

    try:
        # Determinar preço de compra usando a nova lógica
        preco_compra_definitivo = _determinar_preco_compra(ticker, preco_inicial, data_aplicacao, tipo)
        
        # Se não conseguiu determinar preço, retornar erro (exceto para renda fixa)
        tipo_lc = (tipo or '').strip().lower()
        is_renda_fixa = any(k in tipo_lc for k in ['renda fixa', 'tesouro', 'cdb', 'lci', 'lca', 'debênture', 'debture'])
        
        if preco_compra_definitivo <= 0 and not is_renda_fixa:
            return {"success": False, "message": f"Não foi possível determinar o preço de compra para {ticker}. Verifique se o ticker existe ou forneça um preço manual."}
        
        # Para renda fixa, se não há preço, usar 1.0 como valor unitário
        if preco_compra_definitivo <= 0 and is_renda_fixa:
            preco_compra_definitivo = 1.0
            print(f"DEBUG: Usando valor unitário 1.0 para renda fixa {ticker}")
        
        info = obter_informacoes_ativo(ticker)
        if not info:
            # Fallback: criar ativo manual
            info = {
                "ticker": (ticker or "").upper(),
                "nome_completo": nome_personalizado or (ticker or "Personalizado").upper(),
                "preco_atual": preco_compra_definitivo,  # Usar preço de compra como atual inicialmente
                "tipo": tipo or "Personalizado",
                "dy": None,
                "pl": None,
                "pvp": None,
                "roe": None,
            }
            
        if tipo:
            info["tipo"] = tipo

        # Sanitize optional fields for Postgres compatibility
        def _to_float_or_none(v):
            try:
                if v is None:
                    return None
                if isinstance(v, str) and v.strip() == "":
                    return None
                return float(v)
            except Exception:
                return None

        def _to_bool_or_none(v):
            if v is None:
                return None
            if isinstance(v, str) and v.strip() == "":
                return None
            if isinstance(v, bool):
                return v
            if isinstance(v, (int, float)):
                return bool(v)
            s = str(v).strip().lower()
            if s in ("true", "1", "sim", "yes", "y"):
                return True
            if s in ("false", "0", "nao", "não", "no", "n"):
                return False
            return None

        indexador_pct = _to_float_or_none(indexador_pct)
        isento_ir = _to_bool_or_none(isento_ir)
        liquidez_diaria = _to_bool_or_none(liquidez_diaria)
        data_aplicacao = data_aplicacao if (data_aplicacao and str(data_aplicacao).strip() != "") else None
        vencimento = vencimento if (vencimento and str(vencimento).strip() != "") else None

        quantidade_val = float(quantidade or 0)
        valor_total = float(info["preco_atual"] or 0) * quantidade_val
        data_adicao = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        usuario = get_usuario_atual()
        if not usuario:
            return {"success": False, "message": "Usuário não autenticado"}
        # Ensure schema and tables exist in the user schema
        init_carteira_db(usuario)
        _ensure_indexador_schema()
        
        if _is_postgres():
            conn = _pg_conn_for_user(usuario)
            try:
                with conn.cursor() as cursor:
                    # Garantir que todas as colunas existam no PostgreSQL
                    try:
                        cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS preco_compra NUMERIC')
                        cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS indexador TEXT')
                        cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS indexador_pct NUMERIC')
                        cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS data_aplicacao TEXT')
                        cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS vencimento TEXT')
                        cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS isento_ir BOOLEAN')
                        cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS liquidez_diaria BOOLEAN')
                        cursor.execute('ALTER TABLE carteira ADD COLUMN IF NOT EXISTS preco_medio NUMERIC')
                    except Exception as e:
                        print(f"DEBUG: Erro ao adicionar colunas (pode ser normal se já existirem): {e}")
                    
                    cursor.execute(
                        'SELECT id, quantidade FROM carteira WHERE ticker = %s',
                        (info["ticker"],)
                    )
                    ativo_existente = cursor.fetchone()


                    resultado_movimentacao = registrar_movimentacao(
                        data_adicao,
                        info["ticker"],
                        info["nome_completo"],
                        quantidade_val,
                        preco_compra_definitivo,
                        "atualizado" if (ativo_existente and sobrescrever) else "compra",
                        conn
                    )
                    if not resultado_movimentacao["success"]:
                        return resultado_movimentacao

                    if ativo_existente:
                        # Ativo já existe, atualizar quantidade
                        id_existente, quantidade_existente = ativo_existente
                        try:
                            quantidade_existente = float(quantidade_existente)
                        except Exception:
                            quantidade_existente = float(quantidade_existente or 0)

                        if sobrescrever:
                            # Modo sobrescrever: substituir completamente os dados do ativo
                            novo_valor_total = float(info["preco_atual"] or 0) * quantidade_val
                            cursor.execute(
                                'UPDATE carteira SET quantidade = %s, valor_total = %s, preco_atual = %s, dy = %s, pl = %s, pvp = %s, roe = %s, preco_medio = %s, preco_compra = %s, indexador = %s, indexador_pct = %s, data_aplicacao = %s, vencimento = %s, isento_ir = %s, liquidez_diaria = %s WHERE id = %s',
                                (
                                    quantidade_val,
                                    novo_valor_total,
                                    info["preco_atual"],
                                    info.get("dy"),
                                    info.get("pl"),
                                    info.get("pvp"),
                                    info.get("roe"),
                                    float(preco_compra_definitivo or 0),
                                    float(preco_compra_definitivo or 0),
                                    indexador,
                                    indexador_pct,
                                    data_aplicacao,
                                    vencimento,
                                    isento_ir,
                                    liquidez_diaria,
                                    id_existente,
                                )
                            )
                            mensagem = f"Ativo {info['ticker']} sobrescrito com sucesso (quantidade: {quantidade_val})"
                        else:
                            try:
                                cursor.execute('SELECT preco_medio, preco_compra, preco_atual FROM carteira WHERE id = %s', (id_existente,))
                                pm_row = cursor.fetchone()
                                if pm_row:
                                    pm_db, pc_db, pa_db = pm_row[0], pm_row[1], pm_row[2]
                                else:
                                    pm_db = pc_db = pa_db = None
                                
                                if pm_db is not None:
                                    preco_medio_atual = float(pm_db)
                                elif pc_db is not None:
                                    preco_medio_atual = float(pc_db)
                                elif pa_db is not None:
                                    preco_medio_atual = float(pa_db)
                                else:
                                    preco_medio_atual = float(preco_compra_definitivo or 0)
                            except Exception:
                                preco_medio_atual = float(preco_compra_definitivo or 0)
                            nova_quantidade = quantidade_existente + quantidade_val
                           
                            preco_medio_novo = (
                                (preco_medio_atual * quantidade_existente) + (float(preco_compra_definitivo or 0) * quantidade_val)
                            ) / (nova_quantidade or 1)
                            novo_valor_total = float(info["preco_atual"] or 0) * nova_quantidade
                            cursor.execute(
                                'UPDATE carteira SET quantidade = %s, valor_total = %s, preco_atual = %s, dy = %s, pl = %s, pvp = %s, roe = %s, preco_medio = %s, preco_compra = %s WHERE id = %s',
                                (
                                    nova_quantidade,
                                    novo_valor_total,
                                    info["preco_atual"],
                                    info.get("dy"),
                                    info.get("pl"),
                                    info.get("pvp"),
                                    info.get("roe"),
                                    preco_medio_novo,
                                    preco_medio_novo,
                                    id_existente,
                                )
                            )
                            mensagem = f"Quantidade do ativo {info['ticker']} atualizada: {quantidade_existente} + {quantidade} = {nova_quantidade}"
                    else:
                        # Novo ativo - adicionar todas as colunas necessárias
                        preco_compra = preco_compra_definitivo
                        
                        cursor.execute(
                            'INSERT INTO carteira (ticker, nome_completo, quantidade, preco_atual, preco_compra, preco_medio, valor_total, data_adicao, tipo, dy, pl, pvp, roe, indexador, indexador_pct, data_aplicacao, vencimento, isento_ir, liquidez_diaria) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                            (
                                info["ticker"],
                                info["nome_completo"],
                                quantidade_val,
                                info["preco_atual"],
                                preco_compra,
                                preco_compra,
                                valor_total,
                                data_adicao,
                                info["tipo"],
                                info.get("dy"),
                                info.get("pl"),
                                info.get("pvp"),
                                info.get("roe"),
                                indexador,
                                indexador_pct,
                                data_aplicacao,
                                vencimento,
                                isento_ir,
                                liquidez_diaria,
                            ) 
                        )
                        mensagem = f"Ativo {info['ticker']} adicionado com sucesso"
                    
                    # CRÍTICO: Fazer commit da transação no PostgreSQL
                    conn.commit()
            finally:
                conn.close()
        else:
            db_path = get_db_path(usuario, "carteira")
            conn = sqlite3.connect(db_path, check_same_thread=False)
            cursor = conn.cursor()
            
          
            cursor.execute('SELECT id, quantidade FROM carteira WHERE ticker = ?', (info["ticker"],))
            ativo_existente = cursor.fetchone()
            

            resultado_movimentacao = registrar_movimentacao(
                data_adicao,
                info["ticker"],
                info["nome_completo"],
                quantidade_val,
                preco_compra_definitivo,
                "atualizado" if (ativo_existente and sobrescrever) else "compra",
                conn
            )
            if not resultado_movimentacao["success"]:
                conn.close()
                return resultado_movimentacao
            
            if ativo_existente:
               
                id_existente, quantidade_existente = ativo_existente
                try:
                    quantidade_existente = float(quantidade_existente)
                except Exception:
                    quantidade_existente = float(quantidade_existente or 0)

                if sobrescrever:
                    # Modo sobrescrever: substituir completamente os dados do ativo
                    novo_valor_total = float(info["preco_atual"] or 0) * quantidade_val
                    cursor.execute('''
                        UPDATE carteira SET quantidade = ?, valor_total = ?, preco_atual = ?, dy = ?, pl = ?, pvp = ?, roe = ?,
                            preco_medio = ?, preco_compra = ?, indexador = ?, indexador_pct = ?, data_aplicacao = ?, vencimento = ?,
                            isento_ir = ?, liquidez_diaria = ?
                        WHERE id = ?
                    ''', (
                        quantidade_val,
                        novo_valor_total,
                        info["preco_atual"],
                        info.get("dy"),
                        info.get("pl"),
                        info.get("pvp"),
                        info.get("roe"),
                        float(preco_compra_definitivo or 0),
                        float(preco_compra_definitivo or 0),
                        indexador,
                        indexador_pct,
                        data_aplicacao,
                        vencimento,
                        (1 if isento_ir else 0) if isento_ir is not None else None,
                        (1 if liquidez_diaria else 0) if liquidez_diaria is not None else None,
                        id_existente
                    ))
                    mensagem = f"Ativo {info['ticker']} sobrescrito com sucesso (quantidade: {quantidade_val})"
                else:
                    try:
                        cursor.execute('SELECT preco_medio, preco_compra, preco_atual FROM carteira WHERE id = ?', (id_existente,))
                        pm_row = cursor.fetchone()
                        if pm_row:
                            pm_db, pc_db, pa_db = pm_row[0], pm_row[1], pm_row[2]
                        else:
                            pm_db = pc_db = pa_db = None
                        if pm_db is not None:
                            preco_medio_atual = float(pm_db)
                        elif pc_db is not None:
                            preco_medio_atual = float(pc_db)
                        elif pa_db is not None:
                            preco_medio_atual = float(pa_db)
                        else:
                            preco_medio_atual = float(preco_compra_definitivo or 0)
                    except Exception:
                        preco_medio_atual = float(preco_compra_definitivo or 0)
                    nova_quantidade = quantidade_existente + quantidade_val
                    preco_medio_novo = (
                        (preco_medio_atual * quantidade_existente) + (float(preco_compra_definitivo or 0) * quantidade_val)
                    ) / (nova_quantidade or 1)
                    novo_valor_total = float(info["preco_atual"] or 0) * nova_quantidade
                    cursor.execute('''
                        UPDATE carteira SET quantidade = ?, valor_total = ?, preco_atual = ?, dy = ?, pl = ?, pvp = ?, roe = ?, preco_medio = ?, preco_compra = ?
                        WHERE id = ?
                    ''', (nova_quantidade, novo_valor_total, info["preco_atual"], info.get("dy"), info.get("pl"), info.get("pvp"), info.get("roe"), preco_medio_novo, preco_medio_novo, id_existente))
                    mensagem = f"Quantidade do ativo {info['ticker']} atualizada: {quantidade_existente} + {quantidade} = {nova_quantidade}"
            else:
               
 
                try:
                    cursor.execute('ALTER TABLE carteira ADD COLUMN preco_compra REAL')
                except Exception:
                    pass  
                

                preco_compra = preco_compra_definitivo
                
                cursor.execute('''
                    INSERT INTO carteira (ticker, nome_completo, quantidade, preco_atual, preco_compra, preco_medio, valor_total, 
                                        data_adicao, tipo, dy, pl, pvp, roe, indexador, indexador_pct, data_aplicacao, vencimento, isento_ir, liquidez_diaria)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (info["ticker"], info["nome_completo"], quantidade_val, info["preco_atual"], preco_compra, preco_compra,
                      valor_total, data_adicao, info["tipo"], info.get("dy"), info.get("pl"), 
                      info.get("pvp"), info.get("roe"), indexador, indexador_pct, data_aplicacao, vencimento, (1 if isento_ir else 0) if isento_ir is not None else None, (1 if liquidez_diaria else 0) if liquidez_diaria is not None else None))
                mensagem = f"Ativo {info['ticker']} adicionado com sucesso"
            
            conn.commit()
            conn.close()
        
        # Se o ativo tem indexador, forçar atualização dos preços
        if indexador and indexador_pct:
            print(f"DEBUG: Ativo com indexador adicionado, forçando atualização de preços")
            try:
                atualizar_precos_indicadores_carteira()
            except Exception as e:
                print(f"DEBUG: Erro ao atualizar preços após adicionar ativo: {e}")
        
        return {"success": True, "message": mensagem}
    except Exception as e:
        return {"success": False, "message": f"Erro ao adicionar ativo: {str(e)}"}

def remover_ativo_carteira(id):

    try:
        usuario = get_usuario_atual()
        if not usuario:
            return {"success": False, "message": "Usuário não autenticado"}

        if _is_postgres():
            conn = _pg_conn_for_user(usuario)
            try:
                with conn.cursor() as cursor:
                    cursor.execute('SELECT ticker, nome_completo, quantidade, preco_atual FROM carteira WHERE id = %s', (id,))
                    ativo = cursor.fetchone()
                    if not ativo:
                        return {"success": False, "message": "Ativo não encontrado"}
                    data = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    resultado_movimentacao = registrar_movimentacao(data, ativo[0], ativo[1], ativo[2], ativo[3], "venda", conn)
                    if not resultado_movimentacao["success"]:
                        return resultado_movimentacao
                    cursor.execute('DELETE FROM carteira WHERE id = %s', (id,))
                return {"success": True, "message": "Ativo removido com sucesso"}
            finally:
                conn.close()
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        cursor = conn.cursor()
        cursor.execute('SELECT ticker, nome_completo, quantidade, preco_atual FROM carteira WHERE id = ?', (id,))
        ativo = cursor.fetchone()
        
        if not ativo:
            conn.close()
            return {"success": False, "message": "Ativo não encontrado"}
            

        data = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        resultado_movimentacao = registrar_movimentacao(data, ativo[0], ativo[1], ativo[2], ativo[3], "venda", conn)
        
        if not resultado_movimentacao["success"]:
            conn.close()
            return resultado_movimentacao
        

        cursor.execute('DELETE FROM carteira WHERE id = ?', (id,))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Ativo removido com sucesso"}
    except Exception as e:
        return {"success": False, "message": f"Erro ao remover ativo: {str(e)}"}

def atualizar_ativo_carteira(id, quantidade=None, preco_atual=None, preco_compra=None):

  
    try:
        usuario = get_usuario_atual()
        if not usuario:
            return {"success": False, "message": "Usuário não autenticado"}

        if _is_postgres():
            conn = _pg_conn_for_user(usuario)
            try:
                with conn.cursor() as cursor:
                    cursor.execute('SELECT ticker, nome_completo, preco_atual, quantidade, indexador, indexador_pct FROM carteira WHERE id = %s', (id,))
                    ativo = cursor.fetchone()
                    if not ativo:
                        return {"success": False, "message": "Ativo não encontrado"}
                    current_price = float(ativo[2]) if ativo[2] is not None else 0.0
                    current_qty = float(ativo[3]) if ativo[3] is not None else 0.0
                    new_qty = float(quantidade) if quantidade is not None else current_qty
                    

                    valor_total = current_price * new_qty
                    

                    update_fields = ['quantidade = %s', 'valor_total = %s']
                    update_values = [new_qty, valor_total]
                    


                    if preco_compra is not None:
                        update_fields.append('preco_compra = %s')
                        update_values.append(float(preco_compra))
                        try:
                            cursor.execute('SELECT preco_medio, preco_compra, preco_atual FROM carteira WHERE id = %s', (id,))
                            pm_row = cursor.fetchone()
                            if pm_row:
                                pm_db, pc_db, pa_db = pm_row[0], pm_row[1], pm_row[2]
                            else:
                                pm_db = pc_db = pa_db = None
                            if pm_db is not None:
                                preco_medio_atual = float(pm_db)
                            elif pc_db is not None:
                                preco_medio_atual = float(pc_db)
                            elif pa_db is not None:
                                preco_medio_atual = float(pa_db)
                            else:
                                preco_medio_atual = float(preco_compra)
                        except Exception:
                            preco_medio_atual = float(preco_compra)
                        qty_diff = new_qty - current_qty
                        if qty_diff > 0:
                            novo_pm = ((preco_medio_atual * current_qty) + (float(preco_compra) * qty_diff)) / (new_qty or 1)
                            update_fields.append('preco_medio = %s')
                            update_values.append(novo_pm)
                    
                    update_values.append(id)
        
       
                    cursor.execute(f'UPDATE carteira SET {", ".join(update_fields)} WHERE id = %s', update_values)

      
                    qty_diff = new_qty - current_qty
                    if abs(qty_diff) > 0:
                        tipo_mov = 'compra' if qty_diff > 0 else 'venda'
                        data_mov = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        preco_mov = float(preco_atual) if preco_atual is not None else current_price
                        try:
                            registrar_movimentacao(data_mov, str(ativo[0] or ''), str(ativo[1] or ''), abs(qty_diff), preco_mov, tipo_mov, conn)
                        except Exception as _:
                            pass
                conn.commit()
                return {"success": True, "message": "Ativo atualizado com sucesso"}
            finally:
                conn.close()
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            cur.execute('SELECT ticker, nome_completo, preco_atual, quantidade, indexador, indexador_pct FROM carteira WHERE id = ?', (id,))
            ativo = cur.fetchone()
        
            if not ativo:
                return {"success": False, "message": "Ativo não encontrado"}
            
            current_price = float(ativo[2]) if ativo[2] is not None else 0.0
            current_qty = float(ativo[3]) if ativo[3] is not None else 0.0
            new_qty = float(quantidade) if quantidade is not None else current_qty
        
      
            valor_total = current_price * new_qty
        
        
            update_fields = ['quantidade = ?', 'valor_total = ?']
            update_values = [new_qty, valor_total]
        
     
            if preco_compra is not None:
                update_fields.append('preco_compra = ?')
                update_values.append(float(preco_compra))
                try:
                    cur.execute('SELECT preco_medio, preco_compra, preco_atual FROM carteira WHERE id = ?', (id,))
                    pm_row = cur.fetchone()
                    if pm_row:
                        pm_db, pc_db, pa_db = pm_row[0], pm_row[1], pm_row[2]
                    else:
                        pm_db = pc_db = pa_db = None
                    if pm_db is not None:
                        preco_medio_atual = float(pm_db)
                    elif pc_db is not None:
                        preco_medio_atual = float(pc_db)
                    elif pa_db is not None:
                        preco_medio_atual = float(pa_db)
                    else:
                        preco_medio_atual = float(preco_compra)
                except Exception:
                    preco_medio_atual = float(preco_compra)
                qty_diff = new_qty - current_qty
                if qty_diff > 0:
                    novo_pm = ((preco_medio_atual * current_qty) + (float(preco_compra) * qty_diff)) / (new_qty or 1)
                    update_fields.append('preco_medio = ?')
                    update_values.append(novo_pm)
        
            update_values.append(id)
        
  
            cur.execute(f'''
                UPDATE carteira 
                SET {", ".join(update_fields)}
                WHERE id = ?
            ''', update_values)

        
            qty_diff = new_qty - current_qty
            if abs(qty_diff) > 0:
                tipo_mov = 'compra' if qty_diff > 0 else 'venda'
                data_mov = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                preco_mov = float(preco_atual) if preco_atual is not None else current_price
                try:
                    registrar_movimentacao(data_mov, str(ativo[0] or ''), str(ativo[1] or ''), abs(qty_diff), preco_mov, tipo_mov, conn)
                except Exception as _:
                    pass
        
            conn.commit()
        finally:
            conn.close()
        
        return {"success": True, "message": "Ativo atualizado com sucesso"}
    except Exception as e:
        return {"success": False, "message": f"Erro ao atualizar ativo: {str(e)}"}

def _ensure_goals_schema():
    usuario = get_usuario_atual()
    if not usuario:
        return
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('''
                    CREATE TABLE IF NOT EXISTS goals (
                        id SERIAL PRIMARY KEY,
                        tipo TEXT NOT NULL,         -- 'renda' | 'patrimonio'
                        alvo NUMERIC NOT NULL,      -- valor alvo (renda mensal ou patrimonio)
                        horizonte_meses INTEGER,    -- opcional
                        aporte_mensal NUMERIC,      -- opcional
                        premissas JSONB,            -- objeto com parametros (dy_por_classe etc.)
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                ''')
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            cur.execute('''
                CREATE TABLE IF NOT EXISTS goals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tipo TEXT NOT NULL,
                    alvo REAL NOT NULL,
                    horizonte_meses INTEGER,
                    aporte_mensal REAL,
                    premissas TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            ''')
            conn.commit()
        finally:
            conn.close()

def get_goals():
    usuario = get_usuario_atual()
    if not usuario:
        return []
    _ensure_goals_schema()
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('SELECT id, tipo, alvo, horizonte_meses, aporte_mensal, premissas, created_at, updated_at FROM goals ORDER BY id DESC LIMIT 1')
                row = c.fetchone()
                if not row:
                    return None
                return {
                    'id': row[0], 'tipo': row[1], 'alvo': float(row[2]), 'horizonte_meses': row[3],
                    'aporte_mensal': (float(row[4]) if row[4] is not None else None), 'premissas': row[5],
                    'created_at': row[6], 'updated_at': row[7]
                }
        finally:
            conn.close()
    db_path = get_db_path(usuario, "carteira")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        cur = conn.cursor()
        cur.execute('SELECT id, tipo, alvo, horizonte_meses, aporte_mensal, premissas, created_at, updated_at FROM goals ORDER BY id DESC LIMIT 1')
        row = cur.fetchone()
        if not row:
            return None
        import json
        premissas = None
        try:
            premissas = json.loads(row[5]) if row[5] else None
        except Exception:
            premissas = None
        return {
            'id': row[0], 'tipo': row[1], 'alvo': float(row[2]), 'horizonte_meses': row[3],
            'aporte_mensal': (float(row[4]) if row[4] is not None else None), 'premissas': premissas,
            'created_at': row[6], 'updated_at': row[7]
        }
    finally:
        conn.close()

def save_goals(payload: dict):
    usuario = get_usuario_atual()
    if not usuario:
        return { 'success': False, 'message': 'Não autenticado' }
    _ensure_goals_schema()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    tipo = (payload.get('tipo') or 'renda')
    alvo = float(payload.get('alvo') or 0)
    horizonte_meses = payload.get('horizonte_meses')
    aporte_mensal = payload.get('aporte_mensal')
    premissas = payload.get('premissas')
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('DELETE FROM goals')
                c.execute('INSERT INTO goals (tipo, alvo, horizonte_meses, aporte_mensal, premissas, created_at, updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s)', (tipo, alvo, horizonte_meses, aporte_mensal, json.dumps(premissas) if premissas is not None else None, now, now))
                conn.commit()
                return { 'success': True }
        finally:
            conn.close()
    db_path = get_db_path(usuario, "carteira")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        cur = conn.cursor()
        cur.execute('DELETE FROM goals')
        cur.execute('INSERT INTO goals (tipo, alvo, horizonte_meses, aporte_mensal, premissas, created_at, updated_at) VALUES (?,?,?,?,?,?,?)', (tipo, alvo, horizonte_meses, aporte_mensal, json.dumps(premissas) if premissas is not None else None, now, now))
        conn.commit()
        return { 'success': True }
    finally:
        conn.close()

def compute_goals_projection(goal: dict):
   
    itens = obter_carteira() or []
    total_atual = float(sum((it.get('valor_total') or 0.0) for it in itens)) if itens else 0.0
    tipo = (goal.get('tipo') or 'renda')
    alvo = float(goal.get('alvo') or 0)
    horizonte_meses = int(goal.get('horizonte_meses') or 0) if goal.get('horizonte_meses') is not None else 0
    aporte_mensal = float(goal.get('aporte_mensal') or 0)
    premissas = goal.get('premissas') or {}

   
    dy_por_classe = (premissas.get('dy_por_classe') or {}) if isinstance(premissas, dict) else {}
    
  
    taxa_crescimento = goal.get('taxa_crescimento')
    if taxa_crescimento is not None:
        retorno_anual = float(taxa_crescimento)
    else:
        retorno_anual = float(premissas.get('retorno_anual', 0.10)) if isinstance(premissas, dict) else 0.10
    
    taxa_mensal = (1 + retorno_anual) ** (1/12) - 1

   
    if tipo == 'renda':
        
        dy_mensal = float(premissas.get('dy_mensal_global', retorno_anual/12)) if isinstance(premissas, dict) else (retorno_anual/12)
        capital_alvo = alvo / max(1e-9, dy_mensal)
    else:
        capital_alvo = alvo

  
    aporte_sugerido = aporte_mensal
    if aporte_sugerido <= 0 and horizonte_meses > 0:
       
        from math import isfinite
        fv_residual = max(0.0, capital_alvo - (total_atual * ((1 + taxa_mensal) ** horizonte_meses)))
        if taxa_mensal > 0 and horizonte_meses > 0 and isfinite(fv_residual):
            aporte_sugerido = fv_residual * taxa_mensal / (((1 + taxa_mensal) ** horizonte_meses) - 1)
        else:
            aporte_sugerido = fv_residual / max(1, horizonte_meses)


    n = horizonte_meses if horizonte_meses and horizonte_meses > 0 else 120
    saldo = total_atual
    roadmap = []
    for m in range(1, n + 1):
        saldo = saldo * (1 + taxa_mensal) + (aporte_sugerido or 0)
        roadmap.append({ 'mes': m, 'saldo': round(saldo, 2), 'aporte': round(aporte_sugerido or 0, 2) })

    return {
        'capital_alvo': round(capital_alvo, 2),
        'aporte_sugerido': round(aporte_sugerido or 0, 2),
        'horizonte_meses': n,
        'saldo_inicial': round(total_atual, 2),
        'taxa_mensal': taxa_mensal,
        'taxa_anual_usada': retorno_anual,
        'taxa_manual': taxa_crescimento is not None,
        'roadmap': roadmap,
    }

# ==================== METAS DE APORTES ====================

def _ensure_metas_aportes_schema():
    """Cria schema para tabela de metas de aportes"""
    usuario = get_usuario_atual()
    if not usuario:
        return
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('''
                    CREATE TABLE IF NOT EXISTS metas_aportes (
                        id SERIAL PRIMARY KEY,
                        tipo_periodo TEXT NOT NULL,
                        valor_meta NUMERIC NOT NULL,
                        data_inicio TEXT NOT NULL,
                        data_fim TEXT,
                        ativo BOOLEAN DEFAULT TRUE,
                        integrado_com_goal INTEGER,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                ''')
                conn.commit()
        except Exception as e:
            print(f"Erro ao criar tabela metas_aportes: {e}")
            conn.rollback()
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            cur.execute('''
                CREATE TABLE IF NOT EXISTS metas_aportes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tipo_periodo TEXT NOT NULL,
                    valor_meta REAL NOT NULL,
                    data_inicio TEXT NOT NULL,
                    data_fim TEXT,
                    ativo INTEGER DEFAULT 1,
                    integrado_com_goal INTEGER,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            ''')
            conn.commit()
        finally:
            conn.close()

def calcular_aportes_reais(tipo_periodo='mensal', mes=None, ano=None, data_inicio=None, data_fim=None):
    """
    Calcula aportes reais a partir das movimentações de compra
    tipo_periodo: 'mensal' | 'rebalanceamento' | 'anual'
    """
    try:
        movimentacoes = obter_movimentacoes(mes=mes, ano=ano)
        
        # Filtrar apenas compras
        compras = [m for m in movimentacoes if m.get('tipo') == 'compra']
        
        # Se tem data_inicio e data_fim, filtrar por período
        if data_inicio and data_fim:
            compras = [
                c for c in compras 
                if c.get('data') >= data_inicio and c.get('data') < data_fim
            ]
        
        # Calcular total de aportes
        total_aporte = sum(
            float(c.get('quantidade', 0)) * float(c.get('preco', 0))
            for c in compras
        )
        
        return {
            'valor': round(total_aporte, 2),
            'quantidade_movimentacoes': len(compras),
            'data_inicio': data_inicio or (f"{ano}-{mes:02d}-01" if mes and ano else None),
            'data_fim': data_fim or (f"{ano}-{mes:02d}-{28 if mes == 2 else 30 if mes in [4,6,9,11] else 31}" if mes and ano else None)
        }
    except Exception as e:
        print(f"Erro ao calcular aportes reais: {e}")
        return {
            'valor': 0.0,
            'quantidade_movimentacoes': 0,
            'data_inicio': None,
            'data_fim': None
        }

def get_metas_aportes():
    """Obtém todas as metas de aportes ativas"""
    usuario = get_usuario_atual()
    if not usuario:
        return []
    _ensure_metas_aportes_schema()
    
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                # Garantir que a tabela existe antes de consultar
                try:
                    c.execute('''
                        SELECT id, tipo_periodo, valor_meta, data_inicio, data_fim, ativo, integrado_com_goal, created_at, updated_at
                        FROM metas_aportes
                        WHERE ativo = TRUE
                        ORDER BY created_at DESC
                    ''')
                    rows = c.fetchall()
                    return [
                        {
                            'id': row[0],
                            'tipo_periodo': row[1],
                            'valor_meta': float(row[2]),
                            'data_inicio': row[3],
                            'data_fim': row[4],
                            'ativo': row[5],
                            'integrado_com_goal': row[6],
                            'created_at': row[7],
                            'updated_at': row[8]
                        }
                        for row in rows
                    ]
                except Exception as e:
                    # Se a tabela não existe, criar novamente
                    print(f"Tabela metas_aportes não encontrada, recriando: {e}")
                    _ensure_metas_aportes_schema()
                    return []
        except Exception as e:
            print(f"Erro ao obter metas de aportes: {e}")
            import traceback
            traceback.print_exc()
            return []
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            cur.execute('''
                SELECT id, tipo_periodo, valor_meta, data_inicio, data_fim, ativo, integrado_com_goal, created_at, updated_at
                FROM metas_aportes
                WHERE ativo = 1
                ORDER BY created_at DESC
            ''')
            rows = cur.fetchall()
            return [
                {
                    'id': row[0],
                    'tipo_periodo': row[1],
                    'valor_meta': float(row[2]),
                    'data_inicio': row[3],
                    'data_fim': row[4],
                    'ativo': bool(row[5]),
                    'integrado_com_goal': row[6],
                    'created_at': row[7],
                    'updated_at': row[8]
                }
                for row in rows
            ]
        finally:
            conn.close()

def save_meta_aporte(payload: dict):
    """Salva ou atualiza uma meta de aporte"""
    usuario = get_usuario_atual()
    if not usuario:
        return {'success': False, 'message': 'Não autenticado'}
    _ensure_metas_aportes_schema()
    
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    meta_id = payload.get('id')
    tipo_periodo = payload.get('tipo_periodo', 'mensal')
    valor_meta = float(payload.get('valor_meta', 0))
    data_inicio = payload.get('data_inicio', now[:10])
    data_fim = payload.get('data_fim')
    ativo = payload.get('ativo', True)
    integrado_com_goal = payload.get('integrado_com_goal')
    
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                try:
                    if meta_id:
                        c.execute('''
                            UPDATE metas_aportes
                            SET tipo_periodo=%s, valor_meta=%s, data_inicio=%s, data_fim=%s, ativo=%s, integrado_com_goal=%s, updated_at=%s
                            WHERE id=%s
                        ''', (tipo_periodo, valor_meta, data_inicio, data_fim, ativo, integrado_com_goal, now, meta_id))
                    else:
                        c.execute('''
                            INSERT INTO metas_aportes (tipo_periodo, valor_meta, data_inicio, data_fim, ativo, integrado_com_goal, created_at, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ''', (tipo_periodo, valor_meta, data_inicio, data_fim, ativo, integrado_com_goal, now, now))
                    conn.commit()
                    return {'success': True}
                except Exception as e:
                    print(f"Erro ao salvar meta de aporte: {e}")
                    import traceback
                    traceback.print_exc()
                    conn.rollback()
                    return {'success': False, 'message': str(e)}
        except Exception as e:
            print(f"Erro na conexão ao salvar meta de aporte: {e}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            if meta_id:
                cur.execute('''
                    UPDATE metas_aportes
                    SET tipo_periodo=?, valor_meta=?, data_inicio=?, data_fim=?, ativo=?, integrado_com_goal=?, updated_at=?
                    WHERE id=?
                ''', (tipo_periodo, valor_meta, data_inicio, data_fim, 1 if ativo else 0, integrado_com_goal, now, meta_id))
            else:
                cur.execute('''
                    INSERT INTO metas_aportes (tipo_periodo, valor_meta, data_inicio, data_fim, ativo, integrado_com_goal, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (tipo_periodo, valor_meta, data_inicio, data_fim, 1 if ativo else 0, integrado_com_goal, now, now))
            conn.commit()
            return {'success': True}
        finally:
            conn.close()

def delete_meta_aporte(meta_id: int):
    """Desativa uma meta de aporte"""
    usuario = get_usuario_atual()
    if not usuario:
        return {'success': False, 'message': 'Não autenticado'}
    _ensure_metas_aportes_schema()
    
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('UPDATE metas_aportes SET ativo=FALSE, updated_at=%s WHERE id=%s', (now, meta_id))
                conn.commit()
                return {'success': True}
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            cur.execute('UPDATE metas_aportes SET ativo=0, updated_at=? WHERE id=?', (now, meta_id))
            conn.commit()
            return {'success': True}
        finally:
            conn.close()

def calcular_projecao_com_aporte(saldo_inicial, capital_alvo, aporte_mensal, taxa_mensal, max_meses=600):
    """
    Calcula em quantos meses vai atingir o capital_alvo com aporte_mensal fixo
    Retorna: (meses_necessarios, atingivel, projecao_meses)
    """
    from math import log
    
    if capital_alvo <= saldo_inicial:
        return 0, True, []
    
    if taxa_mensal <= 0 or aporte_mensal <= 0:
        # Sem crescimento, cálculo simples
        faltante = capital_alvo - saldo_inicial
        meses = faltante / aporte_mensal if aporte_mensal > 0 else float('inf')
        return int(meses), meses <= max_meses, []
    
    # Fórmula: FV = PV * (1 + i)^n + PMT * [((1 + i)^n - 1) / i]
    # Resolvendo para n:
    # capital_alvo = saldo_inicial * (1 + taxa_mensal)^n + aporte_mensal * [((1 + taxa_mensal)^n - 1) / taxa_mensal]
    
    try:
        # Simplificando: capital_alvo ≈ saldo_inicial * (1 + i)^n + aporte_mensal * n (aproximação)
        # Ou usando fórmula exata
        if saldo_inicial * (1 + taxa_mensal) ** max_meses + aporte_mensal * (((1 + taxa_mensal) ** max_meses - 1) / taxa_mensal) < capital_alvo:
            # Não é atingível em max_meses
            return max_meses, False, []
        
        # Calcular iterativamente
        saldo = saldo_inicial
        meses = 0
        projecao = []
        while saldo < capital_alvo and meses < max_meses:
            meses += 1
            saldo = saldo * (1 + taxa_mensal) + aporte_mensal
            if meses % 12 == 0:  # A cada ano
                projecao.append({'ano': meses // 12, 'meses': meses, 'saldo': round(saldo, 2)})
        
        return meses, saldo >= capital_alvo, projecao
    except Exception:
        return max_meses, False, []

def get_status_integrado_metas():
    """
    Sistema completo integrado de metas:
    - Meta de patrimônio/renda (goal)
    - Meta de aporte (opcional)
    - Aporte real (calculado)
    - Projeções com diferentes cenários
    - Sugestões inteligentes
    """
    usuario = get_usuario_atual()
    if not usuario:
        return None
    
    # Obter goal (meta de patrimônio/renda)
    goal = get_goals()
    
    # Obter metas de aportes
    metas_aportes = get_metas_aportes()
    meta_aporte_ativa = metas_aportes[0] if metas_aportes else None
    
    # Calcular projeção da goal
    projecao_goal = None
    if goal:
        projecao_goal = compute_goals_projection(goal)
    
    # Calcular aportes reais (mês atual)
    hoje = datetime.now()
    aportes_reais_mes = calcular_aportes_reais('mensal', mes=hoje.month, ano=hoje.year)
    
    # Calcular aportes reais da meta (se houver)
    aportes_reais_meta = None
    if meta_aporte_ativa:
        status_aportes = get_status_aportes(meta_aporte_ativa.get('id'))
        if status_aportes:
            aportes_reais_meta = status_aportes.get('realizado', {})
    
    # Preparar resultado base
    resultado = {
        'goal': goal,
        'meta_aporte': meta_aporte_ativa,
        'projecao_goal': projecao_goal,
        'aportes_reais_mes': aportes_reais_mes,
        'aportes_reais_meta': aportes_reais_meta,
        'analise_completa': {},
        'projecoes': {},
        'sugestoes': []
    }
    
    if not goal or not projecao_goal:
        resultado['sugestoes'].append("Configure uma meta de patrimônio ou renda para ver análises completas")
        return resultado
    
    # Dados base
    saldo_atual = projecao_goal.get('saldo_inicial', 0)
    capital_alvo = projecao_goal.get('capital_alvo', 0)
    aporte_sugerido = projecao_goal.get('aporte_sugerido', 0)
    taxa_mensal = projecao_goal.get('taxa_mensal', 0)
    horizonte_meses = projecao_goal.get('horizonte_meses', 0)
    
    # Aportes
    aporte_real_mes = aportes_reais_mes.get('valor', 0) if aportes_reais_mes else 0
    aporte_meta_definida = meta_aporte_ativa.get('valor_meta', 0) if meta_aporte_ativa else 0
    
    # Usar aporte real da meta se disponível, senão usar do mês
    aporte_real_para_analise = aportes_reais_meta.get('valor', aporte_real_mes) if aportes_reais_meta else aporte_real_mes
    
    # Calcular projeções com diferentes cenários
    projecoes = {}
    
    # Cenário 1: Com aporte sugerido (ideal)
    if aporte_sugerido > 0:
        meses_ideal, atingivel_ideal, proj_ideal = calcular_projecao_com_aporte(
            saldo_atual, capital_alvo, aporte_sugerido, taxa_mensal
        )
        projecoes['com_aporte_sugerido'] = {
            'aporte_mensal': round(aporte_sugerido, 2),
            'meses_necessarios': meses_ideal,
            'atingivel': atingivel_ideal,
            'anos_necessarios': round(meses_ideal / 12, 1),
            'projecao_anual': proj_ideal
        }
    
    # Cenário 2: Com aporte real atual
    if aporte_real_para_analise > 0:
        meses_real, atingivel_real, proj_real = calcular_projecao_com_aporte(
            saldo_atual, capital_alvo, aporte_real_para_analise, taxa_mensal
        )
        projecoes['com_aporte_real'] = {
            'aporte_mensal': round(aporte_real_para_analise, 2),
            'meses_necessarios': meses_real,
            'atingivel': atingivel_real,
            'anos_necessarios': round(meses_real / 12, 1),
            'projecao_anual': proj_real
        }
    
    # Cenário 3: Com meta de aporte definida (se diferente)
    if aporte_meta_definida > 0 and aporte_meta_definida != aporte_real_para_analise:
        meses_meta, atingivel_meta, proj_meta = calcular_projecao_com_aporte(
            saldo_atual, capital_alvo, aporte_meta_definida, taxa_mensal
        )
        projecoes['com_meta_aporte'] = {
            'aporte_mensal': round(aporte_meta_definida, 2),
            'meses_necessarios': meses_meta,
            'atingivel': atingivel_meta,
            'anos_necessarios': round(meses_meta / 12, 1),
            'projecao_anual': proj_meta
        }
    
    # Análise completa
    progresso_objetivo = (saldo_atual / capital_alvo * 100) if capital_alvo > 0 else 0
    faltante_objetivo = max(0, capital_alvo - saldo_atual)
    
    # Comparação de aportes
    percentual_vs_sugerido = (aporte_real_para_analise / aporte_sugerido * 100) if aporte_sugerido > 0 else 0
    faltante_vs_sugerido = max(0, aporte_sugerido - aporte_real_para_analise)
    
    resultado['analise_completa'] = {
        'saldo_atual': round(saldo_atual, 2),
        'capital_alvo': round(capital_alvo, 2),
        'progresso_objetivo': round(progresso_objetivo, 2),
        'faltante_objetivo': round(faltante_objetivo, 2),
        'aporte_sugerido': round(aporte_sugerido, 2),
        'aporte_real': round(aporte_real_para_analise, 2),
        'aporte_meta_definida': round(aporte_meta_definida, 2),
        'percentual_vs_sugerido': round(percentual_vs_sugerido, 2),
        'faltante_vs_sugerido': round(faltante_vs_sugerido, 2),
        'taxa_mensal': round(taxa_mensal * 100, 4),
        'horizonte_original_meses': horizonte_meses
    }
    
    resultado['projecoes'] = projecoes
    
    # Gerar sugestões inteligentes
    sugestoes = []
    
    # Sugestão 1: Comparação com aporte sugerido
    if aporte_sugerido > 0:
        if aporte_real_para_analise < aporte_sugerido * 0.5:
            sugestoes.append({
                'tipo': 'critico',
                'titulo': 'Aporte muito abaixo do sugerido',
                'mensagem': f'Você está aportando R$ {aporte_real_para_analise:,.2f}, mas o sugerido é R$ {aporte_sugerido:,.2f}. Considere aumentar seus aportes para atingir sua meta no prazo desejado.',
                'acao_sugerida': f'Aumentar aporte para pelo menos R$ {aporte_sugerido * 0.7:,.2f}'
            })
        elif aporte_real_para_analise < aporte_sugerido:
            sugestoes.append({
                'tipo': 'atencao',
                'titulo': 'Aporte abaixo do sugerido',
                'mensagem': f'Você está aportando R$ {aporte_real_para_analise:,.2f}, mas o ideal seria R$ {aporte_sugerido:,.2f}. Isso pode atrasar o alcance da sua meta.',
                'acao_sugerida': f'Considere aumentar o aporte em R$ {faltante_vs_sugerido:,.2f} por mês'
            })
        elif aporte_real_para_analise >= aporte_sugerido:
            sugestoes.append({
                'tipo': 'sucesso',
                'titulo': 'Aporte adequado!',
                'mensagem': f'Parabéns! Você está aportando R$ {aporte_real_para_analise:,.2f}, que está acima ou igual ao sugerido de R$ {aporte_sugerido:,.2f}.',
                'acao_sugerida': 'Continue mantendo esse ritmo de aportes'
            })
    
    # Sugestão 2: Projeção de tempo
    if 'com_aporte_real' in projecoes:
        proj_real = projecoes['com_aporte_real']
        if proj_real['atingivel']:
            if proj_real['anos_necessarios'] > horizonte_meses / 12:
                sugestoes.append({
                    'tipo': 'atencao',
                    'titulo': 'Prazo estendido',
                    'mensagem': f'Com o aporte atual de R$ {aporte_real_para_analise:,.2f}, você atingirá sua meta em {proj_real["anos_necessarios"]} anos, mas sua meta original era {horizonte_meses / 12:.1f} anos.',
                    'acao_sugerida': f'Para atingir no prazo, aumente o aporte para R$ {aporte_sugerido:,.2f}'
                })
            else:
                sugestoes.append({
                    'tipo': 'sucesso',
                    'titulo': 'No caminho certo!',
                    'mensagem': f'Com o aporte atual, você atingirá sua meta em aproximadamente {proj_real["anos_necessarios"]} anos.',
                    'acao_sugerida': 'Continue mantendo esse ritmo'
                })
        else:
            sugestoes.append({
                'tipo': 'critico',
                'titulo': 'Meta pode não ser atingida',
                'mensagem': f'Com o aporte atual de R$ {aporte_real_para_analise:,.2f}, pode ser difícil atingir a meta no prazo desejado.',
                'acao_sugerida': f'Considere aumentar significativamente o aporte para R$ {aporte_sugerido:,.2f}'
            })
    
    # Sugestão 3: Progresso do objetivo
    if progresso_objetivo < 10:
        sugestoes.append({
            'tipo': 'info',
            'titulo': 'Início da jornada',
            'mensagem': f'Você está no início da jornada. Faltam R$ {faltante_objetivo:,.2f} para atingir seu objetivo.',
            'acao_sugerida': 'Mantenha a disciplina nos aportes mensais'
        })
    elif progresso_objetivo >= 50:
        sugestoes.append({
            'tipo': 'sucesso',
            'titulo': 'Mais da metade do caminho!',
            'mensagem': f'Parabéns! Você já atingiu {progresso_objetivo:.1f}% do seu objetivo.',
            'acao_sugerida': 'Continue firme, você está quase lá!'
        })
    
    # Sugestão 4: Comparação entre cenários
    if 'com_aporte_sugerido' in projecoes and 'com_aporte_real' in projecoes:
        proj_sugerido = projecoes['com_aporte_sugerido']
        proj_real = projecoes['com_aporte_real']
        diferenca_anos = proj_real['anos_necessarios'] - proj_sugerido['anos_necessarios']
        if diferenca_anos > 2:
            sugestoes.append({
                'tipo': 'atencao',
                'titulo': 'Diferença significativa',
                'mensagem': f'Aumentar o aporte de R$ {aporte_real_para_analise:,.2f} para R$ {aporte_sugerido:,.2f} reduziria o tempo em {diferenca_anos:.1f} anos.',
                'acao_sugerida': f'Considere aumentar o aporte em R$ {faltante_vs_sugerido:,.2f} por mês'
            })
    
    resultado['sugestoes'] = sugestoes
    
    return resultado

def get_status_aportes(meta_id=None):
    """
    Calcula status de aportes: realizado vs meta
    Se meta_id for None, usa a meta ativa mais recente
    """
    usuario = get_usuario_atual()
    if not usuario:
        return None
    
    metas = get_metas_aportes()
    if not metas:
        return None
    
    # Se não especificou meta_id, pega a mais recente
    if meta_id:
        meta = next((m for m in metas if m['id'] == meta_id), None)
    else:
        meta = metas[0] if metas else None
    
    if not meta:
        return None
    
    tipo_periodo = meta['tipo_periodo']
    data_inicio = meta['data_inicio']
    data_fim = meta['data_fim']
    
    # Calcular aportes reais
    hoje = datetime.now()
    aporte_real = None
    
    if tipo_periodo == 'mensal':
        # Meta mensal: calcular aportes do mês atual
        mes = hoje.month
        ano = hoje.year
        aporte_real = calcular_aportes_reais('mensal', mes=mes, ano=ano)
    elif tipo_periodo == 'rebalanceamento':
        # Meta por rebalanceamento: calcular desde data_inicio até data_fim ou hoje
        if data_fim:
            aporte_real = calcular_aportes_reais('rebalanceamento', data_inicio=data_inicio, data_fim=data_fim)
        else:
            # Se não tem data_fim, calcular até hoje
            aporte_real = calcular_aportes_reais('rebalanceamento', data_inicio=data_inicio, data_fim=hoje.strftime('%Y-%m-%d'))
    elif tipo_periodo == 'anual':
        # Meta anual: calcular aportes do ano atual
        ano = hoje.year
        aporte_real = calcular_aportes_reais('anual', ano=ano)
    
    if not aporte_real:
        aporte_real = {'valor': 0.0, 'quantidade_movimentacoes': 0}
    
    valor_realizado = aporte_real.get('valor', 0.0)
    valor_meta = meta.get('valor_meta', 0.0)
    faltante = max(0, valor_meta - valor_realizado)
    percentual_concluido = (valor_realizado / valor_meta * 100) if valor_meta > 0 else 0
    
    # Calcular sugestão mensal baseada no faltante e dias restantes
    sugestao_mensal = 0
    if faltante > 0:
        if tipo_periodo == 'mensal':
            dias_restantes = max(1, (datetime(hoje.year, hoje.month, 28) - hoje).days)
            sugestao_mensal = faltante / max(1, dias_restantes) * 30
        elif tipo_periodo == 'anual':
            dias_restantes = max(1, (datetime(hoje.year, 12, 31) - hoje).days)
            sugestao_mensal = faltante / max(1, dias_restantes) * 30
    
    # Gerar alertas
    alertas = []
    if percentual_concluido < 50 and faltante > 0:
        alertas.append(f"Meta abaixo de 50% - faltam R$ {faltante:,.2f}")
    if faltante > valor_meta * 0.3:
        alertas.append("Atenção: mais de 30% da meta ainda não foi atingida")
    
    return {
        'meta': meta,
        'realizado': {
            'valor': valor_realizado,
            'quantidade_movimentacoes': aporte_real.get('quantidade_movimentacoes', 0),
            'data_inicio': aporte_real.get('data_inicio'),
            'data_fim': aporte_real.get('data_fim')
        },
        'percentual_concluido': round(percentual_concluido, 2),
        'faltante': round(faltante, 2),
        'sugestao_mensal': round(sugestao_mensal, 2),
        'alertas': alertas
    }

def migrar_preco_compra_existente():
    """
    MIGRAÇÃO ÚNICA: Executa apenas uma vez para corrigir ativos existentes
    NÃO deve ser chamada automaticamente - apenas manualmente quando necessário
    """
    try:
        usuario = get_usuario_atual()
        if not usuario:
            return {"success": False, "message": "Usuário não autenticado"}

        print(f"DEBUG: Iniciando migração única de preco_compra para usuário {usuario}")
        migrados = 0
        
        if _is_postgres():
            conn = _pg_conn_for_user(usuario)
            try:
                with conn.cursor() as cursor:
                    # Buscar ativos sem preco_compra
                    cursor.execute('SELECT id, ticker FROM carteira WHERE preco_compra IS NULL')
                    ativos_sem_preco = cursor.fetchall()
                    
                    for ativo_id, ticker in ativos_sem_preco:
                        # Buscar primeira movimentação de compra
                        cursor.execute('''
                            SELECT preco FROM movimentacoes 
                            WHERE ticker = %s AND tipo = 'compra' 
                            ORDER BY data ASC LIMIT 1
                        ''', (ticker,))
                        primeira_compra = cursor.fetchone()
                        
                        if primeira_compra:
                            preco_compra = primeira_compra[0]
                            cursor.execute('''
                                UPDATE carteira SET preco_compra = %s WHERE id = %s
                            ''', (preco_compra, ativo_id))
                            print(f"DEBUG: Migrado preco_compra para {ticker}: {preco_compra}")
                            migrados += 1
                    
                    conn.commit()
            finally:
                conn.close()
        else:
            db_path = get_db_path(usuario, "carteira")
            conn = sqlite3.connect(db_path, check_same_thread=False)
            try:
                cursor = conn.cursor()
                # Buscar ativos sem preco_compra
                cursor.execute('SELECT id, ticker FROM carteira WHERE preco_compra IS NULL')
                ativos_sem_preco = cursor.fetchall()
                
                for ativo_id, ticker in ativos_sem_preco:
                    # Buscar primeira movimentação de compra
                    cursor.execute('''
                        SELECT preco FROM movimentacoes 
                        WHERE ticker = ? AND tipo = 'compra' 
                        ORDER BY data ASC LIMIT 1
                    ''', (ticker,))
                    primeira_compra = cursor.fetchone()
                    
                    if primeira_compra:
                        preco_compra = primeira_compra[0]
                        cursor.execute('''
                            UPDATE carteira SET preco_compra = ? WHERE id = ?
                        ''', (preco_compra, ativo_id))
                        print(f"DEBUG: Migrado preco_compra para {ticker}: {preco_compra}")
                        migrados += 1
                
                conn.commit()
            finally:
                conn.close()
        
        print(f"DEBUG: Migração concluída. {migrados} ativos migrados.")
        return {"success": True, "migrados": migrados}
    except Exception as e:
        print(f"Erro na migração de preco_compra: {e}")
        return {"success": False, "message": str(e)}

def _enriquecer_dados_fii(ativo):
    """Enriquece dados de FII com metadados do fii_scraper"""
    if not ativo.get('tipo') or 'fii' not in ativo.get('tipo', '').lower():
        return ativo
    
    try:
        from fii_scraper import obter_dados_fii_fundsexplorer
        ticker = ativo.get('ticker', '')
        metadata = obter_dados_fii_fundsexplorer(ticker)
        
        if metadata:
            ativo['tipo_fii'] = metadata.get('tipo')
            ativo['segmento_fii'] = metadata.get('segmento')
        else:
            ativo['tipo_fii'] = None
            ativo['segmento_fii'] = None
    except Exception as e:
        print(f"Erro ao enriquecer dados do FII {ativo.get('ticker')}: {e}")
        ativo['tipo_fii'] = None
        ativo['segmento_fii'] = None
    
    return ativo
def obter_carteira_com_metadados_fii():
    """Obtém carteira com metadados de FIIs (usado apenas quando necessário)"""
    try:
        usuario = get_usuario_atual()
        if not usuario:
            return {"success": False, "message": "Usuário não autenticado"}

        try:
            _ensure_indexador_schema()
        except Exception:
            pass

        if _is_postgres():
            conn = _pg_conn_for_user(usuario)
            try:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        SELECT id, ticker, nome_completo, quantidade, preco_atual, preco_compra, valor_total,
                               data_adicao, tipo, dy, pl, pvp, roe, indexador, indexador_pct, data_aplicacao, vencimento, isento_ir, liquidez_diaria, preco_medio
                        FROM carteira
                        ORDER BY valor_total DESC
                    ''')
                    rows = cursor.fetchall()
            finally:
                conn.close()
            ativos = []
            for row in rows:
                preco_compra = float(row[5]) if row[5] is not None else None
                vencimento = row[16] if len(row) > 16 else None
                tipo = row[8] if len(row) > 8 else "Desconhecido"
                
                status_vencimento = None
                if tipo and "renda fixa" in tipo.lower() and vencimento:
                    status_vencimento = _calcular_status_vencimento(vencimento)
                
                ativo = {
                    "id": row[0],
                    "ticker": row[1],
                    "nome_completo": row[2],
                    "quantidade": float(row[3]) if row[3] is not None else 0,
                    "preco_atual": float(row[4]) if row[4] is not None else 0,
                    "preco_compra": preco_compra,
                    "valor_total": float(row[6]) if row[6] is not None else 0,
                    "data_adicao": row[7],
                    "tipo": tipo,
                    "dy": float(row[9]) if row[9] is not None else None,
                    "pl": float(row[10]) if row[10] is not None else None,
                    "pvp": float(row[11]) if row[11] is not None else None,
                    "roe": float(row[12]) if row[12] is not None else None,
                    "indexador": row[13],
                    "indexador_pct": float(row[14]) if (len(row) > 14 and row[14] is not None) else None,
                    "vencimento": vencimento,
                    "status_vencimento": status_vencimento,
                    "preco_medio": float(row[18]) if (len(row) > 18 and row[18] is not None) else (preco_compra if preco_compra is not None else None),
                }
                
                ativos.append(ativo)
            return ativos
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, ticker, nome_completo, quantidade, preco_atual, preco_compra, valor_total,
                   data_adicao, tipo, dy, pl, pvp, roe, indexador, indexador_pct, data_aplicacao, vencimento, isento_ir, liquidez_diaria, preco_medio
            FROM carteira
            ORDER BY valor_total DESC
        ''')
        
        ativos = []
        for row in cursor.fetchall():
            row_len = len(row)
            preco_compra = row[5] if row_len > 5 else None
            vencimento = row[16] if row_len > 16 else None
            tipo = row[8] if row_len > 8 else "Desconhecido"
            
            status_vencimento = None
            if tipo and "renda fixa" in tipo.lower() and vencimento:
                status_vencimento = _calcular_status_vencimento(vencimento)
            
            ativo = {
                "id": row[0],
                "ticker": row[1],
                "nome_completo": row[2],
                "quantidade": row[3],
                "preco_atual": row[4],
                "preco_compra": preco_compra,
                "valor_total": row[6] if row_len > 6 else row[5],
                "data_adicao": row[7] if row_len > 7 else row[6],
                "tipo": tipo,
                "dy": row[9] if row_len > 9 else row[8],
                "pl": row[10] if row_len > 10 else row[9],
                "pvp": row[11] if row_len > 11 else row[10],
                "roe": row[12] if row_len > 12 else row[11],
                "indexador": row[13] if row_len > 13 else row[12],
                "indexador_pct": row[14] if row_len > 14 else row[13],
                "vencimento": vencimento,
                "status_vencimento": status_vencimento,
                "preco_medio": (row[18] if row_len > 18 else None) if (row_len > 18 and row[18] is not None) else (preco_compra if preco_compra is not None else None),
            }
            
            # REMOVIDO: Enriquecimento automático de FIIs (agora é sob demanda no frontend)
            # Isso melhora significativamente a performance do carregamento inicial
            ativos.append(ativo)
        
        conn.close()
        return ativos
    except Exception as e:
        print(f"Erro ao obter carteira com metadados: {e}")
        return []

def obter_carteira():

    try:
        usuario = get_usuario_atual()
        if not usuario:
            return {"success": False, "message": "Usuário não autenticado"}

        
        try:
            _ensure_indexador_schema()
            # REMOVIDO: migrar_preco_compra_existente() - causava reescrita de preços
        except Exception:
            pass

        if _is_postgres():
            conn = _pg_conn_for_user(usuario)
            try:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        SELECT id, ticker, nome_completo, quantidade, preco_atual, preco_compra, valor_total,
                               data_adicao, tipo, dy, pl, pvp, roe, indexador, indexador_pct, data_aplicacao, vencimento, isento_ir, liquidez_diaria
                        FROM carteira
                        ORDER BY valor_total DESC
                    ''')
                    rows = cursor.fetchall()
            finally:
                conn.close()
            ativos = []
            for row in rows:
                preco_compra = float(row[5]) if row[5] is not None else None
                vencimento = row[16] if len(row) > 16 else None
                tipo = row[8] if len(row) > 8 else "Desconhecido"
                

                status_vencimento = None
                if tipo and "renda fixa" in tipo.lower() and vencimento:
                    status_vencimento = _calcular_status_vencimento(vencimento)
                
                ativo = {
                    "id": row[0],
                    "ticker": row[1],
                    "nome_completo": row[2],
                    "quantidade": float(row[3]) if row[3] is not None else 0,
                    "preco_atual": float(row[4]) if row[4] is not None else 0,
                    "preco_compra": preco_compra,
                    "valor_total": float(row[6]) if row[6] is not None else 0,
                    "data_adicao": row[7],
                    "tipo": tipo,
                    "dy": float(row[9]) if row[9] is not None else None,
                    "pl": float(row[10]) if row[10] is not None else None,
                    "pvp": float(row[11]) if row[11] is not None else None,
                    "roe": float(row[12]) if row[12] is not None else None,
                    "indexador": row[13],
                    "indexador_pct": float(row[14]) if (len(row) > 14 and row[14] is not None) else None,
                    "vencimento": vencimento,
                    "status_vencimento": status_vencimento,
                }
                
                ativos.append(ativo)
            return ativos
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, ticker, nome_completo, quantidade, preco_atual, preco_compra, valor_total,
                   data_adicao, tipo, dy, pl, pvp, roe, indexador, indexador_pct, data_aplicacao, vencimento, isento_ir, liquidez_diaria
            FROM carteira
            ORDER BY valor_total DESC
        ''')
        
        ativos = []
        for row in cursor.fetchall():
            row_len = len(row)
            preco_compra = row[5] if row_len > 5 else None
            vencimento = row[16] if row_len > 16 else None
            tipo = row[8] if row_len > 8 else "Desconhecido"
            
            # Calcular status de vencimento para renda fixa
            status_vencimento = None
            if tipo and "renda fixa" in tipo.lower() and vencimento:
                status_vencimento = _calcular_status_vencimento(vencimento)
            
            ativo = {
                "id": row[0],
                "ticker": row[1],
                "nome_completo": row[2],
                "quantidade": row[3],
                "preco_atual": row[4],
                "preco_compra": preco_compra,
                "valor_total": row[6] if row_len > 6 else row[5],
                "data_adicao": row[7] if row_len > 7 else row[6],
                "tipo": tipo,
                "dy": row[9] if row_len > 9 else row[8],
                "pl": row[10] if row_len > 10 else row[9],
                "pvp": row[11] if row_len > 11 else row[10],
                "roe": row[12] if row_len > 12 else row[11],
                "indexador": row[13] if row_len > 13 else row[12],
                "indexador_pct": row[14] if row_len > 14 else row[13],
                "vencimento": vencimento,
                "status_vencimento": status_vencimento,
            }
            
            # REMOVIDO: Enriquecimento automático de FIIs (agora é sob demanda no frontend)
            # Isso melhora significativamente a performance do carregamento inicial
            ativos.append(ativo)
        
        conn.close()
        return ativos
    except Exception as e:
        print(f"Erro ao obter carteira: {e}")
        return []

# ==================== REBALANCEAMENTO ====================

def save_rebalance_config(periodo: str, targets: dict, last_rebalance_date: str | None = None):
    import json as _json
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}
    _ensure_rebalance_schema()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    targets_json = _json.dumps(targets or {})
    # start_date: se não existe, define como agora; se existe, mantém
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('SELECT id, start_date FROM rebalance_config LIMIT 1')
                row = c.fetchone()
                if row:
                    start = row[1] or now
                    c.execute('UPDATE rebalance_config SET periodo=%s, targets_json=%s, last_rebalance_date=%s, updated_at=%s WHERE id=%s',
                              (periodo, targets_json, last_rebalance_date, now, row[0]))
                else:
                    c.execute('INSERT INTO rebalance_config (periodo, targets_json, start_date, last_rebalance_date, updated_at) VALUES (%s, %s, %s, %s, %s)',
                              (periodo, targets_json, now, last_rebalance_date, now))
        finally:
            conn.close()
        return {"success": True}
    # sqlite
    db_path = get_db_path(usuario, "carteira")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        c = conn.cursor()
        c.execute('SELECT id, start_date FROM rebalance_config LIMIT 1')
        row = c.fetchone()
        if row:
            start = row[1] or now
            c.execute('UPDATE rebalance_config SET periodo=?, targets_json=?, last_rebalance_date=?, updated_at=? WHERE id=?',
                      (periodo, targets_json, last_rebalance_date, now, row[0]))
        else:
            c.execute('INSERT INTO rebalance_config (periodo, targets_json, start_date, last_rebalance_date, updated_at) VALUES (?, ?, ?, ?, ?)',
                      (periodo, targets_json, now, last_rebalance_date, now))
        conn.commit()
    finally:
        conn.close()
    return {"success": True}

def get_rebalance_config():
    import json as _json
    usuario = get_usuario_atual()
    if not usuario:
        return None
    _ensure_rebalance_schema()
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('SELECT periodo, targets_json, start_date, last_rebalance_date, updated_at FROM rebalance_config LIMIT 1')
                row = c.fetchone()
                if not row:
                    return None
                periodo, targets_json, start_date, last_rebalance_date, updated_at = row
                return {
                    'periodo': periodo,
                    'targets': _json.loads(targets_json or '{}'),
                    'start_date': start_date,
                    'last_rebalance_date': last_rebalance_date,
                    'updated_at': updated_at,
                }
        finally:
            conn.close()
    db_path = get_db_path(usuario, "carteira")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        c = conn.cursor()
        c.execute('SELECT periodo, targets_json, start_date, last_rebalance_date, updated_at FROM rebalance_config LIMIT 1')
        row = c.fetchone()
        if not row:
            return None
        periodo, targets_json, start_date, last_rebalance_date, updated_at = row
        return {
            'periodo': periodo,
            'targets': json.loads(targets_json or '{}'),
            'start_date': start_date,
            'last_rebalance_date': last_rebalance_date,
            'updated_at': updated_at,
        }
    finally:
        conn.close()

def compute_rebalance_status():
    from datetime import datetime as _dt
    usuario = get_usuario_atual()
    if not usuario:
        return {"error": "Não autenticado"}
    _ensure_rebalance_schema()
    cfg = get_rebalance_config()
    carteira = obter_carteira() or []
    if not cfg or not carteira:
        return {
            'configured': bool(cfg),
            'can_rebalance': False,
            'since_start_days': None,
            'current_distribution': {},
            'targets': cfg.get('targets') if cfg else {},
            'periodo': cfg.get('periodo') if cfg else None,
            'deviations': {},
            'suggestions': [],
        }
    # distribuição atual por tipo
    total = sum((it.get('valor_total') or 0.0) for it in carteira)
    dist = {}
    for it in carteira:
        tipo = it.get('tipo') or 'Desconhecido'
        dist[tipo] = dist.get(tipo, 0.0) + float(it.get('valor_total') or 0.0)
    dist_pct = {k: (v/total*100.0 if total>0 else 0.0) for k, v in dist.items()}
    # metas
    targets = cfg.get('targets') or {}
    # desvios
    deviations = {}
    for tipo, tgt in targets.items():
        cur = dist_pct.get(tipo, 0.0)
        deviations[tipo] = cur - float(tgt or 0.0)
    # datas e janela
    start_str = cfg.get('start_date')
    last_str = cfg.get('last_rebalance_date')
    try:
        since_days = ( _dt.now() - _dt.strptime(start_str[:19], '%Y-%m-%d %H:%M:%S') ).days if start_str else None
    except Exception:
        since_days = None
    periodo = (cfg.get('periodo') or 'mensal').lower()
    period_days = {'mensal': 30, 'trimestral': 90, 'semestral': 180, 'anual': 365}.get(periodo, 30)
 
    base_date = None
    try:
        if last_str:
            base_date = _dt.strptime(last_str[:19], '%Y-%m-%d %H:%M:%S')
        elif start_str:
            base_date = _dt.strptime(start_str[:19], '%Y-%m-%d %H:%M:%S')
    except Exception:
        base_date = None
    next_due = None
    days_until_next = None
    if base_date:
        next_due = base_date + timedelta(days=period_days)
        days_until_next = (next_due - _dt.now()).days
    can_rebalance = (days_until_next is not None) and (days_until_next <= 0)
    
    suggestions = []
    for tipo, tgt in targets.items():
        cur_val = dist.get(tipo, 0.0)
        tgt_val = (float(tgt or 0.0)/100.0) * total
        diff_val = tgt_val - cur_val
        if abs(diff_val) < 1e-6:
            continue
        action = 'comprar' if diff_val > 0 else 'vender'
        suggestions.append({
            'classe': tipo,
            'acao': action,
            'valor': abs(diff_val)
        })
    return {
        'configured': True,
        'can_rebalance': can_rebalance,
        'since_start_days': since_days,
        'period_days': period_days,
        'periodo': periodo,
        'current_distribution': dist_pct,
        'targets': targets,
        'deviations': deviations,
        'suggestions': suggestions,
        'last_rebalance_date': last_str,
        'next_due_date': next_due.strftime('%Y-%m-%d %H:%M:%S') if next_due else None,
        'days_until_next': days_until_next,
    }

def registrar_rebalance_event(date_str: str | None = None):
    
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}
    _ensure_rebalance_schema()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    event_date = date_str or now
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('INSERT INTO rebalance_history (data, created_at) VALUES (%s, %s)', (event_date, now))
                c.execute('UPDATE rebalance_config SET last_rebalance_date=%s, updated_at=%s', (event_date, now))
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "carteira")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            cur.execute('INSERT INTO rebalance_history (data, created_at) VALUES (?, ?)', (event_date, now))
            cur.execute('UPDATE rebalance_config SET last_rebalance_date=?, updated_at=?', (event_date, now))
            conn.commit()
        finally:
            conn.close()
    return {"success": True}

def get_rebalance_history():
    usuario = get_usuario_atual()
    if not usuario:
        return []
    _ensure_rebalance_schema()
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as c:
                c.execute('SELECT data FROM rebalance_history ORDER BY id DESC')
                return [r[0] for r in c.fetchall()]
        finally:
            conn.close()
    db_path = get_db_path(usuario, "carteira")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        cur = conn.cursor()
        cur.execute('SELECT data FROM rebalance_history ORDER BY id DESC')
        return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()

def registrar_movimentacao(data, ticker, nome_completo, quantidade, preco, tipo, conn=None):

    try:
        usuario = get_usuario_atual()
        if not usuario:
            return {"success": False, "message": "Usuário não autenticado"}

        should_close = False
        local_conn = None
        if _is_postgres():
            # Se uma conexão foi passada, usar ela; senão criar nova
            if conn is not None:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS movimentacoes (
                            id SERIAL PRIMARY KEY,
                            data TEXT NOT NULL,
                            ticker TEXT NOT NULL,
                            nome_completo TEXT,
                            quantidade NUMERIC NOT NULL,
                            preco NUMERIC NOT NULL,
                            tipo TEXT NOT NULL
                        )
                    ''')
                    cursor.execute(
                        'INSERT INTO movimentacoes (data, ticker, nome_completo, quantidade, preco, tipo) VALUES (%s, %s, %s, %s, %s, %s)',
                        (data, ticker, nome_completo, quantidade, preco, tipo)
                    )
                    # CRÍTICO: Commit da movimentação no PostgreSQL
                    conn.commit()
            else:
                pg_conn = _pg_conn_for_user(usuario)
                try:
                    with pg_conn.cursor() as cursor:
                        cursor.execute('''
                            CREATE TABLE IF NOT EXISTS movimentacoes (
                                id SERIAL PRIMARY KEY,
                                data TEXT NOT NULL,
                                ticker TEXT NOT NULL,
                                nome_completo TEXT,
                                quantidade NUMERIC NOT NULL,
                                preco NUMERIC NOT NULL,
                                tipo TEXT NOT NULL
                            )
                        ''')
                        cursor.execute(
                            'INSERT INTO movimentacoes (data, ticker, nome_completo, quantidade, preco, tipo) VALUES (%s, %s, %s, %s, %s, %s)',
                            (data, ticker, nome_completo, quantidade, preco, tipo)
                        )
                        pg_conn.commit()
                finally:
                    pg_conn.close()
        else:
            if conn is None:
                db_path = get_db_path(usuario, "carteira")
                local_conn = sqlite3.connect(db_path, check_same_thread=False)
                should_close = True
            else:
                should_close = False
            cursor = (conn or local_conn).cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS movimentacoes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data TEXT NOT NULL,
                    ticker TEXT NOT NULL,
                    nome_completo TEXT,
                    quantidade REAL NOT NULL,
                    preco REAL NOT NULL,
                    tipo TEXT NOT NULL
                )
            ''')
            cursor.execute('''
                INSERT INTO movimentacoes (data, ticker, nome_completo, quantidade, preco, tipo)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (data, ticker, nome_completo, quantidade, preco, tipo))
            if should_close and local_conn:
                local_conn.commit()
                local_conn.close()
        
        return {"success": True, "message": "Movimentação registrada com sucesso"}
    except Exception as e:
        try:
            if should_close and local_conn:
                local_conn.close()
        except Exception:
            pass
        return {"success": False, "message": f"Erro ao registrar movimentação: {str(e)}"}

def obter_movimentacoes(mes=None, ano=None):

    try:
        usuario = get_usuario_atual()
        if not usuario:
            return []

        if _is_postgres():
            conn = _pg_conn_for_user(usuario)
            try:
                with conn.cursor() as cursor:
                    if mes and ano:
                        mes_int = int(mes)
                        ano_int = int(ano)
                        if mes_int == 12:
                            prox_ano, prox_mes = ano_int + 1, 1
                        else:
                            prox_ano, prox_mes = ano_int, mes_int + 1
                        inicio = f"{ano_int}-{mes_int:02d}-01"
                        fim = f"{prox_ano}-{prox_mes:02d}-01"
                        cursor.execute('SELECT * FROM movimentacoes WHERE data >= %s AND data < %s ORDER BY data DESC', (inicio, fim))
                    elif ano:
                        ano_int = int(ano)
                        inicio = f"{ano_int}-01-01"
                        fim = f"{ano_int+1}-01-01"
                        cursor.execute('SELECT * FROM movimentacoes WHERE data >= %s AND data < %s ORDER BY data DESC', (inicio, fim))
                    else:
                        cursor.execute('SELECT * FROM movimentacoes ORDER BY data DESC')
                    rows = cursor.fetchall()
            finally:
                conn.close()
        else:
            db_path = get_db_path(usuario, "carteira")
            conn = sqlite3.connect(db_path, check_same_thread=False)
            cursor = conn.cursor()
            if mes and ano:
                mes_int = int(mes)
                ano_int = int(ano)
                if mes_int == 12:
                    prox_ano, prox_mes = ano_int + 1, 1
                else:
                    prox_ano, prox_mes = ano_int, mes_int + 1
                inicio = f"{ano_int}-{mes_int:02d}-01"
                fim = f"{prox_ano}-{prox_mes:02d}-01"
                cursor.execute('SELECT * FROM movimentacoes WHERE data >= ? AND data < ? ORDER BY data DESC', (inicio, fim))
            elif ano:
                ano_int = int(ano)
                inicio = f"{ano_int}-01-01"
                fim = f"{ano_int+1}-01-01"
                cursor.execute('SELECT * FROM movimentacoes WHERE data >= ? AND data < ? ORDER BY data DESC', (inicio, fim))
            else:
                cursor.execute('SELECT * FROM movimentacoes ORDER BY data DESC')
            rows = cursor.fetchall()
        
        movimentacoes = []
        for row in rows:
            movimentacoes.append({
                "id": row[0],
                "data": row[1],
                "ticker": row[2],
                "nome_completo": row[3],
                "quantidade": row[4],
                "preco": row[5],
                "tipo": row[6]
            })
        
        return movimentacoes
    except Exception as e:
        print(f"Erro ao obter movimentações: {e}")
        return []

def obter_historico_carteira(periodo='mensal'):
    
    try:
        print(f"DEBUG: obter_historico_carteira chamada com período: {periodo}")
        usuario = get_usuario_atual()
        if not usuario:
            print("DEBUG: Usuário não encontrado")
            return []
            
        if _is_postgres():
            conn = _pg_conn_for_user(usuario)
            try:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        SELECT data, ticker, quantidade, preco, tipo 
                        FROM movimentacoes 
                        ORDER BY data ASC
                    """)
                    movimentacoes = cursor.fetchall()
            finally:
                conn.close()
        else:
            db_path = get_db_path(usuario, "carteira")
            conn = sqlite3.connect(db_path, check_same_thread=False)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT data, ticker, quantidade, preco, tipo 
                FROM movimentacoes 
                ORDER BY data ASC
            """)
            movimentacoes = cursor.fetchall()
        
        print(f"DEBUG: Encontradas {len(movimentacoes)} movimentações para usuário {usuario}")
        
        if not movimentacoes:
            print("DEBUG: Nenhuma movimentação encontrada")
            return []
        

        print("DEBUG: Primeiras 3 movimentações:")
        for i, mov in enumerate(movimentacoes[:3]):
            print(f"  {i+1}. Data: '{mov[0]}', Ticker: {mov[1]}, Qtd: {mov[2]}, Preço: {mov[3]}")
        
      
        historico = []
        posicoes = {}  
        
      
        for mov in movimentacoes:
            data_mov = mov[0]
            ticker = mov[1]
            quantidade = float(mov[2])
            preco = float(mov[3])
            
    
 
            

            if ticker in posicoes:
                posicoes[ticker] += quantidade
            else:
                posicoes[ticker] = quantidade
            
            
            patrimonio_total = 0
            for ticker_pos, qtd in posicoes.items():
                if qtd > 0:
                    
                    patrimonio_total += qtd * preco
            
          
            item_historico = {
                'data': data_mov[:10],  
                'valor_total': patrimonio_total
            }
            historico.append(item_historico)
            print(f"DEBUG: Adicionado ao histórico: {item_historico}")
        
        print(f"DEBUG: Total de {len(historico)} itens no histórico")
        print("DEBUG: Primeiros 3 itens do histórico:")
        for i, item in enumerate(historico[:3]):
            print(f"  {i+1}. {item}")
        
        return historico
        
    except Exception as e:
        print(f"Erro ao obter histórico da carteira: {e}")
        import traceback
        traceback.print_exc()
        return []


def _month_end(dt: datetime) -> datetime:
    return ((dt.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1))


def _gerar_pontos_tempo(gran: str, data_inicio: datetime, data_fim: datetime) -> list:

    pontos = []
    if gran == 'semanal':
        # Normalizar para a segunda-feira da semana de data_inicio
        start_day = datetime(data_inicio.year, data_inicio.month, data_inicio.day)
        start_monday = start_day - timedelta(days=start_day.weekday())
        atual = datetime(start_monday.year, start_monday.month, start_monday.day)
        while atual <= data_fim:
            pontos.append(datetime(atual.year, atual.month, atual.day))
            atual = atual + timedelta(days=7)
        return pontos
    # Default: pontos mensais
    atual = datetime(data_inicio.year, data_inicio.month, 1)
    fim = datetime(data_fim.year, data_fim.month, 1)
    while atual <= fim:
        pontos.append(_month_end(atual))
        atual = (atual.replace(day=28) + timedelta(days=4)).replace(day=1)
    return pontos
def obter_historico_carteira_comparado(agregacao: str = 'mensal'):
    
    try:
        usuario = get_usuario_atual()
        if not usuario:
            return {"datas": [], "carteira": [], "ibov": [], "ivvb11": [], "ifix": [], "ipca": [], "cdi": [], "carteira_valor": [], "carteira_price": []}

        if _is_postgres():
            conn = _pg_conn_for_user(usuario)
            try:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        SELECT data, ticker, quantidade, preco, tipo 
                        FROM movimentacoes 
                        ORDER BY data ASC
                    """)
                    movimentos = cursor.fetchall()
            finally:
                conn.close()
        else:
            db_path = get_db_path(usuario, "carteira")
            conn = sqlite3.connect(db_path, check_same_thread=False)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT data, ticker, quantidade, preco, tipo 
                FROM movimentacoes 
                ORDER BY data ASC
            """)
            movimentos = cursor.fetchall()

        if not movimentos:
            return {"datas": [], "carteira": [], "ibov": [], "ivvb11": [], "ifix": [], "ipca": [], "cdi": [], "carteira_valor": [], "carteira_price": []}


        datas_mov = [datetime.strptime(m[0][:10], '%Y-%m-%d') for m in movimentos]
        data_ini = min(datas_mov)
        data_fim = datetime.now()

        # granularidade pedida via agregacao
        gran = agregacao if agregacao in ('mensal','trimestral','semestral','anual','maximo','semanal') else 'mensal'
        pontos = _gerar_pontos_tempo(gran, data_ini, data_fim)


        tickers = sorted(list({m[1] for m in movimentos}))
        ticker_to_hist = {}
        
        # Paralelização: busca histórico de múltiplos tickers simultaneamente
        def _buscar_historico_ticker(tk):
            """Função auxiliar para buscar histórico de um ticker"""
            try:
                yf_ticker = yf.Ticker(tk)
                hist = yf_ticker.history(start=data_ini - timedelta(days=5), end=data_fim + timedelta(days=5))
               
                try:
                    if hasattr(hist.index, 'tz') and hist.index.tz is not None:
                        hist.index = hist.index.tz_localize(None)
                except Exception:
                    pass
                return (tk, hist)
            except Exception:
                return (tk, None)
        
        if tickers:
            
            max_workers = min(len(tickers), 200)  # Até 200 workers simultâneos
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Submete todas as tarefas
                future_to_ticker = {
                    executor.submit(_buscar_historico_ticker, tk): tk 
                    for tk in tickers
                }
                
                # Coleta resultados conforme terminam
                for future in as_completed(future_to_ticker):
                    try:
                        tk, hist = future.result()
                        ticker_to_hist[tk] = hist
                    except Exception:
                        tk = future_to_ticker[future]
                        ticker_to_hist[tk] = None


        def price_on_or_before(hist_df, dt):
            if hist_df is None or hist_df.empty:
                return None
            
            try:
                sub = hist_df[hist_df.index <= dt]
                if sub.empty:
                    return None
                return float(sub['Close'].iloc[-1])
            except Exception:
                return None


        mov_by_ticker = {}
        for data_str, tk, qtd, preco, tipo in movimentos:
            dt = datetime.strptime(data_str[:10], '%Y-%m-%d')
            mov_by_ticker.setdefault(tk, []).append((dt, float(qtd if qtd is not None else 0.0), str(tipo)))

        def quantity_until(tk, dt):
            q = 0.0
            for mdt, mq, mtype in mov_by_ticker.get(tk, []):
                if mdt <= dt:
                    if mtype == 'venda':
                        q -= mq
                    else:
                        q += mq
            return q

 
        carteira_vals = []
        datas_labels = []
        for pt in pontos:
            total = 0.0
            for tk in tickers:
                q = quantity_until(tk, pt)
                if q <= 0:
                    continue
                price = price_on_or_before(ticker_to_hist.get(tk), pt)
                if price is None:
                    continue
                total += q * price
            carteira_vals.append(total)
            if gran == 'semanal':
                datas_labels.append(pt.strftime('%Y-%m-%d'))
            else:
                datas_labels.append(pt.strftime('%Y-%m'))

 
        indices_map = {
            'ibov': ['^BVSP', 'BOVA11.SA'],
            'ivvb11': ['IVVB11.SA'],
            'ifix': ['^IFIX', 'XFIX11.SA']
        }
        indices_vals = {k: [] for k in indices_map.keys()}
        
        
        def _buscar_indice_historico(key, candidates):
           
            for cand in candidates:
                try:
                    h = yf.Ticker(cand).history(start=data_ini - timedelta(days=5), end=data_fim + timedelta(days=5))
                    if h is not None and not h.empty:
                        try:
                            if hasattr(h.index, 'tz') and h.index.tz is not None:
                                h.index = h.index.tz_localize(None)
                        except Exception:
                            pass
                        return (key, h)
                except Exception:
                    continue
            return (key, None)
        

        indices_hist = {}
        with ThreadPoolExecutor(max_workers=200) as executor:  
            future_to_key = {
                executor.submit(_buscar_indice_historico, key, candidates): key 
                for key, candidates in indices_map.items()
            }
            
            for future in as_completed(future_to_key):
                try:
                    key, hist = future.result()
                    indices_hist[key] = hist
                except Exception:
                    key = future_to_key[future]
                    indices_hist[key] = None
        

        for key in indices_map.keys():
            hist = indices_hist.get(key)
            for pt in pontos:
                price = price_on_or_before(hist, pt) if hist is not None else None
                indices_vals[key].append(float(price) if price is not None else None)


        ipca_series = []
        try:
            import requests
            url = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json'
            resp = requests.get(url, timeout=10)
            if resp.ok:
                dados = resp.json()

                ipca_map = {}
                for item in dados:
                    data_br = item['data']  
                    dia, mes, ano = data_br.split('/')
                    chave = f"{ano}-{mes}"
                    ipca_map[chave] = float(item['valor'])

                base = 100.0
                for lab in datas_labels:
                    var = ipca_map.get(lab)
                    if var is not None:
                        base *= (1.0 + var/100.0)
                    ipca_series.append(base)
        except Exception:
            ipca_series = [None for _ in datas_labels]


        cdi_series = []
        try:
            import requests
            start_date = data_ini.strftime('%d/%m/%Y')
            end_date = data_fim.strftime('%d/%m/%Y')
            url_cdi = (
                f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json"
                f"&dataInicial={start_date}&dataFinal={end_date}"
            )
            r = requests.get(url_cdi, timeout=10)
            if r.ok:
                arr = r.json() or []
                
                def _parse_br_date(d):
                    try:
                        dd, mm, yy = d.split('/')
                        return datetime(int(yy), int(mm), int(dd))
                    except Exception:
                        return None
                arr_sorted = sorted(
                    [( _parse_br_date(it.get('data')), it.get('valor') ) for it in arr if it.get('data') and it.get('valor')],
                    key=lambda x: (x[0] or datetime.min)
                )
                base = 100.0
                last_by_month = {}
                for dt, valor in arr_sorted:
                    if dt is None:
                        continue
                    try:
                        taxa_aa = float(str(valor).replace(',', '.'))
                    except Exception:
                        continue
                    
                    try:
                        daily_factor = (1.0 + taxa_aa/100.0) ** (1.0/252.0)
                    except Exception:
                        daily_factor = 1.0
                    base *= daily_factor
                    lab = f"{dt.year}-{str(dt.month).zfill(2)}"
                    last_by_month[lab] = base
                
                for i, lab in enumerate(datas_labels):
                    if lab in last_by_month:
                        cdi_series.append(last_by_month[lab])
                    else:
                        cdi_series.append(cdi_series[-1] if cdi_series else None)
            else:
                cdi_series = [None for _ in datas_labels]
        except Exception:
            cdi_series = [None for _ in datas_labels]


        def rebase(series):
            vals = [v for v in series if v is not None and v > 0]
            if not vals:
                return [None for _ in series]
            base = vals[0]
            return [ (v / base * 100.0) if (v is not None and v > 0) else None for v in series ]


        def reduce_by_granularity(labels, series_dict, gran):

            if gran in ('mensal', 'maximo', 'semanal'):
                return labels, series_dict
            keep_months = {
                'trimestral': {3, 6, 9, 12},
                'semestral': {6, 12},
                'anual': {12}
            }.get(gran, None)
            if keep_months is None:
                return labels, series_dict
            idxs = []
            for i, lab in enumerate(labels):
                try:
                    if '-' in lab and len(lab) == 7:  
                        _, m = lab.split('-')
                        m_int = int(m)
                    else:
                        
                        parts = lab.split('-')
                        m_int = int(parts[1]) if len(parts) >= 2 else 12
                except Exception:
                    m_int = 12
                if m_int in keep_months or i == len(labels) - 1:
                    idxs.append(i)
            new_labels = [labels[i] for i in idxs]
            new_series = {k: [v[i] for i in idxs] for k, v in series_dict.items()}
            return new_labels, new_series

        series_dict = {
            'carteira': carteira_vals,
            'ibov': indices_vals['ibov'],
            'ivvb11': indices_vals['ivvb11'],
            'ifix': indices_vals['ifix'],
            'ipca': ipca_series if ipca_series else [None for _ in datas_labels],
            'cdi': cdi_series if cdi_series else [None for _ in datas_labels]
        }
        datas_labels, series_dict = reduce_by_granularity(datas_labels, series_dict, gran)

        carteira_price_base = []
        if pontos:
            base_val = 100.0
            carteira_price_base.append(base_val)
            for i in range(1, len(pontos)):
                prev_pt = pontos[i-1]
                cur_pt = pontos[i]
                V_prev = 0.0
                V_cur = 0.0
                for tk in tickers:
                    q_prev = quantity_until(tk, prev_pt)
                    if q_prev <= 0:
                        continue
                    p_prev = price_on_or_before(ticker_to_hist.get(tk), prev_pt)
                    p_cur = price_on_or_before(ticker_to_hist.get(tk), cur_pt)
                    if p_prev is None or p_cur is None:
                        continue
                    V_prev += q_prev * p_prev
                    V_cur += q_prev * p_cur
                if V_prev and V_prev > 0:
                    sub_return = V_cur / V_prev
                    base_val = base_val * sub_return
               
                carteira_price_base.append(base_val)

        if gran == 'semanal':
            labels_full = [pt.strftime('%Y-%m-%d') for pt in pontos]
        else:
            labels_full = [pt.strftime('%Y-%m') for pt in pontos]
      
        carteira_price_series = []
        label_to_price = {labels_full[i]: carteira_price_base[i] for i in range(len(labels_full))} if pontos else {}
        for lab in datas_labels:
            carteira_price_series.append(label_to_price.get(lab, None))

        carteira_rebased = rebase(series_dict['carteira'])
        ibov_rebased = rebase(series_dict['ibov'])
        ivvb_rebased = rebase(series_dict['ivvb11'])
        ifix_rebased = rebase(series_dict['ifix'])
        ipca_rebased = rebase(series_dict['ipca']) if series_dict['ipca'] else [None for _ in datas_labels]
        cdi_rebased = rebase(series_dict['cdi']) if series_dict['cdi'] else [None for _ in datas_labels]

        return {
            "datas": datas_labels,
            "carteira": carteira_rebased,
            "ibov": ibov_rebased,
            "ivvb11": ivvb_rebased,
            "ifix": ifix_rebased,
            "ipca": ipca_rebased,
            "cdi": cdi_rebased,
            "carteira_valor": series_dict['carteira'],
            "carteira_price": carteira_price_series,
        }
    except Exception as e:
        print(f"Erro em obter_historico_carteira_comparado: {e}")
        return {"datas": [], "carteira": [], "ibov": [], "ivvb11": [], "ifix": [], "ipca": [], "cdi": [], "carteira_valor": [], "carteira_price": []}


# ==================== FUNÇÕES DE CONTROLE FINANCEIRO ====================

def init_controle_db(usuario=None):

    if not usuario:
        usuario = get_usuario_atual()
        if not usuario:
            raise ValueError("Usuário não especificado")
    
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS receitas (
                        id SERIAL PRIMARY KEY,
                        nome TEXT NOT NULL,
                        valor NUMERIC NOT NULL,
                        data TEXT NOT NULL,
                        categoria TEXT,
                        tipo TEXT,
                        recorrencia TEXT,
                        parcelas_total INTEGER,
                        parcela_atual INTEGER,
                        grupo_parcela TEXT,
                        observacao TEXT
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS cartoes (
                        id SERIAL PRIMARY KEY,
                        nome TEXT NOT NULL,
                        valor NUMERIC NOT NULL,
                        pago TEXT NOT NULL,
                        data TEXT NOT NULL,
                        categoria TEXT,
                        tipo TEXT,
                        recorrencia TEXT,
                        parcelas_total INTEGER,
                        parcela_atual INTEGER,
                        grupo_parcela TEXT,
                        observacao TEXT
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS cartoes_cadastrados (
                        id SERIAL PRIMARY KEY,
                        nome TEXT NOT NULL,
                        bandeira TEXT NOT NULL,
                        limite NUMERIC NOT NULL,
                        vencimento INTEGER NOT NULL,
                        cor TEXT NOT NULL,
                        ativo BOOLEAN DEFAULT TRUE,
                        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        pago BOOLEAN DEFAULT FALSE,
                        mes_pagamento INTEGER,
                        ano_pagamento INTEGER,
                        data_pagamento TIMESTAMP
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS compras_cartao (
                        id SERIAL PRIMARY KEY,
                        cartao_id INTEGER NOT NULL,
                        nome TEXT NOT NULL,
                        valor NUMERIC NOT NULL,
                        data TEXT NOT NULL,
                        categoria TEXT,
                        observacao TEXT,
                        FOREIGN KEY (cartao_id) REFERENCES cartoes_cadastrados(id) ON DELETE CASCADE
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS outros_gastos (
                        id SERIAL PRIMARY KEY,
                        nome TEXT NOT NULL,
                        valor NUMERIC NOT NULL,
                        data TEXT NOT NULL,
                        categoria TEXT,
                        tipo TEXT,
                        recorrencia TEXT,
                        parcelas_total INTEGER,
                        parcela_atual INTEGER,
                        grupo_parcela TEXT,
                        observacao TEXT
                    )
                ''')
                
                # ==================== ÍNDICES OTIMIZADOS PARA CONTROLE FINANCEIRO ====================
                # OTIMIZAÇÃO: Índices criados dentro do schema do usuário (isolamento garantido)
                
                # RECEITAS - Índices para filtros por data (carregamento mensal)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_receitas_data ON receitas(data)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_receitas_categoria ON receitas(categoria)")
                
                # CARTOES - Índices para filtros por data e status
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_data ON cartoes(data)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_pago ON cartoes(pago)")
                
                # OUTROS GASTOS - Índices para filtros por data e categoria
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_outros_gastos_data ON outros_gastos(data)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_outros_gastos_categoria ON outros_gastos(categoria)")
                
                # CARTOES CADASTRADOS - Índices para filtros por status
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_cadastrados_ativo ON cartoes_cadastrados(ativo)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_cadastrados_mes_ano ON cartoes_cadastrados(mes_pagamento, ano_pagamento)")
                
                # COMPRAS CARTAO - Índices para relacionamento e filtros
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_compras_cartao_cartao_id ON compras_cartao(cartao_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_compras_cartao_data ON compras_cartao(data)")
                
                # Índices críticos para performance - Controle PostgreSQL
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_receitas_data ON receitas(data)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_receitas_categoria ON receitas(categoria)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_data ON cartoes(data)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_pago ON cartoes(pago)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_outros_data ON outros_gastos(data)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_outros_categoria ON outros_gastos(categoria)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_compras_cartao_id ON compras_cartao(cartao_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_compras_cartao_data ON compras_cartao(data)")
                # Adicionar colunas de pagamento se não existirem
                try:
                    cursor.execute("ALTER TABLE cartoes_cadastrados ADD COLUMN pago BOOLEAN DEFAULT FALSE")
                except Exception:
                    pass  # Coluna já existe
                try:
                    cursor.execute("ALTER TABLE cartoes_cadastrados ADD COLUMN mes_pagamento INTEGER")
                except Exception:
                    pass  # Coluna já existe
                try:
                    cursor.execute("ALTER TABLE cartoes_cadastrados ADD COLUMN ano_pagamento INTEGER")
                except Exception:
                    pass  # Coluna já existe
                try:
                    cursor.execute("ALTER TABLE cartoes_cadastrados ADD COLUMN data_pagamento TIMESTAMP")
                except Exception:
                    pass  # Coluna já existe
                
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_cadastrados_ativo ON cartoes_cadastrados(ativo)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_cadastrados_pago ON cartoes_cadastrados(pago)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_compras_cartao_cartao_id ON compras_cartao(cartao_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_compras_cartao_data ON compras_cartao(data)")
        finally:
            conn.close()
        return
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS receitas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            valor REAL NOT NULL,
            data TEXT NOT NULL,
            categoria TEXT,
            tipo TEXT,
            recorrencia TEXT,
            parcelas_total INTEGER,
            parcela_atual INTEGER,
            grupo_parcela TEXT,
            observacao TEXT
        )
    ''')
    

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cartoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            valor REAL NOT NULL,
            pago TEXT NOT NULL,
            data TEXT NOT NULL,
            categoria TEXT,
            tipo TEXT,
            recorrencia TEXT,
            parcelas_total INTEGER,
            parcela_atual INTEGER,
            grupo_parcela TEXT,
            observacao TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cartoes_cadastrados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            bandeira TEXT NOT NULL,
            limite REAL NOT NULL,
            vencimento INTEGER NOT NULL,
            cor TEXT NOT NULL,
            ativo BOOLEAN DEFAULT 1,
            data_criacao TEXT DEFAULT CURRENT_TIMESTAMP,
            pago BOOLEAN DEFAULT 0,
            mes_pagamento INTEGER,
            ano_pagamento INTEGER,
            data_pagamento TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS compras_cartao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cartao_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            valor REAL NOT NULL,
            data TEXT NOT NULL,
            categoria TEXT,
            observacao TEXT,
            FOREIGN KEY (cartao_id) REFERENCES cartoes_cadastrados(id) ON DELETE CASCADE
        )
    ''')
    

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS outros_gastos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            valor REAL NOT NULL,
            data TEXT NOT NULL,
            categoria TEXT,
            tipo TEXT,
            recorrencia TEXT,
            parcelas_total INTEGER,
            parcela_atual INTEGER,
            grupo_parcela TEXT,
            observacao TEXT
        )
    ''')

    try:
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA temp_store=MEMORY;")
    except Exception:
        pass
    # Índices críticos para performance - Controle SQLite
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_receitas_data ON receitas(data)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_receitas_categoria ON receitas(categoria)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_data ON cartoes(data)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_pago ON cartoes(pago)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_outros_data ON outros_gastos(data)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_outros_categoria ON outros_gastos(categoria)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_cadastrados_ativo ON cartoes_cadastrados(ativo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_compras_cartao_cartao_id ON compras_cartao(cartao_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_compras_cartao_data ON compras_cartao(data)")
    
    conn.commit()
    conn.close()

def _upgrade_controle_schema(usuario=None):
    if not usuario:
        usuario = get_usuario_atual()
        if not usuario:
            return
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                tables = ['receitas','cartoes','outros_gastos']
                add_columns = [
                    ('categoria','TEXT'),
                    ('tipo','TEXT'),
                    ('recorrencia','TEXT'),
                    ('parcelas_total','INTEGER'),
                    ('parcela_atual','INTEGER'),
                    ('grupo_parcela','TEXT'),
                    ('observacao','TEXT'),
                ]
                for t in tables:
                    for col, coltype in add_columns:
                        try:
                            cursor.execute(f"ALTER TABLE {t} ADD COLUMN IF NOT EXISTS {col} {coltype}")
                        except Exception:
                            pass
            conn.commit()
        finally:
            conn.close()
        
        # Criar tabelas de cartões cadastrados se não existirem
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS cartoes_cadastrados (
                        id SERIAL PRIMARY KEY,
                        nome TEXT NOT NULL,
                        bandeira TEXT NOT NULL,
                        limite NUMERIC NOT NULL,
                        vencimento INTEGER NOT NULL,
                        cor TEXT NOT NULL,
                        ativo BOOLEAN DEFAULT TRUE,
                        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        pago BOOLEAN DEFAULT FALSE,
                        mes_pagamento INTEGER,
                        ano_pagamento INTEGER,
                        data_pagamento TIMESTAMP
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS compras_cartao (
                        id SERIAL PRIMARY KEY,
                        cartao_id INTEGER NOT NULL,
                        nome TEXT NOT NULL,
                        valor NUMERIC NOT NULL,
                        data TEXT NOT NULL,
                        categoria TEXT,
                        observacao TEXT,
                        FOREIGN KEY (cartao_id) REFERENCES cartoes_cadastrados(id) ON DELETE CASCADE
                    )
                ''')
                # Adicionar colunas de pagamento se não existirem
                try:
                    cursor.execute("ALTER TABLE cartoes_cadastrados ADD COLUMN pago BOOLEAN DEFAULT FALSE")
                except Exception:
                    pass  # Coluna já existe
                try:
                    cursor.execute("ALTER TABLE cartoes_cadastrados ADD COLUMN mes_pagamento INTEGER")
                except Exception:
                    pass  # Coluna já existe
                try:
                    cursor.execute("ALTER TABLE cartoes_cadastrados ADD COLUMN ano_pagamento INTEGER")
                except Exception:
                    pass  # Coluna já existe
                try:
                    cursor.execute("ALTER TABLE cartoes_cadastrados ADD COLUMN data_pagamento TIMESTAMP")
                except Exception:
                    pass  # Coluna já existe
                
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_cadastrados_ativo ON cartoes_cadastrados(ativo)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_cadastrados_pago ON cartoes_cadastrados(pago)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_compras_cartao_cartao_id ON compras_cartao(cartao_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_compras_cartao_data ON compras_cartao(data)")
            conn.commit()
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "controle")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cur = conn.cursor()
            tables = ['receitas','cartoes','outros_gastos']
            add_columns = [
                ('categoria','TEXT'),
                ('tipo','TEXT'),
                ('recorrencia','TEXT'),
                ('parcelas_total','INTEGER'),
                ('parcela_atual','INTEGER'),
                ('grupo_parcela','TEXT'),
                ('observacao','TEXT'),
            ]
            for t in tables:
                cur.execute(f"PRAGMA table_info({t})")
                existing = {row[1] for row in cur.fetchall()}
                for col, coltype in add_columns:
                    if col not in existing:
                        try:
                            cur.execute(f"ALTER TABLE {t} ADD COLUMN {col} {coltype}")
                        except Exception:
                            pass
            conn.commit()
        finally:
            conn.close()
        
        # Criar tabelas de cartões cadastrados se não existirem
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cartoes_cadastrados (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    bandeira TEXT NOT NULL,
                    limite REAL NOT NULL,
                    vencimento INTEGER NOT NULL,
                    cor TEXT NOT NULL,
                    ativo BOOLEAN DEFAULT 1,
                    data_criacao TEXT DEFAULT CURRENT_TIMESTAMP,
                    pago BOOLEAN DEFAULT 0,
                    mes_pagamento INTEGER,
                    ano_pagamento INTEGER,
                    data_pagamento TEXT
                )
            ''')
            
 
            cursor.execute("PRAGMA table_info(cartoes_cadastrados)")
            existing_columns = {row[1] for row in cursor.fetchall()}
            
            colunas_pagamento = [
                ('pago', 'BOOLEAN DEFAULT 0'),
                ('mes_pagamento', 'INTEGER'),
                ('ano_pagamento', 'INTEGER'),
                ('data_pagamento', 'TEXT')
            ]
            
            for col_name, col_type in colunas_pagamento:
                if col_name not in existing_columns:
                    try:
                        cursor.execute(f"ALTER TABLE cartoes_cadastrados ADD COLUMN {col_name} {col_type}")
                    except Exception:
                        pass  # Coluna já existe ou erro ao adicionar
            
            conn.commit()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS compras_cartao (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cartao_id INTEGER NOT NULL,
                    nome TEXT NOT NULL,
                    valor REAL NOT NULL,
                    data TEXT NOT NULL,
                    categoria TEXT,
                    observacao TEXT,
                    FOREIGN KEY (cartao_id) REFERENCES cartoes_cadastrados(id) ON DELETE CASCADE
                )
            ''')
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_cartoes_cadastrados_ativo ON cartoes_cadastrados(ativo)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_compras_cartao_cartao_id ON compras_cartao(cartao_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_compras_cartao_data ON compras_cartao(data)")
            conn.commit()
        finally:
            conn.close()

def salvar_receita(nome, valor, data=None, categoria=None, tipo=None, recorrencia=None, parcelas_total=None, parcela_atual=None, grupo_parcela=None, observacao=None):
    
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    # Validar e normalizar data
    try:
        if data:
            # Tentar parsear a data para validar formato
            datetime.strptime(data, '%Y-%m-%d')
            data_atual = data
        else:
            data_atual = datetime.now().strftime('%Y-%m-%d')
    except ValueError:
        # Se data inválida, usar data atual
        data_atual = datetime.now().strftime('%Y-%m-%d')
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    INSERT INTO receitas 
                        (nome, valor, data, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (nome, valor, data_atual, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao))
        finally:
            conn.close()
        return
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO receitas 
            (nome, valor, data, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (nome, valor, data_atual, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao))
    conn.commit()
    conn.close()

def atualizar_receita(id_registro, nome=None, valor=None, data=None, categoria=None, tipo=None, recorrencia=None, parcelas_total=None, parcela_atual=None, grupo_parcela=None, observacao=None):

    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    UPDATE receitas SET 
                        nome = COALESCE(%s, nome),
                        valor = COALESCE(%s, valor),
                        data = COALESCE(%s, data),
                        categoria = COALESCE(%s, categoria),
                        tipo = COALESCE(%s, tipo),
                        recorrencia = COALESCE(%s, recorrencia),
                        parcelas_total = COALESCE(%s, parcelas_total),
                        parcela_atual = COALESCE(%s, parcela_atual),
                        grupo_parcela = COALESCE(%s, grupo_parcela),
                        observacao = COALESCE(%s, observacao)
                    WHERE id = %s
                ''', (nome, valor, data, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao, id_registro))
        finally:
            conn.close()
        return
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE receitas SET 
            nome = COALESCE(?, nome),
            valor = COALESCE(?, valor),
            data = COALESCE(?, data),
            categoria = COALESCE(?, categoria),
            tipo = COALESCE(?, tipo),
            recorrencia = COALESCE(?, recorrencia),
            parcelas_total = COALESCE(?, parcelas_total),
            parcela_atual = COALESCE(?, parcela_atual),
            grupo_parcela = COALESCE(?, grupo_parcela),
            observacao = COALESCE(?, observacao)
        WHERE id = ?
    ''', (nome, valor, data, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao, id_registro))
    conn.commit()
    conn.close()

def _remover_registro_generico(tabela, id_registro, banco="controle"):
    """Função genérica para remover registros de qualquer tabela"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute(f'DELETE FROM {tabela} WHERE id = %s', (id_registro,))
        finally:
            conn.close()
        return
    db_path = get_db_path(usuario, banco)
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute(f'DELETE FROM {tabela} WHERE id = ?', (id_registro,))
    conn.commit()
    conn.close()

def remover_receita(id_registro):
    """Remover receita - wrapper para compatibilidade"""
    return _remover_registro_generico("receitas", id_registro, "controle")
def carregar_receitas_mes_ano(mes, ano, pessoa=None):
   
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    mes_int = int(mes)
    ano_int = int(ano)
    if mes_int == 12:
        prox_ano, prox_mes = ano_int + 1, 1
    else:
        prox_ano, prox_mes = ano_int, mes_int + 1
    inicio = f"{ano_int}-{mes_int:02d}-01"
    fim = f"{prox_ano}-{prox_mes:02d}-01"
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            if pessoa:
                query = '''
                    SELECT * FROM receitas 
                    WHERE data >= %s AND data < %s AND nome = %s
                    ORDER BY data DESC
                '''
                df = pd.read_sql_query(query, conn, params=(inicio, fim, pessoa))
            else:
                query = '''
                    SELECT * FROM receitas 
                    WHERE data >= %s AND data < %s
                    ORDER BY data DESC
                '''
                df = pd.read_sql_query(query, conn, params=(inicio, fim))
            return df
        finally:
            conn.close()
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        try:
            conn.execute("CREATE INDEX IF NOT EXISTS idx_receitas_data ON receitas(data)")
        except Exception:
            pass
        if pessoa:
            query = '''
                SELECT * FROM receitas 
                WHERE data >= ? AND data < ? AND nome = ?
                ORDER BY data DESC
            '''
            df = pd.read_sql_query(query, conn, params=(inicio, fim, pessoa))
        else:
            query = '''
                SELECT * FROM receitas 
                WHERE data >= ? AND data < ?
                ORDER BY data DESC
            '''
            df = pd.read_sql_query(query, conn, params=(inicio, fim))
        return df
    finally:
        conn.close()

def adicionar_cartao(nome, valor, pago, data=None, categoria=None, tipo=None, recorrencia=None, parcelas_total=None, parcela_atual=None, grupo_parcela=None, observacao=None):

    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    data_atual = (data or datetime.now().strftime('%Y-%m-%d'))
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    INSERT INTO cartoes 
                        (nome, valor, pago, data, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (nome, valor, pago, data_atual, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao))
        finally:
            conn.close()
        return
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO cartoes 
            (nome, valor, pago, data, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (nome, valor, pago, data_atual, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao))
    conn.commit()
    conn.close()

def carregar_cartoes_mes_ano(mes, ano):
    
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    mes_int = int(mes)
    ano_int = int(ano)
    if mes_int == 12:
        prox_ano, prox_mes = ano_int + 1, 1
    else:
        prox_ano, prox_mes = ano_int, mes_int + 1
    inicio = f"{ano_int}-{mes_int:02d}-01"
    fim = f"{prox_ano}-{prox_mes:02d}-01"
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            query = '''
                SELECT * FROM cartoes 
                WHERE data >= %s AND data < %s
                ORDER BY data DESC
            '''
            df = pd.read_sql_query(query, conn, params=(inicio, fim))
        finally:
            conn.close()
        return df.to_dict('records')
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        query = '''
            SELECT * FROM cartoes 
            WHERE data >= ? AND data < ?
            ORDER BY data DESC
        '''
        df = pd.read_sql_query(query, conn, params=(inicio, fim))
    finally:
        conn.close()
    return df.to_dict('records')

def atualizar_cartao(id_registro, nome=None, valor=None, pago=None, data=None, categoria=None, tipo=None, recorrencia=None, parcelas_total=None, parcela_atual=None, grupo_parcela=None, observacao=None):
    
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    UPDATE cartoes SET 
                        nome = COALESCE(%s, nome),
                        valor = COALESCE(%s, valor),
                        pago = COALESCE(%s, pago),
                        data = COALESCE(%s, data),
                        categoria = COALESCE(%s, categoria),
                        tipo = COALESCE(%s, tipo),
                        recorrencia = COALESCE(%s, recorrencia),
                        parcelas_total = COALESCE(%s, parcelas_total),
                        parcela_atual = COALESCE(%s, parcela_atual),
                        grupo_parcela = COALESCE(%s, grupo_parcela),
                        observacao = COALESCE(%s, observacao)
                    WHERE id = %s
                ''', (nome, valor, pago, data, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao, id_registro))
        finally:
            conn.close()
        return
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE cartoes SET 
            nome = COALESCE(?, nome),
            valor = COALESCE(?, valor),
            pago = COALESCE(?, pago),
            data = COALESCE(?, data),
            categoria = COALESCE(?, categoria),
            tipo = COALESCE(?, tipo),
            recorrencia = COALESCE(?, recorrencia),
            parcelas_total = COALESCE(?, parcelas_total),
            parcela_atual = COALESCE(?, parcela_atual),
            grupo_parcela = COALESCE(?, grupo_parcela),
            observacao = COALESCE(?, observacao)
        WHERE id = ?
    ''', (nome, valor, pago, data, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao, id_registro))
    conn.commit()
    conn.close()

def remover_cartao(id_registro):
    """Remover cartão - wrapper para compatibilidade"""
    return _remover_registro_generico("cartoes", id_registro, "controle")

def adicionar_outro_gasto(nome, valor, data=None, categoria=None, tipo=None, recorrencia=None, parcelas_total=None, parcela_atual=None, grupo_parcela=None, observacao=None):
    
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    # Validar e normalizar data
    try:
        if data:
            # Tentar parsear a data para validar formato
            datetime.strptime(data, '%Y-%m-%d')
            data_atual = data
        else:
            data_atual = datetime.now().strftime('%Y-%m-%d')
    except ValueError:
        # Se data inválida, usar data atual
        data_atual = datetime.now().strftime('%Y-%m-%d')
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    INSERT INTO outros_gastos 
                        (nome, valor, data, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (nome, valor, data_atual, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao))
        finally:
            conn.close()
        return
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO outros_gastos 
            (nome, valor, data, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (nome, valor, data_atual, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao))
    conn.commit()
    conn.close()

def carregar_outros_mes_ano(mes, ano):
    
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    mes_int = int(mes)
    ano_int = int(ano)
    if mes_int == 12:
        prox_ano, prox_mes = ano_int + 1, 1
    else:
        prox_ano, prox_mes = ano_int, mes_int + 1
    inicio = f"{ano_int}-{mes_int:02d}-01"
    fim = f"{prox_ano}-{prox_mes:02d}-01"
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            query = '''
                SELECT * FROM outros_gastos 
                WHERE data >= %s AND data < %s
                ORDER BY data DESC
            '''
            df = pd.read_sql_query(query, conn, params=(inicio, fim))
        finally:
            conn.close()
        return df.to_dict('records')
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        query = '''
            SELECT * FROM outros_gastos 
            WHERE data >= ? AND data < ?
            ORDER BY data DESC
        '''
        df = pd.read_sql_query(query, conn, params=(inicio, fim))
    finally:
        conn.close()
    return df.to_dict('records')

def atualizar_outro_gasto(id_registro, nome=None, valor=None, data=None, categoria=None, tipo=None, recorrencia=None, parcelas_total=None, parcela_atual=None, grupo_parcela=None, observacao=None):
    
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    UPDATE outros_gastos SET 
                        nome = COALESCE(%s, nome),
                        valor = COALESCE(%s, valor),
                        data = COALESCE(%s, data),
                        categoria = COALESCE(%s, categoria),
                        tipo = COALESCE(%s, tipo),
                        recorrencia = COALESCE(%s, recorrencia),
                        parcelas_total = COALESCE(%s, parcelas_total),
                        parcela_atual = COALESCE(%s, parcela_atual),
                        grupo_parcela = COALESCE(%s, grupo_parcela),
                        observacao = COALESCE(%s, observacao)
                    WHERE id = %s
                ''', (nome, valor, data, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao, id_registro))
        finally:
            conn.close()
        return
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE outros_gastos SET 
            nome = COALESCE(?, nome),
            valor = COALESCE(?, valor),
            data = COALESCE(?, data),
            categoria = COALESCE(?, categoria),
            tipo = COALESCE(?, tipo),
            recorrencia = COALESCE(?, recorrencia),
            parcelas_total = COALESCE(?, parcelas_total),
            parcela_atual = COALESCE(?, parcela_atual),
            grupo_parcela = COALESCE(?, grupo_parcela),
            observacao = COALESCE(?, observacao)
        WHERE id = ?
    ''', (nome, valor, data, categoria, tipo, recorrencia, parcelas_total, parcela_atual, grupo_parcela, observacao, id_registro))
    conn.commit()
    conn.close()

def remover_outro_gasto(id_registro):
    """Remover outro gasto - wrapper para compatibilidade"""
    return _remover_registro_generico("outros_gastos", id_registro, "controle")



# ==================== FUNÇÕES DE MARMITAS ====================

def init_marmitas_db(usuario=None):
 
    if not usuario:
        usuario = get_usuario_atual()
        if not usuario:
            raise ValueError("Usuário não especificado")
    
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS marmitas (
                        id SERIAL PRIMARY KEY,
                        data TEXT NOT NULL,
                        valor NUMERIC NOT NULL,
                        comprou INTEGER NOT NULL
                    )
                ''')
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_marmitas_data ON marmitas(data)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_marmitas_comprou ON marmitas(comprou)")
        finally:
            conn.close()
        return
    db_path = get_db_path(usuario, "marmitas")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS marmitas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            valor REAL NOT NULL,
            comprou INTEGER NOT NULL
        )
    ''')
    try:
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA temp_store=MEMORY;")
    except Exception:
        pass
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_marmitas_data ON marmitas(data)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_marmitas_comprou ON marmitas(comprou)")
    conn.commit()
    conn.close()

def consultar_marmitas(mes=None, ano=None):
    """Consultar marmitas com filtros opcionais"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                if mes and ano:
                    mes_int = int(mes)
                    ano_int = int(ano)
                    if mes_int == 12:
                        prox_ano, prox_mes = ano_int + 1, 1
                    else:
                        prox_ano, prox_mes = ano_int, mes_int + 1
                    inicio = f"{ano_int}-{mes_int:02d}-01"
                    fim = f"{prox_ano}-{prox_mes:02d}-01"
                    cursor.execute('SELECT * FROM marmitas WHERE data >= %s AND data < %s ORDER BY data DESC', (inicio, fim))
                else:
                    cursor.execute('SELECT * FROM marmitas ORDER BY data DESC')
                return cursor.fetchall()
        finally:
            conn.close()
    db_path = get_db_path(usuario, "marmitas")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    if mes and ano:
        mes_int = int(mes)
        ano_int = int(ano)
        if mes_int == 12:
            prox_ano, prox_mes = ano_int + 1, 1
        else:
            prox_ano, prox_mes = ano_int, mes_int + 1
        inicio = f"{ano_int}-{mes_int:02d}-01"
        fim = f"{prox_ano}-{prox_mes:02d}-01"
        cursor.execute('SELECT * FROM marmitas WHERE data >= ? AND data < ? ORDER BY data DESC', (inicio, fim))
    else:
        cursor.execute('SELECT * FROM marmitas ORDER BY data DESC')
    registros = cursor.fetchall()
    conn.close()
    return registros

def adicionar_marmita(data, valor, comprou):
    """Adicionar nova marmita"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('INSERT INTO marmitas (data, valor, comprou) VALUES (%s, %s, %s)', (data, valor, comprou))
        finally:
            conn.close()
        return
    db_path = get_db_path(usuario, "marmitas")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('INSERT INTO marmitas (data, valor, comprou) VALUES (?, ?, ?)', 
                  (data, valor, comprou))
    conn.commit()
    conn.close()

def atualizar_marmita(id_registro, data=None, valor=None, comprou=None):
    """Atualizar marmita"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                # Primeiro, buscar os dados atuais
                cursor.execute('SELECT data, valor, comprou FROM marmitas WHERE id = %s', (id_registro,))
                row = cursor.fetchone()
                if not row:
                    return {"success": False, "message": "Marmita não encontrada"}
                
                # Usar valores atuais se não fornecidos
                nova_data = data if data is not None else row[0]
                novo_valor = valor if valor is not None else row[1]
                novo_comprou = comprou if comprou is not None else bool(row[2])
                
                cursor.execute('UPDATE marmitas SET data = %s, valor = %s, comprou = %s WHERE id = %s', 
                             (nova_data, novo_valor, novo_comprou, id_registro))
                conn.commit()
                return {"success": True}
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "marmitas")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        cursor = conn.cursor()
        try:
            # Primeiro, buscar os dados atuais
            cursor.execute('SELECT data, valor, comprou FROM marmitas WHERE id = ?', (id_registro,))
            row = cursor.fetchone()
            if not row:
                return {"success": False, "message": "Marmita não encontrada"}
            
            # Usar valores atuais se não fornecidos
            nova_data = data if data is not None else row[0]
            novo_valor = valor if valor is not None else row[1]
            novo_comprou = comprou if comprou is not None else bool(row[2])
            
            cursor.execute('UPDATE marmitas SET data = ?, valor = ?, comprou = ? WHERE id = ?', 
                         (nova_data, novo_valor, novo_comprou, id_registro))
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

def remover_marmita(id_registro):
    """Remover marmita"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('DELETE FROM marmitas WHERE id = %s', (id_registro,))
        finally:
            conn.close()
        return
    db_path = get_db_path(usuario, "marmitas")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM marmitas WHERE id = ?', (id_registro,))
    conn.commit()
    conn.close()

def gastos_mensais(periodo='6m'):
    """Calcular gastos mensais de marmitas"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    hoje = datetime.now()
    if periodo.endswith('m'):
        meses = int(periodo.replace('m', ''))
        data_inicio = hoje - timedelta(days=30*meses)
    elif periodo.endswith('y'):
        anos = int(periodo.replace('y', ''))
        data_inicio = hoje - timedelta(days=365*anos)
    else:
        data_inicio = hoje - timedelta(days=30)

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            query = '''
                SELECT left(data, 7) as "AnoMes", SUM(valor) as valor
                FROM marmitas
                WHERE data >= %s
                GROUP BY 1
                ORDER BY 1 DESC
            '''
            df = pd.read_sql_query(query, conn, params=(data_inicio.strftime('%Y-%m-%d'),))
        finally:
            conn.close()
        return df
    db_path = get_db_path(usuario, "marmitas")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    query = '''
        SELECT 
            substr(data, 1, 7) as AnoMes,
            SUM(valor) as valor
        FROM marmitas 
        WHERE data >= ?
        GROUP BY substr(data, 1, 7)
        ORDER BY AnoMes DESC
    '''
    df = pd.read_sql_query(query, conn, params=(data_inicio.strftime('%Y-%m-%d'),))
    conn.close()
    return df

def verificar_e_corrigir_bancos_usuario(usuario):
    """Verifica e corrige bancos de dados do usuário se necessário"""
    try:
        import os
        current_dir = os.path.dirname(os.path.abspath(__file__))
        bancos_dir = os.path.join(current_dir, "bancos_usuarios", usuario)
        
        if not os.path.exists(bancos_dir):
            print(f"Diretório não existe para {usuario}, criando bancos...")
            inicializar_bancos_usuario(usuario)
            return True
            
        # Verificar se todos os bancos existem
        bancos_necessarios = ['carteira.db', 'controle.db', 'marmitas.db']
        bancos_existentes = [f for f in os.listdir(bancos_dir) if f.endswith('.db')]
        
        if len(bancos_existentes) < 3:
            print(f"Bancos incompletos para {usuario}, recriando...")
            inicializar_bancos_usuario(usuario)
            return True
            
        # Verificar se as tabelas do controle existem
        controle_path = os.path.join(bancos_dir, 'controle.db')
        if os.path.exists(controle_path):
            conn = sqlite3.connect(controle_path, check_same_thread=False)
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [t[0] for t in cursor.fetchall()]
                
                tabelas_necessarias = ['receitas', 'outros_gastos', 'cartoes_cadastrados', 'compras_cartao']
                tabelas_faltando = [t for t in tabelas_necessarias if t not in tables]
                
                if tabelas_faltando:
                    print(f"Tabelas faltando para {usuario}: {tabelas_faltando}, recriando controle...")
                    init_controle_db(usuario)
                    return True
            finally:
                conn.close()
        
        # Verificar se as tabelas de marmitas existem
        marmitas_path = os.path.join(bancos_dir, 'marmitas.db')
        if os.path.exists(marmitas_path):
            conn = sqlite3.connect(marmitas_path, check_same_thread=False)
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [t[0] for t in cursor.fetchall()]
                
                if 'marmitas' not in tables:
                    print(f"Tabela marmitas faltando para {usuario}, recriando marmitas...")
                    init_marmitas_db(usuario)
                    return True
            finally:
                conn.close()
        else:
            print(f"Banco marmitas não existe para {usuario}, criando...")
            init_marmitas_db(usuario)
            return True
        
        return False
    except Exception as e:
        print(f"Erro ao verificar bancos para {usuario}: {e}")
        return False

def inicializar_bancos_usuario(usuario):
    """Inicializa todos os bancos de dados para um usuário"""
    try:
        init_carteira_db(usuario)
        init_controle_db(usuario)
        init_marmitas_db(usuario)
        print(f"Bancos inicializados com sucesso para usuário: {usuario}")
    except Exception as e:
        print(f"Erro ao inicializar bancos para {usuario}: {e}")
        raise

def calcular_saldo_mes_ano(mes, ano, pessoa=None):
    
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    mes_int = int(mes)
    ano_int = int(ano)
    if mes_int == 12:
        prox_ano, prox_mes = ano_int + 1, 1
    else:
        prox_ano, prox_mes = ano_int, mes_int + 1
    inicio = f"{ano_int}-{mes_int:02d}-01"
    fim = f"{prox_ano}-{prox_mes:02d}-01"

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:

            df_receitas = pd.read_sql_query(
                'SELECT SUM(valor) as total FROM receitas WHERE data >= %s AND data < %s',
                conn,
                params=(inicio, fim)
            )
          
            # Cartões antigos migrados para outros_gastos
  
            df_outros = pd.read_sql_query(
                'SELECT valor FROM outros_gastos WHERE data >= %s AND data < %s',
                conn,
                params=(inicio, fim)
            )
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "controle")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        
        df_receitas = pd.read_sql_query(
            'SELECT SUM(valor) as total FROM receitas WHERE data >= ? AND data < ?',
            conn,
            params=(inicio, fim)
        )
        
        df_outros = pd.read_sql_query(
            'SELECT valor FROM outros_gastos WHERE data >= ? AND data < ?',
            conn,
            params=(inicio, fim)
        )
        conn.close()

    total_receitas = float(df_receitas['total'].iloc[0]) if not df_receitas.empty and df_receitas['total'].iloc[0] is not None else 0.0
    total_outros = float(df_outros['valor'].sum()) if not df_outros.empty else 0.0
    total_despesas = total_outros
    return total_receitas - total_despesas

# ==================== FUNÇÕES DE CARTÕES CADASTRADOS ====================

def adicionar_cartao_cadastrado(nome, bandeira, limite, vencimento, cor):
    """Adiciona um novo cartão cadastrado"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    INSERT INTO cartoes_cadastrados (nome, bandeira, limite, vencimento, cor)
                    VALUES (%s, %s, %s, %s, %s)
                ''', (nome, bandeira, limite, vencimento, cor))
        finally:
            conn.close()
        return
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO cartoes_cadastrados (nome, bandeira, limite, vencimento, cor)
        VALUES (?, ?, ?, ?, ?)
    ''', (nome, bandeira, limite, vencimento, cor))
    conn.commit()
    conn.close()

def listar_cartoes_cadastrados():
    """Lista todos os cartões cadastrados"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

   
    _upgrade_controle_schema(usuario)

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    SELECT * FROM cartoes_cadastrados 
                    WHERE ativo = TRUE 
                    ORDER BY nome
                ''')
                columns = [desc[0] for desc in cursor.description]
                results = cursor.fetchall()
                return [dict(zip(columns, row)) for row in results]
        finally:
            conn.close()
    
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM cartoes_cadastrados 
        WHERE ativo = 1 
        ORDER BY nome
    ''')
    columns = [desc[0] for desc in cursor.description]
    results = cursor.fetchall()
    conn.close()
    return [dict(zip(columns, row)) for row in results]

def atualizar_cartao_cadastrado(id_cartao, nome=None, bandeira=None, limite=None, vencimento=None, cor=None, ativo=None):
    """Atualiza um cartão cadastrado"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    UPDATE cartoes_cadastrados SET 
                        nome = COALESCE(%s, nome),
                        bandeira = COALESCE(%s, bandeira),
                        limite = COALESCE(%s, limite),
                        vencimento = COALESCE(%s, vencimento),
                        cor = COALESCE(%s, cor),
                        ativo = COALESCE(%s, ativo)
                    WHERE id = %s
                ''', (nome, bandeira, limite, vencimento, cor, ativo, id_cartao))
        finally:
            conn.close()
        return
    
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE cartoes_cadastrados SET 
            nome = COALESCE(?, nome),
            bandeira = COALESCE(?, bandeira),
            limite = COALESCE(?, limite),
            vencimento = COALESCE(?, vencimento),
            cor = COALESCE(?, cor),
            ativo = COALESCE(?, ativo)
        WHERE id = ?
    ''', (nome, bandeira, limite, vencimento, cor, ativo, id_cartao))
    conn.commit()
    conn.close()
def remover_cartao_cadastrado(id_cartao):
    """Remove um cartão cadastrado (soft delete)"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    UPDATE cartoes_cadastrados SET ativo = FALSE WHERE id = %s
                ''', (id_cartao,))
        finally:
            conn.close()
        return
    
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE cartoes_cadastrados SET ativo = 0 WHERE id = ?
    ''', (id_cartao,))
    conn.commit()
    conn.close()

# ==================== FUNÇÕES DE COMPRAS DO CARTÃO ====================

def adicionar_compra_cartao(cartao_id, nome, valor, data, categoria=None, observacao=None):
    """Adiciona uma compra ao cartão"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    data_atual = data or datetime.now().strftime('%Y-%m-%d')
    
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    INSERT INTO compras_cartao (cartao_id, nome, valor, data, categoria, observacao)
                    VALUES (%s, %s, %s, %s, %s, %s)
                ''', (cartao_id, nome, valor, data_atual, categoria, observacao))
        finally:
            conn.close()
        return
    
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO compras_cartao (cartao_id, nome, valor, data, categoria, observacao)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (cartao_id, nome, valor, data_atual, categoria, observacao))
    conn.commit()
    conn.close()

def listar_compras_cartao(cartao_id, mes=None, ano=None):
    """Lista compras de um cartão específico"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                if mes and ano:
                    mes_int = int(mes)
                    ano_int = int(ano)
                    if mes_int == 12:
                        prox_ano, prox_mes = ano_int + 1, 1
                    else:
                        prox_ano, prox_mes = ano_int, mes_int + 1
                    inicio = f"{ano_int}-{mes_int:02d}-01"
                    fim = f"{prox_ano}-{prox_mes:02d}-01"
                    cursor.execute('''
                        SELECT * FROM compras_cartao 
                        WHERE cartao_id = %s AND data >= %s AND data < %s
                        ORDER BY data DESC
                    ''', (cartao_id, inicio, fim))
                else:
                    cursor.execute('''
                        SELECT * FROM compras_cartao 
                        WHERE cartao_id = %s
                        ORDER BY data DESC
                    ''', (cartao_id,))
                columns = [desc[0] for desc in cursor.description]
                results = cursor.fetchall()
                return [dict(zip(columns, row)) for row in results]
        finally:
            conn.close()
    
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    if mes and ano:
        mes_int = int(mes)
        ano_int = int(ano)
        if mes_int == 12:
            prox_ano, prox_mes = ano_int + 1, 1
        else:
            prox_ano, prox_mes = ano_int, mes_int + 1
        inicio = f"{ano_int}-{mes_int:02d}-01"
        fim = f"{prox_ano}-{prox_mes:02d}-01"
        cursor.execute('''
            SELECT * FROM compras_cartao 
            WHERE cartao_id = ? AND data >= ? AND data < ?
            ORDER BY data DESC
        ''', (cartao_id, inicio, fim))
    else:
        cursor.execute('''
            SELECT * FROM compras_cartao 
            WHERE cartao_id = ?
            ORDER BY data DESC
        ''', (cartao_id,))
    columns = [desc[0] for desc in cursor.description]
    results = cursor.fetchall()
    conn.close()
    return [dict(zip(columns, row)) for row in results]

def atualizar_compra_cartao(id_compra, nome=None, valor=None, data=None, categoria=None, observacao=None):
    """Atualiza uma compra do cartão"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('''
                    UPDATE compras_cartao SET 
                        nome = COALESCE(%s, nome),
                        valor = COALESCE(%s, valor),
                        data = COALESCE(%s, data),
                        categoria = COALESCE(%s, categoria),
                        observacao = COALESCE(%s, observacao)
                    WHERE id = %s
                ''', (nome, valor, data, categoria, observacao, id_compra))
        finally:
            conn.close()
        return
    
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE compras_cartao SET 
            nome = COALESCE(?, nome),
            valor = COALESCE(?, valor),
            data = COALESCE(?, data),
            categoria = COALESCE(?, categoria),
            observacao = COALESCE(?, observacao)
        WHERE id = ?
    ''', (nome, valor, data, categoria, observacao, id_compra))
    conn.commit()
    conn.close()

def remover_compra_cartao(id_compra):
    """Remove uma compra do cartão"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute('DELETE FROM compras_cartao WHERE id = %s', (id_compra,))
        finally:
            conn.close()
        return
    
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM compras_cartao WHERE id = ?', (id_compra,))
    conn.commit()
    conn.close()

def calcular_total_compras_cartao(cartao_id, mes=None, ano=None):
    """Calcula o total de compras de um cartão"""
    usuario = get_usuario_atual()
    if not usuario:
        return {"success": False, "message": "Usuário não autenticado"}

    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                if mes and ano:
                    mes_int = int(mes)
                    ano_int = int(ano)
                    if mes_int == 12:
                        prox_ano, prox_mes = ano_int + 1, 1
                    else:
                        prox_ano, prox_mes = ano_int, mes_int + 1
                    inicio = f"{ano_int}-{mes_int:02d}-01"
                    fim = f"{prox_ano}-{prox_mes:02d}-01"
                    cursor.execute('''
                        SELECT COALESCE(SUM(valor), 0) as total FROM compras_cartao 
                        WHERE cartao_id = %s AND data >= %s AND data < %s
                    ''', (cartao_id, inicio, fim))
                else:
                    cursor.execute('''
                        SELECT COALESCE(SUM(valor), 0) as total FROM compras_cartao 
                        WHERE cartao_id = %s
                    ''', (cartao_id,))
                result = cursor.fetchone()
                return float(result[0]) if result else 0.0
        finally:
            conn.close()
    
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    cursor = conn.cursor()
    if mes and ano:
        mes_int = int(mes)
        ano_int = int(ano)
        if mes_int == 12:
            prox_ano, prox_mes = ano_int + 1, 1
        else:
            prox_ano, prox_mes = ano_int, mes_int + 1
        inicio = f"{ano_int}-{mes_int:02d}-01"
        fim = f"{prox_ano}-{prox_mes:02d}-01"
        cursor.execute('''
            SELECT COALESCE(SUM(valor), 0) as total FROM compras_cartao 
            WHERE cartao_id = ? AND data >= ? AND data < ?
        ''', (cartao_id, inicio, fim))
    else:
        cursor.execute('''
            SELECT COALESCE(SUM(valor), 0) as total FROM compras_cartao 
            WHERE cartao_id = ?
        ''', (cartao_id,))
    result = cursor.fetchone()
    conn.close()
    return float(result[0]) if result else 0.0

def marcar_cartao_como_pago(cartao_id, mes_pagamento, ano_pagamento):
    """Marca um cartão como pago e converte em despesa"""
    usuario = get_usuario_atual()
    if not usuario:
        return False
    
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:

                cursor.execute("SELECT nome, limite FROM cartoes_cadastrados WHERE id = %s", [cartao_id])
                cartao = cursor.fetchone()
                if not cartao:
                    return False
                
                nome_cartao, limite = cartao
                

                # Somar somente as compras do mês/ano informados
                total_compras = calcular_total_compras_cartao(cartao_id, mes_pagamento, ano_pagamento)
                

                cursor.execute("""
                    UPDATE cartoes_cadastrados 
                    SET pago = TRUE, mes_pagamento = %s, ano_pagamento = %s, data_pagamento = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, [mes_pagamento, ano_pagamento, cartao_id])
                
                # Limpar compras do cartão (devolver limite)
                cursor.execute("""
                    DELETE FROM compras_cartao WHERE cartao_id = %s
                """, [cartao_id])
                
                # Adicionar como despesa no mês do pagamento
                data_pagamento = f"{ano_pagamento}-{mes_pagamento:02d}-01"
                cursor.execute("""
                    INSERT INTO outros_gastos (nome, valor, data, categoria, tipo, observacao)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, [f"Pagamento {nome_cartao}", total_compras, data_pagamento, "cartao", "variavel", f"Pagamento do cartão {nome_cartao}"])
                
                conn.commit()
                return True
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "controle")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cursor = conn.cursor()
            
            # Buscar dados do cartão
            cursor.execute("SELECT nome, limite FROM cartoes_cadastrados WHERE id = ?", [cartao_id])
            cartao = cursor.fetchone()
            if not cartao:
                return False
            
            nome_cartao, limite = cartao
            
            # Calcular total de compras do mês/ano informados
            total_compras = calcular_total_compras_cartao(cartao_id, mes_pagamento, ano_pagamento)
            
            # Marcar cartão como pago
            cursor.execute("""
                UPDATE cartoes_cadastrados 
                SET pago = 1, mes_pagamento = ?, ano_pagamento = ?, data_pagamento = CURRENT_TIMESTAMP
                WHERE id = ?
            """, [mes_pagamento, ano_pagamento, cartao_id])
            
            # Limpar compras do cartão (devolver limite)
            cursor.execute("""
                DELETE FROM compras_cartao WHERE cartao_id = ?
            """, [cartao_id])
            
            # Adicionar como despesa no mês do pagamento
            data_pagamento = f"{ano_pagamento}-{mes_pagamento:02d}-01"
            cursor.execute("""
                INSERT INTO outros_gastos (nome, valor, data, categoria, tipo, observacao)
                VALUES (?, ?, ?, ?, ?, ?)
            """, [f"Pagamento {nome_cartao}", total_compras, data_pagamento, "cartao", "variavel", f"Pagamento do cartão {nome_cartao}"])
            
            conn.commit()
            return True
        finally:
            conn.close()

def desmarcar_cartao_como_pago(cartao_id):
    """Desmarca um cartão como pago e remove a despesa correspondente"""
    usuario = get_usuario_atual()
    if not usuario:
        return False
    
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                # Buscar dados do cartão incluindo mês/ano de pagamento atual
                cursor.execute("SELECT nome, mes_pagamento, ano_pagamento FROM cartoes_cadastrados WHERE id = %s", [cartao_id])
                row = cursor.fetchone()
                if not row:
                    return False
                nome_cartao, mes_pg, ano_pg = row
                # Montar a data alvo do lançamento do pagamento (primeiro dia do mês)
                data_alvo = None
                if mes_pg and ano_pg:
                    try:
                        data_alvo = f"{int(ano_pg):04d}-{int(mes_pg):02d}-01"
                    except Exception:
                        data_alvo = None
                
                # Desmarcar cartão como pago
                cursor.execute("""
                    UPDATE cartoes_cadastrados 
                    SET pago = FALSE, mes_pagamento = NULL, ano_pagamento = NULL, data_pagamento = NULL
                    WHERE id = %s
                """, [cartao_id])
                
                # Remover somente a despesa correspondente ao mês/ano do pagamento registrado
                if data_alvo:
                    cursor.execute("""
                        DELETE FROM outros_gastos 
                        WHERE nome = %s AND categoria = 'cartao' AND data = %s
                    """, [f"Pagamento {nome_cartao}", data_alvo])
                
                conn.commit()
                return True
        finally:
            conn.close()
    else:
        db_path = get_db_path(usuario, "controle")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            cursor = conn.cursor()
            
            # Buscar dados do cartão incluindo mês/ano de pagamento atual
            cursor.execute("SELECT nome, mes_pagamento, ano_pagamento FROM cartoes_cadastrados WHERE id = ?", [cartao_id])
            row = cursor.fetchone()
            if not row:
                return False
            nome_cartao, mes_pg, ano_pg = row
            data_alvo = None
            if mes_pg and ano_pg:
                try:
                    data_alvo = f"{int(ano_pg):04d}-{int(mes_pg):02d}-01"
                except Exception:
                    data_alvo = None
            
            # Desmarcar cartão como pago
            cursor.execute("""
                UPDATE cartoes_cadastrados 
                SET pago = 0, mes_pagamento = NULL, ano_pagamento = NULL, data_pagamento = NULL
                WHERE id = ?
            """, [cartao_id])
            
            # Remover somente a despesa correspondente ao mês/ano do pagamento registrado
            if data_alvo:
                cursor.execute("""
                    DELETE FROM outros_gastos 
                    WHERE nome = ? AND categoria = 'cartao' AND data = ?
                """, [f"Pagamento {nome_cartao}", data_alvo])
            
            conn.commit()
            return True
        finally:
            conn.close()

# ==================== ROTINA DE ROLLOVER DE MÊS PARA CARTÕES ====================
def resetar_status_cartoes_novo_mes():
    """
    Se o mês virou, resetar o status 'pago' dos cartões para permitir novo pagamento,
    sem remover as despesas lançadas em meses anteriores.
    """
    usuario = get_usuario_atual()
    if not usuario:
        return
    hoje = datetime.now()
    mes_atual = hoje.month
    ano_atual = hoje.year
    if _is_postgres():
        conn = _pg_conn_for_user(usuario)
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE cartoes_cadastrados
                    SET pago = FALSE, mes_pagamento = NULL, ano_pagamento = NULL, data_pagamento = NULL
                    WHERE pago = TRUE AND (mes_pagamento IS DISTINCT FROM %s OR ano_pagamento IS DISTINCT FROM %s)
                """, (mes_atual, ano_atual))
                # Nenhuma remoção em outros_gastos aqui (não devemos afetar meses anteriores)
                conn.commit()
        finally:
            conn.close()
        return
    # SQLite
    db_path = get_db_path(usuario, "controle")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE cartoes_cadastrados
            SET pago = 0, mes_pagamento = NULL, ano_pagamento = NULL, data_pagamento = NULL
            WHERE pago = 1 AND (mes_pagamento != ? OR ano_pagamento != ?)
        """, (mes_atual, ano_atual))
        conn.commit()
    finally:
        conn.close()

# ==================== FUNÇÕES DE SIMULAÇÃO DE CHOQUES ====================

def simular_choques_indexadores(choques_cdi=0, choques_ipca=0, choques_selic=0):
    """
    Simula choques nos indexadores e calcula o impacto na carteira
    """
    try:
        usuario = get_usuario_atual()
        if not usuario:
            return {"error": "Usuário não autenticado"}
        
        carteira = obter_carteira()
        if not carteira:
            return {"carteira_simulada": [], "totais": {"valor_atual": 0, "valor_simulado": 0, "variacao": 0, "variacao_percentual": 0}}
        
        carteira_simulada = []
        valor_atual_total = 0
        valor_simulado_total = 0
        
        for ativo in carteira:
            # Calcular novo preço baseado no indexador
            novo_preco = ativo['preco_atual']
            impacto = 0
            
            # Aplicar choque baseado no indexador
            if ativo.get('indexador') == 'CDI':
                impacto = choques_cdi
            elif ativo.get('indexador') == 'IPCA':
                impacto = choques_ipca
            elif ativo.get('indexador') == 'SELIC':
                impacto = choques_selic
            
            # Calcular novo preço (simplificado: 1% de choque = 1% no preço)
            if impacto != 0:
                novo_preco = ativo['preco_atual'] * (1 + impacto / 100)
            
            # Calcular novos valores
            novo_valor_total = novo_preco * ativo['quantidade']
            variacao = novo_valor_total - ativo['valor_total']
            variacao_percentual = (variacao / ativo['valor_total']) * 100 if ativo['valor_total'] > 0 else 0
            
            # Adicionar à carteira simulada
            ativo_simulado = {
                **ativo,
                'preco_simulado': novo_preco,
                'valor_total_simulado': novo_valor_total,
                'variacao': variacao,
                'variacao_percentual': variacao_percentual
            }
            carteira_simulada.append(ativo_simulado)
            
            # Somar totais
            valor_atual_total += ativo['valor_total']
            valor_simulado_total += novo_valor_total
        
        # Calcular totais
        variacao_total = valor_simulado_total - valor_atual_total
        variacao_percentual_total = (variacao_total / valor_atual_total) * 100 if valor_atual_total > 0 else 0
        
        return {
            "carteira_simulada": carteira_simulada,
            "totais": {
                "valor_atual": valor_atual_total,
                "valor_simulado": valor_simulado_total,
                "variacao": variacao_total,
                "variacao_percentual": variacao_percentual_total
            }
        }
        
    except Exception as e:
        print(f"Erro na simulação de choques: {e}")
        return {"error": str(e)}

def obter_cenarios_predefinidos():

    return [
        {
            "nome": "Otimista",
            "descricao": "Economia em crescimento",
            "choques": {"cdi": 2, "ipca": -1, "selic": 2},
            "cor": "text-green-600"
        },
        {
            "nome": "Pessimista", 
            "descricao": "Crise econômica",
            "choques": {"cdi": -3, "ipca": 3, "selic": -3},
            "cor": "text-red-600"
        },
        {
            "nome": "Crise",
            "descricao": "Crise severa",
            "choques": {"cdi": -5, "ipca": 5, "selic": -5},
            "cor": "text-red-800"
        },
        {
            "nome": "Inflação Alta",
            "descricao": "Inflação descontrolada",
            "choques": {"cdi": 1, "ipca": 4, "selic": 1},
            "cor": "text-orange-600"
        }
    ]

def executar_monte_carlo(n_simulacoes=10000, periodo_anos=5, confianca=95):
    """
    Executa simulação Monte Carlo para a carteira
    """
    try:
        import numpy as np
        import random
        
        print(f"Iniciando Monte Carlo: {n_simulacoes} simulações, {periodo_anos} anos")
        
        usuario = get_usuario_atual()
        if not usuario:
            return {"error": "Usuário não autenticado"}
        
        carteira = obter_carteira()
        if not carteira:
            return {"error": "Carteira vazia"}
        
        print(f"Carteira encontrada: {len(carteira)} ativos")
        
        # Calcular valor atual total
        valor_atual_total = sum(ativo['valor_total'] for ativo in carteira)
        print(f"Valor atual total: R$ {valor_atual_total:,.2f}")
        
        # Parâmetros para simulação (baseados em dados históricos médios)
        retorno_medio_anual = 0.12  # 12% ao ano (média histórica do mercado brasileiro)
        volatilidade_anual = 0.20   # 20% de volatilidade anual
        
     
        cenarios = []
        
        for _ in range(n_simulacoes):
           
            retorno_anual = np.random.normal(retorno_medio_anual, volatilidade_anual)
            
           
            valor_final = valor_atual_total * ((1 + retorno_anual) ** periodo_anos)
            cenarios.append(valor_final)
        
  
        cenarios_ordenados = sorted(cenarios)
        n_cenarios = len(cenarios_ordenados)
        
      
        percentis = {
            "p5": cenarios_ordenados[int(0.05 * n_cenarios)],
            "p25": cenarios_ordenados[int(0.25 * n_cenarios)],
            "p50": cenarios_ordenados[int(0.50 * n_cenarios)],
            "p75": cenarios_ordenados[int(0.75 * n_cenarios)],
            "p95": cenarios_ordenados[int(0.95 * n_cenarios)]
        }
        
    
        valor_esperado = np.mean(cenarios)
        
   
        volatilidade = np.std(cenarios) / valor_esperado
        
    
        cenarios_perda = [c for c in cenarios if c < valor_atual_total]
        probabilidade_perda = len(cenarios_perda) / n_cenarios * 100
        

        sharpe = (valor_esperado - valor_atual_total) / (np.std(cenarios) * np.sqrt(periodo_anos))
        
        resultado = {
            "percentis": percentis,
            "probabilidade_perda": probabilidade_perda,
            "valor_esperado": valor_esperado,
            "volatilidade": volatilidade,
            "sharpe": sharpe,
            "cenarios": cenarios[:1000]  
        }
        
        print(f"Monte Carlo concluído: Valor esperado R$ {valor_esperado:,.2f}")
        return resultado
        
    except Exception as e:
        print(f"Erro na simulação Monte Carlo: {e}")
        return {"error": str(e)}


# ==================== FUNÇÕES DE GERENCIAMENTO DE ROLES E PERFIL ====================

def obter_perfil_usuario(username):
    """Obtém informações do perfil do usuário (sem senha)"""
    usuario = buscar_usuario_por_username(username)
    if not usuario:
        return None
    return {
        'id': usuario['id'],
        'nome': usuario['nome'],
        'username': usuario['username'],
        'email': usuario.get('email'),
        'role': usuario.get('role', 'usuario'),
        'data_cadastro': usuario['data_cadastro'],
        'auth_provider': usuario.get('auth_provider', 'proprietario')  # google ou proprietario
    }

def atualizar_perfil_usuario(username, nome=None, email=None):
    """Atualiza informações do perfil do usuário"""
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            with conn.cursor() as c:
                updates = []
                params = []
                if nome is not None:
                    updates.append('nome = %s')
                    params.append(nome)
                if email is not None:
                    updates.append('email = %s')
                    params.append(email)
                if not updates:
                    return False
                params.append(username)
                c.execute(f'''
                    UPDATE public.usuarios 
                    SET {', '.join(updates)}
                    WHERE username = %s
                ''', params)
                conn.commit()
                return True
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        c = conn.cursor()
        try:
            updates = []
            params = []
            if nome is not None:
                updates.append('nome = ?')
                params.append(nome)
            if email is not None:
                updates.append('email = ?')
                params.append(email)
            if not updates:
                return False
            params.append(username)
            c.execute(f'''
                UPDATE usuarios 
                SET {', '.join(updates)}
                WHERE username = ?
            ''', params)
            conn.commit()
            return True
        finally:
            conn.close()

def atualizar_senha_usuario(username, nova_senha):
    """Atualiza a senha do usuário"""
    senha_hash = bcrypt.hashpw(nova_senha.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            with conn.cursor() as c:
                c.execute('UPDATE public.usuarios SET senha_hash = %s WHERE username = %s', (senha_hash, username))
                conn.commit()
                return True
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        c = conn.cursor()
        try:
            c.execute('UPDATE usuarios SET senha_hash = ? WHERE username = ?', (senha_hash, username))
            conn.commit()
            return True
        finally:
            conn.close()

def verificar_role(username, role_requerido='admin'):
    """Verifica se o usuário tem o role necessário"""
    usuario = buscar_usuario_por_username(username)
    if not usuario:
        return False
    role_usuario = usuario.get('role', 'usuario')
    return role_usuario == role_requerido

def definir_role_usuario(username, novo_role):
    """Define o role de um usuário (apenas admin pode fazer isso)"""
    if novo_role not in ['usuario', 'admin']:
        return False
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            with conn.cursor() as c:
                c.execute('UPDATE public.usuarios SET role = %s WHERE username = %s', (novo_role, username))
                conn.commit()
                return True
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        c = conn.cursor()
        try:
            c.execute('UPDATE usuarios SET role = ? WHERE username = ?', (novo_role, username))
            conn.commit()
            return True
        finally:
            conn.close()

def listar_usuarios(admin_only=False):
    """Lista todos os usuários (apenas para admins)"""
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            with conn.cursor() as c:
                if admin_only:
                    c.execute('SELECT id, nome, username, email, role, data_cadastro FROM public.usuarios WHERE role = %s', ('admin',))
                else:
                    c.execute('SELECT id, nome, username, email, role, data_cadastro FROM public.usuarios')
                rows = c.fetchall()
                return [{
                    'id': row[0],
                    'nome': row[1],
                    'username': row[2],
                    'email': row[3],
                    'role': row[4] if len(row) > 4 else 'usuario',
                    'data_cadastro': row[5]
                } for row in rows]
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        c = conn.cursor()
        if admin_only:
            c.execute('SELECT id, nome, username, email, role, data_cadastro FROM usuarios WHERE role = ?', ('admin',))
        else:
            c.execute('SELECT id, nome, username, email, role, data_cadastro FROM usuarios')
        rows = c.fetchall()
        conn.close()
        return [{
            'id': row[0],
            'nome': row[1],
            'username': row[2],
            'email': row[3],
            'role': row[4] if len(row) > 4 else 'usuario',
            'data_cadastro': row[5]
        } for row in rows]

def excluir_conta_usuario(username):
    """Exclui a conta do usuário (LGPD)"""
    if _is_postgres():
        conn = _get_pg_conn()
        try:
            with conn.cursor() as c:
                # Excluir usuário
                c.execute('DELETE FROM public.usuarios WHERE username = %s', (username,))
                conn.commit()
                return True
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(USUARIOS_DB_PATH)
        c = conn.cursor()
        try:
            c.execute('DELETE FROM usuarios WHERE username = ?', (username,))
            conn.commit()
            return True
        finally:
            conn.close()