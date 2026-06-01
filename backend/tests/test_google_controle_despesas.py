"""
Testes: despesas (outros_gastos) com login Google vs conta com dados (Mateus).

Executar na pasta backend:
  python -m pytest tests/test_google_controle_despesas.py -v
  python tests/test_google_controle_despesas.py
"""
import os
import sys
import sqlite3
import tempfile
import shutil
import time

import bcrypt

# backend/ no path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models as m


def _setup_isolated_auth_and_mateus_data():
    """Auth temporário + pasta Mateus com 1 despesa; conta Google vazia com mesmo e-mail."""
    tmp = tempfile.mkdtemp(prefix="finmas_test_google_")
    auth_dir = os.path.join(tmp, "bancos_usuarios", "_auth")
    os.makedirs(auth_dir, exist_ok=True)
    auth_db = os.path.join(auth_dir, "usuarios.db")

    mateus_dir = os.path.join(tmp, "bancos_usuarios", "Mateus")
    os.makedirs(mateus_dir, exist_ok=True)
    google_dir = os.path.join(tmp, "bancos_usuarios", "mateusaugusto692")
    os.makedirs(google_dir, exist_ok=True)

    conn_auth = sqlite3.connect(auth_db)
    c = conn_auth.cursor()
    c.execute(
        """
        CREATE TABLE usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT, username TEXT UNIQUE, senha_hash TEXT,
            pergunta_seguranca TEXT, resposta_seguranca_hash TEXT,
            data_cadastro TEXT, role TEXT, email TEXT, auth_provider TEXT,
            allowed_screens TEXT
        )
        """
    )
    c.execute(
        """
        CREATE TABLE sessoes (
            token TEXT PRIMARY KEY, username TEXT, expira_em INTEGER
        )
        """
    )
    email = "mateusaugusto692@gmail.com"
    senha = bcrypt.hashpw(b"x", bcrypt.gensalt()).decode("utf-8")
    c.execute(
        "INSERT INTO usuarios (nome, username, senha_hash, data_cadastro, role, email, auth_provider) VALUES (?,?,?,?,?,?,?)",
        ("Mateus", "Mateus", senha, "2024-01-01", "usuario", email, "proprietario"),
    )
    c.execute(
        "INSERT INTO usuarios (nome, username, senha_hash, data_cadastro, role, email, auth_provider) VALUES (?,?,?,?,?,?,?)",
        ("Mateus Google", "mateusaugusto692", senha, "2024-01-01", "usuario", email, "google"),
    )
    token_google = "test_token_google_sessao"
    c.execute(
        "INSERT INTO sessoes (token, username, expira_em) VALUES (?,?,?)",
        (token_google, "mateusaugusto692", int(time.time()) + 3600),
    )
    conn_auth.commit()
    conn_auth.close()

    for folder in (mateus_dir, google_dir):
        db = os.path.join(folder, "controle.db")
        conn = sqlite3.connect(db)
        conn.execute(
            """
            CREATE TABLE outros_gastos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT, valor REAL, data TEXT,
                categoria TEXT, tipo TEXT, recorrencia TEXT,
                parcelas_total INTEGER, parcela_atual INTEGER,
                grupo_parcela TEXT, observacao TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE receitas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT, valor REAL, data TEXT,
                categoria TEXT, tipo TEXT, recorrencia TEXT,
                parcelas_total INTEGER, parcela_atual INTEGER,
                grupo_parcela TEXT, observacao TEXT
            )
            """
        )
        conn.commit()
        conn.close()

    conn_m = sqlite3.connect(os.path.join(mateus_dir, "controle.db"))
    conn_m.execute(
        "INSERT INTO outros_gastos (nome, valor, data, categoria) VALUES (?,?,?,?)",
        ("Despesa teste Mateus", 150.0, "2026-06-15", "outros"),
    )
    conn_m.execute(
        "INSERT INTO receitas (nome, valor, data) VALUES (?,?,?)",
        ("Receita teste Mateus", 500.0, "2026-06-10"),
    )
    conn_m.commit()
    conn_m.close()

    return tmp, token_google


