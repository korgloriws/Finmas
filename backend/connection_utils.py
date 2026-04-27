"""
Utilitários para detectar desconexão de cliente HTTP em Flask.

Por que isto existe
-------------------
Flask + Gunicorn em modo síncrono (workers `sync` ou `gthread`) não recebe
notificação automática quando o cliente fecha a conexão TCP. Se a request
está dentro de uma chamada bloqueante (ex: yfinance pesado), o servidor
continua processando até o fim e só descobre que o cliente sumiu quando
tenta escrever a resposta no socket morto. Isso desperdiça threads e
slots de semáforo (ex: ANALISE_ATIVOS_SEM, MONTE_CARLO_SEM) — exatamente
o que aparece nos logs como [SLOW] GET ... duracao=200s+ sem ninguém
para receber.

Como funciona
-------------
A função `cliente_desconectado()` espia o socket TCP com MSG_PEEK em modo
não-bloqueante:
  - Se recv retorna b'' → cliente fechou (FIN/RST)
  - Se levanta BlockingIOError → socket vivo, sem dados pendentes (normal)
  - Se levanta ConnectionResetError → conexão resetada (cliente sumiu)
  - Qualquer outro erro → fail-safe: assume conectado

Modo de uso
-----------
Inserir verificações dentro de loops longos (ex: iterar tickers da
carteira fazendo yfinance). Suficientemente rápido (<1ms) para chamar a
cada iteração:

    for ativo in carteira:
        if cliente_desconectado():
            current_app.logger.info("Cliente desconectou, abortando")
            break
        processar(ativo)

Limitações
----------
- Não interrompe trabalho que já está rodando dentro de uma chamada
  externa (yfinance.history, requests.get, etc.) — só verifica entre
  iterações de loops Python.
- Em alguns proxies reversos (Nginx) pode haver buffering: o cliente
  fecha mas o Nginx só repassa o FIN ao backend depois do timeout.
  Para Finmas isso é OK porque temos timeout de 24h só na rota
  /api/analise/ativos; nas outras o Nginx repassa rapidamente.
"""
from __future__ import annotations

import socket as _socket_module
from typing import Optional

try:
    from flask import has_request_context, request as _flask_request
except ImportError:
    has_request_context = lambda: False  # type: ignore
    _flask_request = None  # type: ignore


def _extrair_socket_do_request() -> Optional[object]:
    """
    Tenta encontrar o socket TCP subjacente em diferentes ambientes:
    Werkzeug dev server, Gunicorn (sync/gthread) e fallback via wsgi.input.
    Retorna None se não conseguir.
    """
    if not has_request_context():
        return None
    try:
        env = _flask_request.environ
    except Exception:
        return None

    # Werkzeug dev server expõe diretamente
    sock = env.get('werkzeug.socket')
    if sock is not None:
        return sock

    # Gunicorn (alguns workers) também expõe
    sock = env.get('gunicorn.socket')
    if sock is not None:
        return sock

    # Fallback: tentar extrair do wsgi.input (geralmente um BufferedReader
    # envolvendo o socket). Esta abordagem é frágil e depende da
    # implementação interna do servidor.
    wsgi_input = env.get('wsgi.input')
    if wsgi_input is None:
        return None

    # Werkzeug usa LimitedStream wrapping o rfile do BaseHTTPRequestHandler
    candidates = (
        getattr(wsgi_input, '_sock', None),
        getattr(getattr(wsgi_input, 'rfile', None), '_sock', None),
        getattr(getattr(wsgi_input, 'stream', None), 'raw', None),
    )
    for cand in candidates:
        if cand is not None and hasattr(cand, 'recv'):
            return cand

    return None


def cliente_desconectado() -> bool:
    """
    Retorna True somente se for CERTEZA que o cliente HTTP fechou a
    conexão TCP. Em qualquer dúvida, retorna False (fail-safe — não
    abortar requests legítimas).

    Custo: ~0.1ms quando o socket está acessível. Seguro para chamar
    em loops de centenas de iterações.
    """
    sock = _extrair_socket_do_request()
    if sock is None:
        return False  # não conseguiu verificar → assume conectado

    try:
        # MSG_PEEK lê sem consumir do buffer. Combinado com non-blocking,
        # nos diz se o socket está vivo, fechado ou tem dados pendentes.
        try:
            original_blocking = sock.getblocking()
        except Exception:
            original_blocking = True

        try:
            sock.setblocking(False)
        except Exception:
            return False

        try:
            data = sock.recv(1, _socket_module.MSG_PEEK)
            # Em non-blocking mode, recv retornar b'' significa que o
            # peer fechou ordeiramente (FIN). Esta é a detecção principal.
            if data == b'':
                return True
            # Recebemos algum byte — socket vivo (raro em GET, mas possível
            # em conexões keep-alive com pipelining).
            return False
        except BlockingIOError:
            # EAGAIN/EWOULDBLOCK: socket vivo, sem dados pendentes (normal)
            return False
        except (ConnectionResetError, BrokenPipeError):
            return True
        except (OSError, _socket_module.error):
            # Outros erros de socket: provavelmente desconectado
            return True
        finally:
            try:
                sock.setblocking(original_blocking)
            except Exception:
                pass
    except Exception:
        # Qualquer falha inesperada: fail-safe
        return False
