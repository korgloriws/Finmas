"""
Assistente FinMas via OpenRouter — agent com tools internas (carteira, ativos, notícias).
A chave fica só no backend: OPENROUTER_API_KEY
"""
from __future__ import annotations

import json
import os
import traceback
from typing import Any, Dict, List, Optional, Tuple

import requests

# Carrega .env local se existir (sem sobrescrever variáveis já definidas)
def _load_env_file(path: str) -> None:
    try:
        if not os.path.isfile(path):
            return
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, _, val = line.partition('=')
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val
    except Exception:
        pass


try:
    from dotenv import load_dotenv
    _here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(_here, '.env'), override=False)
    load_dotenv(os.path.join(_here, '..', '.env'), override=False)
except Exception:
    _here = os.path.dirname(os.path.abspath(__file__))
    _load_env_file(os.path.join(_here, '.env'))
    _load_env_file(os.path.join(_here, '..', '.env'))

OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
OPENROUTER_API_KEY = (os.getenv('OPENROUTER_API_KEY') or '').strip()

# Cascata OpenRouter (só modelos válidos). stealth/ox-alpha NÃO existe no catálogo atual.
OPENROUTER_MODELS = [
    m.strip()
    for m in (os.getenv('OPENROUTER_MODELS') or '').split(',')
    if m.strip()
] or [
    'openrouter/free',  # roteador free (rápido) — escolhe um free disponível
    'nvidia/nemotron-3.5-lightning:free',
    'thinkingmachines/inkling:free',
    'minimax/minimax-m3:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
]

# Limites — free models às vezes engasgam; timeout curto + fallback
MAX_TOOL_ROUNDS = 3
MAX_MODELS_TRY = int(os.getenv('OPENROUTER_MAX_MODELS', '3') or 3)
REQUEST_TIMEOUT_S = float(os.getenv('OPENROUTER_TIMEOUT_S', '20') or 20)
OVERALL_BUDGET_S = float(os.getenv('OPENROUTER_BUDGET_S', '55') or 55)
TOOL_TIMEOUT_S = float(os.getenv('OPENROUTER_TOOL_TIMEOUT_S', '12') or 12)

SYSTEM_PROMPT = """Você é o assistente do FinMas, app de investimentos e finanças pessoais (ações, FIIs, BDRs, renda fixa, carteira e análise).

Regras:
- Se a pergunta for sobre "esta tela", "o que tem aqui", "como usar esta página", use o CONTEXTO DA TELA / guia de telas e responda SEM chamar tools, salvo se pedirem números da carteira ou de um ticker.
- Use tools só quando precisar de dados reais (carteira, cotação, notícias, taxas).
- Não invente cotações nem indicadores. Se a tool falhar, diga que não conseguiu obter o dado.
- Responda em português do Brasil, claro e objetivo.
- Não execute ordens de compra/venda; apenas oriente.
"""

