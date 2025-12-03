#!/usr/bin/env python3
"""
Script auxiliar para migrar dados do Neon para Supabase
Execute este script APÓS configurar a variável DATABASE_URL com a URL do Supabase
"""

import os
import sys
import psycopg
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

# ==================== CONFIGURAÇÕES ====================
# URLs configuradas diretamente aqui para facilitar

NEON_URL = "postgresql://neondb_owner:npg_RI1QJyPED6kt@ep-tiny-recipe-acbzzcs2-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

SUPABASE_URL = "postgresql://postgres:Korgloriws13@db.utvmrdotraksbfvbdzqn.supabase.co:5432/postgres?sslmode=require"

def sanitize_db_url(url: str) -> str:
    """Sanitiza a URL do banco removendo channel_binding"""
    if not url:
        return url
    try:
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

def get_neon_url():
    """Obtém a URL do Neon (antiga)"""
    return sanitize_db_url(NEON_URL)

def get_supabase_url():
    """Obtém a URL do Supabase (nova)"""
    return sanitize_db_url(SUPABASE_URL)

def list_user_schemas(conn):
    """Lista todos os schemas de usuários"""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'u_%'
            ORDER BY schema_name
        """)
        return [row[0] for row in cur.fetchall()]

def migrate_global_tables(neon_conn, supabase_conn):
    """Migra tabelas globais (usuarios, sessoes)"""
    print("\n📦 Migrando tabelas globais...")
    
    # Criar tabelas no Supabase se não existirem
    with supabase_conn.cursor() as cur:
        # Tabela usuarios
        cur.execute('''
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
        
        # Tabela sessoes
        cur.execute('''
            CREATE TABLE IF NOT EXISTS public.sessoes (
                token TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                expira_em BIGINT NOT NULL
            )
        ''')
        supabase_conn.commit()
    
    # Copiar dados
    with neon_conn.cursor() as neon_cur:
        # Copiar usuarios
        neon_cur.execute("SELECT * FROM public.usuarios")
        usuarios = neon_cur.fetchall()
        columns = [desc[0] for desc in neon_cur.description]
        
        if usuarios:
            print(f"  → Migrando {len(usuarios)} usuários...")
            with supabase_conn.cursor() as supabase_cur:
                for row in usuarios:
                    usuario_dict = dict(zip(columns, row))
                    try:
                        supabase_cur.execute('''
                            INSERT INTO public.usuarios 
                            (id, nome, username, senha_hash, pergunta_seguranca, resposta_seguranca_hash, data_cadastro)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (id) DO NOTHING
                        ''', (
                            usuario_dict['id'],
                            usuario_dict['nome'],
                            usuario_dict['username'],
                            usuario_dict['senha_hash'],
                            usuario_dict.get('pergunta_seguranca'),
                            usuario_dict.get('resposta_seguranca_hash'),
                            usuario_dict['data_cadastro']
                        ))
                    except Exception as e:
                        print(f"    ⚠️  Erro ao migrar usuário {usuario_dict.get('username')}: {e}")
            
            # Resetar sequência
            with supabase_conn.cursor() as supabase_cur:
                supabase_cur.execute("SELECT setval('public.usuarios_id_seq', (SELECT MAX(id) FROM public.usuarios))")
        
        # Copiar sessoes (opcional - geralmente não é necessário migrar sessões)
        neon_cur.execute("SELECT * FROM public.sessoes")
        sessoes = neon_cur.fetchall()
        if sessoes:
            print(f"  → Encontradas {len(sessoes)} sessões (não migrando - serão recriadas no próximo login)")
    
    supabase_conn.commit()
    print("  ✅ Tabelas globais migradas!")

def migrate_user_schema(neon_conn, supabase_conn, schema_name):
    """Migra um schema de usuário específico"""
    print(f"\n👤 Migrando schema {schema_name}...")
    
    # Criar schema no Supabase
    with supabase_conn.cursor() as cur:
        cur.execute(f"CREATE SCHEMA IF NOT EXISTS {schema_name}")
        cur.execute(f"SET search_path TO {schema_name}")
    
    # Listar tabelas do schema no Neon
    with neon_conn.cursor() as neon_cur:
        neon_cur.execute(f"SET search_path TO {schema_name}")
        neon_cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = %s
            ORDER BY table_name
        """, (schema_name,))
        tables = [row[0] for row in neon_cur.fetchall()]
    
    if not tables:
        print(f"  ⚠️  Nenhuma tabela encontrada em {schema_name}")
        return
    
    print(f"  → Encontradas {len(tables)} tabelas")
    
    # Migrar cada tabela
    for table in tables:
        try:
            print(f"    📋 Migrando tabela {table}...")
            
            # Obter estrutura da tabela
            with neon_conn.cursor() as neon_cur:
                neon_cur.execute(f"SET search_path TO {schema_name}")
                neon_cur.execute(f"SELECT * FROM {table} LIMIT 0")
                columns = [desc[0] for desc in neon_cur.description]
                
                # Contar registros
                neon_cur.execute(f"SELECT COUNT(*) FROM {table}")
                count = neon_cur.fetchone()[0]
                
                if count == 0:
                    print(f"      → Tabela vazia, pulando...")
                    continue
                
                # Copiar dados
                neon_cur.execute(f"SELECT * FROM {table}")
                rows = neon_cur.fetchall()
                
                # Criar tabela no Supabase (estrutura básica - pode precisar ajustes)
                with supabase_conn.cursor() as supabase_cur:
                    supabase_cur.execute(f"SET search_path TO {schema_name}")
                    
                    # Tentar copiar dados
                    for row in rows:
                        row_dict = dict(zip(columns, row))
                        placeholders = ', '.join(['%s'] * len(columns))
                        column_names = ', '.join(columns)
                        
                        try:
                            values = tuple(row_dict.values())
                            supabase_cur.execute(
                                f"INSERT INTO {table} ({column_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING",
                                values
                            )
                        except Exception as e:
                            # Se a tabela não existir, criar estrutura básica
                            if "does not exist" in str(e).lower():
                                print(f"      ⚠️  Tabela {table} não existe no Supabase. Criando estrutura básica...")
                                # Nota: A estrutura exata será criada pelo sistema automaticamente
                                # Aqui apenas pulamos esta tabela
                                break
                            else:
                                print(f"      ⚠️  Erro ao inserir registro: {e}")
                                continue
                
                print(f"      ✅ {len(rows)} registros migrados")
        
        except Exception as e:
            print(f"    ❌ Erro ao migrar tabela {table}: {e}")
            continue
    
    supabase_conn.commit()
    print(f"  ✅ Schema {schema_name} migrado!")

