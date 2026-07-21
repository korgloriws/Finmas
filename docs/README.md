# Documentação FinMas

Bem-vindo à documentação técnica e funcional do **FinMas**. Use este índice para navegar.

## Para quem é cada guia

| Perfil | Comece por |
|--------|------------|
| Desenvolvedor novo no projeto | [Instalação](instalacao-e-execucao.md) → [Arquitetura](arquitetura.md) |
| Product / suporte | [Módulos e funcionalidades](modulos.md) |
| DevOps / infra | [Deploy e operação](deploy-e-operacao.md) |
| Integração ou manutenção de API | [API](api-referencia.md) |
| Admin do sistema | [Autenticação e permissões](autenticacao-e-permissoes.md) |

## Índice completo

1. **[Instalação e execução](instalacao-e-execucao.md)**  
   Ambiente local (Python + Vite), Docker, variáveis de ambiente e troubleshooting.

2. **[Arquitetura](arquitetura.md)**  
   Stack tecnológica, monólito Flask + SPA React, cache, sessões e integrações externas.

3. **[Módulos e funcionalidades](modulos.md)**  
   Descrição de cada tela, abas da carteira/controle, calculadoras, guia e regras importantes.

4. **[Banco de dados](banco-de-dados.md)**  
   Modelo multi-tenant com SQLite por usuário, arquivos `.db`, snapshots e opcional PostgreSQL.

5. **[Referência da API](api-referencia.md)**  
   Endpoints REST agrupados por domínio (auth, carteira, controle, home, mercado).

6. **[Autenticação e permissões](autenticacao-e-permissoes.md)**  
   Login, Google OAuth, roles, `allowed_screens` (premium) e painel admin.

7. **[Deploy e operação](deploy-e-operacao.md)**  
   Docker, Gunicorn, Nginx, backups automáticos, health check e logs.

## Conteúdo de marketing (não técnico)

Textos públicos de landing e vendas ficam centralizados em:

`frontend/src/content/marketingContent.ts`

## Convenções

- **Rotas frontend** usam React Router (`frontend/src/App.tsx`).
- **API** prefixo `/api/`; em dev o Vite faz proxy para `localhost:5005`.
- **Usuário atual** no backend vem da sessão Flask (`get_usuario_atual()` em `models.py`).
- Datas no controle financeiro usam formato `YYYY-MM-DD`; agregações de carteira podem usar `YYYY-MM` ou `YYYY-MM-DD` conforme o período.

## Atualização desta documentação

Ao adicionar módulos relevantes, atualize:

1. O guia de [módulos](modulos.md) (comportamento visível ao usuário).
2. A [referência da API](api-referencia.md) (novos endpoints).
3. O [README](../README.md) se mudar o fluxo de instalação ou deploy.
