# Finmas - Sistema de Gestão Financeira Pessoal

Sistema completo de gestão financeira pessoal focado em investimentos, controle de gastos e análise de mercado brasileiro.

##  Índice

- [Visão Geral](#visão-geral)
- [Stack Tecnológico](#stack-tecnológico)
- [Arquitetura](#arquitetura)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Funcionalidades](#funcionalidades)
- [Como Funciona](#como-funciona)
- [Deploy e Infraestrutura](#deploy-e-infraestrutura)
- [APIs Disponíveis](#apis-disponíveis)
- [Desenvolvimento](#desenvolvimento)

---

##  Visão Geral

**Finmas** é uma plataforma SaaS completa para gestão financeira pessoal que permite:

- **Gestão de Carteira de Investimentos**: Ações, FIIs, BDRs, Criptomoedas, Renda Fixa
- **Análise de Mercado**: Filtros avançados, comparação de ativos, rankings
- **Controle Financeiro**: Receitas, despesas, cartões de crédito, marmitas
- **Análise de Proventos**: Agenda de dividendos, histórico, projeções
- **Relatórios e Insights**: Gráficos, relatórios PDF/CSV, análises de performance

### Características Principais

-  **Multi-usuário**: Isolamento total de dados por usuário
-  **Tempo Real**: Preços atualizados via yfinance
-  **Responsivo**: Funciona em desktop, tablet e mobile
-  **PWA**: Pode ser instalado como app
-  **Dark Mode**: Suporte a tema claro/escuro
-  **Performance**: Otimizado com batch requests e lazy loading

---

##  Stack Tecnológico

### Frontend

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **React** | 18.2.0 | Framework principal |
| **TypeScript** | 5.2.2 | Tipagem estática |
| **Vite** | 5.0.0 | Build tool e dev server |
| **React Router** | 6.20.1 | Roteamento |
| **TanStack Query** | 5.8.4 | Gerenciamento de estado e cache |
| **Recharts** | 2.15.4 | Gráficos e visualizações |
| **Tailwind CSS** | 3.3.5 | Estilização |
| **Framer Motion** | 12.23.12 | Animações |
| **Axios** | 1.6.2 | Cliente HTTP |
| **React Hook Form** | 7.48.2 | Formulários |
| **Zod** | 3.22.4 | Validação de schemas |

### Backend

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **Python** | 3.11 | Linguagem principal |
| **Flask** | Latest | Framework web |
| **Gunicorn** | Latest | Servidor WSGI (2 workers, 8 threads cada) |
| **SQLite** | - | Banco de dados (produção) |
| **PostgreSQL** | - | Banco de dados (opcional, via DATABASE_URL) |
| **yfinance** | Latest | Dados de mercado (preços, histórico, fundamentos) |
| **Pandas** | Latest | Manipulação de dados |
| **Bcrypt** | Latest | Hash de senhas |
| **Flask-Caching** | Latest | Cache de requisições |
| **ReportLab** | Latest | Geração de PDFs |

### Infraestrutura

| Tecnologia | Uso |
|------------|-----|
| **Docker** | Containerização |
| **Docker Compose** | Orquestração |
| **Nginx** | Reverse proxy e servidor web |
| **Let's Encrypt** | Certificados SSL |
| **Hostinger VPS** | Hospedagem (2 vCPUs, 8GB RAM) |

---

## Arquitetura

### Arquitetura Geral

```
┌─────────────────┐
│   Nginx (443)   │  ← Reverse Proxy + SSL
└────────┬────────┘
         │
┌────────▼────────┐
│  Docker App     │
│  ┌───────────┐  │
│  │  Flask    │  │  ← Backend (Gunicorn: 2 workers × 8 threads)
│  │  (8080)   │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │  React    │  │  ← Frontend (SPA estático)
│  │  (dist/)  │  │
│  └───────────┘  │
└────────┬────────┘
         │
┌────────▼────────┐
│  SQLite DBs     │  ← Bancos por usuário
│  (por usuário)  │     - carteira.db
│                 │     - controle.db
│                 │     - marmitas.db
└─────────────────┘
```

### Fluxo de Dados

1. **Usuário** → Nginx (HTTPS)
2. **Nginx** → Docker Container (Flask)
3. **Flask** → Valida autenticação (cookie `session_token`)
4. **Flask** → Busca dados no SQLite do usuário (`bancos_usuarios/{username}/`)
5. **Flask** → Busca preços em tempo real  (paralelizado com 200 workers)
6. **Flask** → Retorna JSON
7. **React** → Renderiza com React Query (cache automático)

### Isolamento de Dados

- Cada usuário tem seu próprio diretório: `bancos_usuarios/{username}/`
- Cada diretório contém 3 bancos SQLite:
  - `carteira.db` - Investimentos
  - `controle.db` - Receitas/Despesas
  - `marmitas.db` - Controle de alimentação
- Autenticação via cookie HTTP-only (`session_token`)
- Validação em todas as requisições

---

##  Estrutura do Projeto

```
Finmas/
├── backend/                    # Backend Python/Flask
│   ├── app.py                 # Rotas e endpoints da API
│   ├── models.py              # Lógica de negócio e acesso a dados
│   ├── assets_lists.py        # Listas de ativos (Ações, FIIs, BDRs)
│   ├── fii_scraper.py         # Scraper de dados de FIIs
│   ├── mercados_api.py        # API de dados de mercado
│   ├── tesouro_direto_api.py  # API de Tesouro Direto
│   ├── complete_b3_logos_mapping.py  # Mapeamento de logos
│   └── bancos_usuarios/       # Bancos SQLite por usuário
│       └── {username}/
│           ├── carteira.db
│           ├── controle.db
│           └── marmitas.db
│
├── frontend/                   # Frontend React/TypeScript
│   ├── src/
│   │   ├── pages/             # Páginas principais
│   │   │   ├── HomePage.tsx
│   │   │   ├── CarteiraPage.tsx
│   │   │   ├── DetalhesPage.tsx
│   │   │   ├── AnalisePage.tsx
│   │   │   ├── ControlePage.tsx
│   │   │   └── ...
│   │   ├── components/         # Componentes reutilizáveis
│   │   │   ├── carteira/       # Componentes específicos de carteira
│   │   │   ├── detalhes/       # Componentes de detalhes
│   │   │   ├── controle/       # Componentes de controle financeiro
│   │   │   └── ...
│   │   ├── contexts/           # Contextos React
│   │   │   ├── AuthContext.tsx
│   │   │   ├── ThemeContext.tsx
│   │   │   └── AnaliseContext.tsx
│   │   ├── services/           # Serviços de API
│   │   │   └── api.ts
│   │   ├── utils/              # Utilitários
│   │   │   ├── formatters.ts
│   │   │   ├── tickerUtils.ts
│   │   │   └── ...
│   │   └── types/              # Definições TypeScript
│   │       └── index.ts
│   ├── public/                 # Assets estáticos
│   └── dist/                   # Build de produção
│
├── data/                       # Dados persistentes (Docker volume)
│   └── bancos_usuarios/
│
├── logs/                       # Logs da aplicação (Docker volume)
│
├── Dockerfile                  # Imagem Docker
├── docker-compose.yml          # Orquestração Docker
├── nginx.conf                  # Configuração Nginx
├── requirements.txt           # Dependências Python
├── backup.sh                   # Script de backup automático
└── README.md                   # Esta documentação
```

---

##  Funcionalidades

### 1. Gestão de Carteira

-  Adicionar/Remover/Atualizar ativos
-  Suporte a múltiplos tipos: Ações, FIIs, BDRs, Criptomoedas, Renda Fixa
-  Renda Fixa com indexadores (CDI, IPCA, SELIC, Prefixado)
-  Atualização automática de preços 
-  Cálculo automático de valor total, ganho/perda
-  Histórico de movimentações
-  Rebalanceamento automático
-  Projeções e simulações

### 2. Análise de Mercado

-  Filtros avançados (ROE, DY, P/L, P/VP, Liquidez)
-  Comparação de múltiplos ativos
-  Rankings (dividendos, valorização)
-  Análise de BDRs, Debentures, CRIs, CRAs
-  Dados de mercado em tempo real

### 3. Detalhes de Ativos

-  Visão geral completa
-  Fundamentos (P/L, P/VP, ROE, DY, etc.)
-  Gráficos históricos (preço, volume)
-  Comparação com outros ativos
-  Histórico de dividendos
-  Dados específicos de FIIs (vacância, cotistas, portfolio)

### 4. Controle Financeiro

-  Receitas (recorrentes, parceladas)
-  Despesas variáveis
-  Cartões de crédito (cadastro, compras, pagamentos)
-  Controle de marmitas (gastos com alimentação)
-  Evolução financeira (gráficos)
-  Saldo por pessoa

### 5. Proventos e Dividendos

-  Agenda de dividendos
-  Histórico de proventos recebidos
-  Projeções futuras
-  Ranking de dividendos

### 6. Relatórios

-  Exportação CSV (movimentações, posições, rendimentos)
-  Exportação PDF (movimentações, posições, rendimentos)
-  Relatórios personalizados

### 7. Ferramentas Auxiliares

-  Calculadora de Juros Compostos
-  Conversor de Moedas
-  Guia do Mercado (educacional)
-  Simulador de choques
-  Análise Monte Carlo

---

##  Como Funciona

### Autenticação

1. Usuário faz login → Backend valida credenciais
2. Backend cria `session_token` (32 bytes aleatórios)
3. Token é armazenado em cookie HTTP-only
4. Token é salvo no banco com expiração (1 hora)
5. Todas as requisições validam o token
6. Logout invalida o token

### Isolamento de Dados

- Cada requisição valida `session_token` → identifica usuário
- Backend busca dados apenas em `bancos_usuarios/{username}/`
- Impossível acessar dados de outro usuário

### Atualização de Preços


1. Backend coleta todos os tickers únicos da carteira
2. Faz batch request para (até 200 tickers por vez)
3. Processa em paralelo (200 workers simultâneos)
4. Atualiza preços no banco SQLite do usuário
5. Retorna resultado

### Batch Requests

- Frontend agrupa múltiplas requisições em uma única chamada
- Exemplo: `/api/batch` com `[{endpoint: '/carteira'}, {endpoint: '/indicadores'}]`
- Reduz latência de ~400ms para ~150ms (3-4x mais rápido)

### Lazy Loading

- Componentes pesados (gráficos) são carregados sob demanda
- Abas de páginas só carregam dados quando abertas
- Reduz carga inicial em ~70%

---

##  Deploy e Infraestrutura

### Ambiente de Produção

- **Servidor**: Hostinger VPS (2 vCPUs, 8GB RAM, 100GB SSD)
- **Sistema Operacional**: Ubuntu 24.04 LTS
- **Containerização**: Docker + Docker Compose
- **Web Server**: Nginx (reverse proxy)
- **SSL**: Let's Encrypt (renovação automática)
- **Domínio**: finmas.com.br

### Configuração do Servidor

```bash
# Estrutura de diretórios
/opt/finmas/
├── data/bancos_usuarios/    # Bancos SQLite (persistência)
├── logs/                    # Logs da aplicação
├── backups/                 # Backups automáticos
└── nginx.conf               # Configuração Nginx
```

### Docker

- **Imagem**: Multi-stage build (frontend + backend)
- **Workers**: 2 workers Gunicorn × 8 threads = 16 threads simultâneas
- **Porta**: 8080 (interno, Nginx expõe 443)
- **Volumes**: 
  - `./data/bancos_usuarios` → persistência de dados
  - `./logs` → logs da aplicação

### Nginx

- **HTTP (80)**: Redireciona para HTTPS
- **HTTPS (443)**: Serve aplicação
- **Cache**: Assets estáticos (1 ano), APIs sem cache
- **SSL**: TLS 1.2/1.3, certificados Let's Encrypt

### Backup

- **Frequência**: Diário (via cron)
- **Localização**: `/opt/finmas/backups/`
- **Retenção**: 7 dias
- **Formato**: `.tar.gz` (todos os bancos SQLite)

---

##  APIs Disponíveis

### Autenticação

- `POST /api/auth/registro` - Criar conta
- `POST /api/auth/login` - Fazer login
- `POST /api/auth/logout` - Fazer logout
- `GET /api/auth/usuario-atual` - Usuário atual
- `POST /api/auth/redefinir-senha` - Recuperar senha

### Carteira

- `GET /api/carteira` - Listar carteira
- `POST /api/carteira/adicionar` - Adicionar ativo
- `DELETE /api/carteira/remover/<id>` - Remover ativo
- `PUT /api/carteira/atualizar/<id>` - Atualizar ativo
- `POST /api/carteira/refresh` - Atualizar preços
- `GET /api/carteira/insights` - Insights da carteira
- `GET /api/carteira/historico` - Histórico da carteira
- `GET /api/carteira/proventos-recebidos` - Proventos recebidos

### Ativos

- `GET /api/ativo/<ticker>` - Detalhes do ativo
- `GET /api/ativo/<ticker>/historico` - Histórico de preços
- `GET /api/ativo/<ticker>/preco-atual` - Preço atual
- `POST /api/comparar` - Comparar múltiplos ativos
- `GET /api/fii-metadata/<ticker>` - Metadados de FII

### Análise

- `POST /api/analise/ativos` - Análise com filtros
- `GET /api/analise/resumo` - Resumo de análise
- `GET /api/listas/ativos` - Listas de ativos disponíveis

### Controle Financeiro

- `GET /api/controle/receitas` - Listar receitas
- `POST /api/controle/receitas` - Criar receita
- `GET /api/controle/cartoes` - Listar cartões
- `GET /api/controle/saldo` - Calcular saldo
- `GET /api/controle/evolucao-financeira` - Evolução financeira

### Mercado

- `GET /api/mercados/bdrs` - Lista de BDRs
- `GET /api/mercados/debentures` - Debentures
- `GET /api/mercados/ibov` - Índice IBOV
- `GET /api/dividendos/agenda` - Agenda de dividendos
- `GET /api/dividendos/ranking` - Ranking de dividendos

### Batch

- `POST /api/batch` - Requisições em lote (até 20 endpoints)

---

##  Desenvolvimento

### Pré-requisitos

- Node.js 20+
- Python 3.11+
- Docker e Docker Compose
- Git

### Setup Local

```bash
# 1. Clonar repositório
git clone https://github.com/korgloriws/Finmas.git
cd Finmas

# 2. Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r ../requirements.txt

# 3. Frontend
cd ../frontend
npm install

# 4. Rodar desenvolvimento
# Terminal 1: Backend
cd backend
python app.py

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Build para Produção

```bash
# Build Docker
docker-compose build

# Rodar
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### Variáveis de Ambiente

```bash
# Backend
ENVIRONMENT=production
PORT=8080
# DATABASE_URL (opcional, se usar PostgreSQL)

# Frontend
VITE_API_BASE_URL=/api  # ou URL completa se necessário
```

---

##  Segurança

-  Senhas hasheadas com bcrypt
-  Cookies HTTP-only
-  SSL/TLS (HTTPS obrigatório)
-  Headers de segurança (HSTS, X-Frame-Options, etc.)
-  Isolamento total de dados por usuário
-  Validação de sessão em todas as requisições
-  Rate limiting (via Nginx e código)

---

##  Performance

### Otimizações Implementadas

- **Batch Requests**: Agrupa múltiplas requisições
- **Lazy Loading**: Componentes carregados sob demanda
- **Code Splitting**: Bundle dividido em chunks
- **Cache**: React Query (5-10 minutos)
- **Paralelização**: 200 workers para yfinance
- **Gunicorn**: 2 workers × 8 threads = 16 threads simultâneas

### Métricas Esperadas

- **Tempo de carregamento inicial**: < 2s
- **Atualização de preços (100 ativos)**: 3-5s
- **Requisições simultâneas**: 16 threads
- **Uso de RAM**: ~400MB (com 2 workers)

---

##  Licença

Proprietário - Todos os direitos reservados

---

##  Autor

Mateus Rodrigues.

---

##  Roadmap

- [ ] Sistema de pagamento e assinaturas
- [ ] Notificações push


---

**Versão**: 1.0.0  
**Última atualização**: Dezembro 2025

