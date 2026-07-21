# Autenticação e permissões

## Fluxos de login

### Usuário e senha

1. `POST /api/auth/registro` — cria conta, inicializa bancos (`inicializar_bancos_usuario`)
2. `POST /api/auth/login` — valida bcrypt, cria sessão
3. Cookie de sessão enviado automaticamente nas próximas requests (`withCredentials`)

### Google OAuth

1. `GET /api/auth/google/login` — redirect para Google
2. `GET /api/auth/google/callback` — cria ou vincula usuário (`criar_usuario_google`)
3. Frontend chama `checkCurrentUser()` para sincronizar estado

Contas Google:

- `auth_provider = 'google'`
- Senha local não é usada; alteração de senha na UI é desabilitada

### Recuperação de senha

Fluxo com pergunta de segurança configurada no cadastro:

1. `POST /api/auth/obter-pergunta`
2. `POST /api/auth/verificar-resposta`
3. `POST /api/auth/redefinir-senha`

---

## Sessões

- Armazenadas em `sessoes` (SQLite ou Postgres)
- `POST /api/auth/logout` invalida sessão atual
- `invalidar_todas_sessoes` ao trocar senha ou ações críticas de segurança
- Username **não** é persistido em `localStorage` (removido por segurança)

---

## Roles

| Role | Comportamento |
|------|----------------|
| `usuario` | Acesso padrão; pode ter restrição de telas |
| `admin` | Acesso total + painel em Configurações |

Verificação: `verificar_role`, `userRole` no `AuthContext`.

---

## Permissões por tela (Premium)

Campo `allowed_screens` no usuário (JSON array de strings).

| Valor | Efeito |
|-------|--------|
| `null` | Todas as telas liberadas |
| `[]` (vazio) | Todas as telas liberadas |
| `["analise", "carteira-impostos", ...]` | Somente IDs listados |

### IDs de tela (`TELAS_APP`)

Definidos em `frontend/src/services/api.ts`:

```
home, detalhes, carteira, controle, guia, analise, noticias,
agenda-dividendos, calculadora, juros-compostos, conversor,
correcao-monetaria, rankings, conceitos, radar-dividendos,
carteira-impostos, carteira-insights, carteira-projecao,
carteira-simulador, configuracoes
```

### Frontend

`canAccessScreen(pathOrId)` em `AuthContext`:

- Admin → sempre `true`
- Normaliza path (`/home` → `home`)
- Usado em `ProtectedRoute` e bloqueios de abas premium (ex.: impostos na carteira)

### Backend

Algumas rotas verificam login via decorator/middleware de sessão; restrição fina de premium é principalmente **frontend + lista de telas**. Admin altera via:

```
PUT /api/admin/usuarios/<username>/telas
Body: { "telas": ["analise", "rankings"] }  // ou null para liberar tudo
```

---

## Bloqueio de usuário

`PUT /api/admin/usuarios/<username>/block` com `{ "blocked": true }`

Usuário bloqueado não consegue login.

---

## Alteração de username

`PUT /api/perfil/username`

- Exige senha atual (contas locais)
- Atualiza pasta em `bancos_usuarios/`, sessões e referências
- `limpar_pastas_orfas_usuarios` remove resíduos no Windows

---

## Exclusão de conta

`DELETE /api/perfil/excluir` com confirmação textual `EXCLUIR`.

Remove dados do usuário conforme implementação em `excluir_conta_usuario`.

---

## SecurityCheck

Componente `SecurityCheck` envolve rotas autenticadas: pode exigir pergunta de segurança configurada antes de acessar o app.

---

## Boas práticas

1. Em produção, use `FLASK_SECRET_KEY` forte e única
2. Configure OAuth com URLs de redirect corretas (`FRONTEND_URL`)
3. Restrinja Adminer (`8081`) a localhost ou VPN
4. Premium comercial: ativar telas manualmente após contato (página `/vendas`)
