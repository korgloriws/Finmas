import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  Calendar, 
  TrendingUp, 
  Award,
  Clock,
  BarChart3,
  Target,
  AlertCircle
} from 'lucide-react'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { dividendosService } from '../../services/api'
import { normalizeTicker } from '../../utils/tickerUtils'

interface DetalhesRadarDividendosTabProps {
  ticker: string
  historicoDividendos: Record<string, number> | null
  tipoAtivo?: string
}

interface DividendoItem {
  data: Date
  valor: number
  tipo: 'historico' | 'futuro'
  dataCom?: string
  dataPagamento?: string
  tipoProvento?: string
}

function InfoSection({ 
  title, 
  icon: Icon, 
  children 
}: {
  title: string
  icon: any
  children: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:shadow-lg transition-all duration-300">
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-primary text-primary-foreground shadow-lg">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-foreground">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function DetalhesRadarDividendosTab({
  ticker,
  historicoDividendos,
  tipoAtivo
}: DetalhesRadarDividendosTabProps) {
  const normalizedTicker = normalizeTicker(ticker)
  const tickerSemSufixo = normalizedTicker.replace(/\.(SA|SAO)$/i, '').toUpperCase()
  
  // Buscar agenda de dividendos futuros (próximos 12 meses)
  const { data: agendaFutura, isLoading: loadingAgenda } = useQuery({
    queryKey: ['agenda-dividendos-radar', ticker],
    queryFn: async () => {
      const hoje = new Date()
      const resultados: any[] = []
      
      // Buscar próximos 12 meses
      for (let i = 0; i < 12; i++) {
        const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)
        const mes = data.getMonth() + 1
        const ano = data.getFullYear()
        
        try {
          const agenda = await dividendosService.getAgenda(mes, ano, ['acoes', 'fiis', 'bdrs'])
          
          // Filtrar por ticker
          const todosDividendos = [
            ...(agenda.acoes?.dividendos || []),
            ...(agenda.fiis?.dividendos || []),
            ...(agenda.bdrs?.dividendos || [])
          ]
          
          const dividendosFiltrados = todosDividendos.filter(d => {
            const tickerDividendo = d.ticker.replace(/\.(SA|SAO)$/i, '').toUpperCase()
            return tickerDividendo === tickerSemSufixo
          })
          
          resultados.push(...dividendosFiltrados)
        } catch (error) {
          console.error(`Erro ao buscar agenda para ${mes}/${ano}:`, error)
        }
      }
      
      return resultados
    },
    enabled: !!ticker,
    staleTime: 30 * 60 * 1000, // 30 minutos
  })

  // Combinar histórico e futuro
  const dividendosConsolidados = useMemo<DividendoItem[]>(() => {
    const items: DividendoItem[] = []
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    // Adicionar histórico
    if (historicoDividendos) {
      Object.entries(historicoDividendos).forEach(([dataStr, valor]) => {
        const data = new Date(dataStr)
        data.setHours(0, 0, 0, 0)
        
        if (data <= hoje) {
          items.push({
            data,
            valor,
            tipo: 'historico'
          })
        }
      })
    }

    // Adicionar futuros
    if (agendaFutura) {
      agendaFutura.forEach((d: any) => {
        try {
          const dataPagamento = new Date(d.data_pagamento)
          dataPagamento.setHours(0, 0, 0, 0)
          
          if (dataPagamento > hoje) {
            items.push({
              data: dataPagamento,
              valor: d.valor,
              tipo: 'futuro',
              dataCom: d.data_com,
              dataPagamento: d.data_pagamento,
              tipoProvento: d.tipo_provento
            })
          }
        } catch (error) {
          console.error('Erro ao processar dividendo futuro:', error)
        }
      })
    }

    // Ordenar por data
    return items.sort((a, b) => a.data.getTime() - b.data.getTime())
  }, [historicoDividendos, agendaFutura])

  // Análise de padrões de meses
  const padraoMeses = useMemo(() => {
    const mesesCount: Record<number, { count: number; valores: number[] }> = {}
    
    // Inicializar todos os meses
    for (let i = 0; i < 12; i++) {
      mesesCount[i] = { count: 0, valores: [] }
    }

    // Analisar histórico (últimos 5 anos)
    const cincoAnosAtras = new Date()
    cincoAnosAtras.setFullYear(cincoAnosAtras.getFullYear() - 5)

    if (historicoDividendos) {
      Object.entries(historicoDividendos).forEach(([dataStr, valor]) => {
        const data = new Date(dataStr)
        if (data >= cincoAnosAtras) {
          const mes = data.getMonth()
          mesesCount[mes].count++
          mesesCount[mes].valores.push(valor)
        }
      })
    }

    // Calcular estatísticas por mês
    const mesesComEstatisticas = Object.entries(mesesCount).map(([mes, dados]) => {
      const mesNum = parseInt(mes)
      const media = dados.valores.length > 0 
        ? dados.valores.reduce((a, b) => a + b, 0) / dados.valores.length 
        : 0
      
      return {
        mes: mesNum,
        nomeMes: new Date(2000, mesNum, 1).toLocaleDateString('pt-BR', { month: 'long' }),
        count: dados.count,
        media,
        frequencia: dados.count / 5, // Frequência nos últimos 5 anos
        valores: dados.valores
      }
    }).filter(m => m.count > 0)
      .sort((a, b) => b.count - a.count)

    return mesesComEstatisticas
  }, [historicoDividendos])

  // Estatísticas gerais
  const estatisticas = useMemo(() => {
    const historicos = dividendosConsolidados.filter(d => d.tipo === 'historico')
    const futuros = dividendosConsolidados.filter(d => d.tipo === 'futuro')
    
    const valoresHistoricos = historicos.map(d => d.valor)
    const valoresFuturos = futuros.map(d => d.valor)

    return {
      totalHistoricos: historicos.length,
      totalFuturos: futuros.length,
      totalGeral: dividendosConsolidados.length,
      somaHistoricos: valoresHistoricos.reduce((a, b) => a + b, 0),
      somaFuturos: valoresFuturos.reduce((a, b) => a + b, 0),
      mediaHistorica: valoresHistoricos.length > 0 
        ? valoresHistoricos.reduce((a, b) => a + b, 0) / valoresHistoricos.length 
        : 0,
      mediaFutura: valoresFuturos.length > 0
        ? valoresFuturos.reduce((a, b) => a + b, 0) / valoresFuturos.length
        : 0,
      maiorHistorico: valoresHistoricos.length > 0 ? Math.max(...valoresHistoricos) : 0,
      menorHistorico: valoresHistoricos.length > 0 ? Math.min(...valoresHistoricos) : 0,
      proximoDividendo: futuros.length > 0 ? futuros[0] : null,
      ultimoDividendo: historicos.length > 0 ? historicos[historicos.length - 1] : null
    }
  }, [dividendosConsolidados])

  return (
    <motion.div
      key="radar-dividendos"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Estatísticas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <InfoSection title="Total Histórico" icon={BarChart3}>
          <div className="text-center">
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              {estatisticas.totalHistoricos}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Dividendos pagos
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(estatisticas.somaHistoricos)} total
            </p>
          </div>
        </InfoSection>

        <InfoSection title="Próximos Dividendos" icon={Clock}>
          <div className="text-center">
            <p className="text-xl sm:text-2xl font-bold text-primary">
              {estatisticas.totalFuturos}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Dividendos futuros
            </p>
            {estatisticas.proximoDividendo && (
              <p className="text-xs text-primary mt-1 font-medium">
                Próximo: {formatDate(estatisticas.proximoDividendo.data.toISOString())}
              </p>
            )}
          </div>
        </InfoSection>

        <InfoSection title="Média Histórica" icon={TrendingUp}>
          <div className="text-center">
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              {formatCurrency(estatisticas.mediaHistorica)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Por dividendo
            </p>
            {estatisticas.mediaFutura > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Média futura: {formatCurrency(estatisticas.mediaFutura)}
              </p>
            )}
          </div>
        </InfoSection>

        <InfoSection title="Último Dividendo" icon={Award}>
          <div className="text-center">
            {estatisticas.ultimoDividendo ? (
              <>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {formatCurrency(estatisticas.ultimoDividendo.valor)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDate(estatisticas.ultimoDividendo.data.toISOString())}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">N/A</p>
            )}
          </div>
        </InfoSection>
      </div>

      {/* Padrão de Meses */}
      {padraoMeses.length > 0 && (
        <InfoSection title="Padrão de Pagamento (Últimos 5 Anos)" icon={Target}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Análise dos meses em que a empresa normalmente paga dividendos:
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {padraoMeses.map((mes) => (
                <motion.div
                  key={mes.mes}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: mes.mes * 0.05 }}
                  className="bg-muted/30 rounded-lg p-3 border border-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-foreground capitalize">
                      {mes.nomeMes}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {mes.count}x
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Frequência:</span>
                      <span className="font-medium text-foreground">
                        {(mes.frequencia * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Média:</span>
                      <span className="font-medium text-primary">
                        {formatCurrency(mes.media)}
                      </span>
                    </div>
                  </div>
                  {/* Barra de frequência visual */}
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${mes.frequencia * 100}%` }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            {padraoMeses.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Dados insuficientes para análise de padrão</p>
              </div>
            )}
          </div>
        </InfoSection>
      )}

      {/* Timeline Consolidada */}
      <InfoSection title="Timeline de Dividendos (Histórico + Futuro)" icon={Calendar}>
        {loadingAgenda ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Carregando agenda futura...</p>
          </div>
        ) : dividendosConsolidados.length > 0 ? (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Data</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Valor</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Status</th>
                    {tipoAtivo === 'FII' && (
                      <th className="px-4 py-3 text-left font-medium text-foreground">Tipo Provento</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {dividendosConsolidados.map((item, index) => {
                    const hoje = new Date()
                    hoje.setHours(0, 0, 0, 0)
                    const isFuturo = item.data > hoje
                    const isPassado = item.data < hoje
                    
                    return (
                      <motion.tr
                        key={`${item.data.toISOString()}-${index}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`${
                          index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                        } hover:bg-muted/40 transition-colors ${
                          isFuturo ? 'border-l-4 border-l-primary' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">
                          {formatDate(item.data.toISOString())}
                        </td>
                        <td className="px-4 py-3 font-semibold text-primary">
                          {formatCurrency(item.valor)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            item.tipo === 'historico'
                              ? 'bg-green-500/20 text-green-600'
                              : 'bg-blue-500/20 text-blue-600'
                          }`}>
                            {item.tipo === 'historico' ? 'Histórico' : 'Futuro'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            isFuturo
                              ? 'bg-primary/20 text-primary'
                              : isPassado
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-yellow-500/20 text-yellow-600'
                          }`}>
                            {isFuturo ? 'Futuro' : isPassado ? 'Pago' : 'Hoje'}
                          </span>
                        </td>
                        {tipoAtivo === 'FII' && (
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {item.tipoProvento || '-'}
                          </td>
                        )}
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum dividendo encontrado (histórico ou futuro)</p>
          </div>
        )}
      </InfoSection>

      {/* Informação sobre análise */}
      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Sobre o Radar de Dividendos</p>
            <p>
              Esta análise combina o histórico de dividendos  com a agenda futura  
              para fornecer uma visão completa. O padrão de meses é calculado com base nos últimos 5 anos de histórico, 
              permitindo identificar quais meses a empresa normalmente paga dividendos.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

