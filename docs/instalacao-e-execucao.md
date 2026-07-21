# Instalação e execução

## Pré-requisitos

| Componente | Versão recomendada |
|------------|-------------------|
| Python | 3.11+ |
| Node.js | 20+ |
| npm | 9+ |
| Docker (opcional) | 24+ |
| sqlite3 CLI (opcional) | para checkpoint manual de WAL |

## Desenvolvimento local (recomendado para código)

### 1. Backend (Flask)

Na raiz do repositório:

```bash
pip install -r requirements.txt
cd backend
python app.py
```

- Porta padrão: **5005**
- Modo: servidor de desenvolvimento Flask (`debug=False` no código atual)
- Dados: `backend/bancos_usuarios/` (criados no primeiro cadastro)

### 2. Frontend (Vite + React)

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

- Porta: **3000**
- Proxy: requisições `/api/*` → `http://localhost:5005` (ver `frontend/vite.config.ts`)
- Timeout do proxy: 5 minutos (rotas pesadas como análise de ativos)

### 3. Primeiro acesso

1. Abra `http://localhost:3000`
2. Crie conta em **Login → Registrar** ou use login Google (se OAuth configurado)
3. Após login, você é redirecionado para `/home`

### Build de produção do frontend (sem Docker)

```bash
cd frontend
npm run build
```

O Flask serve os arquivos estáticos de `frontend/dist` quando existem (produção).

---

## Docker

### Produção / ambiente integrado

```bash
docker compose up --build -d
```

| Item | Valor |
|------|-------|
| URL app | `http://127.0.0.1:8080` |
| Health | `GET /health` |
| Dados SQLite | volume `./data/bancos_usuarios` → `/app/backend/bancos_usuarios` |
| Cache | volume `./cache` |
| Backups | volume `./backups` (tar.gz no startup) |
| Adminer (SQLite) | `http://127.0.0.1:8081` (somente localhost) |

### Desenvolvimento com Docker

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up
```

O override local define:

- `ENABLE_STARTUP_BACKUP=false`
- `ENVIRONMENT=development`
- `FRONTEND_URL=http://localhost:3000`

---

## Variáveis de ambiente

| Variável | Onde | Descrição |
|----------|------|-----------|
| `FLASK_SECRET_KEY` | Backend | Chave de sessão Flask/OAuth. **Obrigatória em produção.** |
| `GOOGLE_CLIENT_ID` | Backend | OAuth Google |
| `GOOGLE_CLIENT_SECRET` | Backend | OAuth Google |
| `FRONTEND_URL` | Backend | URL base para redirects OAuth (ex.: `https://finmas.com.br`) |
| `ENVIRONMENT` | Backend | `production` ou `development` |
| `PORT` | Backend/Docker | Porta Gunicorn (padrão `8080` no container) |
| `ENABLE_STARTUP_BACKUP` | Docker entrypoint | `true`/`false` — backup tar.gz antes do Gunicorn |
| `DATABASE_URL` | Backend | Se definida, usa **PostgreSQL** para auth/sessões (opcional). Sem ela: SQLite. |
| `VITE_API_BASE_URL` | Frontend build | Base da API (padrão `/api` em produção no mesmo host) |

Nunca commite segredos reais. Use `.env` local ou secrets do provedor de deploy.

---

## Estrutura de dados local

Após o primeiro usuário cadastrado:

```
backend/bancos_usuarios/
├── _auth/
│   └── usuarios.db          # contas, sessões (modo SQLite)
└── {username}/
    ├── carteira.db          # ativos, movimentações, histórico
    ├── controle.db          # receitas, despesas, cartões, categorias
    └── marmitas.db          # controle de alimentação
```

---

## Troubleshooting

### Frontend não conecta na API

- Confirme o backend em `http://localhost:5005/health`
- Verifique se o Vite está rodando na porta 3000
- Em produção, confirme que o Nginx encaminha `/api` para o upstream

### Análise de ativos demora ou dá timeout

- Normal para listas grandes (BDRs). O proxy Vite e o Gunicorn usam timeout de até 10 min em rotas específicas
- O frontend limita GETs concorrentes (`MAX_CONCURRENT_GETS = 3` em `api.ts`)

### Banco “travado” no Windows

- Feche processos que mantenham `.db` aberto antes de backup/restore
- O sistema usa WAL; o `entrypoint.sh` executa `PRAGMA wal_checkpoint(FULL)` antes de backups

### Erro ao restaurar backup

- Restauração substitui **todos** os dados do usuário
- Faça backup manual antes (`Configurações` ou `GET /api/carteira/backup/download`)

---

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Frontend dev server |
| `npm run build` | Build TypeScript + Vite |
| `python backend/app.py` | Backend dev |
| `docker compose up --build` | Stack completa |