# Descrições estáticas — respondem "o que tem nesta tela" sem bater no mercado
GUIA_TELAS = {
    '/': {
        'nome': 'Home',
        'resumo': 'Painel inicial com visão geral do patrimônio e do mês.',
        'conteudo': [
            'Cards de resumo (carteira, saldo/controle do mês)',
            'Insights rápidos',
            'Distribuição da carteira',
            'Evolução patrimonial',
            'Widget de notícias',
            'Atalhos / rankings em destaque',
        ],
        'dicas': 'Use a Home para checar o dia a dia. Para aprofundar, vá em Carteira, Análise ou Detalhes.',
    },
    '/carteira': {
        'nome': 'Carteira',
        'resumo': 'Gestão das posições e proventos.',
        'conteudo': ['Lista de ativos', 'Proventos', 'Projeção', 'Rebalanceamento', 'Gráficos'],
        'dicas': 'Aqui você acompanha quantidade, preço médio e valor investido.',
    },
    '/analise': {
        'nome': 'Análise de oportunidades',
        'resumo': 'Screener com filtros de DY, ROE, P/L, P/VP, liquidez e período dos indicadores.',
        'conteudo': ['Lista (Ações/BDRs/FIIs)', 'Filtros e exclusão de setor', 'Período Agora/6M/1A/3A/5A', 'Gráficos'],
        'dicas': 'O período recalcula DY/ROE/P/L/P/VP/liquidez na janela escolhida.',
    },
    '/detalhes': {
        'nome': 'Detalhes dos ativos',
        'resumo': 'Ficha completa de um ticker (preço, fundamentos, dividendos, gráficos).',
        'conteudo': ['Visão geral', 'Fundamentos', 'Dividendos', 'Comparativos'],
        'dicas': 'Informe um ticker na busca para abrir a ficha.',
    },
    '/controle': {
        'nome': 'Controle financeiro',
        'resumo': 'Receitas, despesas, cartões e alimentação do mês.',
        'conteudo': ['Financeiro', 'Cartões', 'Alimentação'],
        'dicas': 'Ideal para acompanhar fluxo de caixa pessoal.',
    },
    '/noticias': {
        'nome': 'Notícias',
        'resumo': 'Feed de notícias do mercado.',
        'conteudo': ['Lista de matérias', 'Detalhe da notícia'],
    },
    '/guia': {
        'nome': 'Guia do Mercado',
        'resumo': 'Conteúdo educativo sobre o mercado.',
    },
    '/calculadora': {
        'nome': 'Calculadoras',
        'resumo': 'Juros compostos, correção monetária e outras simulações.',
    },
    '/rankings': {
        'nome': 'Rankings',
        'resumo': 'Rankings de ativos por indicadores.',
    },
    '/agenda-dividendos': {
        'nome': 'Agenda de Dividendos',
        'resumo': 'Calendário de proventos.',
    },
    '/configuracoes': {
        'nome': 'Configurações',
        'resumo': 'Perfil, segurança e preferências da conta.',
    },
}

TOOLS_SPEC = [
    {
        'type': 'function',
        'function': {
            'name': 'info_tela',
            'description': 'Descreve o que a tela/rota atual do FinMas mostra (rápido, sem dados de mercado). Use para perguntas sobre a interface.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'rota': {
                        'type': 'string',
                        'description': 'Rota atual, ex: /, /carteira, /analise',
                    },
                },
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'resumo_carteira',
            'description': 'Resumo da carteira do usuário logado: total, alocação por tipo e top ativos.',
            'parameters': {'type': 'object', 'properties': {}, 'additionalProperties': False},
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'consultar_ativo',
            'description': 'Consulta rápida de preço e indicadores atuais de um ticker.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'ticker': {
                        'type': 'string',
                        'description': 'Ticker do ativo, ex: PETR4, HGLG11, AAPL34',
                    },
                },
                'required': ['ticker'],
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'buscar_noticias',
            'description': 'Busca notícias recentes do mercado no FinMas (pode demorar um pouco).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'limite': {
                        'type': 'integer',
                        'description': 'Quantidade de notícias (1-5)',
                        'minimum': 1,
                        'maximum': 5,
                    },
                },
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'taxas_indexadores',
            'description': 'Retorna taxas atuais de indexadores (SELIC, CDI, IPCA).',
            'parameters': {'type': 'object', 'properties': {}, 'additionalProperties': False},
        },
    },
]


def assistente_configurado() -> bool:
    return bool(OPENROUTER_API_KEY)


def _safe_float(v: Any, digits: int = 2) -> Optional[float]:
    try:
        if v is None:
            return None
        f = float(v)
        if f != f or f == float('inf') or f == float('-inf'):
            return None
        return round(f, digits)
    except Exception:
        return None


def tool_resumo_carteira() -> Dict[str, Any]:
    from models import obter_carteira

    carteira = obter_carteira()
    if isinstance(carteira, dict) and carteira.get('success') is False:
        return {'ok': False, 'erro': carteira.get('message') or 'Carteira indisponível'}
    if not isinstance(carteira, list):
        return {'ok': False, 'erro': 'Formato de carteira inesperado'}

    total = 0.0
    por_tipo: Dict[str, float] = {}
    itens = []
    for a in carteira:
        try:
            valor = float(a.get('valor_total') or 0)
        except Exception:
            valor = 0.0
        total += valor
        tipo = str(a.get('tipo') or 'Outros')
        por_tipo[tipo] = por_tipo.get(tipo, 0.0) + valor
        itens.append({
            'ticker': a.get('ticker'),
            'tipo': tipo,
            'quantidade': _safe_float(a.get('quantidade'), 4),
            'preco_atual': _safe_float(a.get('preco_atual')),
            'valor_total': _safe_float(valor),
            'dy': _safe_float(a.get('dy')),
            'pl': _safe_float(a.get('pl')),
            'pvp': _safe_float(a.get('pvp')),
            'roe': _safe_float(a.get('roe')),
        })

    itens.sort(key=lambda x: x.get('valor_total') or 0, reverse=True)
    alocacao = []
    if total > 0:
        for tipo, valor in sorted(por_tipo.items(), key=lambda x: -x[1]):
            alocacao.append({
                'tipo': tipo,
                'valor': _safe_float(valor),
                'pct': _safe_float(100.0 * valor / total),
            })

    return {
        'ok': True,
        'total_patrimonio': _safe_float(total),
        'qtd_ativos': len(itens),
        'alocacao_por_tipo': alocacao,
        'top_ativos': itens[:12],
    }