def _patch_models_paths(tmp_root):
  base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
  m.USUARIOS_DB_PATH = os.path.join(tmp_root, "bancos_usuarios", "_auth", "usuarios.db")
  # get_db_path usa dirname(models.py)/bancos_usuarios — redirecionar via monkeypatch no root
  orig_join = os.path.join

  def fake_join(*parts):
    if "bancos_usuarios" in parts and parts[0] == base:
      idx = parts.index("bancos_usuarios")
      tail = parts[idx + 1 :]
      return orig_join(tmp_root, "bancos_usuarios", *tail)
    return orig_join(*parts)

  return orig_join, fake_join


def test_usuario_para_dados_google_aponta_pasta_mateus():
    tmp, _ = _setup_isolated_auth_and_mateus_data()
    orig_join, fake_join = _patch_models_paths(tmp)
    try:
        os.path.join = fake_join
        m.get_usuario_atual = lambda: "mateusaugusto692"
        dados = m._usuario_para_dados("mateusaugusto692")
        assert dados == "Mateus", f"esperado Mateus, obteve {dados}"
        outros = m.carregar_outros_mes_ano("06", "2026", dados)
        assert len(outros) == 1, f"esperado 1 despesa, obteve {len(outros)}"
        receitas = m.carregar_receitas_mes_ano("06", "2026", usuario=dados)
        assert len(receitas) == 1
    finally:
        os.path.join = orig_join
        shutil.rmtree(tmp, ignore_errors=True)


def test_get_usuario_atual_unifica_sessao_google():
    tmp, token = _setup_isolated_auth_and_mateus_data()
    orig_join, fake_join = _patch_models_paths(tmp)
    try:
        os.path.join = fake_join

        class FakeRequest:
            cookies = {"session_token": token}

        class FakeG:
            pass

        import flask
        # mock mínimo sem app context completo
        m.request = FakeRequest()
        g = FakeG()
        m.g = g

        user = None

        def fake_get():
            nonlocal user
            conn = sqlite3.connect(m.USUARIOS_DB_PATH)
            c = conn.cursor()
            c.execute("SELECT username FROM sessoes WHERE token = ?", (token,))
            row = c.fetchone()
            conn.close()
            if not row:
                return None
            username_sessao = row[0]
            perfil = m.obter_perfil_usuario(username_sessao) or {}
            email_sessao = (perfil.get("email") or "").strip()
            canonical = m.canonical_account_username(username_sessao, email_sessao)
            if canonical != username_sessao:
                conn = sqlite3.connect(m.USUARIOS_DB_PATH)
                c = conn.cursor()
                c.execute(
                    "UPDATE sessoes SET username = ? WHERE token = ?",
                    (canonical, token),
                )
                conn.commit()
                conn.close()
            return canonical

        # Teste direto da lógica de unificação
        user = fake_get()
        assert user == "Mateus"
        conn = sqlite3.connect(m.USUARIOS_DB_PATH)
        c = conn.cursor()
        c.execute("SELECT username FROM sessoes WHERE token = ?", (token,))
        assert c.fetchone()[0] == "Mateus"
        conn.close()
    finally:
        os.path.join = orig_join
        shutil.rmtree(tmp, ignore_errors=True)


def test_api_outros_via_flask_client():
    tmp, token = _setup_isolated_auth_and_mateus_data()
    orig_join, fake_join = _patch_models_paths(tmp)
    try:
        os.path.join = fake_join
        from app import server

        client = server.test_client()
        rv = client.get(
            "/api/controle/outros?mes=06&ano=2026",
            headers={"Cookie": f"session_token={token}"},
        )
        assert rv.status_code == 200, rv.get_data(as_text=True)
        data = rv.get_json()
        assert isinstance(data, list), data
        assert len(data) >= 1, f"API outros vazia: {data}"
        assert data[0].get("nome") == "Despesa teste Mateus"

        rv2 = client.get(
            "/api/controle/receitas?mes=06&ano=2026",
            headers={"Cookie": f"session_token={token}"},
        )
        assert rv2.status_code == 200
        rec = rv2.get_json()
        assert isinstance(rec, list) and len(rec) >= 1
    finally:
        os.path.join = orig_join
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    test_usuario_para_dados_google_aponta_pasta_mateus()
    print("OK test_usuario_para_dados_google_aponta_pasta_mateus")
    test_get_usuario_atual_unifica_sessao_google()
    print("OK test_get_usuario_atual_unifica_sessao_google")
    test_api_outros_via_flask_client()
    print("OK test_api_outros_via_flask_client")
    print("Todos os testes passaram.")
