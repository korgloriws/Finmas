import axios from 'axios'
import { AtivoInfo, AtivoDetalhes, TickerSugestao, AtivoCarteira, Movimentacao, Marmita, GastoMensal, Receita, Cartao, OutroGasto, EvolucaoFinanceira, TotalPorPessoa, ReceitasDespesas, AtivoAnalise, ResumoAnalise, FiltrosAnalise, CartaoCadastrado, CompraCartao } from '../types'
import { normalizeTicker } from '../utils/tickerUtils'

const API_BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as ImportMeta & { env?: any })?.env?.VITE_API_BASE_URL)
  ? (import.meta as ImportMeta & { env?: any }).env.VITE_API_BASE_URL
  : '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 16000000,
  withCredentials: true,
})


api.interceptors.request.use(
  (config) => {

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)


api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const ativoService = {

  getDetalhes: async (ticker: string): Promise<AtivoDetalhes> => {
    const normalizedTicker = normalizeTicker(ticker)
    const response = await api.get(`/ativo/${normalizedTicker}`)
    return response.data
  },

  getHistorico: async (ticker: string, periodo: string = '1y'): Promise<Array<Record<string, any>>> => {
    const normalizedTicker = normalizeTicker(ticker)
    const response = await api.get(`/ativo/${normalizedTicker}/historico?periodo=${periodo}`)
    return response.data
  },

  getPrecoHistorico: async (ticker: string, data: string): Promise<{preco: number, data_historico: string, data_solicitada: string, ticker: string}> => {
    const normalizedTicker = normalizeTicker(ticker)
    const response = await api.get(`/ativo/${normalizedTicker}/preco-historico?data=${data}`)
    return response.data
  },

  getPrecoAtual: async (ticker: string): Promise<{preco: number, data: string, ticker: string}> => {
    const normalizedTicker = normalizeTicker(ticker)
    const response = await api.get(`/ativo/${normalizedTicker}/preco-atual`)
    return response.data
  },


  comparar: async (tickers: string[]): Promise<AtivoInfo[]> => {
    const normalizedTickers = tickers.map(normalizeTicker)
    const response = await api.post('/comparar', { tickers: normalizedTickers })
    return response.data
  },


  getSugestoes: async (): Promise<TickerSugestao[]> => {
    const response = await api.get('/tickers/sugestoes')
    return response.data
  },


  startLoad: async (): Promise<void> => {
    await api.post('/start_load')
  },


  getData: async (): Promise<any[]> => {
    const response = await api.get('/get_data')
    return response.data
  },


  getLogoUrl: async (ticker: string): Promise<string | null> => {
    try {
      const normalizedTicker = normalizeTicker(ticker)
      const response = await api.get(`/logo/${normalizedTicker}`)
      return response.data.logo_url
    } catch (error) {
      return null
    }
  },

  getLogosBatch: async (tickers: string[]): Promise<Record<string, string | null>> => {
    try {
      const response = await api.post('/logos', { tickers })
      return (response.data?.logos || {}) as Record<string, string | null>
    } catch {
      return {}
    }
  },

  getExchangeRate: async (symbol: string): Promise<{ symbol: string; rate: number; date: string; volume: number }> => {
    const response = await api.get(`/exchange-rate/${symbol}`)
    return response.data
  },

  getFiiMetadata: async (ticker: string): Promise<{
    ticker: string
    tipo?: string
    segmento?: string
    vacancia?: number
    num_cotistas?: number
    gestora?: string
    fonte?: string
    portfolio?: import('../types').PortfolioFII
  } | null> => {
    try {
      const normalizedTicker = normalizeTicker(ticker)
      const response = await api.get(`/fii-metadata/${normalizedTicker}`)
      return response.data
    } catch (error) {
      console.error('Erro ao buscar metadados de FII:', error)
      return null
    }
  },
}

export const carteiraService = {

  getCarteira: async (): Promise<AtivoCarteira[]> => {
    const response = await api.get('/carteira')
    return response.data
  },
  getCarteiraRefresh: async (): Promise<AtivoCarteira[]> => {
    const response = await api.get('/carteira?refresh=1')
    return response.data
  },

  refreshCarteira: async (): Promise<{ success: boolean; updated?: number; errors?: string[]; message?: string }> => {
    const response = await api.post('/carteira/refresh')
    return response.data
  },

  refreshIndexadores: async (): Promise<{ success: boolean; updated?: number; errors?: string[]; message?: string }> => {
    const response = await api.post('/carteira/refresh-indexadores')
    return response.data
  },

  testarIndexador: async (params: { preco_inicial: number; indexador: string; indexador_pct: number; data_adicao?: string }): Promise<any> => {
    const response = await api.post('/teste-indexador', params)
    return response.data
  },

  // Indicadores e Tesouro Direto
  getIndicadores: async (): Promise<{ selic?: any; cdi?: any; ipca?: any }> => {
    const response = await api.get('/indicadores')
    return response.data
  },
  getTesouroTitulos: async (): Promise<{ titulos: Array<{ nome: string; vencimento: string; taxaCompra: number; pu: number; indexador?: string; tipoRent?: string }> }> => {
    const response = await api.get('/tesouro/titulos')
    return response.data
  },

  // Tipos de Ativo (CRUD)
  getTipos: async (): Promise<string[]> => {
    const response = await api.get('/carteira/tipos')
    return response.data?.tipos || []
  },
  criarTipo: async (nome: string): Promise<any> => {
    const response = await api.post('/carteira/tipos', { nome })
    return response.data
  },
  renomearTipo: async (oldName: string, newName: string): Promise<any> => {
    const response = await api.put('/carteira/tipos', { old: oldName, new: newName })
    return response.data
  },
  excluirTipo: async (nome: string): Promise<any> => {
    const response = await api.delete('/carteira/tipos', { data: { nome } })
    return response.data
  },

  getInsights: async (): Promise<any> => {
    const response = await api.get('/carteira/insights')
    return response.data
  },


  adicionarAtivo: async (
    ticker: string,
    quantidade: number,
    tipo?: string,
    preco_inicial?: number,
    nome_personalizado?: string,
    indexador?: 'CDI' | 'IPCA' | 'SELIC' | 'PREFIXADO' | 'CDI+' | 'IPCA+',
    indexador_pct?: number,
    data_aplicacao?: string,
    vencimento?: string,
    isento_ir?: boolean,
    liquidez_diaria?: boolean,
  ): Promise<any> => {
    const normalizedTicker = normalizeTicker(ticker)
    const response = await api.post('/carteira/adicionar', {
      ticker: normalizedTicker,
      quantidade,
      tipo,
      preco_inicial,
      nome_personalizado,
      indexador,
      indexador_pct,
      data_aplicacao,
      vencimento,
      isento_ir,
      liquidez_diaria,
    })
    return response.data
  },


  removerAtivo: async (id: number): Promise<any> => {
    const response = await api.delete(`/carteira/remover/${id}`)
    return response.data
  },


  atualizarAtivo: async (id: number, payload: { quantidade?: number; preco_atual?: number; preco_compra?: number }): Promise<any> => {
    const body: any = {}
    if (typeof payload.quantidade === 'number') body.quantidade = payload.quantidade
    if (typeof payload.preco_atual === 'number') body.preco_atual = payload.preco_atual
    if (typeof payload.preco_compra === 'number') body.preco_compra = payload.preco_compra
    const response = await api.put(`/carteira/atualizar/${id}`, body)
    return response.data
  },


  getMovimentacoes: async (mes?: number, ano?: number): Promise<Movimentacao[]> => {
    const params = new URLSearchParams()
    if (mes) params.append('mes', mes.toString())
    if (ano) params.append('ano', ano.toString())
    
    const response = await api.get(`/carteira/movimentacoes?${params.toString()}`)
    return response.data
  },

  // Rebalanceamento
  getRebalanceConfig: async (): Promise<{ periodo?: string; targets?: Record<string, number>; start_date?: string; last_rebalance_date?: string } | {}> => {
    const response = await api.get('/carteira/rebalance/config')
    return response.data
  },
  saveRebalanceConfig: async (payload: { periodo: string; targets: Record<string, number>; last_rebalance_date?: string }): Promise<any> => {
    const response = await api.post('/carteira/rebalance/config', payload)
    return response.data
  },
  getRebalanceStatus: async (): Promise<any> => {
    const response = await api.get('/carteira/rebalance/status')
    return response.data
  },
  getRebalanceHistory: async (): Promise<{ history: string[] }> => {
    const response = await api.get('/carteira/rebalance/history')
    return response.data
  },
  addRebalanceHistory: async (date: string): Promise<any> => {
    const response = await api.post('/carteira/rebalance/history', { date })
    return response.data
  },

  getHistorico: async (periodo: string = 'mensal'): Promise<{
    datas: string[]
    carteira: (number|null)[]
    ibov: (number|null)[]
    ivvb11: (number|null)[]
    ifix: (number|null)[]
    ipca: (number|null)[]
    cdi: (number|null)[]
    carteira_valor: number[]
  }> => {
    const response = await api.get(`/carteira/historico?periodo=${periodo}`)
    return response.data
  },

  // Goals (Metas)
  getGoals: async (): Promise<any> => {
    const response = await api.get('/goals')
    return response.data || null
  },
  saveGoals: async (payload: { tipo: 'renda'|'patrimonio'; alvo: number; horizonte_meses?: number; aporte_mensal?: number; premissas?: any }): Promise<any> => {
    const response = await api.post('/goals', payload)
    return response.data
  },
  projectGoals: async (payload?: { tipo?: 'renda'|'patrimonio'; alvo?: number; horizonte_meses?: number; aporte_mensal?: number; premissas?: any }): Promise<{ capital_alvo: number; aporte_sugerido: number; horizonte_meses: number; saldo_inicial: number; taxa_mensal: number; roadmap: Array<{ mes: number; saldo: number; aporte: number }> }> => {
    const response = await api.post('/goals/projecao', payload || {})
    return response.data
  },


  downloadMovimentacoesCSV: async (params: { mes?: string; ano?: string; inicio?: string; fim?: string }) => {
    const p = new URLSearchParams()
    if (params.mes) p.append('mes', params.mes)
    if (params.ano) p.append('ano', params.ano)
    if (params.inicio) p.append('inicio', params.inicio)
    if (params.fim) p.append('fim', params.fim)
    const url = `/relatorios/movimentacoes?${p.toString()}`
    const resp = await api.get(url, { responseType: 'blob' })
    return resp.data as Blob
  },
  downloadPosicoesCSV: async () => {
    const resp = await api.get(`/relatorios/posicoes`, { responseType: 'blob' })
    return resp.data as Blob
  },
  downloadRendimentosCSV: async (periodo: string = 'mensal') => {
    const resp = await api.get(`/relatorios/rendimentos?periodo=${periodo}`, { responseType: 'blob' })
    return resp.data as Blob
  },
  downloadMovimentacoesPDF: async (params: { mes?: string; ano?: string; inicio?: string; fim?: string }) => {
    const p = new URLSearchParams()
    if (params.mes) p.append('mes', params.mes)
    if (params.ano) p.append('ano', params.ano)
    if (params.inicio) p.append('inicio', params.inicio)
    if (params.fim) p.append('fim', params.fim)
    p.append('formato', 'pdf')
    const url = `/relatorios/movimentacoes?${p.toString()}`
    const resp = await api.get(url, { responseType: 'blob' })
    return resp.data as Blob
  },
  downloadPosicoesPDF: async () => {
    const resp = await api.get(`/relatorios/posicoes?formato=pdf`, { responseType: 'blob' })
    return resp.data as Blob
  },
  downloadRendimentosPDF: async (periodo: string = 'mensal') => {
    const resp = await api.get(`/relatorios/rendimentos?periodo=${periodo}&formato=pdf`, { responseType: 'blob' })
    return resp.data as Blob
  },

  getProventos: async (tickers: string[]): Promise<Array<{
    ticker: string
    nome: string
    proventos: Array<{
      data: string
      valor: number
      tipo: string
    }>
    erro?: string
  }>> => {
    try {
      const response = await api.post('/carteira/proventos', { tickers })
      return response.data
    } catch (error) {
      console.error('Erro ao buscar proventos:', error)
      return []
    }
  },

  getProventosComFiltro: async (tickers: string[], periodo: string = 'total'): Promise<Array<{
    ticker: string
    nome: string
    proventos: Array<{
      data: string
      valor: number
      tipo: string
    }>
    erro?: string
  }>> => {
    try {
      const response = await api.post('/carteira/proventos', { tickers, periodo })
      return response.data
    } catch (error) {
      console.error('Erro ao buscar proventos com filtro:', error)
      return []
    }
  },

  getProventosRecebidos: async (periodo: string = 'total'): Promise<Array<{
    ticker: string
    nome: string
    quantidade_carteira: number
    data_aquisicao?: string
    proventos_recebidos: Array<{
      data: string
      valor_unitario: number
      quantidade: number
      valor_recebido: number
      tipo: string
    }>
    total_recebido: number
  }>> => {
    try {
      const response = await api.get(`/carteira/proventos-recebidos?periodo=${periodo}`)
      return response.data
    } catch (error) {
      console.error('Erro ao buscar proventos recebidos:', error)
      return []
    }
  },
}

export const marmitasService = {
  getMarmitas: async (mes?: number, ano?: number): Promise<Marmita[]> => {
    const params = new URLSearchParams()
    if (mes) params.append('mes', mes.toString())
    if (ano) params.append('ano', ano.toString())
    
    const response = await api.get(`/marmitas?${params.toString()}`)
    return response.data
  },

  adicionarMarmita: async (data: string, valor: number, comprou: boolean): Promise<any> => {
    const response = await api.post('/marmitas', {
      data,
      valor,
      comprou
    })
    return response.data
  },

  atualizarMarmita: async (id: number, data: string, valor: number, comprou: boolean): Promise<any> => {
    const response = await api.put(`/marmitas/${id}`, {
      data,
      valor,
      comprou
    })
    return response.data
  },

  removerMarmita: async (id: number): Promise<any> => {
    const response = await api.delete(`/marmitas/${id}`)
    return response.data
  },

  getGastosMensais: async (periodo: string = '6m'): Promise<GastoMensal[]> => {
    const response = await api.get(`/marmitas/gastos-mensais?periodo=${periodo}`)
    return response.data
  },
}

export const controleService = {

  getReceitas: async (mes?: string, ano?: string, pessoa?: string): Promise<Receita[]> => {
    const params = new URLSearchParams()
    if (mes) params.append('mes', mes)
    if (ano) params.append('ano', ano)
    if (pessoa) params.append('pessoa', pessoa)
    
    const response = await api.get(`/controle/receitas?${params.toString()}`)
    return response.data
  },

  adicionarReceita: async (
    nome: string, 
    valor: number,
    opts?: { data?: string; categoria?: string; tipo?: string; recorrencia?: string; parcelas_total?: number; parcela_atual?: number; grupo_parcela?: string; observacao?: string }
  ): Promise<any> => {
    const response = await api.post('/controle/receitas', { nome, valor, ...(opts || {}) })
    return response.data
  },

  atualizarReceita: async (
    id: number, 
    nome?: string, 
    valor?: number,
    opts?: { data?: string; categoria?: string; tipo?: string; recorrencia?: string; parcelas_total?: number; parcela_atual?: number; grupo_parcela?: string; observacao?: string }
  ): Promise<any> => {
    const response = await api.put('/controle/receitas', { id, nome, valor, ...(opts || {}) })
    return response.data
  },

  removerReceita: async (id: number): Promise<any> => {
    const response = await api.delete(`/controle/receitas?id=${id}`)
    return response.data
  },


  getCartoes: async (mes?: string, ano?: string): Promise<Cartao[]> => {
    const params = new URLSearchParams()
    if (mes) params.append('mes', mes)
    if (ano) params.append('ano', ano)
    
    const response = await api.get(`/controle/cartoes?${params.toString()}`)
    return response.data
  },

  adicionarCartao: async (
    nome: string, 
    valor: number, 
    pago: string,
    opts?: { data?: string; categoria?: string; tipo?: string; recorrencia?: string; parcelas_total?: number; parcela_atual?: number; grupo_parcela?: string; observacao?: string }
  ): Promise<any> => {
    const response = await api.post('/controle/cartoes', { nome, valor, pago, ...(opts || {}) })
    return response.data
  },

  atualizarCartao: async (
    id: number, 
    nome?: string, 
    valor?: number, 
    pago?: string,
    opts?: { data?: string; categoria?: string; tipo?: string; recorrencia?: string; parcelas_total?: number; parcela_atual?: number; grupo_parcela?: string; observacao?: string }
  ): Promise<any> => {
    const response = await api.put('/controle/cartoes', { id, nome, valor, pago, ...(opts || {}) })
    return response.data
  },

  removerCartao: async (id: number): Promise<any> => {
    const response = await api.delete(`/controle/cartoes?id=${id}`)
    return response.data
  },


  getOutros: async (mes?: string, ano?: string): Promise<OutroGasto[]> => {
    const params = new URLSearchParams()
    if (mes) params.append('mes', mes)
    if (ano) params.append('ano', ano)
    
    const response = await api.get(`/controle/outros?${params.toString()}`)
    return response.data
  },

  adicionarOutro: async (
    nome: string, 
    valor: number,
    opts?: { data?: string; categoria?: string; tipo?: string; recorrencia?: string; parcelas_total?: number; parcela_atual?: number; grupo_parcela?: string; observacao?: string }
  ): Promise<any> => {
    const response = await api.post('/controle/outros', { nome, valor, ...(opts || {}) })
    return response.data
  },

  atualizarOutro: async (
    id: number, 
    nome?: string, 
    valor?: number,
    opts?: { data?: string; categoria?: string; tipo?: string; recorrencia?: string; parcelas_total?: number; parcela_atual?: number; grupo_parcela?: string; observacao?: string }
  ): Promise<any> => {
    const response = await api.put('/controle/outros', { id, nome, valor, ...(opts || {}) })
    return response.data
  },

  removerOutro: async (id: number): Promise<any> => {
    const response = await api.delete(`/controle/outros?id=${id}`)
    return response.data
  },


  getSaldo: async (mes?: string, ano?: string, pessoa?: string): Promise<{ saldo: number }> => {
    const params = new URLSearchParams()
    if (mes) params.append('mes', mes)
    if (ano) params.append('ano', ano)
    if (pessoa) params.append('pessoa', pessoa)
    
    const response = await api.get(`/controle/saldo?${params.toString()}`)
    return response.data
  },


  getTotalPorPessoa: async (mes?: string, ano?: string): Promise<TotalPorPessoa[]> => {
    const params = new URLSearchParams()
    if (mes) params.append('mes', mes)
    if (ano) params.append('ano', ano)
    
    const response = await api.get(`/controle/total-por-pessoa?${params.toString()}`)
    return response.data
  },


  getEvolucaoFinanceira: async (mes?: string, ano?: string, pessoa?: string): Promise<EvolucaoFinanceira[]> => {
    const params = new URLSearchParams()
    if (mes) params.append('mes', mes)
    if (ano) params.append('ano', ano)
    if (pessoa) params.append('pessoa', pessoa)
    
    const response = await api.get(`/controle/evolucao-financeira?${params.toString()}`)
    return response.data
  },

  getEvolucaoReceitas: async (periodo: string): Promise<{mes: string, receitas: number}[]> => {
    const response = await api.get(`/controle/evolucao-receitas?periodo=${periodo}`)
    return response.data
  },


  getReceitasDespesas: async (mes?: string, ano?: string, pessoa?: string): Promise<ReceitasDespesas> => {
    const params = new URLSearchParams()
    if (mes) params.append('mes', mes)
    if (ano) params.append('ano', ano)
    if (pessoa) params.append('pessoa', pessoa)
    
    const response = await api.get(`/controle/receitas-despesas?${params.toString()}`)
    return response.data
  },
}

export const analiseService = {

  getAtivos: async (tipo: string, filtros: FiltrosAnalise): Promise<AtivoAnalise[]> => {
    const response = await api.post('/analise/ativos', { tipo, filtros })
    return response.data
  },

  getResumo: async (): Promise<ResumoAnalise> => {
    const response = await api.get('/analise/resumo')
    return response.data
  },
}

export const listasService = {
  getTickersPorTipo: async (tipo: string): Promise<{ tipo?: string; tickers?: string[]; acoes?: string[]; fiis?: string[]; bdrs?: string[] }> => {
    const response = await api.get(`/listas/ativos?tipo=${encodeURIComponent(tipo)}`)
    return response.data
  }
}

export const rfCatalogService = {
  list: async (): Promise<{ items: Array<any> }> => {
    const resp = await api.get('/rf/catalog')
    return resp.data
  },
  create: async (item: any): Promise<any> => {
    const resp = await api.post('/rf/catalog', item)
    return resp.data
  },
  update: async (item: any): Promise<any> => {
    const resp = await api.put('/rf/catalog', item)
    return resp.data
  },
  remove: async (id: number): Promise<any> => {
    const resp = await api.delete('/rf/catalog', { data: { id } })
    return resp.data
  },
}

export const homeService = {
  getResumo: async (mes: string, ano: string): Promise<any> => {
    const response = await api.get(`/home/resumo?mes=${mes}&ano=${ano}`)
    return response.data
  },
}

// ==================== SERVIÇOS DE CARTÕES ====================

export const cartaoService = {
  // Cartões Cadastrados
  getCartoesCadastrados: async (): Promise<CartaoCadastrado[]> => {
    const response = await api.get('/controle/cartoes-cadastrados')
    return response.data
  },

  adicionarCartaoCadastrado: async (data: {
    nome: string
    bandeira: string
    limite: number
    vencimento: number
    cor: string
  }): Promise<void> => {
    await api.post('/controle/cartoes-cadastrados', data)
  },

  atualizarCartaoCadastrado: async (data: {
    id: number
    nome?: string
    bandeira?: string
    limite?: number
    vencimento?: number
    cor?: string
    ativo?: boolean
  }): Promise<void> => {
    await api.put('/controle/cartoes-cadastrados', data)
  },

  removerCartaoCadastrado: async (id: number): Promise<void> => {
    await api.delete(`/controle/cartoes-cadastrados?id=${id}`)
  },

  // Compras do Cartão
  getComprasCartao: async (cartaoId: number, mes?: string, ano?: string): Promise<CompraCartao[]> => {
    const params = new URLSearchParams({ cartao_id: cartaoId.toString() })
    if (mes) params.append('mes', mes)
    if (ano) params.append('ano', ano)
    
    const response = await api.get(`/controle/compras-cartao?${params.toString()}`)
    return response.data
  },

  adicionarCompraCartao: async (data: {
    cartao_id: number
    nome: string
    valor: number
    data: string
    categoria?: string
    observacao?: string
  }): Promise<void> => {
    await api.post('/controle/compras-cartao', data)
  },

  atualizarCompraCartao: async (data: {
    id: number
    nome?: string
    valor?: number
    data?: string
    categoria?: string
    observacao?: string
  }): Promise<void> => {
    await api.put('/controle/compras-cartao', data)
  },

  removerCompraCartao: async (id: number): Promise<void> => {
    await api.delete(`/controle/compras-cartao?id=${id}`)
  },

  getTotalComprasCartao: async (cartaoId: number, mes?: string, ano?: string): Promise<number> => {
    const params = new URLSearchParams({ cartao_id: cartaoId.toString() })
    if (mes) params.append('mes', mes)
    if (ano) params.append('ano', ano)
    
    const response = await api.get(`/controle/total-compras-cartao?${params.toString()}`)
    return response.data.total
  },

  marcarCartaoComoPago: async (cartaoId: number, mesPagamento: number, anoPagamento: number): Promise<any> => {
    const response = await api.post('/controle/marcar-cartao-pago', {
      cartao_id: cartaoId,
      mes_pagamento: mesPagamento,
      ano_pagamento: anoPagamento
    })
    return response.data
  },

  desmarcarCartaoComoPago: async (cartaoId: number): Promise<any> => {
    const response = await api.post('/controle/desmarcar-cartao-pago', {
      cartao_id: cartaoId
    })
    return response.data
  },
}

// ==================== SERVIÇOS DE SIMULAÇÃO ====================

export const simuladorService = {
  simularChoques: async (choques: { cdi: number; ipca: number; selic: number }): Promise<any> => {
    const response = await api.post('/simulador/choques', {
      choques_cdi: choques.cdi,
      choques_ipca: choques.ipca,
      choques_selic: choques.selic
    })
    return response.data
  },

  obterCenarios: async (): Promise<any> => {
    const response = await api.get('/simulador/cenarios')
    return response.data
  },

  executarMonteCarlo: async (config: { nSimulacoes: number; periodoAnos: number; confianca: number }): Promise<any> => {
    const response = await api.post('/simulador/monte-carlo', config)
    return response.data
  },
}

export default api 