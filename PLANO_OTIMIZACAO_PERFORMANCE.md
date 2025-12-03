# 🚀 Plano Detalhado de Otimização de Performance - Finmas

## 📊 Análise da Arquitetura Atual

### Stack Tecnológica
- **Backend**: Flask (Python) + yfinance + PostgreSQL (Supabase)
- **Frontend**: React + TypeScript + Vite + React Query
- **Cache**: SimpleCache (em memória, não compartilhado)
- **Deploy**: Render (plano starter)
- **Database**: Supabase PostgreSQL

### Gargalos Identificados

1. **Chamadas yfinance sequenciais** - Loop `for ticker in tickers` sem paralelização
2. **Cache não compartilhado** - SimpleCache não funciona entre workers do Gunicorn
3. **Timeout excessivo** - 16 segundos no frontend
4. **Múltiplas requisições** - Frontend faz muitas chamadas individuais
5. **Sem background jobs** - Atualizações bloqueiam requests
6. **Sem CDN** - Assets estáticos servidos pelo Flask
7. **Bundle não otimizado** - Sem code splitting avançado
8. **Queries não otimizadas** - Sem índices adequados
9. **Connection pooling limitado** - Conexões PostgreSQL não otimizadas
10. **Render starter limitado** - CPU/RAM limitados no plano gratuito

---

## 🎯 Plano de 10 Passos para Otimização Exponencial

### **PASSO 1: Implementar Cache Redis Compartilhado** ⚡
**Impacto**: 🔥🔥🔥🔥🔥 (Crítico)
**Custo**: $0-5/mês
**Tempo**: 2-3 horas

#### Problema Atual
- `SimpleCache` não é compartilhado entre workers do Gunicorn
- Cada worker tem seu próprio cache em memória
- Cache é perdido quando worker reinicia

#### Solução
```python
# backend/models.py
from flask_caching import Cache
import redis
import os

# Configurar Redis
cache_config = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_REDIS_URL': os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    'CACHE_DEFAULT_TIMEOUT': 300
}

cache = Cache(config=cache_config)
```

#### Opções Gratuitas de Redis
1. **Upstash Redis** (melhor opção gratuita)
   - 10.000 comandos/dia grátis
   - Sem servidor para gerenciar
   - Latência < 1ms
   - URL: `https://upstash.com`

2. **Redis Cloud** (plano gratuito)
   - 30MB grátis
   - Limitado mas suficiente para começar

3. **Render Redis** (se já estiver no Render)
   - $7/mês (não é gratuito, mas barato)

#### Benefícios Esperados
- Redução de 60-80% nas chamadas yfinance
- Cache compartilhado entre todos os workers
- Performance 3-5x melhor em requisições repetidas

---

### **PASSO 2: Paralelizar Chamadas yfinance** ⚡
**Impacto**: 🔥🔥🔥🔥🔥 (Crítico)
**Custo**: $0
**Tempo**: 3-4 horas

#### Problema Atual
```python
# backend/app.py linha 1169
resultados = []
for ticker in tickers:  # ❌ SEQUENCIAL
    acao = yf.Ticker(ticker_yf)
    info = acao.info or {}
    resultados.append({...})
```

