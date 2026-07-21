# Referência da API

Base URL: `/api` (mesmo host do frontend em produção).

Autenticação: **cookie de sessão** (`withCredentials: true` no Axios). A maioria das rotas exige login.

Respostas de erro comuns: `401` (não autenticado), `403` (bloqueado/sem permissão), `400`/`500` com `{ "error": "..." }`.

---

## Saúde

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check (sem prefixo `/api`) |

---

## Autenticação e perfil

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/registro` | Cadastro |
| POST | `/api/auth/login` | Login usuário/senha |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/google/login` | Início OAuth Google |
| GET | `/api/auth/google/callback` | Callback OAuth |
| GET | `/api/auth/usuario-atual` | Usuário, role, `allowed_screens` |
| POST | `/api/auth/obter-pergunta` | Recuperação de senha |
| POST | `/api/auth/verificar-resposta` | Valida resposta secreta |
| POST | `/api/auth/redefinir-senha` | Nova senha |
| GET | `/api/perfil` | Dados do perfil |
| PUT | `/api/perfil` | Atualizar perfil |
| PUT | `/api/perfil/username` | Alterar username |
| PUT | `/api/perfil/senha` | Alterar senha |
| DELETE | `/api/perfil/excluir` | Excluir conta (confirmação `EXCLUIR`) |

---

## Admin

Requer `role=admin`.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/usuarios` | Listar usuários |
| POST | `/api/admin/usuarios` | Criar usuário |
| DELETE | `/api/admin/usuarios/<username>` | Excluir |
| PUT | `/api/admin/usuarios/<username>/role` | `usuario` ou `admin` |
| PUT | `/api/admin/usuarios/<path:username>/block` | Bloquear/desbloquear |
| PUT | `/api/admin/usuarios/<path:username>/senha` | Redefinir senha |
| GET/PUT | `/api/admin/usuarios/<path:username>/telas` | `allowed_screens` |
| GET | `/api/admin/usuarios/<path:username>/dados` | Resumo |
| GET | `/api/admin/usuarios/<path:username>/carteira` | Carteira do usuário |
| GET | `/api/admin/usuarios/<path:username>/movimentacoes` | Movimentações |
| GET | `/api/admin/usuarios/<path:username>/marmitas` | Marmitas |
| GET | `/api/admin/usuarios/<path:username>/controle` | Controle financeiro |

---

## Carteira

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/carteira` | Lista de ativos |
| GET | `/api/carteira?refresh=1` | Força atualização de preços |
| POST | `/api/carteira/refresh` | Atualiza cotações |
| POST | `/api/carteira/refresh-indexadores` | Atualiza RF indexada |
| GET | `/api/carteira/valorizacao-periodo` | Valorização por período |
| POST | `/api/carteira/adicionar` | Novo ativo |
| PUT | `/api/carteira/atualizar/<id>` | Editar ativo |
| DELETE | `/api/carteira/remover/<id>` | Remover ativo |
| GET | `/api/carteira/movimentacoes` | Histórico movimentações |
| GET | `/api/carteira/historico?agregacao=` | Histórico + índices |
| GET | `/api/carteira/insights` | Insights (correlação) |
| POST | `/api/carteira/proventos` | Proventos por tickers |
| GET | `/api/carteira/proventos-recebidos` | Proventos da carteira |
| GET/POST | `/api/carteira/rebalance/config` | Config rebalanceamento |
| GET | `/api/carteira/rebalance/status` | Status atual |
| GET/POST | `/api/carteira/rebalance/history` | Histórico |
| GET/POST/PUT/DELETE | `/api/carteira/tipos` | Tipos de ativo |
| GET | `/api/carteira/backup/download` | Download backup |
| POST | `/api/carteira/backup/restore` | Restaurar backup (multipart) |
| GET/POST | `/api/goals` | Metas patrimônio |
| POST | `/api/goals/projecao` | Projeção metas |
| GET/POST/DELETE | `/api/metas-aportes` | Metas de aporte |
| GET | `/api/metas-aportes/status` | Status aportes |
| GET | `/api/metas/status-integrado` | Metas integradas |
| GET | `/api/aportes-reais` | Aportes calculados |

### Relatórios

| Método | Rota | Formato |
|--------|------|---------|
| GET | `/api/relatorios/movimentacoes` | JSON |
| GET | `/api/relatorios/movimentacoes.csv` | CSV |
| GET | `/api/relatorios/movimentacoes.xlsx` | Excel |
| GET | `/api/relatorios/movimentacoes.pdf` | PDF |
| GET | `/api/relatorios/posicoes` | (idem padrões csv/xlsx/pdf) |
| GET | `/api/relatorios/rendimentos` | (idem) |

---

## Controle financeiro

