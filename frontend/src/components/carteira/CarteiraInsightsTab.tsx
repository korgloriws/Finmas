import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  BarChart3, 
  Target, 
  TrendingUp, 
  Activity, 
  Brain,
  Network,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'
import { formatCurrency, formatPercentage } from '../../utils/formatters'
import { getDisplayTicker } from '../../utils/tickerUtils'
import { ativoService } from '../../services/api'

interface CarteiraInsightsTabProps {
  carteira: any[]
  loadingInsights: boolean
  insights: any
}

export default function CarteiraInsightsTab({
  carteira,
  loadingInsights,
  insights
}: CarteiraInsightsTabProps) {
  const [periodoCorrelacao, setPeriodoCorrelacao] = useState<'6mo' | '1y' | '2y'>('1y')

  // Buscar histórico de preços para todos os ativos da carteira
  const tickersUnicos = useMemo(() => {
    return [...new Set(carteira.map(a => a.ticker).filter(Boolean))]
  }, [carteira])

  // Buscar histórico de cada ativo
  const historicosQueries = useQuery({
    queryKey: ['correlacao-historicos', tickersUnicos, periodoCorrelacao],
    queryFn: async () => {
      const resultados: Record<string, Array<Record<string, any>>> = {}
      
      // Buscar histórico de cada ticker em paralelo
      const promessas = tickersUnicos.map(async (ticker) => {
        try {
          const historico = await ativoService.getHistorico(ticker, periodoCorrelacao)
          return { ticker, historico }
        } catch (error) {
          console.error(`Erro ao buscar histórico de ${ticker}:`, error)
          return { ticker, historico: [] }
        }
      })
      
      const resultadosArray = await Promise.all(promessas)
      resultadosArray.forEach(({ ticker, historico }) => {
        resultados[ticker] = historico
      })
      
      return resultados
    },
    enabled: tickersUnicos.length > 0,
    staleTime: 30 * 60 * 1000, // 30 minutos
    refetchOnWindowFocus: false,
  })

  // Calcular correlações entre ativos
  const analiseCorrelacao = useMemo(() => {
    if (!historicosQueries.data || tickersUnicos.length < 2) {
      return null
    }

    const historicos = historicosQueries.data
    
    // Preparar dados: criar série de retornos diários para cada ativo
    const retornosPorTicker: Record<string, number[]> = {}
    
    // Encontrar datas comuns a todos os ativos
    const todasDatas = new Set<string>()
    Object.values(historicos).forEach(hist => {
      hist.forEach(item => {
        if (item.Date) {
          const data = new Date(item.Date).toISOString().split('T')[0]
          todasDatas.add(data)
        }
      })
    })
    
    // Ordenar datas
    const datasOrdenadas = Array.from(todasDatas).sort()
    
    // Calcular retornos diários para cada ativo
    tickersUnicos.forEach(ticker => {
      const hist = historicos[ticker] || []
      if (hist.length === 0) return
      
      // Criar mapa de preços por data
      const precosPorData: Record<string, number> = {}
      hist.forEach(item => {
        if (item.Date && item.Close) {
          const data = new Date(item.Date).toISOString().split('T')[0]
          precosPorData[data] = parseFloat(item.Close) || 0
        }
      })
      
      // Calcular retornos diários
      const retornos: number[] = []
      for (let i = 1; i < datasOrdenadas.length; i++) {
        const dataAtual = datasOrdenadas[i]
        const dataAnterior = datasOrdenadas[i - 1]
        const precoAtual = precosPorData[dataAtual]
        const precoAnterior = precosPorData[dataAnterior]
        
        if (precoAtual && precoAnterior && precoAnterior > 0) {
          const retorno = (precoAtual - precoAnterior) / precoAnterior
          retornos.push(retorno)
        } else {
          retornos.push(NaN)
        }
      }
      
      retornosPorTicker[ticker] = retornos
    })
    
    // Calcular correlação de Pearson entre todos os pares
    const correlacoes: Array<{
      ticker1: string
      ticker2: string
      correlacao: number
    }> = []
    
    const calcularCorrelacao = (arr1: number[], arr2: number[]): number => {
      // Filtrar apenas valores válidos (não NaN) onde ambos têm dados
      const paresValidos: Array<[number, number]> = []
      for (let i = 0; i < Math.min(arr1.length, arr2.length); i++) {
        if (!isNaN(arr1[i]) && !isNaN(arr2[i])) {
          paresValidos.push([arr1[i], arr2[i]])
        }
      }
      
      if (paresValidos.length < 10) return NaN // Mínimo de 10 pontos para calcular
      
      const valores1 = paresValidos.map(p => p[0])
      const valores2 = paresValidos.map(p => p[1])
      
      const media1 = valores1.reduce((a, b) => a + b, 0) / valores1.length
      const media2 = valores2.reduce((a, b) => a + b, 0) / valores2.length
      
      let numerador = 0
      let somaQuadrados1 = 0
      let somaQuadrados2 = 0
      
      for (let i = 0; i < valores1.length; i++) {
        const diff1 = valores1[i] - media1
        const diff2 = valores2[i] - media2
        numerador += diff1 * diff2
        somaQuadrados1 += diff1 * diff1
        somaQuadrados2 += diff2 * diff2
      }
      
      const denominador = Math.sqrt(somaQuadrados1 * somaQuadrados2)
      if (denominador === 0) return NaN
      
      return numerador / denominador
    }
    
    // Calcular correlação para todos os pares
    for (let i = 0; i < tickersUnicos.length; i++) {
      for (let j = i + 1; j < tickersUnicos.length; j++) {
        const ticker1 = tickersUnicos[i]
        const ticker2 = tickersUnicos[j]
        const retornos1 = retornosPorTicker[ticker1] || []
        const retornos2 = retornosPorTicker[ticker2] || []
        
        const correlacao = calcularCorrelacao(retornos1, retornos2)
        
        if (!isNaN(correlacao)) {
          correlacoes.push({
            ticker1,
            ticker2,
            correlacao
          })
        }
      }
    }
    
    // Ordenar correlações
    const correlacoesOrdenadas = [...correlacoes].sort((a, b) => b.correlacao - a.correlacao)
    
    // Calcular correlação média
    const correlacaoMedia = correlacoes.length > 0
      ? correlacoes.reduce((sum, c) => sum + c.correlacao, 0) / correlacoes.length
      : 0
    
    // Top 5 mais correlacionados
    const topMaisCorrelacionados = correlacoesOrdenadas.slice(0, 5)
    
    // Top 5 menos correlacionados (ou negativos)
    const topMenosCorrelacionados = [...correlacoesOrdenadas].reverse().slice(0, 5)
    
    // Contar ativos com alta correlação (> 0.7)
    const altaCorrelacao = correlacoes.filter(c => c.correlacao > 0.7).length
    const percentualAltaCorrelacao = correlacoes.length > 0
      ? (altaCorrelacao / correlacoes.length) * 100
      : 0
    
    return {
      correlacaoMedia,
      totalPares: correlacoes.length,
      topMaisCorrelacionados,
      topMenosCorrelacionados,
      altaCorrelacao,
      percentualAltaCorrelacao,
      matriz: correlacoes
    }
  }, [historicosQueries.data, tickersUnicos])

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">Insights</h2>
      
      {carteira && carteira.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Insights Principais */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                  <h3 className="text-lg font-semibold text-blue-800">Resumo</h3>
                </div>
                {loadingInsights ? (
                  <div className="text-blue-700">Calculando…</div>
                ) : insights ? (
                  <div className="text-blue-700 space-y-1 text-sm">
                    <div>Total investido: <strong>{formatCurrency(insights.resumo?.total_investido || 0)}</strong></div>
                    <div>Nº ativos: <strong>{insights.resumo?.num_ativos || 0}</strong></div>
                    <div>DY médio (pond.): <strong>{insights.resumo?.weighted_dy_pct != null ? formatPercentage(insights.resumo.weighted_dy_pct) : (insights.resumo?.weighted_dy != null ? formatPercentage((insights.resumo.weighted_dy || 0) * 100) : 'N/A')}</strong></div>
                    <div>PL médio: <strong>{insights.resumo?.avg_pl?.toFixed?.(2) ?? 'N/A'}</strong></div>
                    <div>P/VP médio: <strong>{insights.resumo?.avg_pvp?.toFixed?.(2) ?? 'N/A'}</strong></div>
                    <div>ROE médio: <strong>{insights.resumo?.avg_roe != null ? formatPercentage((insights.resumo.avg_roe || 0) * 100) : 'N/A'}</strong></div>
                  </div>
                ) : null}
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Target className="w-6 h-6 text-purple-600" />
                  <h3 className="text-lg font-semibold text-purple-800">Concentração</h3>
                </div>
                {loadingInsights ? (
                  <div className="text-purple-700">Calculando…</div>
                ) : insights ? (
                  <div className="text-purple-700 text-sm space-y-1">
                    {(insights.concentracao?.top_positions || []).map((p: any) => (
                      <div key={p.ticker} className="flex justify-between">
                        <span>{p.ticker}</span>
                        <span>{formatCurrency(p.valor_total)} • {((p.percentual || 0).toFixed?.(1) || '0.0')}%</span>
                      </div>
                    ))}
                    {(insights.concentracao?.alerts || []).length > 0 && (
                      <div className="text-xs text-red-600 mt-2">Alerta: posições acima de 25% detectadas.</div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                  <h3 className="text-lg font-semibold text-green-800">Renda (DY)</h3>
                </div>
                {loadingInsights ? (
                  <div className="text-green-700">Calculando…</div>
                ) : insights ? (
                  <div className="text-green-700 text-sm space-y-1">
                    <div>DY ponderado: <strong>{insights.renda?.weighted_dy_pct != null ? formatPercentage(insights.renda.weighted_dy_pct) : (insights.renda?.weighted_dy != null ? formatPercentage((insights.renda.weighted_dy || 0) * 100) : 'N/A')}</strong></div>
                    <div className="mt-2 font-medium">Top DY</div>
                    {(insights.renda?.top_dy || []).map((a: any) => (
                      <div key={a.ticker} className="flex justify-between">
                        <span>{a.ticker}</span>
                        <span>{formatPercentage(a.dy_pct ?? ((a.dy || 0) * 100))} • {((a.percentual_carteira || 0).toFixed?.(1) || '0.0')}%</span>
                      </div>
                    ))}
                    <div className="text-xs mt-2">Ativos sem DY: {insights.renda?.ativos_sem_dy || 0}</div>
                  </div>
                ) : null}
              </div>

              <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Activity className="w-6 h-6 text-orange-600" />
                  <h3 className="text-lg font-semibold text-orange-800">Avaliação</h3>
                </div>
                {loadingInsights ? (
                  <div className="text-orange-700">Calculando…</div>
                ) : insights ? (
                  <div className="text-orange-700 text-sm space-y-1">
                    <div>
                      PL alto (&gt;25): <strong>{insights.avaliacao?.pl?.high_count || 0}</strong> • PL baixo (&le;10): <strong>{insights.avaliacao?.pl?.low_count || 0}</strong>
                    </div>
                    <div>
                      Undervalued (P/VP &le; 1): <strong>{insights.avaliacao?.pvp?.undervalued_count || 0}</strong> • Overpriced (P/VP &ge; 3): <strong>{insights.avaliacao?.pvp?.overpriced_count || 0}</strong>
                    </div>
                    <div>
                      ROE médio: <strong>{insights.resumo?.avg_roe != null ? formatPercentage((insights.resumo.avg_roe || 0) * 100) : 'N/A'}</strong> • ROE negativo: <strong>{insights.avaliacao?.roe?.negative_count || 0}</strong>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Análise de Correlação */}
          {tickersUnicos.length >= 2 && (
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/20">
                      <Network className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl font-semibold text-foreground">Análise de Correlação</h3>
                      <p className="text-xs text-muted-foreground">Correlação entre movimentos de preços dos ativos</p>
                    </div>
                  </div>
                  <select
                    value={periodoCorrelacao}
                    onChange={(e) => setPeriodoCorrelacao(e.target.value as '6mo' | '1y' | '2y')}
                    className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                    aria-label="Selecionar período para análise de correlação"
                  >
                    <option value="6mo">Últimos 6 meses</option>
                    <option value="1y">Último ano</option>
                    <option value="2y">Últimos 2 anos</option>
                  </select>
                </div>

                {historicosQueries.isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="animate-pulse">Calculando correlações...</div>
                  </div>
                ) : analiseCorrelacao ? (
                  <div className="space-y-6">
                    {/* Resumo da Correlação */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-muted/50 rounded-lg p-4 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Correlação Média</div>
                        <div className={`text-2xl font-bold ${
                          analiseCorrelacao.correlacaoMedia > 0.7 ? 'text-orange-600' :
                          analiseCorrelacao.correlacaoMedia > 0.4 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {analiseCorrelacao.correlacaoMedia.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {analiseCorrelacao.correlacaoMedia > 0.7 ? 'Alta correlação' :
                           analiseCorrelacao.correlacaoMedia > 0.4 ? 'Correlação moderada' :
                           'Baixa correlação'}
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-4 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Pares Analisados</div>
                        <div className="text-2xl font-bold text-foreground">
                          {analiseCorrelacao.totalPares}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {tickersUnicos.length} ativos na carteira
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-4 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Alta Correlação (&gt;0.7)</div>
                        <div className={`text-2xl font-bold ${
                          analiseCorrelacao.percentualAltaCorrelacao > 50 ? 'text-red-600' :
                          analiseCorrelacao.percentualAltaCorrelacao > 30 ? 'text-orange-600' :
                          'text-green-600'
                        }`}>
                          {analiseCorrelacao.percentualAltaCorrelacao.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {analiseCorrelacao.altaCorrelacao} de {analiseCorrelacao.totalPares} pares
                        </div>
                      </div>
                    </div>

                    {/* Top Pares Mais Correlacionados */}
                    {analiseCorrelacao.topMaisCorrelacionados.length > 0 && (
                      <div className="bg-muted/30 rounded-lg p-4 border border-border">
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          Top 5 Pares Mais Correlacionados
                        </h4>
                        <div className="space-y-2">
                          {analiseCorrelacao.topMaisCorrelacionados.map((par, index) => (
                            <div key={`${par.ticker1}-${par.ticker2}`} className="flex items-center justify-between p-2 bg-background rounded">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                                <span className="text-sm font-medium text-foreground">
                                  {getDisplayTicker(par.ticker1)} × {getDisplayTicker(par.ticker2)}
                                </span>
                              </div>
                              <div className={`text-sm font-semibold ${
                                par.correlacao > 0.8 ? 'text-red-600' :
                                par.correlacao > 0.7 ? 'text-orange-600' :
                                'text-foreground'
                              }`}>
                                {par.correlacao.toFixed(3)}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-3">
                          Valores próximos de 1.0 indicam que os ativos se movem juntos (risco de concentração)
                        </div>
                      </div>
                    )}

                    {/* Top Pares Menos Correlacionados */}
                    {analiseCorrelacao.topMenosCorrelacionados.length > 0 && (
                      <div className="bg-muted/30 rounded-lg p-4 border border-border">
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Top 5 Pares Menos Correlacionados
                        </h4>
                        <div className="space-y-2">
                          {analiseCorrelacao.topMenosCorrelacionados.map((par, index) => (
                            <div key={`${par.ticker1}-${par.ticker2}`} className="flex items-center justify-between p-2 bg-background rounded">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                                <span className="text-sm font-medium text-foreground">
                                  {getDisplayTicker(par.ticker1)} × {getDisplayTicker(par.ticker2)}
                                </span>
                              </div>
                              <div className={`text-sm font-semibold ${
                                par.correlacao < 0 ? 'text-blue-600' :
                                par.correlacao < 0.3 ? 'text-green-600' :
                                'text-foreground'
                              }`}>
                                {par.correlacao.toFixed(3)}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-3">
                          Valores baixos ou negativos indicam boa diversificação (redução de risco)
                        </div>
                      </div>
                    )}

                    {/* Insights Automáticos */}
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-foreground mb-3">Insights de Diversificação</h4>
                      <div className="space-y-2 text-sm">
                        {analiseCorrelacao.percentualAltaCorrelacao > 50 ? (
                          <div className="flex items-start gap-2 text-red-700 dark:text-red-400">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>
                              <strong>Atenção:</strong> {analiseCorrelacao.percentualAltaCorrelacao.toFixed(1)}% dos seus ativos têm alta correlação (&gt;0.7). 
                              Isso indica risco de concentração - considere adicionar ativos de setores diferentes.
                            </p>
                          </div>
                        ) : analiseCorrelacao.percentualAltaCorrelacao > 30 ? (
                          <div className="flex items-start gap-2 text-orange-700 dark:text-orange-400">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>
                              <strong>Moderado:</strong> {analiseCorrelacao.percentualAltaCorrelacao.toFixed(1)}% dos seus ativos têm alta correlação. 
                              Considere diversificar mais para reduzir o risco.
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 text-green-700 dark:text-green-400">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>
                              <strong>Bom:</strong> Sua carteira tem baixa correlação média ({analiseCorrelacao.correlacaoMedia.toFixed(2)}), 
                              indicando boa diversificação e redução de risco.
                            </p>
                          </div>
                        )}
                        
                        {analiseCorrelacao.topMaisCorrelacionados.length > 0 && (
                          <div className="text-muted-foreground mt-2">
                            <p>
                              Os ativos {getDisplayTicker(analiseCorrelacao.topMaisCorrelacionados[0].ticker1)} e{' '}
                              {getDisplayTicker(analiseCorrelacao.topMaisCorrelacionados[0].ticker2)} têm a maior correlação{' '}
                              ({analiseCorrelacao.topMaisCorrelacionados[0].correlacao.toFixed(2)}), 
                              movendo-se praticamente juntos.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Dados insuficientes para calcular correlações.</p>
                    <p className="text-xs mt-1">É necessário histórico de pelo menos 2 ativos.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Insights Secundários */}
          <div className="bg-muted/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-500" />
              Recomendações
            </h3>
            {loadingInsights ? (
              <div className="text-sm text-muted-foreground">Calculando…</div>
            ) : insights ? (
              <div className="space-y-3">
                {insights.avaliacao?.pvp?.undervalued_count > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-background rounded">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-muted-foreground">
                      Existem {insights.avaliacao.pvp.undervalued_count} ativos com P/VP ≤ 1, potenciais oportunidades de valor.
                    </p>
                  </div>
                )}
                {insights.avaliacao?.pl?.low_count > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-background rounded">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-muted-foreground">
                      {insights.avaliacao.pl.low_count} ativos com P/L ≤ 10 sugerem múltiplos atrativos.
                    </p>
                  </div>
                )}
                {insights.avaliacao?.roe?.negative_count > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-background rounded">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-muted-foreground">
                      {insights.avaliacao.roe.negative_count} ativos com ROE negativo: avaliação de manutenção/redução recomendada.
                    </p>
                  </div>
                )}
                {(insights.concentracao?.alerts || []).length > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-background rounded">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-muted-foreground">
                      Concentração elevada detectada em {insights.concentracao.alerts.length} posição(ões). Considere rebalanceamento.
                    </p>
                  </div>
                )}
                {analiseCorrelacao && analiseCorrelacao.percentualAltaCorrelacao > 50 && (
                  <div className="flex items-start gap-2 p-3 bg-background rounded">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-muted-foreground">
                      Alta correlação entre ativos detectada ({analiseCorrelacao.percentualAltaCorrelacao.toFixed(1)}%). 
                      Considere diversificar com ativos de setores diferentes para reduzir risco.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="bg-muted/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-500" />
              Alertas
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-background rounded">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-sm text-muted-foreground">
                  {carteira?.filter(ativo => ativo?.pl && ativo.pl > 20).length || 0} ativos com P/L elevado.
                </p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-background rounded">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-sm text-muted-foreground">
                  {carteira?.filter(ativo => ativo?.dy && ativo.dy < 0.02).length || 0} ativos com baixo dividend yield.
                </p>
              </div>
              {analiseCorrelacao && analiseCorrelacao.percentualAltaCorrelacao > 30 && (
                <div className="flex items-start gap-2 p-3 bg-background rounded">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-muted-foreground">
                    Correlação média de {analiseCorrelacao.correlacaoMedia.toFixed(2)} - {analiseCorrelacao.percentualAltaCorrelacao.toFixed(1)}% dos pares têm alta correlação.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-8">
          Adicione ativos à sua carteira para receber insights personalizados.
        </div>
      )}
    </div>
  )
}