#### Solução
```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import asyncio
from functools import partial

def obter_info_ticker(ticker):
    """Função para buscar info de um ticker"""
    try:
        ticker_yf = ticker.strip().upper()
        if '.' not in ticker_yf and len(ticker_yf) <= 6:
            ticker_yf += '.SA'
        
        acao = yf.Ticker(ticker_yf)
        info = acao.info or {}
        
        return {
            "ticker": ticker,
            "nome": info.get('longName', '-'),
            "preco_atual": info.get('currentPrice') or info.get('regularMarketPrice'),
            "pl": info.get('trailingPE'),
            "pvp": info.get('priceToBook'),
            "dy": info.get('dividendYield'),
            "roe": info.get('returnOnEquity'),
            "setor": info.get('sector', '-'),
            "pais": info.get('country', '-'),
        }
    except Exception as e:
        return {
            "ticker": ticker,
            "nome": f"Erro: {str(e)}",
            "preco_atual": None,
            # ... outros campos None
        }

@server.route("/api/comparar", methods=["POST"])
def api_comparar_ativos():
    try:
        data = request.get_json()
        tickers = data.get('tickers', [])
        
        if not tickers:
            return jsonify({"error": "Nenhum ticker fornecido"}), 400
        
        # ✅ PARALELIZADO com ThreadPoolExecutor
        max_workers = min(len(tickers), 10)  # Limitar a 10 threads
        
        resultados = []
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_ticker = {
                executor.submit(obter_info_ticker, ticker): ticker 
                for ticker in tickers
            }
            
            for future in as_completed(future_to_ticker):
                resultado = future.result()
                resultados.append(resultado)
        
        return jsonify(resultados)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

#### Aplicar em Todos os Endpoints
- `/api/comparar` ✅
- `/api/analise/ativos` (busca múltiplos ativos)
- Atualização de carteira (refresh múltiplos tickers)

#### Benefícios Esperados
- Redução de 70-90% no tempo de resposta para múltiplos tickers
- 10 tickers: de ~30s para ~3-5s
- Melhor experiência do usuário

---

### **PASSO 3: Implementar Background Jobs para Atualizações** ⚡
**Impacto**: 🔥🔥🔥🔥 (Alto)
**Custo**: $0-7/mês
**Tempo**: 4-5 horas

#### Problema Atual
- Atualização de carteira bloqueia request por 30-60 segundos
- Usuário fica esperando na tela
- Timeout de 16 segundos é muito alto

#### Solução: Celery + Redis (ou alternativa simples)

**Opção 1: Celery (Recomendado)**
```python
# backend/tasks.py
from celery import Celery
import os

celery_app = Celery(
    'finmas',
    broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    backend=os.getenv('REDIS_URL', 'redis://localhost:6379/0')
)

@celery_app.task
def atualizar_carteira_async(username):
    """Atualiza carteira em background"""
    from models import obter_carteira, atualizar_precos_indicadores_carteira
    # Lógica de atualização
    atualizar_precos_indicadores_carteira(username)
    return {"status": "completed"}

# backend/app.py
@server.route("/api/carteira/refresh", methods=["POST"])
def api_refresh_carteira():
    usuario = get_usuario_atual()
    if not usuario:
        return jsonify({"error": "Não autenticado"}), 401
    
    # Iniciar job em background
    task = atualizar_carteira_async.delay(usuario)
    
    return jsonify({
        "message": "Atualização iniciada",
        "task_id": task.id,
        "status": "processing"
    }), 202

@server.route("/api/carteira/refresh/status/<task_id>", methods=["GET"])
def api_refresh_status(task_id):
    task = atualizar_carteira_async.AsyncResult(task_id)
    return jsonify({
        "status": task.state,
        "result": task.result if task.ready() else None
    })
```

**Opção 2: Threading Simples (Mais fácil, menos robusto)**
```python
import threading
from queue import Queue

# Fila de jobs
job_queue = Queue()
job_status = {}

def worker():
    while True:
        job = job_queue.get()
        if job is None:
            break
        try:
            job['status'] = 'processing'
            # Executar atualização
            atualizar_precos_indicadores_carteira(job['username'])
            job['status'] = 'completed'
        except Exception as e:
            job['status'] = 'error'
            job['error'] = str(e)
        job_queue.task_done()

# Iniciar worker thread
threading.Thread(target=worker, daemon=True).start()
```

#### Benefícios Esperados
- Requests instantâneos (< 1s)
- Usuário não fica esperando
- Melhor UX com status de progresso

---

### **PASSO 4: Otimizar Frontend - Batch Requests e Code Splitting** ⚡
**Impacto**: 🔥🔥🔥🔥 (Alto)
**Custo**: $0
**Tempo**: 3-4 horas

#### Problema Atual
- Múltiplas requisições individuais
- Bundle grande carregado de uma vez
- Timeout de 16 segundos

#### Solução 1: Batch Endpoint
```python
# backend/app.py
@server.route("/api/ativos/batch", methods=["POST"])
def api_get_ativos_batch():
    """Busca múltiplos ativos de uma vez"""
    data = request.get_json()
    tickers = data.get('tickers', [])
    
    # Usar paralelização do Passo 2
    resultados = {}
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(obter_info_ticker, ticker): ticker 
            for ticker in tickers
        }
        for future in as_completed(futures):
            ticker = futures[future]
            resultados[ticker] = future.result()
    
    return jsonify(resultados)
```

#### Solução 2: Code Splitting no Frontend
```typescript
// frontend/src/pages/DetalhesPage.tsx
import { lazy, Suspense } from 'react'

