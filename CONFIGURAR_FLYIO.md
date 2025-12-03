# Configurar DATABASE_URL no Fly.io

## Passo a Passo

### 1. Configurar a variável de ambiente

Execute este comando no terminal (substitua `[SUA_SENHA]` pela senha real do Supabase):

```bash
fly secrets set DATABASE_URL="postgresql://postgres:Korgloriws13@db.utvmrdotraksbfvbdzqn.supabase.co:5432/postgres?sslmode=require"
```

### 2. Verificar se foi configurado

```bash
fly secrets list
```

Você deve ver `DATABASE_URL` na lista.

### 3. Reiniciar a aplicação

```bash
fly apps restart finmas-backend
```

Ou através do dashboard do Fly.io.

### 4. Verificar logs

```bash
fly logs
```

Procure por mensagens como:
- `_is_postgres: DATABASE_URL=True, psycopg=True, resultado=True`
- `Conectando ao PostgreSQL`
- `Schema criado/verificado`

## ⚠️ Importante

- A variável `DATABASE_URL` tem prioridade sobre `USUARIOS_DB_URL`
- Após configurar, todas as tabelas serão criadas automaticamente
- Os usuários existentes precisarão fazer login novamente (ou você pode migrar os dados)

## 🔄 Alternativa: Usar USUARIOS_DB_URL

Se preferir usar `USUARIOS_DB_URL` em vez de `DATABASE_URL`:

```bash
fly secrets set USUARIOS_DB_URL="postgresql://postgres:Korgloriws13@db.utvmrdotraksbfvbdzqn.supabase.co:5432/postgres?sslmode=require"
```

