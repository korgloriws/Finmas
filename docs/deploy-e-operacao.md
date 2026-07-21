# Deploy e operação

## Arquitetura de produção

```
                    ┌─────────────┐
   HTTPS 443 ──────►│   Nginx     │  TLS, gzip, timeouts longos
                    │  (host)     │  para /api/analise
                    └──────┬──────┘
                           │ proxy_pass :8080
                    ┌──────▼──────┐
                    │  Gunicorn   │  2 workers × 6 threads
                    │  + Flask    │  preload, max-requests 1000
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        bancos_usuarios  cache      backups/
```

Referência de Nginx: `nginx.conf` na raiz do repo.

---

## Docker

### Build e run

```bash
docker compose build
docker compose up -d
```

### Volumes importantes

| Volume host | Container | Uso |
|-------------|-----------|-----|
| `./data/bancos_usuarios` | `/app/backend/bancos_usuarios` | **Dados dos usuários** |
| `./cache` | `/app/cache` | Cache Flask |
| `./backups` | `/app/backups` | Backups automáticos |
| `./logs` | `/app/logs` | Logs (se configurado) |

### Entrypoint (`entrypoint.sh`)

1. Se `ENABLE_STARTUP_BACKUP=true`, cria `finmas_backup_YYYYMMDD_HHMMSS.tar.gz`
2. Executa WAL checkpoint em todos `.db`
3. Remove backups com mais de 7 dias
4. Inicia Gunicorn

### Health check

```bash
curl -f http://127.0.0.1:8080/health
```

Configurado no `docker-compose.yml` (intervalo 30s).

---

## Gunicorn

Comando no `Dockerfile`:

```
gunicorn -w 2 -k gthread --threads 6 -t 600 \
  --max-requests 1000 --max-requests-jitter 50 --preload \
  -b 0.0.0.0:8080 app:server
```

- **600s timeout**: análises e scrapers longos
- **preload**: importa app uma vez; WAL ativado no master
- Ajuste workers conforme CPU/RAM do servidor

---

## Nginx

Pontos críticos (ver `nginx.conf` completo):

- Redirect HTTP → HTTPS
- Certificados Let's Encrypt
- `proxy_read_timeout` elevado para rotas de análise
- Headers de segurança (HSTS, X-Frame-Options)
- Servir estáticos ou proxy total para Flask (setup atual: Flask serve SPA)

---

## Variáveis de produção

```env
ENVIRONMENT=production
PORT=8080
FLASK_SECRET_KEY=<segredo-forte>
FRONTEND_URL=https://finmas.com.br
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
ENABLE_STARTUP_BACKUP=true
```

**Não** definir `DATABASE_URL` se quiser manter SQLite puro (padrão atual em Docker).

---

## Backup e restore

### Automático

- No startup do container (tar.gz de `bancos_usuarios`)
- Retenção 7 dias

### Manual (usuário)

- UI: Configurações → Backup / Restaurar
- API: `GET /api/carteira/backup/download`, `POST /api/carteira/backup/restore`

### Manual (servidor)

```bash
# Parar app ou garantir checkpoint
sqlite3 backend/bancos_usuarios/user/carteira.db "PRAGMA wal_checkpoint(FULL);"
tar -czf backup_manual.tar.gz -C data/bancos_usuarios .
```

### Restore de desastre

1. Pare o container
2. Substitua conteúdo de `data/bancos_usuarios` pelo backup
3. Suba o container
4. Verifique `/health` e login de teste

---

## Monitoramento

| O quê | Como |
|-------|------|
| App up | `/health` |
| Logs Gunicorn | `docker logs finmas-app` |
| Espaço em disco | volumes `data/`, `backups/`, `cache/` |
| Nginx | `/var/log/nginx/finmas_*.log` |

---

## Atualização de versão

1. Backup manual dos dados
2. `git pull` + `docker compose build --no-cache`
3. `docker compose up -d`
4. Smoke test: login, carteira, controle, uma rota premium

O frontend é embutido na imagem (`frontend-build` stage). Não é necessário build separado no host.

---

## Adminer

Container opcional na porta **8081** (localhost only).

- Sistema: **SQLite**
- Servidor: `/db` (volume montado)
- Usuário/senha: vazio

Use apenas para suporte. Edições diretas no banco podem corromper consistência.

---

## Script `backup.sh`

Existe `backup.sh` na raiz para backups adicionais fora do Docker — revise e adapte paths antes de usar em cron.

---

## Checklist pós-deploy

- [ ] `FLASK_SECRET_KEY` alterada do default
- [ ] OAuth Google com redirect URI de produção
- [ ] Volume `data/bancos_usuarios` persistido
- [ ] HTTPS ativo
- [ ] Adminer não exposto publicamente
- [ ] Backup testado (restore em ambiente de staging)