// Lazy load de tabs pesadas
const DetalhesFundamentalsTab = lazy(() => import('../components/detalhes/DetalhesFundamentalsTab'))
const DetalhesChartsTab = lazy(() => import('../components/detalhes/DetalhesChartsTab'))
const DetalhesComparisonTab = lazy(() => import('../components/detalhes/DetalhesComparisonTab'))

// Usar Suspense
<Suspense fallback={<LoadingSpinner />}>
  {activeTab === 'fundamentals' && <DetalhesFundamentalsTab />}
</Suspense>
```

#### Solução 3: Reduzir Timeout e Melhorar Retry
```typescript
// frontend/src/services/api.ts
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30s (reduzir de 16 milhões!)
  withCredentials: true,
})

// Adicionar retry com exponential backoff
api.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config
    if (!config || !config.retry) {
      config.retry = 0
    }
    
    if (config.retry < 3 && error.response?.status >= 500) {
      config.retry += 1
      await new Promise(resolve => setTimeout(resolve, 1000 * config.retry))
      return api(config)
    }
    
    return Promise.reject(error)
  }
)
```

#### Benefícios Esperados
- Redução de 50-70% no número de requisições
- Bundle inicial 40-60% menor
- Carregamento inicial 2-3x mais rápido

---

### **PASSO 5: Otimizar Queries PostgreSQL e Adicionar Índices** ⚡
**Impacto**: 🔥🔥🔥 (Médio-Alto)
**Custo**: $0
**Tempo**: 2-3 horas

#### Problema Atual
- Queries sem índices adequados
- Buscas sequenciais em tabelas grandes
- Connection pooling não otimizado

#### Solução
```sql
-- Índices críticos para performance
CREATE INDEX IF NOT EXISTS idx_carteira_usuario_ticker 
ON carteira(usuario, ticker);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_usuario_data 
ON movimentacoes(usuario, data);

CREATE INDEX IF NOT EXISTS idx_receitas_usuario_mes_ano 
ON receitas(usuario, mes, ano);

-- Connection pooling no Supabase
-- Já está incluído, mas verificar configuração
```

#### Otimizar Connection Pooling
```python
# backend/models.py
from psycopg_pool import ConnectionPool

# Pool de conexões compartilhado
_pool = None

def get_pool():
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            max_idle=300,
            max_lifetime=3600
        )
    return _pool

def _pg_conn_for_user(username: str):
    pool = get_pool()
    conn = pool.getconn()
    try:
        _pg_use_schema(conn, username)
        return conn
    except Exception:
        pool.putconn(conn)
        raise
```

#### Benefícios Esperados
- Queries 5-10x mais rápidas
- Menor uso de CPU/RAM no banco
- Melhor escalabilidade

---

### **PASSO 6: Implementar CDN para Assets Estáticos** ⚡
**Impacto**: 🔥🔥🔥 (Médio)
**Custo**: $0-5/mês
**Tempo**: 1-2 horas

#### Problema Atual
- Assets servidos pelo Flask (lento)
- Sem cache de browser otimizado
- Sem compressão adequada

#### Solução: Vercel/Netlify para Frontend (Gratuito)

**Opção 1: Vercel (Recomendado)**
```bash
# Deploy frontend no Vercel (gratuito)
npm i -g vercel
cd frontend
vercel --prod
```

**Opção 2: Cloudflare Pages (Gratuito)**
- Deploy automático via GitHub
- CDN global incluído
- Sem custo

**Opção 3: Manter no Render mas otimizar**
```python
# backend/app.py
from flask import send_from_directory

@server.route('/static/<path:filename>')
def static_files(filename):
    response = send_from_directory(FRONTEND_DIST, filename)
    # Cache por 1 ano para assets estáticos
    response.cache_control.max_age = 31536000
    response.cache_control.public = True
    return response
```

#### Benefícios Esperados
- Assets 5-10x mais rápidos
- Redução de carga no backend
- Melhor experiência global

---

### **PASSO 7: Implementar Rate Limiting e Throttling** ⚡
**Impacto**: 🔥🔥 (Médio)
**Custo**: $0
**Tempo**: 1-2 horas

#### Problema Atual
- Sem proteção contra abuso
- Usuários podem fazer muitas requisições
- yfinance pode bloquear IPs

#### Solução
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=server,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

@server.route("/api/ativo/<ticker>", methods=["GET"])
@limiter.limit("10 per minute")  # 10 requisições por minuto
def api_get_ativo_details(ticker):
    # ... código existente
```