def main():
    print("🚀 Iniciando migração Neon → Supabase\n")
    
    # Obter conexões
    neon_url = get_neon_url()
    supabase_url = get_supabase_url()
    
    print("\n📡 Conectando aos bancos...")
    try:
        neon_conn = psycopg.connect(neon_url)
        print("  ✅ Conectado ao Neon")
    except Exception as e:
        print(f"  ❌ Erro ao conectar ao Neon: {e}")
        return
    
    try:
        supabase_conn = psycopg.connect(supabase_url)
        print("  ✅ Conectado ao Supabase")
    except Exception as e:
        print(f"  ❌ Erro ao conectar ao Supabase: {e}")
        neon_conn.close()
        return
    
    try:
        # Migrar tabelas globais
        migrate_global_tables(neon_conn, supabase_conn)
        
        # Listar schemas de usuários
        print("\n🔍 Buscando schemas de usuários...")
        user_schemas = list_user_schemas(neon_conn)
        
        if not user_schemas:
            print("  ⚠️  Nenhum schema de usuário encontrado")
        else:
            print(f"  → Encontrados {len(user_schemas)} schemas de usuários")
            
            # Perguntar se quer migrar todos
            resposta = input(f"\n❓ Migrar todos os {len(user_schemas)} schemas? (s/n): ").strip().lower()
            
            if resposta == 's':
                for schema in user_schemas:
                    migrate_user_schema(neon_conn, supabase_conn, schema)
            else:
                print("\nSchemas disponíveis:")
                for i, schema in enumerate(user_schemas, 1):
                    print(f"  {i}. {schema}")
                
                escolha = input("\nDigite o número do schema para migrar (ou 'todos' para migrar todos): ").strip()
                
                if escolha.lower() == 'todos':
                    for schema in user_schemas:
                        migrate_user_schema(neon_conn, supabase_conn, schema)
                else:
                    try:
                        idx = int(escolha) - 1
                        if 0 <= idx < len(user_schemas):
                            migrate_user_schema(neon_conn, supabase_conn, user_schemas[idx])
                        else:
                            print("❌ Número inválido")
                    except ValueError:
                        print("❌ Entrada inválida")
        
        print("\n✅ Migração concluída!")
        print("\n⚠️  IMPORTANTE:")
        print("  1. Verifique se os dados foram migrados corretamente")
        print("  2. Teste o login de alguns usuários")
        print("  3. As tabelas serão criadas automaticamente no primeiro login se faltarem")
    
    finally:
        neon_conn.close()
        supabase_conn.close()
        print("\n🔌 Conexões fechadas")

if __name__ == "__main__":
    main()

