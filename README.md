# FinMas

Plataforma web para **gestão de investimentos** e **controle financeiro pessoal**, pensada para o mercado brasileiro (B3, índices locais, tributação e conteúdo em português).

## O que o sistema faz

- **Carteira**: ações, FIIs, BDRs, ETFs, cripto e renda fixa; importação B3; proventos; gráficos com comparativo vs índices; rebalanceamento; relatórios.
- **Controle financeiro**: receitas, despesas, cartões, marmitas e fluxo de caixa com categorias personalizáveis.
- **Análise e mercado**: detalhes de ativos, análise de oportunidades, rankings, agenda de dividendos e notícias.
- **Ferramentas gratuitas**: guia do mercado (com módulo fiscal), hub de calculadoras, conversor e correção monetária.
- **Premium** (por permissão de telas): Conceitos, Radar de Dividendos, Impostos, Insights, Projeção, Simulador e telas avançadas.

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [Índice da documentação](docs/README.md) | Visão geral e links |
| [Instalação e execução](docs/instalacao-e-execucao.md) | Desenvolvimento local e Docker |
| [Arquitetura](docs/arquitetura.md) | Stack, pastas e fluxo de dados |
| [Módulos e funcionalidades](docs/modulos.md) | Telas, abas e regras de negócio |
| [Banco de dados](docs/banco-de-dados.md) | SQLite por usuário, tabelas principais |
| [API](docs/api-referencia.md) | Endpoints REST agrupados |
| [Autenticação e permissões](docs/autenticacao-e-permissoes.md) | Login, OAuth, admin e premium |
| [Deploy e operação](docs/deploy-e-operacao.md) | Produção, backup, Nginx e variáveis |

## Início rápido (desenvolvimento)

### Pré-requisitos

- Node.js 20+
- Python 3.11+
- npm

### Backend

```bash
cd backend
pip install -r ../requirements.txt
python app.py
```

O API sobe em `http://localhost:5005`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

A interface sobe em `http://localhost:3000` e faz proxy de `/api` para o backend.

### Docker (produção ou teste integrado)

```bash
docker compose up --build
```

Aplicação em `http://127.0.0.1:8080`. Dados persistidos em `./data/bancos_usuarios`.

Para desenvolvimento local com Docker sem backup no startup:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up
```

## Estrutura do repositório

```
finmas/
├── backend/           # API Flask, modelos, scrapers
├── frontend/          # React + TypeScript + Vite
├── docs/              # Documentação do sistema
├── docker-compose.yml
├── Dockerfile
├── entrypoint.sh      # Backup WAL + Gunicorn
├── nginx.conf         # Referência para produção
└── requirements.txt
```

## Licença e contato

Uso privado do projeto FinMas. Para suporte comercial ou plano premium: `finmasfinanceiro@gmail.com`.
