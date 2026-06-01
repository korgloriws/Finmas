#!/usr/bin/env python3
"""
Verificação pré-deploy: despesas com login Google (conta duplicada mesmo e-mail).

Executar na pasta backend:
  python scripts/verificar_deploy_google_despesas.py

Exit code 0 = seguro para deploy do ponto de vista Google/despesas.
"""
from __future__ import annotations

import os
import sys
import sqlite3
import time

# Evita apagar sessão de teste ao importar app.py
os.environ.setdefault("FINMAS_FORCE_LOGIN_ON_START", "0")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models as m

EMAIL_ALVO = os.environ.get("FINMAS_TEST_EMAIL", "mateusaugusto692@gmail.com")
MES = os.environ.get("FINMAS_TEST_MES", "06")
ANO = os.environ.get("FINMAS_TEST_ANO", "2026")


def _falha(msg: str) -> None:
    print(f"FALHA: {msg}")
    sys.exit(1)


def _ok(msg: str) -> None:
    print(f"OK: {msg}")


def auditar_usuarios():
    print("\n=== 1. Cadastros com o e-mail alvo ===")
    candidatos = m.listar_usuarios_por_email(EMAIL_ALVO)
    if not candidatos:
        print(f"AVISO: nenhum usuário com e-mail {EMAIL_ALVO}")
        print("  (Se só existir conta Google nova sem e-mail gravado, vincule o e-mail no perfil.)")
        return candidatos
    for u in candidatos:
        auth = u.get("auth_provider", "?")
        dados = m._storage_tem_dados_controle(m.resolver_storage_username(u["username"]))
        print(f"  - {u['username']} provider={auth} tem_dados_controle={dados}")
    return candidatos


def simular_google(candidatos: list):
    print("\n=== 2. Simulação sessão Google (conta vazia + Mateus com dados) ===")
    google_user = None
    com_dados = None
    for u in candidatos:
        storage = m.resolver_storage_username(u["username"])
        if m._storage_tem_dados_controle(storage):
            com_dados = u["username"]
        elif u.get("auth_provider") == "google":
            google_user = u["username"]
    if not com_dados:
        if len(candidatos) == 1:
            com_dados = candidatos[0]["username"]
        else:
            _falha("Nenhuma conta com dados financeiros para este e-mail.")
    # Cenário produção típico: só Mateus com e-mail — Google unifica para Mateus
    if len(candidatos) == 1:
        google_user = com_dados
        print(f"  (único cadastro com este e-mail: sessão Google -> {google_user})")
    elif not google_user:
        google_user = f"google_sim_{com_dados.lower()}"
        print(f"  (conta Google paralela simulada: {google_user})")
    dados = m._usuario_para_dados(google_user)
    if dados != m.resolver_storage_username(com_dados):
        _falha(
            f"_usuario_para_dados({google_user})={dados!r} "
            f"esperado pasta de {com_dados!r}"
        )
    outros = m.carregar_outros_mes_ano(MES, ANO, dados)
    receitas = m.carregar_receitas_mes_ano(MES, ANO, usuario=dados)
    _ok(f"Google '{google_user}' -> pasta '{dados}' | outros={len(outros)} receitas={len(receitas)}")
    if len(outros) == 0 and m._storage_tem_dados_controle(m.resolver_storage_username(com_dados)):
        _falha("Pasta com dados mas carregar_outros_mes_ano retornou vazio — revisar mês/ano.")
    return google_user, dados


def testar_api_flask(google_user: str):
    print("\n=== 3. API HTTP /api/controle/outros (Flask test client) ===")
    auth_db = m.USUARIOS_DB_PATH
    if not os.path.isfile(auth_db):
        print("AVISO: banco de auth não encontrado; pulando teste HTTP.")
        return
    try:
        from app import server
    except Exception as e:
        _falha(f"Não foi possível importar app: {e}")
    token = f"verify_deploy_{int(time.time())}"
    conn = sqlite3.connect(auth_db)
    c = conn.cursor()
    c.execute(
        "INSERT OR REPLACE INTO sessoes (token, username, expira_em) VALUES (?,?,?)",
        (token, google_user, int(time.time()) + 3600),
    )
    conn.commit()
    conn.close()
    try:

        client = server.test_client()
        client.set_cookie("session_token", token)
        rv = client.get(f"/api/controle/outros?mes={MES}&ano={ANO}")
        if rv.status_code != 200:
            _falha(f"/controle/outros status={rv.status_code} body={rv.get_data(as_text=True)[:500]}")
        data = rv.get_json()
        if not isinstance(data, list):
            _falha(f"/controle/outros não retornou lista: {type(data)}")
        _ok(f"GET /api/controle/outros -> {len(data)} registro(s)")
        rv2 = client.get(f"/api/controle/receitas?mes={MES}&ano={ANO}")
        if rv2.status_code != 200:
            _falha(f"/controle/receitas status={rv2.status_code}")
        rec = rv2.get_json()
        nrec = len(rec) if isinstance(rec, list) else 0
        _ok(f"GET /api/controle/receitas -> {nrec} registro(s)")
    finally:
        conn = sqlite3.connect(auth_db)
        c = conn.cursor()
        c.execute("DELETE FROM sessoes WHERE token = ?", (token,))
        conn.commit()
        conn.close()


def main():
    print("Verificação pré-deploy — Google + despesas")
    print(f"E-mail: {EMAIL_ALVO} | período: {MES}/{ANO}")
    candidatos = auditar_usuarios()
    google_user, _ = simular_google(candidatos)
    testar_api_flask(google_user)
    print("\n=== RESULTADO: pronto para deploy (camada backend) ===")
    print("Após deploy: logout, login Google, Ctrl+Shift+R, aba Despesas.")
    print("Confira Network: GET /api/controle/outros deve retornar array com itens.")


if __name__ == "__main__":
    main()