#### Benefícios Esperados
- Proteção contra abuso
- Melhor distribuição de recursos
- Menor risco de bloqueio do yfinance

---

### **PASSO 8: Otimizar React Query - Stale Time e Prefetching** ⚡
**Impacto**: 🔥🔥🔥 (Médio-Alto)
**Custo**: $0
**Tempo**: 2-3 horas

#### Problema Atual
- `staleTime: 0` em alguns lugares
- Refetch desnecessário
- Sem prefetching inteligente

#### Solução
```typescript
// frontend/src/pages/HomePage.tsx
const { data: carteira } = useQuery({
  queryKey: ['carteira', user],
  queryFn: carteiraService.getCarteira,
  staleTime: 5 * 60 * 1000, // 5 minutos (aumentar de 0)
  cacheTime: 10 * 60 * 1000, // 10 minutos
  refetchOnWindowFocus: false, // Já está, mas garantir
  refetchOnReconnect: false,
})

// Prefetching inteligente
const queryClient = useQueryClient()

// Prefetch quando hover em link
const handleMouseEnter = (ticker: string) => {
  queryClient.prefetchQuery({
    queryKey: ['ativo-detalhes', ticker],
    queryFn: () => ativoService.getDetalhes(ticker),
    staleTime: 5 * 60 * 1000
  })
}
```

#### Benefícios Esperados
- Redução de 40-60% nas requisições
- Navegação mais fluida
- Melhor uso de cache

---

### **PASSO 9: Avaliar e Otimizar Infraestrutura (Render vs Alternativas)** ⚡
**Impacto**: 🔥🔥🔥🔥 (Alto)
**Custo**: $0-10/mês
**Tempo**: 2-3 horas (pesquisa + migração)

#### Análise de Opções Gratuitas

**1. Render (Atual)**
- ✅ Plano Starter: $7/mês (não é gratuito)
- ✅ Fácil de usar
- ❌ CPU/RAM limitados
- ❌ Cold starts frequentes
- ❌ Sem Redis incluído

**2. Fly.io (RECOMENDADO para backend)**
- ✅ Plano gratuito generoso (3 VMs compartilhadas)
- ✅ Sem cold starts
- ✅ Melhor performance
- ✅ Suporta Docker
- ✅ Redis incluído (Upstash)
- ⚠️ Configuração mais complexa

**3. Railway**
- ✅ $5 crédito grátis/mês
- ✅ Fácil de usar
- ✅ Bom para começar
- ❌ Pode ficar caro com uso

**4. Vercel (Frontend) + Fly.io (Backend)**
- ✅ Vercel: Frontend gratuito (CDN incluído)
- ✅ Fly.io: Backend gratuito
- ✅ Melhor performance global
- ✅ Sem cold starts
- ⚠️ Dois serviços para gerenciar

#### Recomendação: Fly.io + Vercel
```yaml
# fly.toml (já existe, otimizar)
[build]
  builder = "dockerfile"

[env]
  PORT = "8080"
  PYTHONUNBUFFERED = "1"

[[services]]
  internal_port = 8080
  processes = ["app"]
  
  [services.concurrency]
    type = "requests"
    hard_limit = 25
    soft_limit = 20

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

#### Benefícios Esperados
- Performance 2-3x melhor
- Sem cold starts
- Custo zero ou muito baixo
- Melhor escalabilidade

---

### **PASSO 10: Monitoramento e Métricas** ⚡
**Impacto**: 🔥🔥 (Médio - mas crítico para otimização contínua)
**Custo**: $0-10/mês
**Tempo**: 2-3 horas

#### Implementar Logging e Métricas
```python
# backend/monitoring.py
import time
import logging
from functools import wraps

logger = logging.getLogger(__name__)

