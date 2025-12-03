# 🚀 Executar Migração Neon → Supabase

## ✅ Tudo está pronto!

As URLs já estão configuradas no script. Você só precisa executar!

## 📋 Passo a Passo

### 1. Instalar dependência (se necessário)

Abra o terminal na pasta do projeto e execute:

```bash
pip install psycopg[binary]
```

### 2. Executar a migração

**No Windows:**
```bash
python migrate_to_supabase.py
```

**Ou simplesmente dê duplo clique em:**
- `executar_migracao.bat`

**No Linux/Mac:**
```bash
chmod +x executar_migracao.sh
./executar_migracao.sh
```

### 3. O que vai acontecer

1. ✅ Conecta ao Neon (banco antigo)
2. ✅ Conecta ao Supabase (banco novo)
3. ✅ Migra tabelas globais (`usuarios`, `sessoes`)
4. ✅ Lista todos os schemas de usuários
5. ✅ Pergunta se quer migrar todos ou escolher específicos
6. ✅ Migra os dados de cada usuário

### 4. Após a migração

1. **Configurar no Fly.io:**
   ```bash
   fly secrets set DATABASE_URL="postgresql://postgres:Korgloriws13@db.utvmrdotraksbfvbdzqn.supabase.co:5432/postgres?sslmode=require"
   ```

2. **Reiniciar a aplicação:**
   ```bash
   fly apps restart finmas-backend
   ```

3. **Testar login** com um usuário migrado

## ⚠️ Importante

- **Backup:** O script não faz backup automático. Se quiser, faça backup antes!
- **Sessões:** As sessões ativas não serão migradas (usuários precisarão fazer login novamente)
- **Primeira execução:** Pode demorar alguns minutos dependendo da quantidade de dados

## 🔍 Verificar se funcionou

Após executar, você verá mensagens como:
- ✅ Conectado ao Neon
- ✅ Conectado ao Supabase
- ✅ Tabelas globais migradas!
- ✅ Schema migrado!

## ❓ Problemas?

### Erro: "ModuleNotFoundError: No module named 'psycopg'"
**Solução:** Execute `pip install psycopg[binary]`

### Erro de conexão
**Solução:** Verifique se as URLs estão corretas no arquivo `migrate_to_supabase.py`

### Erro: "relation does not exist"
**Solução:** Normal! O script cria as tabelas automaticamente. Se der erro, as tabelas serão criadas quando o usuário fizer login.