def tool_info_tela(rota: Optional[str] = None) -> Dict[str, Any]:
    path = (rota or '/').strip() or '/'
    if not path.startswith('/'):
        path = '/' + path
    # match prefix mais específico
    guia = GUIA_TELAS.get(path)
    if not guia:
        for key in sorted(GUIA_TELAS.keys(), key=len, reverse=True):
            if key != '/' and path.startswith(key):
                guia = GUIA_TELAS[key]
                path = key
                break
    if not guia:
        guia = GUIA_TELAS.get('/')
        path = '/'
    return {'ok': True, 'rota': path, **guia}


def tool_consultar_ativo(ticker: str, periodo_indicadores: str = 'atual') -> Dict[str, Any]:
    """Consulta leve — evita calcular todos os períodos (era a causa principal de timeout)."""
    from models import obter_informacoes_ativo

    t = (ticker or '').strip().upper()
    if not t:
        return {'ok': False, 'erro': 'Ticker vazio'}

    info = obter_informacoes_ativo(t)
    if not info:
        return {'ok': False, 'erro': f'Não foi possível obter dados de {t}'}

    dy = info.get('dy')
    # Yahoo às vezes manda fração
    try:
        if dy is not None and 0 < float(dy) < 1:
            dy = float(dy) * 100.0
    except Exception:
        pass

    roe = info.get('roe')
    try:
        if roe is not None and abs(float(roe)) <= 1.5:
            roe = float(roe) * 100.0
    except Exception:
        pass

    return {
        'ok': True,
        'ticker': info.get('ticker') or t,
        'nome': info.get('nome_completo'),
        'tipo': info.get('tipo'),
        'preco_atual': _safe_float(info.get('preco_atual')),
        'dividend_yield': _safe_float(dy),
        'roe': _safe_float(roe),
        'pl': _safe_float(info.get('pl')),
        'pvp': _safe_float(info.get('pvp')),
        'nota': 'Indicadores no snapshot atual (consulta rápida).',
    }


def _run_with_timeout(fn, timeout_s: float, default_on_timeout: Dict[str, Any]):
    from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            fut = ex.submit(fn)
            return fut.result(timeout=timeout_s)
    except FuturesTimeout:
        return default_on_timeout
    except Exception as e:
        return {'ok': False, 'erro': str(e)}


def tool_buscar_noticias(limite: int = 5) -> Dict[str, Any]:
    n = max(1, min(int(limite or 5), 5))

    def _job():
        from scraper_noticias import obter_noticias
        noticias = obter_noticias(limite=n) or []
        itens = []
        for item in noticias[:n]:
            if not isinstance(item, dict):
                continue
            itens.append({
                'titulo': item.get('titulo') or item.get('title'),
                'fonte': item.get('fonte') or item.get('source'),
                'data': item.get('data') or item.get('date'),
                'url': item.get('url') or item.get('link'),
                'resumo': (item.get('resumo') or item.get('summary') or '')[:280],
            })
        return {'ok': True, 'noticias': itens}

    return _run_with_timeout(
        _job,
        TOOL_TIMEOUT_S,
        {'ok': False, 'erro': f'Timeout ao buscar notícias (>{TOOL_TIMEOUT_S:.0f}s)'},
    )