def log_performance(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        try:
            result = func(*args, **kwargs)
            duration = time.time() - start
            logger.info(f"{func.__name__} took {duration:.2f}s")
            return result
        except Exception as e:
            duration = time.time() - start
            logger.error(f"{func.__name__} failed after {duration:.2f}s: {e}")
            raise
    return wrapper

# Aplicar em endpoints críticos
@server.route("/api/ativo/<ticker>", methods=["GET"])
@log_performance
def api_get_ativo_details(ticker):
    # ... código
```

#### Opções de Monitoramento Gratuito
1. **Sentry** (gratuito até 5k eventos/mês)
2. **Logtail** (gratuito até 1GB/mês)
3. **Uptime Robot** (gratuito para monitoramento básico)

#### Dashboard de Métricas
```python
@server.route("/api/metrics", methods=["GET"])
def api_metrics():
    """Endpoint para métricas de performance"""
    return jsonify({
        "cache_hits": cache_stats.get('hits', 0),
        "cache_misses": cache_stats.get('misses', 0),
        "avg_response_time": avg_response_time,
        "active_connections": db_pool.get_stats()
    })
```

#### Benefícios Esperados
- Identificar gargalos em tempo real
- Otimização contínua baseada em dados
- Alertas proativos

---

## 📈 Resultados Esperados por Passo

| Passo | Redução de Tempo | Redução de Requisições | Impacto UX |
|-------|------------------|------------------------|------------|
| 1. Redis Cache | 60-80% | 60-80% | 🔥🔥🔥🔥🔥 |
| 2. Paralelização | 70-90% | 0% | 🔥🔥🔥🔥🔥 |
| 3. Background Jobs | 90%+ (percebido) | 0% | 🔥🔥🔥🔥 |
| 4. Batch Requests | 50-70% | 50-70% | 🔥🔥🔥🔥 |
| 5. DB Otimização | 50-80% | 0% | 🔥🔥🔥 |
| 6. CDN | 80-90% (assets) | 0% | 🔥🔥🔥 |
| 7. Rate Limiting | 0% | 10-20% | 🔥🔥 |
| 8. React Query | 40-60% | 40-60% | 🔥🔥🔥 |
| 9. Infraestrutura | 50-70% | 0% | 🔥🔥🔥🔥 |
| 10. Monitoramento | N/A | N/A | 🔥🔥 |

### **Resultado Total Esperado**
- ⚡ **Tempo de resposta**: 5-10x mais rápido
- 📉 **Requisições**: 60-70% de redução
- 💰 **Custo**: $0-15/mês (maioria gratuito)
- 😊 **UX**: Exponencialmente melhor

---

## 🎯 Priorização Recomendada

### Fase 1 (Impacto Imediato - 1 semana)
1. ✅ Passo 1: Redis Cache (Upstash - gratuito)
2. ✅ Passo 2: Paralelização yfinance
3. ✅ Passo 8: Otimizar React Query

### Fase 2 (Melhorias Significativas - 1 semana)
4. ✅ Passo 4: Batch Requests
5. ✅ Passo 5: Otimizar DB
6. ✅ Passo 3: Background Jobs

### Fase 3 (Otimizações Avançadas - 1 semana)
7. ✅ Passo 9: Migrar para Fly.io + Vercel
8. ✅ Passo 6: CDN (já incluído no Vercel)
9. ✅ Passo 7: Rate Limiting
10. ✅ Passo 10: Monitoramento

---

## 💡 Considerações sobre Migração para TypeScript/Node.js

### ❌ **NÃO RECOMENDADO** pelos seguintes motivos:

1. **yfinance é Python-only**
   - Não há alternativa equivalente em Node.js
   - APIs alternativas (Alpha Vantage, Polygon) são pagas ou limitadas
   - Manter Python é essencial

2. **Custo de Migração**
   - Reescrita completa do backend
   - Risco de bugs
   - Tempo: 2-3 meses
   - Benefício: mínimo (Python é rápido o suficiente)

3. **Arquitetura Híbrida (Recomendada)**
   ```
   Frontend (Vercel) → Backend Python (Fly.io) → yfinance
                    ↓
                  Redis (Upstash)
                    ↓
              PostgreSQL (Supabase)
   ```

### ✅ **Alternativa: Otimizar Python**
- Usar `asyncio` para I/O
- Paralelização com `ThreadPoolExecutor`
- Cache agressivo
- Python é suficiente para este caso de uso

---

## 🚀 Próximos Passos Imediatos

1. **Criar conta Upstash Redis** (gratuito)
2. **Implementar Passo 1** (Redis Cache)
3. **Implementar Passo 2** (Paralelização)
4. **Testar performance** antes/depois
5. **Decidir sobre migração de infraestrutura** (Fly.io vs Render)

---

## 📝 Notas Finais

- **Manter Python é a escolha certa** devido ao yfinance
- **Foco em cache e paralelização** terá maior impacto
- **Infraestrutura gratuita é viável** com Fly.io + Vercel + Upstash
- **Monitoramento é essencial** para otimização contínua

**Tempo total estimado**: 2-3 semanas
**Custo mensal estimado**: $0-15
**Melhoria de performance**: 5-10x

