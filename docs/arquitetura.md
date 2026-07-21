# Arquitetura

## Visão geral

O FinMas é um **monólito full-stack**:

```
┌─────────────────────────────────────────────────────────┐
│  Browser (SPA React)                                     │
│  - React 18 + TypeScript + Vite                          │
│  - TanStack Query (cache de API)                         │
│  - React Router (rotas)                                  │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP /api/*  (cookies de sessão)
┌───────────────────────▼─────────────────────────────────┐
│  Flask (backend/app.py)                                  │
│  - REST JSON                                             │
│  - Serve frontend/dist em produção                       │
│  - Gunicorn (gthread) em Docker                          │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   SQLite/user    Flask-Caching    APIs externas
   (carteira,     (filesystem      yfinance, BCB,
    controle,      ./cache)         brapi, scrapers,
    marmitas)                      tesouro-direto-br
```

## Backend

| Arquivo / pasta | Responsabilidade |
|-----------------|------------------|
| `backend/app.py` | Rotas Flask, orquestração, OAuth, batch API |
| `backend/models.py` | Persistência, regras de negócio, histórico carteira, controle |
| `backend/connection_utils.py` | Detecção de cliente desconectado (abort de jobs longos) |
| `backend/fii_scraper.py` | Metadados de FIIs |
| `backend/mercados_api.py` | Integrações de mercado |
| `backend/tesouro_direto_api.py` | Tesouro Direto |
| `backend/scraper_*.py` | Notícias, rankings, agenda dividendos |
| `backend/generate_assets_lists_from_brapi.py` | Listas de tickers (ações, FIIs, BDRs) |

### Sessão e multi-tenant

- Cada requisição autenticada associa um **username** via sessão Flask (`set_usuario_atual` / `get_usuario_atual`).
- Dados financeiros ficam em **arquivos SQLite separados por usuário** (`bancos_usuarios/{username}/`).
- Auth centralizado em `bancos_usuarios/_auth/usuarios.db` (modo SQLite) ou PostgreSQL se `DATABASE_URL` estiver definida.

### Cache

- `flask-caching` com backend filesystem (`./cache`).
- Chaves por usuário e por recurso (ex.: notícias, cotações).
- Invalidação parcial em `limpar_cache_usuario()` após alterações na carteira.

### Processamento pesado

- **Análise de ativos**: ThreadPoolExecutor com cancelamento se o cliente desconectar.
- **Proventos**: busca paralela por ticker (yfinance / fontes configuradas).
- **Batch API** (`POST /api/batch`): agrupa várias leituras em uma requisição.

## Frontend

| Pasta | Responsabilidade |
|-------|------------------|
| `frontend/src/pages/` | Uma página por rota principal |
| `frontend/src/components/` | UI reutilizável (carteira, controle, guia, home) |
| `frontend/src/services/api.ts` | Cliente Axios, serviços por domínio, `TELAS_APP` |
| `frontend/src/contexts/` | Auth, tema, categorias de controle, análise |
| `frontend/src/utils/` | Formatadores, benchmark carteira, parsers B3 |
| `frontend/src/content/marketingContent.ts` | Textos de landing/vendas |

### Rotas

- **Públicas**: `/`, `/login`, `/guia`, `/calculadora`, `/detalhes`, `/vendas`, `/conhecer`
- **Autenticadas**: `/home`, `/carteira`, `/controle`, `/analise`, etc.
- **Proteção**: `ProtectedRoute` (login) + `canAccessScreen` (premium por tela)

### Estado e performance

- React Query com `staleTime` por tipo de dado (carteira, insights, histórico).
- Carregamento sob demanda em abas pesadas da carteira (insights só na aba insights).
- `NavigationGuard` cancela requests em voo ao trocar de rota.
- Limitador global de GETs concorrentes no `api.ts`.

## Comparativo carteira vs índices

Lógica compartilhada em `frontend/src/utils/carteiraBenchmark.ts`:

1. Backend retorna séries rebased e `carteira_price` (retorno por preço, sem aportes).
2. Frontend ancora todas as séries na mesma data e capital inicial.
3. Modo **R$**: `capital × (série[i] / série[âncora])`
4. Modo **%**: `(série[i] / série[âncora] − 1) × 100`

Patrimônio **com aportes** usa `carteira_valor` + snapshots em `historico_carteira` (gráfico separado).

## Integrações externas

| Fonte | Uso |
|-------|-----|
| **yfinance** | Cotações, histórico, fundamentals |
| **BCB / séries** | CDI, IPCA, SELIC, correção monetária |
| **brapi.dev** | Listas de ativos, rankings |
| **tesouro-direto-br** | Títulos públicos |
| **Investidor10 / scrapers** | Agenda dividendos, rankings (HTML) |
| **dadosdemercado.com.br** | Notícias |
| **ccxt** (opcional) | Criptomoedas |

## Deploy típico

```
Internet → Nginx (TLS) → Gunicorn :8080 → Flask
                ↓
         volumes: bancos_usuarios, cache, backups, logs
```

Ver [Deploy e operação](deploy-e-operacao.md).