| Método | Rota | Descrição |
|--------|------|-----------|
| GET/POST/PUT/DELETE | `/api/controle/receitas` | CRUD receitas |
| GET/POST/PUT/DELETE | `/api/controle/outros` | CRUD despesas |
| GET/POST/PUT/DELETE | `/api/controle/cartoes` | Cartões (legado) |
| GET/POST/PUT/DELETE | `/api/controle/cartoes-cadastrados` | Cartões |
| GET/POST/PUT/DELETE | `/api/controle/compras-cartao` | Compras |
| POST | `/api/controle/marcar-cartao-pago` | Gera despesa |
| POST | `/api/controle/desmarcar-cartao-pago` | Reverte |
| GET/POST | `/api/controle/categorias-gasto` | Categorias |
| PUT/DELETE | `/api/controle/categorias-gasto/<id>` | Editar/remover categoria |
| GET | `/api/controle/saldo` | Saldo do mês |
| GET | `/api/controle/despesas` | Despesas agregadas |
| GET | `/api/controle/evolucao-financeira` | Série temporal |
| GET | `/api/controle/evolucao-receitas` | Receitas no tempo |
| GET | `/api/controle/receitas-despesas` | Comparativo |

### Marmitas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/marmitas` | Listar marmitas do mês |
| POST | `/api/marmitas` | Adicionar |
| PUT | `/api/marmitas/<id>` | Editar |
| DELETE | `/api/marmitas/<id>` | Remover |
| GET | `/api/marmitas/gastos-mensais` | Totais mensais |

---

## Home

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/home/resumo?mes=&ano=` | Resumo mensal |
| GET | `/api/home/evolucao-carteira?periodo=` | Histórico para gráfico |
| GET | `/api/home/gastos-categoria?mes=&ano=&janela=` | Gastos por categoria |

---

## Ativos e mercado

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/ativo/<ticker>` | Detalhes resumidos |
| GET | `/api/ativo/<ticker>/historico` | Preços históricos |
| GET | `/api/ativo/<ticker>/fundamentals` | Fundamentos |
| GET | `/api/ativo/<ticker>/preco-atual` | Cotação |
| GET | `/api/ativo/<ticker>/preco-historico` | Preço em data |
| GET | `/api/fii-metadata/<ticker>` | Metadados FII |
| POST | `/api/comparar` | Comparar ativos |
| GET | `/api/tickers/sugestoes?q=` | Autocomplete |
| GET | `/api/logo/<ticker>` | Logo do ativo |
| POST | `/api/logos` | Logos em lote |

---

## Análise

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/analise/ativos` | Lista filtrada (pesado) |
| POST | `/api/analise/cancelar` | Cancela job em andamento |
| GET | `/api/analise/resumo` | Resumo cacheado |
| GET | `/api/listas/ativos` | Listas ações/FIIs/BDRs |
| GET/POST/PUT/DELETE | `/api/rf/catalog` | Catálogo renda fixa |

---

## Calculadoras e índices

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/indicadores` | Indicadores BCB |
| GET | `/api/correcao-monetaria/indices` | Índices disponíveis |
| POST | `/api/correcao-monetaria/calcular` | Cálculo |
| GET | `/api/taxas-indexadores` | CDI, IPCA, SELIC |

---

## Simulador (carteira premium)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/simulador/choques` | Choque em indexadores |
| GET | `/api/simulador/cenarios` | Cenários predefinidos |
| POST | `/api/simulador/monte-carlo` | Simulação Monte Carlo |

---

## Tesouro Direto

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/tesouro/titulos` | Títulos |
| GET | `/api/tesouro-direto/titulos` | Via biblioteca |
| GET | `/api/tesouro-direto/ettj` | Curva ETTJ |
| GET | `/api/tesouro-direto/movimentacoes` | Movimentações |

---

## Dividendos, rankings, notícias

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/dividendos/agenda` | Agenda dividendos |
| GET | `/api/dividendos/ranking` | Ranking dividendos |
| GET | `/api/ranking/investidor10` | Ranking Investidor10 |
| GET | `/api/ranking/lista` | Lista brapi |
| POST | `/api/ranking/atualizar-lista` | Atualiza lista |
| GET | `/api/noticias?limite=` | Feed notícias |
| GET | `/api/noticias/detalhes?url=` | Detalhe matéria |

---

## Batch

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/batch` | Múltiplas leituras em uma request |

Corpo: `{ "requests": [{ "endpoint": "/carteira", "method": "GET" }, ...] }`

---

## SPA fallback

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` e `/<path>` | Serve `index.html` do React para rotas client-side |

Implementação em `app.py` — rotas desconhecidas que não são `/api` retornam o bundle.

---

## Cliente frontend

Serviços organizados em `frontend/src/services/api.ts`:

- `carteiraService`, `controleService`, `homeService`, `ativoService`, `adminService`, `perfilService`, `noticiasService`, etc.
- `TELAS_APP`: IDs de telas para permissões
- `fetchHistoricoCarteiraComFallback`: histórico com retry

Para testar manualmente, use cookies de sessão (login no browser) ou ferramentas como Insomnia com suporte a cookies.
