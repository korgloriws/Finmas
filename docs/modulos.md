# Módulos e funcionalidades

Mapa funcional do FinMas por área. Rotas entre parênteses.

---

## Home (`/home`)

Painel após login.

- Cards: receitas, despesas, **saldo mensal**, valor da carteira
- **Saldo mensal** = receitas − despesas **registradas** em `outros_gastos` (cartão só entra ao marcar fatura como paga; marmitas não entram no saldo financeiro)
- Gráfico de evolução da carteira vs **IBOV, IVVB11, IFIX, IPCA, CDI, Bitcoin** (comparativo equivalente)
- Distribuição por tipo de ativo, metas anuais, insights rápidos e atalhos

---

## Carteira (`/carteira`)

Central de investimentos. Abas via `?tab=`:

| Aba | ID | Descrição |
|-----|-----|-----------|
| Ativos | `ativos` | Lista, adicionar/editar/vender, importação **B3**, renda fixa indexada (CDI, IPCA, SELIC, prefixado) |
| Gráficos | `graficos` | Comparativo vs índices (R$ ou %), patrimônio com snapshots, calendário de performance, tracking error / beta / Sharpe |
| Ranking | `ranking` | Ranking interno dos ativos da carteira |
| Proventos | `proventos` | Dividendos/JCP recebidos e previstos |
| Rebalanceamento | `rebalance` | Metas de alocação por tipo, status e histórico |
| Movimentações | `movimentacoes` | Histórico de compras, vendas e aportes |
| Relatórios | `relatorios` | Exportação CSV/PDF/XLSX de posições, movimentações e rendimentos |
| **Impostos** | `impostos` | **Premium** — IR vendas (FIFO) e proventos (cálculo no frontend a partir de movimentações) |
| **Insights** | `insights` | **Premium** — correlação entre ativos, alertas |
| **Projeção** | `projecao` | **Premium** — metas de patrimônio/renda com aportes |
| **Simulador** | `simulador` | **Premium** — choques CDI/IPCA/SELIC, cenários, Monte Carlo |

### Importação B3

- Upload de planilha/relatório B3 (`B3ImportModal` + `excelParser.ts`)
- Preserva preços históricos quando disponíveis

### Histórico patrimonial

- Snapshots diários em `historico_carteira` ao atualizar preços ou alterar carteira
- `carteira_price`: curva de retorno **sem aportes** (base 100)
- `carteira_valor`: patrimônio em R$ **com aportes**, alinhado à mesma grade de datas do filtro de período (`datas`) — snapshots quando existem; fallback reconstruído por movimentações
- `patrimonio_datas`: espelha `datas` após o alinhamento (mesmo eixo do comparativo)

### Backup

- Download: Configurações ou API `GET /api/carteira/backup/download`
- Restore: substitui dados atuais (`POST /api/carteira/backup/restore`)

---

## Controle financeiro (`/controle`)

Abas: `financeiro`, `receitas`, `despesas`, `alimentacao`, `cartoes`.

- **Financeiro**: visão do mês, evolução, gráficos por categoria
- **Receitas / Despesas**: lançamentos com categorias personalizáveis (cor sólida, degradê, CSS)
- **Alimentação**: marmitas (`marmitas.db`) — controle separado do saldo principal
- **Cartões**: cadastro de cartões, compras parceladas, marcar como **pago** (gera despesa em `outros_gastos`)

---

## Detalhes dos ativos (`/detalhes`)

Consulta por ticker (acesso livre à consulta básica).

- Fundamentos, histórico, dividendos, gráficos
- **Premium — Conceitos** (`/detalhes/conceitos`): Graham, Bazin, Fear & Greed
- **Premium — Radar de Dividendos**: histórico, próximos proventos, padrão mensal

---

## Análise de oportunidades (`/analise`) — Premium

- Filtros: tipo, DY, P/VPA, liquidez, etc.
- Lista ranqueada com indicadores
- Comparação entre ativos
- Operação pesada; pode levar vários minutos na primeira carga

---

## Agenda de dividendos (`/agenda-dividendos`) — Premium

- Calendário de proventos da carteira e mercado
- Dados via scrapers/APIs (Investidor10)

---

## Rankings (`/rankings`) — Premium

- Ativos mais held na base FinMas
- Rankings por volume/valor
- Lista brapi atualizada periodicamente

---

## Notícias (`/noticias`) — Premium

- Feed estilo jornal com busca, categorias e paginação
- Fonte agregada (dadosdemercado.com.br)

---

## Guia do mercado (`/guia`) — Gratuito

Abas principais:

| Aba | Conteúdo |
|-----|----------|
| Geral | Comece aqui, classes, perfil, risco, estratégias, glossário com busca, links para ferramentas |
| Renda fixa / variável / internacional | Conteúdo por classe |
| Tesouro Direto | Títulos e conceitos |
| Fiscal | Alíquotas, DARF, checklist tributário |

Conteúdo estruturado em `frontend/src/components/guia/` e `geralContent.ts`.

---

## Calculadoras (`/calculadora`) — Gratuito

Hub com abas (`?tab=`):

| Tab | Ferramenta |
|-----|------------|
| `juros-compostos` | Simulação com aportes |
| `correcao-monetaria` | IPCA, IGP-M, etc. |
| `conversor` | Moedas |
| `indicadores` | Séries BCB (SELIC, CDI, IPCA) |
| `comparacao-investimentos` | Comparativo lado a lado |

Rotas antigas (`/juros-compostos`, `/conversor`, `/correcao-monetaria`) redirecionam para o hub.

---

## Configurações (`/configuracoes`)

- Perfil, alteração de **username**, senha (contas locais)
- Backup e restore da carteira
- **Admin**: usuários, roles, bloqueio, telas permitidas, visualização de dados

---

## Páginas públicas

| Rota | Função |
|------|--------|
| `/` | Landing (não logado) ou redirect para `/home` |
| `/vendas` | Plano premium e preços |
| `/conhecer` | Tour pelas telas |
| `/login`, `/recuperar-senha` | Autenticação |
| `/termos-de-uso`, `/politica-de-privacidade` | Legal |

---

## Premium — como funciona

Não é assinatura automática por pagamento integrado. O administrador define **`allowed_screens`** por usuário (lista de IDs de tela). Se `null` ou vazia, o usuário acessa tudo. IDs em `TELAS_APP` (`frontend/src/services/api.ts`).

Telas premium típicas: `analise`, `agenda-dividendos`, `rankings`, `noticias`, `conceitos`, `radar-dividendos`, `carteira-impostos`, `carteira-insights`, `carteira-projecao`, `carteira-simulador`.

Usuário sem permissão vê `AcessoNegadoPage` com link para `/vendas`.