def tool_taxas_indexadores() -> Dict[str, Any]:
    def _job():
        from models import obter_taxas_indexadores
        taxas = obter_taxas_indexadores() or {}
        return {'ok': True, 'taxas': taxas}

    return _run_with_timeout(
        _job,
        TOOL_TIMEOUT_S,
        {'ok': False, 'erro': f'Timeout ao buscar taxas (>{TOOL_TIMEOUT_S:.0f}s)'},
    )


def executar_tool(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    args = arguments or {}
    if name == 'info_tela':
        return tool_info_tela(args.get('rota'))
    if name == 'resumo_carteira':
        return _run_with_timeout(
            tool_resumo_carteira,
            TOOL_TIMEOUT_S,
            {'ok': False, 'erro': f'Timeout ao ler carteira (>{TOOL_TIMEOUT_S:.0f}s)'},
        )
    if name == 'consultar_ativo':
        t = str(args.get('ticker') or '')
        return _run_with_timeout(
            lambda: tool_consultar_ativo(t),
            TOOL_TIMEOUT_S,
            {'ok': False, 'erro': f'Timeout ao consultar {t} (>{TOOL_TIMEOUT_S:.0f}s)'},
        )
    if name == 'buscar_noticias':
        return tool_buscar_noticias(args.get('limite', 5))
    if name == 'taxas_indexadores':
        return tool_taxas_indexadores()
    return {'ok': False, 'erro': f'Tool desconhecida: {name}'}


def _parse_tool_args(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw or '{}')
        except Exception:
            return {}
    return {}


def _openrouter_headers() -> Dict[str, str]:
    return {
        'Authorization': f'Bearer {OPENROUTER_API_KEY}',
        'Content-Type': 'application/json',
        'HTTP-Referer': os.getenv('OPENROUTER_HTTP_REFERER', 'http://localhost:3000'),
        'X-Title': os.getenv('OPENROUTER_APP_TITLE', 'FinMas Assistente'),
    }


def _chamar_openrouter(
    model: str,
    messages: List[Dict[str, Any]],
    use_tools: bool = True,
    timeout_s: Optional[float] = None,
) -> Tuple[Optional[Dict], Optional[str], int]:
    """Retorna (message_dict, erro, status_http)."""
    body: Dict[str, Any] = {
        'model': model,
        'messages': messages,
        'temperature': 0.3,
        'max_tokens': 1200,
        'stream': False,
    }
    if use_tools:
        body['tools'] = TOOLS_SPEC
        body['tool_choice'] = 'auto'

    timeout = timeout_s if timeout_s is not None else REQUEST_TIMEOUT_S
    try:
        resp = requests.post(
            OPENROUTER_URL,
            headers=_openrouter_headers(),
            json=body,
            timeout=timeout,
        )
    except requests.Timeout:
        return None, f'Timeout OpenRouter ({timeout:.0f}s) no modelo {model}', 0
    except Exception as e:
        return None, f'Falha de rede OpenRouter: {e}', 0

    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text[:400]
        return None, f'OpenRouter {resp.status_code}: {detail}', resp.status_code

    try:
        data = resp.json()
        msg = (data.get('choices') or [{}])[0].get('message') or {}
        return msg, None, resp.status_code
    except Exception as e:
        return None, f'Resposta inválida: {e}', resp.status_code


def _extrair_texto(message: Dict[str, Any]) -> str:
    content = message.get('content')
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for p in content:
            if isinstance(p, dict) and p.get('type') in ('text', 'output_text'):
                parts.append(str(p.get('text') or ''))
            elif isinstance(p, str):
                parts.append(p)
        return '\n'.join(x for x in parts if x).strip()
    return ''


def _montar_contexto_tela(contexto: Optional[Dict[str, Any]]) -> str:
    if not contexto:
        return ''
    try:
        rota = contexto.get('rota') or contexto.get('path') or '/'
        guia = tool_info_tela(str(rota))
        resumido = {
            'rota': rota,
            'titulo': contexto.get('titulo') or guia.get('nome'),
            'ticker': contexto.get('ticker'),
            'aba': contexto.get('aba') or contexto.get('tab'),
            'subaba': contexto.get('subaba') or contexto.get('sub'),
            'filtros': contexto.get('filtros'),
            'periodo_indicadores': contexto.get('periodo_indicadores'),
            'observacoes': contexto.get('observacoes'),
            'guia_tela': {
                'nome': guia.get('nome'),
                'resumo': guia.get('resumo'),
                'conteudo': guia.get('conteudo'),
                'dicas': guia.get('dicas'),
            },
        }
        resumido = {k: v for k, v in resumido.items() if v not in (None, '', [], {})}
        if not resumido:
            return ''
        return (
            'Contexto da tela atual do usuário (já inclui o guia da tela — '
            'para “o que tem nesta tela” responda com base nisto, sem tools):\n'
            + json.dumps(resumido, ensure_ascii=False)
        )
    except Exception:
        return ''


def _norm_texto(s: str) -> str:
    import unicodedata
    s = (s or '').lower().strip()
    s = unicodedata.normalize('NFKD', s)
    return ''.join(c for c in s if not unicodedata.combining(c))


def _formatar_resposta_tela(contexto: Optional[Dict[str, Any]]) -> str:
    rota = '/'
    if contexto:
        rota = str(contexto.get('rota') or contexto.get('path') or '/')
    guia = tool_info_tela(rota)
    nome = guia.get('nome') or 'esta tela'
    linhas = [
        f"Você está na tela **{nome}** ({guia.get('rota') or rota}).",
        guia.get('resumo') or '',
    ]
    conteudo = guia.get('conteudo') or []
    if conteudo:
        linhas.append('')
        linhas.append('O que aparece por aqui:')
        for item in conteudo:
            linhas.append(f'• {item}')
    if guia.get('dicas'):
        linhas.append('')
        linhas.append(f"Dica: {guia['dicas']}")
    linhas.append('')
    linhas.append('Se quiser, posso analisar sua carteira ou um ticker específico.')
    return '\n'.join(x for x in linhas if x is not None)


def _formatar_resposta_carteira() -> Tuple[str, List[str]]:
    data = tool_resumo_carteira()
    if not data.get('ok'):
        return (
            f"Não consegui ler a carteira agora: {data.get('erro') or 'erro desconhecido'}.",
            ['resumo_carteira'],
        )
    total = data.get('total_patrimonio') or 0
    qtd = data.get('qtd_ativos') or 0
    linhas = [
        f"Resumo da sua carteira: **R$ {total:,.2f}** em **{qtd}** ativo(s).".replace(',', 'X').replace('.', ',').replace('X', '.'),
        '',
        'Alocação por tipo:',
    ]
    for a in data.get('alocacao_por_tipo') or []:
        linhas.append(
            f"• {a.get('tipo')}: R$ {float(a.get('valor') or 0):,.2f} ({a.get('pct')}%)"
            .replace(',', 'X').replace('.', ',').replace('X', '.')
        )
    top = data.get('top_ativos') or []
    if top:
        linhas.append('')
        linhas.append('Maiores posições:')
        for a in top[:8]:
            linhas.append(
                f"• {a.get('ticker')}: R$ {float(a.get('valor_total') or 0):,.2f}"
                .replace(',', 'X').replace('.', ',').replace('X', '.')
            )
    linhas.append('')
    linhas.append('Quer um insight de diversificação ou foco em algum tipo de ativo?')
    return '\n'.join(linhas), ['resumo_carteira']


def _resposta_instantanea(
    mensagem: str,
    contexto: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Desativado: o usuário quer sempre OpenRouter. Mantido só como API interna vazia."""
    return None


def _precisa_tools(mensagem: str) -> bool:
    t = _norm_texto(mensagem)
    # Perguntas de tela/UI: preferir responder só com contexto (sem tools pesadas)
    if any(k in t for k in (
        'esta tela', 'nessa tela', 'nesta tela', 'essa tela',
        'o que tem', 'o que aparece', 'como usar', 'para que serve',
        'sobre a home', 'tela home', 'pagina home',
    )):
        return False
    return any(k in t for k in (
        'carteira', 'ticker', 'preco', 'cotacao', 'dy', 'roe', 'p/l', 'pl ',
        'noticia', 'selic', 'cdi', 'ipca', 'ativo', 'fii', 'petr', 'vale',
        'comprar', 'vender', 'alocacao', 'patrimonio',
    ))


def rodar_assistente(
    mensagem: str,
    historico: Optional[List[Dict[str, str]]] = None,
    contexto: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    import time

    if not assistente_configurado():
        return {
            'ok': False,
            'error': 'OPENROUTER_API_KEY não configurada. Adicione a chave no arquivo .env do backend e reinicie o Flask.',
            'code': 'missing_api_key',
        }

    texto = (mensagem or '').strip()
    if not texto:
        return {'ok': False, 'error': 'Mensagem vazia', 'code': 'empty_message'}

    started = time.monotonic()

    def _budget_left() -> float:
        return OVERALL_BUDGET_S - (time.monotonic() - started)

    messages: List[Dict[str, Any]] = [{'role': 'system', 'content': SYSTEM_PROMPT}]
    ctx = _montar_contexto_tela(contexto)
    if ctx:
        messages.append({'role': 'system', 'content': ctx})

    for h in (historico or [])[-6:]:
        role = h.get('role')
        content = (h.get('content') or '').strip()
        if role in ('user', 'assistant') and content:
            messages.append({'role': role, 'content': content[:2500]})

    messages.append({'role': 'user', 'content': texto[:4000]})

    tools_used: List[str] = []
    model_usado = None
    model_efetivo = None
    ultimo_erro = None
    # Remove slugs inválidos conhecidos
    models = [
        m for m in OPENROUTER_MODELS[: max(1, MAX_MODELS_TRY)]
        if m and m != 'stealth/ox-alpha'
    ]
    if not models:
        models = ['openrouter/free']

    use_tools_prefer = _precisa_tools(texto)

    for model in models:
        if _budget_left() < 6:
            ultimo_erro = f'Orçamento de tempo esgotado (~{OVERALL_BUDGET_S:.0f}s)'
            break

        model_usado = model
        local_messages = [dict(m) for m in messages]
        use_tools = use_tools_prefer

        for round_i in range(MAX_TOOL_ROUNDS + 1):
            if _budget_left() < 6:
                ultimo_erro = f'Orçamento de tempo esgotado (~{OVERALL_BUDGET_S:.0f}s)'
                break

            timeout = min(REQUEST_TIMEOUT_S, max(6.0, _budget_left() - 1))
            msg, err, status = _chamar_openrouter(model, local_messages, use_tools=use_tools, timeout_s=timeout)
            if err:
                ultimo_erro = err
                low = err.lower()
                if 'timeout' in low or status in (429, 0):
                    break
                if status in (404,) or 'tool' in low or 'no endpoints' in low or 'not found' in low:
                    if use_tools:
                        use_tools = False
                        continue
                    break
                break

            tool_calls = msg.get('tool_calls') or []
            if tool_calls and use_tools:
                local_messages.append({
                    'role': 'assistant',
                    'content': msg.get('content') or '',
                    'tool_calls': tool_calls,
                })
                for tc in tool_calls:
                    if _budget_left() < 4:
                        break
                    fn = (tc.get('function') or {})
                    name = fn.get('name') or ''
                    args = _parse_tool_args(fn.get('arguments'))
                    if name == 'info_tela' and not args.get('rota') and contexto:
                        args['rota'] = contexto.get('rota') or contexto.get('path') or '/'
                    tools_used.append(name)
                    try:
                        result = executar_tool(name, args)
                    except Exception as e:
                        result = {'ok': False, 'erro': str(e)}
                    local_messages.append({
                        'role': 'tool',
                        'tool_call_id': tc.get('id') or name,
                        'name': name,
                        'content': json.dumps(result, ensure_ascii=False, default=str)[:8000],
                    })
                continue

            reply = _extrair_texto(msg)
            if not reply:
                reply = 'Consultei os dados disponíveis. Pode detalhar um pouco mais a sua dúvida?'
            return {
                'ok': True,
                'reply': reply,
                'model': model,
                'tools_used': tools_used,
                'elapsed_s': round(time.monotonic() - started, 2),
            }

    return {
        'ok': False,
        'error': ultimo_erro or 'Nenhum modelo OpenRouter disponível no momento',
        'code': 'all_models_failed',
        'model_tentado': model_usado,
        'tools_used': tools_used,
        'elapsed_s': round(time.monotonic() - started, 2),
    }


def status_assistente() -> Dict[str, Any]:
    return {
        'configured': assistente_configurado(),
        'version': 'openrouter-v3',  # se o front/status não mostrar isto, o Flask antigo ainda está no ar
        'models': OPENROUTER_MODELS,
        'tools': [t['function']['name'] for t in TOOLS_SPEC],
    }
