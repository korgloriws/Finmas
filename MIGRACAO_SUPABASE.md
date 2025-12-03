# Guia de Migração: Neon → Supabase

## ✅ Resposta Rápida

**SIM, todas as tabelas serão criadas automaticamente!** O sistema já está preparado para isso:

1. **Tabelas globais** (`public.usuarios` e `public.sessoes`) são criadas automaticamente quando o app inicia
2. **Tabelas por usuário** (carteira, controle, marmitas) são criadas automaticamente quando cada usuário faz login pela primeira vez

## 📋 Passo a Passo da Migração

### 1. Obter a String de Conexão do Supabase

No painel do Supabase:
1. Vá em **Settings** → **Database**
2. Role até **Connection string** → **URI**
3. Copie a string de conexão (formato: `postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres`)

**Exemplo baseado na sua informação:**
```
postgresql://postgres:[SUA_SENHA]@db.utvmrdotraksbfvbdzqn.supabase.co:5432/postgres
```

### 2. Configurar Variável de Ambiente

O sistema aceita duas variáveis de ambiente (em ordem de prioridade):
- `DATABASE_URL` (preferencial)
- `USUARIOS_DB_URL` (fallback)

#### Se estiver usando Fly.io:

```bash
# Definir a variável de ambiente
fly secrets set DATABASE_URL="postgresql://postgres:[SUA_SENHA]@db.utvmrdotraksbfvbdzqn.supabase.co:5432/postgres?sslmode=require"

# Ou se preferir usar USUARIOS_DB_URL
fly secrets set USUARIOS_DB_URL="postgresql://postgres:[SUA_SENHA]@db.utvmrdotraksbfvbdzqn.supabase.co:5432/postgres?sslmode=require"
```

#### Se estiver usando Render.com:

1. Vá no painel do Render
2. Selecione seu serviço `finmas-backend`
3. Vá em **Environment**
4. Adicione/edite a variável:
   - **Key:** `DATABASE_URL`
   - **Value:** `postgresql://postgres:[SUA_SENHA]@db.utvmrdotraksbfvbdzqn.supabase.co:5432/postgres?sslmode=require`

#### Se estiver usando localmente:

Atualize o arquivo `Finma_React.env`:
```env
USUARIOS_DB_URL="postgresql://postgres:[SUA_SENHA]@db.utvmrdotraksbfvbdzqn.supabase.co:5432/postgres?sslmode=require"
```

### 3. Migrar Dados (Opcional - se já tiver usuários)

Se você já tem dados no Neon e quer migrar:

#### 3.1. Exportar dados do Neon

```bash
# Exportar tabelas globais
pg_dump "postgresql://neondb_owner:npg_RI1QJyPED6kt@ep-tiny-recipe-acbzzcs2-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require" \
  --table=public.usuarios \
  --table=public.sessoes \
  --data-only \
  > usuarios_backup.sql

# Para cada usuário, exportar seus schemas
# (substitua 'u_username' pelo schema do usuário)
pg_dump "postgresql://neondb_owner:npg_RI1QJyPED6kt@ep-tiny-recipe-acbzzcs2-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require" \
  --schema=u_username \
  --data-only \
  > usuario_username_backup.sql
```

#### 3.2. Importar no Supabase

```bash
# Importar tabelas globais
psql "postgresql://postgres:[SUA_SENHA]@db.utvmrdotraksbfvbdzqn.supabase.co:5432/postgres?sslmode=require" < usuarios_backup.sql

# Para cada usuário, criar schema e importar
psql "postgresql://postgres:[SUA_SENHA]@db.utvmrdotraksbfvbdzqn.supabase.co:5432/postgres?sslmode=require" -c "CREATE SCHEMA IF NOT EXISTS u_username;"
psql "postgresql://postgres:[SUA_SENHA]@db.utvmrdotraksbfvbdzqn.supabase.co:5432/postgres?sslmode=require" < usuario_username_backup.sql
```

**⚠️ IMPORTANTE:** Se você não migrar os dados, os usuários precisarão se registrar novamente.

### 4. Deploy e Teste

1. **Faça o deploy** da aplicação com a nova variável de ambiente
2. **Acesse a aplicação** e faça login (ou registre um novo usuário)
3. **Verifique os logs** para confirmar que as tabelas foram criadas

### 5. Verificar Criação das Tabelas

Você pode verificar se as tabelas foram criadas conectando ao Supabase:

```bash
psql "postgresql://postgres:[SUA_SENHA]@db.utvmrdotraksbfvbdzqn.supabase.co:5432/postgres?sslmode=require"

# Verificar tabelas globais
\dt public.*

# Verificar schemas de usuários
\dn

# Verificar tabelas de um usuário específico
SET search_path TO u_username;
\dt
```

## 🔍 Como o Sistema Cria as Tabelas Automaticamente

### Tabelas Globais (schema `public`)
Criadas na inicialização do app (`app.py` linha 122):
- `public.usuarios` - Usuários do sistema
- `public.sessoes` - Sessões ativas

### Tabelas por Usuário (schema `u_{username}`)
Criadas automaticamente quando o usuário faz login pela primeira vez:

**Carteira:**
- `carteira` - Ativos na carteira
- `historico_carteira` - Histórico de valores da carteira
- `asset_types` - Tipos de ativos personalizados
- `rebalance_config` - Configuração de rebalanceamento
- `rebalance_history` - Histórico de rebalanceamentos
- `goals` - Metas financeiras
- `rf_catalog` - Catálogo de renda fixa

**Controle:**
- `receitas` - Receitas
- `cartoes` - Cartões (legado)
- `outros_gastos` - Outros gastos
- `cartoes_cadastrados` - Cartões cadastrados
- `compras_cartao` - Compras nos cartões

**Marmitas:**
- `marmitas` - Registro de marmitas

## ⚠️ Observações Importantes

1. **Senha do Supabase:** Substitua `[SUA_SENHA]` pela senha real do seu banco Supabase
2. **SSL Mode:** O sistema já adiciona `sslmode=require` automaticamente se não estiver presente
3. **Channel Binding:** O sistema remove automaticamente `channel_binding=require` (não suportado pelo Supabase)
4. **Schemas:** Cada usuário terá seu próprio schema (`u_{username}`) criado automaticamente
5. **Primeiro Login:** Quando um usuário fizer login pela primeira vez no Supabase, todas as tabelas do seu schema serão criadas automaticamente

## 🚀 Próximos Passos Após Migração

1. Teste todas as funcionalidades principais
2. Verifique se os dados foram migrados corretamente (se aplicável)
3. Monitore os logs para garantir que não há erros
4. Atualize a documentação interna se necessário

## 📞 Troubleshooting

### Erro: "relation does not exist"
- **Causa:** Tabelas ainda não foram criadas
- **Solução:** Faça login com um usuário - as tabelas serão criadas automaticamente

### Erro: "schema does not exist"
- **Causa:** Schema do usuário não foi criado
- **Solução:** O sistema cria automaticamente no primeiro login

### Erro de conexão SSL
- **Causa:** String de conexão sem `sslmode=require`
- **Solução:** Adicione `?sslmode=require` no final da URL

### Erro: "channel_binding"
- **Causa:** URL contém `channel_binding=require`
- **Solução:** O sistema remove automaticamente, mas você pode remover manualmente da URL

