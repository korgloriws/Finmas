# Banco de dados

## Modelo geral

O FinMas usa **isolamento por usuário**: cada conta tem uma pasta com bancos SQLite dedicados.

```
backend/bancos_usuarios/
├── _auth/
│   └── usuarios.db       # Autenticação (modo SQLite)
└── {username}/
    ├── carteira.db
    ├── controle.db
    └── marmitas.db
```

### PostgreSQL (opcional)

Se `DATABASE_URL` estiver definida, tabelas de **usuários e sessões** podem usar PostgreSQL (`_is_postgres()` em `models.py`). Os dados de carteira/controle por usuário continuam no modelo SQLite por pasta, salvo migrações específicas.

---

## `usuarios.db` (_auth)

Tabelas principais:

| Tabela | Campos relevantes |
|--------|-------------------|
| `usuarios` | `username`, `senha` (bcrypt), `nome`, `email`, `role` (`usuario`/`admin`), `blocked`, `pergunta_seguranca`, `allowed_screens` (JSON), `auth_provider` |
| `sessoes` | tokens de sessão, expiração, vínculo ao username |

Funções: `cadastrar_usuario`, `criar_sessao`, `obter_allowed_screens`, `atualizar_username_usuario`, etc.

---

## `carteira.db`

| Tabela | Descrição |
|--------|-----------|
| `carteira` | Posições atuais: ticker, quantidade, preços, tipo, indexador (RF), etc. |
| `movimentacoes` | Compras, vendas, aportes com data e preço |
| `historico_carteira` | Snapshots de patrimônio (`valor_total`, data) |
| `rebalance_config` | Metas de alocação por tipo |
| `rebalance_history` | Eventos de rebalanceamento |
| `asset_types` | Tipos customizados de ativo |
| `rf_catalog` | Catálogo de produtos de renda fixa |
| `goals` | Metas de patrimônio/renda |
| `metas_aportes` | Metas de aporte periódico |

### Histórico comparativo (API)

`obter_historico_carteira_comparado(agregacao)` monta:

- `datas`, `carteira`, `carteira_price`, `carteira_valor`
- Índices: `ibov`, `ivvb11`, `ifix`, `ipca`, `cdi`, `btc`
- Agregações: `mensal`, `semanal`, `trimestral`, `semestral`, `anual`, `maximo`
- `carteira_valor` e `patrimonio_datas` compartilham a mesma grade de `datas` do período escolhido (snapshots alinhados; fallback com patrimônio reconstruído)

---

## `controle.db`

| Tabela | Descrição |
|--------|-----------|
| `receitas` | Entradas com data, valor, categoria |
| `outros_gastos` | Despesas efetivas (inclui cartão quando marcado pago) |
| `cartoes` | Registro legado de cartões (schema evoluído) |
| `cartoes_cadastrados` | Cartões do usuário |
| `compras_cartao` | Compras parceladas |
| `controle_categorias` | Categorias personalizadas (cor, degradê, CSS) |

### Saldo mensal

`calcular_saldo_mes_ano` / `obter_despesas_controle_mes`:

- Receitas do mês
- Menos **outros_gastos** do mês (não inclui compras de cartão pendentes nem marmitas)

---

## `marmitas.db`

Controle de refeições/alimentação (`marmitas`, gastos mensais). Integrado à aba **Alimentação** do controle; **não** compõe o saldo financeiro da home.

---

## WAL e backups

- SQLite em modo **WAL** (`ativar_wal_em_todos_os_bancos`)
- `entrypoint.sh`: `PRAGMA wal_checkpoint(FULL)` antes de `tar.gz`
- Backups excluem `.db-wal` / `.db-shm` após checkpoint
- Retenção padrão: 7 dias em `/app/backups`

---

## Convenções

- Datas: texto `YYYY-MM-DD` na maioria das tabelas de controle
- Valores monetários: `REAL` / `NUMERIC`
- Username na pasta: case-sensitive; renomear username move/atualiza pasta via `atualizar_username_usuario`
- Limpeza de pastas órfãs: `limpar_pastas_orfas_usuarios` (admin)

---

## Acesso via Adminer

No Docker, Adminer em `127.0.0.1:8081` com volume montado em `/db`. Abra o arquivo `.db` desejado (ex.: `/db/Mateus/carteira.db`). **Somente para administração** — evite edições manuais em produção sem backup.
