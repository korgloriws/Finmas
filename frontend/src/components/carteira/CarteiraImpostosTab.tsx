import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatCurrency } from '../../utils/formatters'
import { 
  Receipt, 
  TrendingUp, 
  DollarSign,
  Calendar,
  Info,
  Download,
  FileText,
  BookOpen,
  AlertCircle,
  Clock,
  AlertTriangle
} from 'lucide-react'
import * as XLSX from 'xlsx'
import TickerWithLogo from '../TickerWithLogo'
import { ativoService } from '../../services/api'

interface CarteiraImpostosTabProps {
  carteira: any[]
  movimentacoes: any[]
  proventosRecebidos: any[]
  loadingMovimentacoes: boolean
  loadingProventos: boolean
}

export default function CarteiraImpostosTab({
  carteira,
  movimentacoes,
  proventosRecebidos,
  loadingMovimentacoes,
  loadingProventos
}: CarteiraImpostosTabProps) {
  const [filtroPeriodo, setFiltroPeriodo] = useState<'mes' | 'trimestre' | 'ano' | 'total'>('ano')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'vendas' | 'proventos'>('todos')

  // Função auxiliar: Calcular preço médio de compra usando movimentações (FIFO)
  const calcularPrecoMedio = useMemo(() => {
    return (ticker: string, dataVenda: string, movimentacoes: any[]) => {
      if (!movimentacoes || movimentacoes.length === 0) {
        return null
      }
      
      // Normalizar ticker para comparação (case-insensitive, remover espaços)
      const tickerNormalizado = (ticker || '').toUpperCase().trim()
      
      const movsDoTicker = movimentacoes
        .filter(m => {
          const mTicker = (m.ticker || '').toUpperCase().trim()
          return mTicker === tickerNormalizado && m.data <= dataVenda
        })
        .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

      if (movsDoTicker.length === 0) {
        return null
      }

      type Lot = { qty: number; price: number; date: string }
      const lots: Lot[] = []
      
      for (const m of movsDoTicker) {
        const qty = Number(m.quantidade || 0)
        const price = Number(m.preco || 0)
        const tipo = (m.tipo || '').toLowerCase().trim()
        
        // Validar valores antes de processar
        if (qty <= 0 || price <= 0 || isNaN(qty) || isNaN(price)) {
          continue
        }
        
        if (tipo === 'compra') {
          lots.push({ qty, price, date: m.data })
        } else if (tipo === 'venda') {
          let remaining = qty
          while (remaining > 0 && lots.length > 0) {
            const lot = lots[0]
            const consume = Math.min(lot.qty, remaining)
            lot.qty -= consume
            remaining -= consume
            if (lot.qty <= 0) lots.shift()
          }
        }
      }
      
      // Se não há lots restantes após processar todas as vendas, não há preço médio válido
      if (lots.length === 0) {
        return null
      }
      
      const totalQtd = lots.reduce((s, l) => s + l.qty, 0)
      const totalValor = lots.reduce((s, l) => s + l.qty * l.price, 0)
      
      if (totalQtd <= 0 || totalValor <= 0 || isNaN(totalQtd) || isNaN(totalValor)) {
        return null
      }
      
      const precoMedio = totalValor / totalQtd
      return isNaN(precoMedio) || precoMedio <= 0 ? null : precoMedio
    }
  }, [])

  // Função auxiliar: Detectar day trade (compra e venda no mesmo dia)
  const isDayTrade = (ticker: string, dataVenda: string, movimentacoes: any[]) => {
    const dataVendaObj = new Date(dataVenda)
    const dataVendaStr = dataVendaObj.toISOString().split('T')[0]
    
    // Verificar se houve compra no mesmo dia
    const compraNoMesmoDia = movimentacoes.some(m => 
      m.ticker === ticker && 
      m.tipo === 'compra' &&
      new Date(m.data).toISOString().split('T')[0] === dataVendaStr
    )
    
    return compraNoMesmoDia
  }

  // Função auxiliar: Calcular alíquota progressiva para criptomoedas
  const calcularAliquotaCripto = (lucro: number) => {
    if (lucro <= 0) return 0
    
    // Tabela progressiva de criptomoedas
    if (lucro <= 5000) return 0.15      // 15% até R$ 5.000
    if (lucro <= 10000) return 0.175    // 17,5% até R$ 10.000
    if (lucro <= 15000) return 0.20     // 20% até R$ 15.000
    return 0.225                         // 22,5% acima de R$ 15.000
  }

  // Função auxiliar: Calcular alíquota progressiva para BDR (dividendos)
  const calcularAliquotaBDRDividendos = (valorBruto: number) => {
    if (valorBruto <= 0) return 0
    
    // Tabela progressiva do IR para BDR dividendos
    if (valorBruto <= 22847.76) return 0.075      // 7,5%
    if (valorBruto <= 33919.80) return 0.15       // 15%
    if (valorBruto <= 45012.60) return 0.225      // 22,5%
    return 0.275                                   // 27,5%
  }

  // Função auxiliar: Identificar se é renda fixa baseado no tipo ou indexador
  const isRendaFixa = (tipo: string, indexador?: string | null) => {
    if (!tipo && !indexador) return false
    
    const tipoLower = (tipo || '').toLowerCase()
    const indexadorUpper = (indexador || '').toUpperCase()
    
    // Verificar pelo tipo
    const tiposRendaFixa = [
      'renda fixa',
      'renda fixa pública',
      'tesouro',
      'cdb',
      'lci',
      'lca',
      'debênture',
      'debenture',
      'cri',
      'cra'
    ]
    
    if (tiposRendaFixa.some(t => tipoLower.includes(t))) {
      return true
    }
    
    // Verificar pelo indexador (CDI, IPCA, SELIC, PREFIXADO)
    const indexadoresRendaFixa = ['CDI', 'IPCA', 'SELIC', 'PREFIXADO', 'CDI+', 'IPCA+']
    if (indexadoresRendaFixa.includes(indexadorUpper)) {
      return true
    }
    
    return false
  }

  // Função auxiliar: Calcular alíquota progressiva de renda fixa baseada no prazo
  const calcularAliquotaRendaFixa = (dataCompra: string, dataVenda: string) => {
    try {
      const compra = new Date(dataCompra)
      const venda = new Date(dataVenda)
      const dias = Math.floor((venda.getTime() - compra.getTime()) / (1000 * 60 * 60 * 24))
      
      // Tabela progressiva do IR para renda fixa (baseada no prazo)
      if (dias <= 180) return 0.225      // 22,5% (até 180 dias)
      if (dias <= 360) return 0.20       // 20% (de 181 a 360 dias)
      if (dias <= 720) return 0.175      // 17,5% (de 361 a 720 dias)
      return 0.15                        // 15% (acima de 720 dias)
    } catch (error) {
      // Se houver erro no cálculo, usar alíquota padrão de 15%
      return 0.15
    }
  }

  // Filtrar movimentações de venda
  const vendas = useMemo(() => {
    if (!movimentacoes) return []
    return movimentacoes.filter(m => m.tipo === 'venda')
  }, [movimentacoes])

  // Buscar tipos de ativos que estão como "Desconhecido" via API
  const tickersDesconhecidos = useMemo(() => {
    if (!vendas || vendas.length === 0) return []
    
    const tickersUnicos = [...new Set(vendas.map(v => v.ticker).filter(Boolean))]
    const tickersParaBuscar: string[] = []
    
    tickersUnicos.forEach(ticker => {
      const ativo = carteira?.find(a => a.ticker === ticker)
      const tipo = ativo?.tipo || 'Desconhecido'
      if (tipo === 'Desconhecido') {
        tickersParaBuscar.push(ticker)
      }
    })
    
    return tickersParaBuscar
  }, [vendas, carteira])

  // Buscar detalhes dos ativos com tipo desconhecido
  const tiposAtivos = useQuery({
    queryKey: ['tipos-ativos-impostos', tickersDesconhecidos],
    queryFn: async () => {
      const tiposMap: Record<string, string> = {}
      
      // Buscar tipos em paralelo
      const promessas = tickersDesconhecidos.map(async (ticker) => {
        try {
          const detalhes = await ativoService.getDetalhes(ticker)
          // A API retorna { info: {...}, historico: [...], ... }
          // O tipo precisa ser inferido do quoteType no info
          if (detalhes && detalhes.info) {
            const quoteType = detalhes.info.quoteType
            let tipo: string | undefined
            
            // Mapear quoteType para tipo (mesma lógica do backend)
            if (quoteType === 'EQUITY') {
              tipo = 'Ação'
            } else if (quoteType === 'ETF') {
              // Verificar se é FII (termina com 11) ou ETF
              const tickerUpper = ticker.toUpperCase()
              if (tickerUpper.endsWith('11') || tickerUpper.endsWith('11.SA')) {
                tipo = 'FII'
              } else {
                tipo = 'ETF'
              }
            } else if (quoteType === 'CRYPTOCURRENCY' || quoteType === 'CURRENCY') {
              tipo = 'Criptomoeda'
            }
            
            if (tipo) {
              tiposMap[ticker] = tipo
            }
          }
        } catch (error) {
          console.error(`Erro ao buscar tipo de ${ticker}:`, error)
        }
      })
      
      await Promise.all(promessas)
      return tiposMap
    },
    enabled: tickersDesconhecidos.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // Cache de 24 horas
    refetchOnWindowFocus: false,
  })

  // Calcular IR sobre vendas (FASE 2 - com todas as regras)
  const irVendas = useMemo(() => {
    if (!vendas || vendas.length === 0 || !movimentacoes) {
      return {
        total: 0,
        detalhes: [],
        totalIsento: 0
      }
    }

    // Agrupar vendas por mês para calcular isenções
    const vendasPorMes: Record<string, any[]> = {}
    vendas.forEach(venda => {
      const data = new Date(venda.data)
      const chaveMes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
      if (!vendasPorMes[chaveMes]) {
        vendasPorMes[chaveMes] = []
      }
      vendasPorMes[chaveMes].push(venda)
    })

    const detalhes = vendas.map(venda => {
      const precoVenda = parseFloat(venda.preco || 0)
      const quantidade = parseFloat(venda.quantidade || 0)
      const valorVenda = precoVenda * quantidade
      
      // Identificar tipo de ativo
      const ativo = carteira?.find(a => a.ticker === venda.ticker)
      let tipoAtivo = ativo?.tipo || 'Desconhecido'
      
      // IMPORTANTE: Verificar se é renda fixa ANTES de buscar na API
      // Renda fixa pode estar como "Desconhecido" mas ter indexador
      if (tipoAtivo === 'Desconhecido' && ativo?.indexador) {
        if (isRendaFixa('', ativo.indexador)) {
          tipoAtivo = 'Renda Fixa'
        }
      }
      
      // Se ainda é "Desconhecido", verificar se o tipo contém palavras-chave de renda fixa
      if (tipoAtivo === 'Desconhecido' && ativo?.tipo) {
        if (isRendaFixa(ativo.tipo, ativo.indexador)) {
          tipoAtivo = 'Renda Fixa'
        }
      }
      
      // Se tipo é "Desconhecido", buscar na API (yfinance)
      if (tipoAtivo === 'Desconhecido' && tiposAtivos.data && venda.ticker) {
        const tipoBuscado = tiposAtivos.data[venda.ticker]
        if (tipoBuscado) {
          tipoAtivo = tipoBuscado
        } else {
          // Fallback: tentar inferir pelo ticker se API não retornou
          const tickerUpper = venda.ticker.toUpperCase()
          if (/[0-9]$/.test(tickerUpper) && !tickerUpper.endsWith('11') && !tickerUpper.includes('ETF')) {
            tipoAtivo = 'Ação' // Tratar como ação
          }
        }
      }
      
      // Última verificação: se ainda é "Desconhecido" mas tem indexador, tratar como renda fixa
      if (tipoAtivo === 'Desconhecido' && ativo?.indexador) {
        tipoAtivo = 'Renda Fixa'
      }
      
      // Calcular preço médio usando FIFO (prioridade 1)
      let precoMedio = calcularPrecoMedio(venda.ticker, venda.data, movimentacoes)
      
      // Se FIFO não retornou valor válido, tentar fallbacks
      if (precoMedio === null || precoMedio <= 0) {
        // Prioridade 2: preço médio do ativo na carteira
        if (ativo?.preco_medio && ativo.preco_medio > 0) {
          precoMedio = parseFloat(ativo.preco_medio)
        }
        // Prioridade 3: preço de compra do ativo
        else if (ativo?.preco_compra && ativo.preco_compra > 0) {
          precoMedio = parseFloat(ativo.preco_compra)
        }
        // Prioridade 4: buscar primeira compra nas movimentações
        else {
          const primeiraCompra = movimentacoes
            .filter(m => m.ticker === venda.ticker && m.tipo === 'compra' && m.data <= venda.data)
            .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())[0]
          
          if (primeiraCompra && primeiraCompra.preco) {
            precoMedio = parseFloat(primeiraCompra.preco)
          } else {
            precoMedio = 0
          }
        }
      }
      
      // Se ainda não encontrou preço médio válido, não pode calcular lucro
      if (precoMedio === null || precoMedio <= 0 || precoVenda <= 0 || quantidade <= 0) {
        return {
          data: venda.data,
          ticker: venda.ticker,
          nome: venda.nome_completo || venda.ticker,
          tipo: tipoAtivo,
          quantidade,
          precoVenda,
          precoMedio: precoMedio || 0,
          valorVenda,
          lucro: 0,
          aliquota: 0,
          irCalculado: 0,
          isento: true,
          motivoIsencao: precoMedio <= 0 ? 'Preço médio não encontrado' : 'Dados insuficientes',
          dayTrade: false
        }
      }
      
      const lucro = (precoVenda - precoMedio) * quantidade
      
      // Detectar day trade
      const dayTrade = isDayTrade(venda.ticker, venda.data, movimentacoes)
      
      // Calcular IR com todas as regras
      let irCalculado = 0
      let aliquota = 0
      let isento = false
      let motivoIsencao = ''
      
      // Só calcular IR se houver lucro (prejuízo não paga IR)
      if (lucro > 0) {
        const dataVenda = new Date(venda.data)
        const chaveMes = `${dataVenda.getFullYear()}-${String(dataVenda.getMonth() + 1).padStart(2, '0')}`
        
        // IMPORTANTE: Calcular lucro total do mês APENAS para este tipo específico de ativo
        // A isenção de R$ 20.000 é por tipo, não global!
        const vendasMesmoMes = vendasPorMes[chaveMes] || []
        let totalLucroMesPorTipo = 0
        
        // Calcular lucro apenas das vendas do MESMO TIPO no mesmo mês
        vendasMesmoMes
          .forEach(v => {
            // Identificar tipo desta venda
            const vAtivo = carteira?.find(a => a.ticker === v.ticker)
            let vTipo = vAtivo?.tipo || 'Desconhecido'
            
            // IMPORTANTE: Verificar se é renda fixa ANTES de buscar na API (mesma lógica do cálculo principal)
            if (vTipo === 'Desconhecido' && vAtivo?.indexador) {
              if (isRendaFixa('', vAtivo.indexador)) {
                vTipo = 'Renda Fixa'
              }
            }
            
            // Se ainda é "Desconhecido", verificar se o tipo contém palavras-chave de renda fixa
            if (vTipo === 'Desconhecido' && vAtivo?.tipo) {
              if (isRendaFixa(vAtivo.tipo, vAtivo.indexador)) {
                vTipo = 'Renda Fixa'
              }
            }
            
            // Se tipo é "Desconhecido", buscar na API (mesma lógica do cálculo principal)
            if (vTipo === 'Desconhecido' && tiposAtivos.data && v.ticker) {
              const tipoBuscado = tiposAtivos.data[v.ticker]
              if (tipoBuscado) {
                vTipo = tipoBuscado
              } else {
                // Fallback: tentar inferir pelo ticker
                const tickerUpper = v.ticker.toUpperCase()
                if (/[0-9]$/.test(tickerUpper) && !tickerUpper.endsWith('11') && !tickerUpper.includes('ETF')) {
                  vTipo = 'Ação'
                }
              }
            }
            
            // Última verificação: se ainda é "Desconhecido" mas tem indexador, tratar como renda fixa
            if (vTipo === 'Desconhecido' && vAtivo?.indexador) {
              vTipo = 'Renda Fixa'
            }
            
            // Só processar se for do MESMO TIPO
            if (vTipo !== tipoAtivo) {
              return
            }
            
            const vPrecoVenda = parseFloat(v.preco || 0)
            const vQuantidade = parseFloat(v.quantidade || 0)
            
            // Calcular preço médio com fallbacks (mesma lógica do cálculo principal)
            let vPrecoMedio = calcularPrecoMedio(v.ticker, v.data, movimentacoes)
            
            if (vPrecoMedio === null || vPrecoMedio <= 0) {
              const vAtivo2 = carteira?.find(a => a.ticker === v.ticker)
              if (vAtivo2?.preco_medio && vAtivo2.preco_medio > 0) {
                vPrecoMedio = parseFloat(vAtivo2.preco_medio)
              } else if (vAtivo2?.preco_compra && vAtivo2.preco_compra > 0) {
                vPrecoMedio = parseFloat(vAtivo2.preco_compra)
              } else {
                const primeiraCompra = movimentacoes
                  .filter(m => m.ticker === v.ticker && (m.tipo === 'compra' || m.tipo?.toLowerCase() === 'compra') && m.data <= v.data)
                  .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())[0]
                
                if (primeiraCompra && primeiraCompra.preco) {
                  vPrecoMedio = parseFloat(primeiraCompra.preco)
                }
              }
            }
            
            // Só calcular lucro se tiver preço médio válido e valores válidos
            if (vPrecoMedio !== null && vPrecoMedio > 0 && vPrecoVenda > 0 && vQuantidade > 0) {
              const vLucro = (vPrecoVenda - vPrecoMedio) * vQuantidade
              // Só somar se houver lucro (prejuízo não conta para isenção)
              if (vLucro > 0) {
                totalLucroMesPorTipo += vLucro
              }
            }
          })
        
        // Aplicar regras por tipo de ativo
        // Tratar "Desconhecido" como ação se o ticker parecer ser uma ação brasileira
        const isAcao = tipoAtivo === 'Ação' || tipoAtivo === 'Ações' || 
                      (tipoAtivo === 'Desconhecido' && venda.ticker && /[0-9]$/.test(venda.ticker.toUpperCase()) && !venda.ticker.toUpperCase().endsWith('11'))
        
        if (isAcao) {
          if (dayTrade) {
            // Day trade: 20% sempre, sem isenção
            aliquota = 0.20
            irCalculado = lucro * aliquota
          } else {
            // Operação comum: isenção até R$ 20k/mês de LUCRO APENAS DE AÇÕES
            // IMPORTANTE: totalLucroMesPorTipo já inclui o lucro da venda atual sendo processada
            // E só considera vendas do MESMO TIPO (ações)
            if (totalLucroMesPorTipo <= 20000) {
              isento = true
              motivoIsencao = 'Isento (lucro mensal de ações ≤ R$ 20.000)'
              aliquota = 0
              irCalculado = 0
            } else {
              aliquota = 0.15
              irCalculado = lucro * aliquota
            }
          }
        } else if (tipoAtivo === 'FII' || tipoAtivo === 'Fundos Imobiliários') {
          // FII: 20% sempre, sem isenção
          aliquota = 0.20
          irCalculado = lucro * aliquota
        } else if (tipoAtivo === 'ETF') {
          if (dayTrade) {
            aliquota = 0.20
            irCalculado = lucro * aliquota
          } else {
            // ETF: 15% sempre, sem isenção até R$ 20k
            aliquota = 0.15
            irCalculado = lucro * aliquota
          }
        } else if (tipoAtivo === 'BDR') {
          if (dayTrade) {
            aliquota = 0.20
            irCalculado = lucro * aliquota
          } else {
            // BDR: 15% sempre, sem isenção
            aliquota = 0.15
            irCalculado = lucro * aliquota
          }
        } else if (tipoAtivo === 'Renda Fixa' || tipoAtivo === 'Renda Fixa Pública' || 
                   isRendaFixa(tipoAtivo, ativo?.indexador)) {
          // Renda Fixa: alíquota progressiva baseada no prazo (data de compra até data de venda)
          // Buscar data de compra nas movimentações
          const primeiraCompra = movimentacoes
            .filter(m => m.ticker === venda.ticker && (m.tipo === 'compra' || m.tipo?.toLowerCase() === 'compra') && m.data <= venda.data)
            .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())[0]
          
          if (primeiraCompra && primeiraCompra.data) {
            aliquota = calcularAliquotaRendaFixa(primeiraCompra.data, venda.data)
            irCalculado = lucro * aliquota
          } else {
            // Se não encontrou data de compra, usar alíquota padrão de 15%
            aliquota = 0.15
            irCalculado = lucro * aliquota
          }
        } else if (tipoAtivo === 'Criptomoeda' || tipoAtivo === 'Criptomoedas') {
          // Cripto: day trade sempre tributado, sem isenção
          if (dayTrade) {
            // Day trade: 20% sempre, sem isenção
            aliquota = 0.20
            irCalculado = lucro * aliquota
          } else {
            // Operação comum: isenção até R$ 35k/mês de LUCRO APENAS DE CRIPTOMOEDAS, depois progressivo
            // Usar o mesmo totalLucroMesPorTipo calculado acima (já filtrado por tipo)
            if (totalLucroMesPorTipo <= 35000) {
              isento = true
              motivoIsencao = 'Isento (lucro mensal de criptomoedas ≤ R$ 35.000)'
              aliquota = 0
              irCalculado = 0
            } else {
              aliquota = calcularAliquotaCripto(lucro)
              irCalculado = lucro * aliquota
            }
          }
        } else {
          // Tipo desconhecido: aplicar 15% como padrão
          aliquota = 0.15
          irCalculado = lucro * aliquota
        }
      }

      return {
        data: venda.data,
        ticker: venda.ticker,
        nome: venda.nome_completo || venda.ticker,
        tipo: tipoAtivo,
        quantidade,
        precoVenda,
        precoMedio,
        valorVenda,
        lucro,
        aliquota: aliquota * 100,
        irCalculado,
        isento,
        motivoIsencao,
        dayTrade
      }
    })

    const total = detalhes.reduce((sum, item) => sum + item.irCalculado, 0)
    const totalIsento = detalhes.filter(item => item.isento).reduce((sum, item) => sum + item.lucro, 0)

    return {
      total,
      detalhes,
      totalIsento
    }
  }, [vendas, carteira, movimentacoes, calcularPrecoMedio, tiposAtivos.data])

  // Calcular IR sobre proventos (FASE 2 - com todas as regras)
  const irProventos = useMemo(() => {
    if (!proventosRecebidos || proventosRecebidos.length === 0) {
      return {
        total: 0,
        detalhes: []
      }
    }

    const detalhes: any[] = []
    
    // Debug: verificar estrutura dos dados
    if (proventosRecebidos.length > 0 && !proventosRecebidos[0].proventos_recebidos) {
      console.warn('Estrutura de proventos recebidos inesperada:', proventosRecebidos[0])
    }
    
    proventosRecebidos.forEach(provento => {
      if (provento.proventos_recebidos && Array.isArray(provento.proventos_recebidos)) {
        provento.proventos_recebidos.forEach((p: any) => {
          const ativo = carteira?.find(a => a.ticker === provento.ticker)
          const tipoAtivo = ativo?.tipo || 'Desconhecido'
          
          // Corrigir acesso ao valor: usar valor_recebido ou calcular de valor_unitario * quantidade
          const valorBruto = p.valor_recebido !== undefined 
            ? parseFloat(p.valor_recebido || 0)
            : (parseFloat(p.valor_unitario || 0) * parseFloat(p.quantidade || 0))
          
          // Calcular IR retido/calculado (regras completas)
          let irRetido = 0
          let aliquota = 0
          let isento = false
          let motivoIsencao = ''
          
          if (tipoAtivo === 'Ação' || tipoAtivo === 'Ações') {
            // Dividendos de ações são isentos (desde 1995)
            isento = true
            motivoIsencao = 'Dividendos de ações são isentos de IR'
            irRetido = 0
            aliquota = 0
          } else if (tipoAtivo === 'FII' || tipoAtivo === 'Fundos Imobiliários') {
            // Dividendos de FII são isentos
            isento = true
            motivoIsencao = 'Dividendos de FII são isentos de IR'
            irRetido = 0
            aliquota = 0
          } else if (tipoAtivo === 'ETF') {
            // ETFs: Dividendos são isentos (mesma regra de ações)
            isento = true
            motivoIsencao = 'Dividendos de ETF são isentos de IR'
            irRetido = 0
            aliquota = 0
          } else if (tipoAtivo === 'BDR') {
            // BDRs: tributação progressiva (7,5% a 27,5%)
            aliquota = calcularAliquotaBDRDividendos(valorBruto)
            irRetido = valorBruto * aliquota
          } else {
            // Desconhecido: tratar como isento por padrão (mais seguro)
            isento = true
            motivoIsencao = 'Tipo de ativo desconhecido - tratado como isento'
            irRetido = 0
            aliquota = 0
          }

          detalhes.push({
            data: p.data,
            ticker: provento.ticker,
            nome: provento.nome || provento.ticker,
            tipo: tipoAtivo,
            valorBruto,
            aliquota: aliquota * 100,
            irRetido,
            valorLiquido: valorBruto - irRetido,
            isento,
            motivoIsencao
          })
        })
      }
    })

    const total = detalhes.reduce((sum, item) => sum + item.irRetido, 0)

    return {
      total,
      detalhes
    }
  }, [proventosRecebidos, carteira])

  // Total geral
  const totalIR = useMemo(() => {
    return irVendas.total + irProventos.total
  }, [irVendas.total, irProventos.total])

  // Filtrar por período
  const filtrarPorPeriodo = (dataStr: string) => {
    if (filtroPeriodo === 'total') return true
    
    const data = new Date(dataStr)
    const agora = new Date()
    
    if (filtroPeriodo === 'mes') {
      return data.getMonth() === agora.getMonth() && 
             data.getFullYear() === agora.getFullYear()
    } else if (filtroPeriodo === 'trimestre') {
      const trimestreAtual = Math.floor(agora.getMonth() / 3)
      const trimestreData = Math.floor(data.getMonth() / 3)
      return trimestreData === trimestreAtual && 
             data.getFullYear() === agora.getFullYear()
    } else if (filtroPeriodo === 'ano') {
      return data.getFullYear() === agora.getFullYear()
    }
    
    return true
  }

  const vendasFiltradas = useMemo(() => {
    return irVendas.detalhes.filter(v => filtrarPorPeriodo(v.data))
  }, [irVendas.detalhes, filtroPeriodo])

  const proventosFiltrados = useMemo(() => {
    return irProventos.detalhes.filter(p => filtrarPorPeriodo(p.data))
  }, [irProventos.detalhes, filtroPeriodo])

  // Função auxiliar: Calcular último dia útil do mês
  const ultimoDiaUtilMes = (ano: number, mes: number) => {
    // Último dia do mês
    const ultimoDia = new Date(ano, mes, 0).getDate()
    let data = new Date(ano, mes - 1, ultimoDia)
    
    // Se for sábado (6) ou domingo (0), voltar para sexta
    while (data.getDay() === 0 || data.getDay() === 6) {
      data.setDate(data.getDate() - 1)
    }
    
    return data
  }

  // Calcular DARFs pendentes (agrupados por mês de vencimento)
  const darfsPendentes = useMemo(() => {
    // Agrupar vendas por mês de vencimento do DARF
    const darfsPorMes: Record<string, { vendas: any[], totalIR: number, vencimento: Date }> = {}
    
    vendasFiltradas.forEach(venda => {
      if (venda.irCalculado > 0 && !venda.isento) {
        const dataVenda = new Date(venda.data)
        const mesVenda = dataVenda.getMonth() + 1
        const anoVenda = dataVenda.getFullYear()
        
        // DARF vence no último dia útil do mês seguinte
        let mesVencimento = mesVenda + 1
        let anoVencimento = anoVenda
        
        if (mesVencimento > 12) {
          mesVencimento = 1
          anoVencimento += 1
        }
        
        const vencimento = ultimoDiaUtilMes(anoVencimento, mesVencimento)
        const chave = `${anoVencimento}-${String(mesVencimento).padStart(2, '0')}`
        
        if (!darfsPorMes[chave]) {
          darfsPorMes[chave] = {
            vendas: [],
            totalIR: 0,
            vencimento
          }
        }
        
        darfsPorMes[chave].vendas.push(venda)
        darfsPorMes[chave].totalIR += venda.irCalculado
      }
    })
    
    // Converter para array e ordenar por data de vencimento
    return Object.entries(darfsPorMes)
      .map(([chave, dados]) => ({
        mes: chave,
        ...dados
      }))
      .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())
  }, [vendasFiltradas])

  // Próximo DARF (mais próximo do vencimento)
  const proximoDARF = useMemo(() => {
    if (darfsPendentes.length === 0) return null
    
    const agora = new Date()
    agora.setHours(0, 0, 0, 0)
    
    // Encontrar o próximo DARF não vencido, ou o mais próximo
    const darfNaoVencido = darfsPendentes.find(d => d.vencimento >= agora)
    const darfMaisProximo = darfsPendentes[0]
    
    const darf = darfNaoVencido || darfMaisProximo
    
    const diasRestantes = Math.ceil((darf.vencimento.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24))
    
    return {
      ...darf,
      diasRestantes,
      status: diasRestantes < 0 ? 'vencido' : 
              diasRestantes === 0 ? 'vence_hoje' : 
              diasRestantes <= 7 ? 'vence_em_breve' : 
              'pendente'
    }
  }, [darfsPendentes])

  // Total de DARFs pendentes
  const totalDARFsPendentes = useMemo(() => {
    return darfsPendentes.reduce((sum, d) => sum + d.totalIR, 0)
  }, [darfsPendentes])

  // Resumo anual consolidado
  const resumoAnual = useMemo(() => {
    const anoAtual = new Date().getFullYear()
    const vendasAno = irVendas.detalhes.filter(v => {
      const data = new Date(v.data)
      return data.getFullYear() === anoAtual
    })
    const proventosAno = irProventos.detalhes.filter(p => {
      const data = new Date(p.data)
      return data.getFullYear() === anoAtual
    })

    const totalVendasAno = vendasAno.reduce((sum, v) => sum + v.valorVenda, 0)
    const totalLucroAno = vendasAno.reduce((sum, v) => sum + v.lucro, 0)
    const totalIRVendasAno = vendasAno.reduce((sum, v) => sum + v.irCalculado, 0)
    const totalIsentoAno = vendasAno.filter(v => v.isento).reduce((sum, v) => sum + v.lucro, 0)

    const totalProventosAno = proventosAno.reduce((sum, p) => sum + p.valorBruto, 0)
    const totalIRProventosAno = proventosAno.reduce((sum, p) => sum + p.irRetido, 0)
    const totalLiquidoProventosAno = proventosAno.reduce((sum, p) => sum + p.valorLiquido, 0)

    return {
      ano: anoAtual,
      vendas: {
        quantidade: vendasAno.length,
        totalVendas: totalVendasAno,
        totalLucro: totalLucroAno,
        totalIR: totalIRVendasAno,
        totalIsento: totalIsentoAno
      },
      proventos: {
        quantidade: proventosAno.length,
        totalBruto: totalProventosAno,
        totalIR: totalIRProventosAno,
        totalLiquido: totalLiquidoProventosAno
      },
      consolidado: {
        totalIR: totalIRVendasAno + totalIRProventosAno,
        totalIsento: totalIsentoAno
      }
    }
  }, [irVendas.detalhes, irProventos.detalhes])

  // Calcular totais por tipo de ativo (usando vendas filtradas por período)
  const vendasPorTipo = useMemo(() => {
    const porTipo: Record<string, {
      tipo: string
      quantidade: number
      totalVendas: number
      totalLucro: number
      totalIR: number
      totalIsento: number
    }> = {}

   
    vendasFiltradas.forEach(venda => {
      const tipo = venda.tipo || 'Desconhecido'
      
      if (!porTipo[tipo]) {
        porTipo[tipo] = {
          tipo,
          quantidade: 0,
          totalVendas: 0,
          totalLucro: 0,
          totalIR: 0,
          totalIsento: 0
        }
      }

      porTipo[tipo].quantidade += 1
      porTipo[tipo].totalVendas += venda.valorVenda || 0
      porTipo[tipo].totalLucro += venda.lucro || 0
      porTipo[tipo].totalIR += venda.irCalculado || 0
      
      if (venda.isento) {
        porTipo[tipo].totalIsento += venda.lucro || 0
      }
    })

    return Object.values(porTipo).sort((a, b) => b.totalVendas - a.totalVendas)
  }, [vendasFiltradas])

  // Função para exportar dados para XLSX
  const exportarParaXLSX = (tipo: 'vendas' | 'proventos' | 'completo') => {
    const workbook = XLSX.utils.book_new()
    let filename = ''

    if (tipo === 'vendas' || tipo === 'completo') {
      // Preparar dados de vendas
      const dadosVendas = vendasFiltradas.map(v => ({
        'Data': new Date(v.data).toLocaleDateString('pt-BR'),
        'Ativo': v.ticker,
        'Tipo': v.tipo,
        'Quantidade': v.quantidade,
        'Preço Venda': v.precoVenda,
        'Preço Médio': v.precoMedio > 0 ? v.precoMedio : null,
        'Lucro': v.lucro,
        'Day Trade': v.dayTrade ? 'Sim' : 'Não',
        'Alíquota (%)': v.isento ? 'Isento' : v.aliquota.toFixed(1) + '%',
        'IR Calculado': v.isento ? 0 : v.irCalculado,
        'Isento': v.isento ? 'Sim' : 'Não'
      }))

      // Adicionar linha de totais
      const totalIR = vendasFiltradas.reduce((sum, v) => sum + v.irCalculado, 0)
      const totalIsento = vendasFiltradas.filter(v => v.isento).reduce((sum, v) => sum + v.lucro, 0)
      
      dadosVendas.push({
        'Data': '',
        'Ativo': '',
        'Tipo': '',
        'Quantidade': null,
        'Preço Venda': null,
        'Preço Médio': null,
        'Lucro': null,
        'Day Trade': '',
        'Alíquota (%)': 'TOTAL',
        'IR Calculado': totalIR,
        'Isento': ''
      } as any)

      if (totalIsento > 0) {
        dadosVendas.push({
          'Data': '',
          'Ativo': '',
          'Tipo': '',
          'Quantidade': null,
          'Preço Venda': null,
          'Preço Médio': null,
          'Lucro': totalIsento,
          'Day Trade': '',
          'Alíquota (%)': 'TOTAL ISENTO',
          'IR Calculado': null,
          'Isento': ''
        } as any)
      }

      const wsVendas = XLSX.utils.json_to_sheet(dadosVendas)
      
      // Ajustar largura das colunas
      const colWidths = [
        { wch: 12 }, // Data
        { wch: 10 }, // Ativo
        { wch: 15 }, // Tipo
        { wch: 10 }, // Quantidade
        { wch: 12 }, // Preço Venda
        { wch: 12 }, // Preço Médio
        { wch: 12 }, // Lucro
        { wch: 10 }, // Day Trade
        { wch: 12 }, // Alíquota
        { wch: 12 }, // IR Calculado
        { wch: 8 }   // Isento
      ]
      wsVendas['!cols'] = colWidths

      XLSX.utils.book_append_sheet(workbook, wsVendas, 'IR sobre Vendas')
      
      if (tipo === 'vendas') {
        filename = `ir_vendas_${new Date().toISOString().split('T')[0]}.xlsx`
      }
    }

    if (tipo === 'proventos' || tipo === 'completo') {
      // Preparar dados de proventos
      const dadosProventos = proventosFiltrados.map(p => ({
        'Data': new Date(p.data).toLocaleDateString('pt-BR'),
        'Ativo': p.ticker,
        'Tipo': p.tipo,
        'Valor Bruto': p.valorBruto,
        'Alíquota (%)': p.isento ? 'Isento' : p.aliquota.toFixed(1) + '%',
        'IR Retido': p.isento ? 0 : p.irRetido,
        'Valor Líquido': p.valorLiquido,
        'Isento': p.isento ? 'Sim' : 'Não'
      }))

      // Adicionar linha de totais
      const totalIR = proventosFiltrados.reduce((sum, p) => sum + p.irRetido, 0)
      const totalBruto = proventosFiltrados.reduce((sum, p) => sum + p.valorBruto, 0)
      const totalLiquido = proventosFiltrados.reduce((sum, p) => sum + p.valorLiquido, 0)
      
      dadosProventos.push({
        'Data': '',
        'Ativo': '',
        'Tipo': '',
        'Valor Bruto': totalBruto,
        'Alíquota (%)': 'TOTAL',
        'IR Retido': totalIR,
        'Valor Líquido': totalLiquido,
        'Isento': ''
      } as any)

      const wsProventos = XLSX.utils.json_to_sheet(dadosProventos)
      
      // Ajustar largura das colunas
      const colWidths = [
        { wch: 12 }, // Data
        { wch: 10 }, // Ativo
        { wch: 15 }, // Tipo
        { wch: 12 }, // Valor Bruto
        { wch: 12 }, // Alíquota
        { wch: 12 }, // IR Retido
        { wch: 12 }, // Valor Líquido
        { wch: 8 }   // Isento
      ]
      wsProventos['!cols'] = colWidths

      XLSX.utils.book_append_sheet(workbook, wsProventos, 'IR sobre Proventos')
      
      if (tipo === 'proventos') {
        filename = `ir_proventos_${new Date().toISOString().split('T')[0]}.xlsx`
      }
    }

    if (tipo === 'completo') {
      // Adicionar aba de resumo anual
      const dadosResumo = [
        {
          'Ano': resumoAnual.ano,
          'Total IR Vendas': resumoAnual.vendas.totalIR,
          'Total IR Proventos': resumoAnual.proventos.totalIR,
          'Total IR Geral': resumoAnual.consolidado.totalIR,
          'Total Isento (Lucro)': resumoAnual.consolidado.totalIsento
        }
      ]

      const wsResumo = XLSX.utils.json_to_sheet(dadosResumo)
      wsResumo['!cols'] = [
        { wch: 10 }, // Ano
        { wch: 15 }, // Total IR Vendas
        { wch: 15 }, // Total IR Proventos
        { wch: 15 }, // Total IR Geral
        { wch: 18 }  // Total Isento
      ]

      XLSX.utils.book_append_sheet(workbook, wsResumo, 'Resumo Anual')
      
      filename = `ir_completo_${resumoAnual.ano}_${new Date().toISOString().split('T')[0]}.xlsx`
    }

    // Baixar arquivo
    XLSX.writeFile(workbook, filename)
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Receipt className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg md:text-xl font-semibold">Impostos</h2>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value as any)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm w-full sm:w-auto"
            aria-label="Filtrar por período"
          >
            <option value="mes">Mês atual</option>
            <option value="trimestre">Trimestre atual</option>
            <option value="ano">Ano atual</option>
            <option value="total">Total</option>
          </select>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as any)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm w-full sm:w-auto"
            aria-label="Filtrar por tipo"
          >
            <option value="todos">Todos</option>
            <option value="vendas">Vendas</option>
            <option value="proventos">Proventos</option>
          </select>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 md:p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">IR sobre Vendas</div>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(irVendas.total, '')}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {vendasFiltradas.length} {vendasFiltradas.length === 1 ? 'venda' : 'vendas'}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 md:p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">IR sobre Proventos</div>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(irProventos.total, '')}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {proventosFiltrados.length} {proventosFiltrados.length === 1 ? 'provento' : 'proventos'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 md:p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">Total de IR</div>
            <Receipt className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary">
            {formatCurrency(totalIR, '')}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Período: {filtroPeriodo === 'mes' ? 'Mês' : filtroPeriodo === 'trimestre' ? 'Trimestre' : filtroPeriodo === 'ano' ? 'Ano' : 'Total'}
          </div>
        </div>

        <div className={`bg-card border rounded-xl p-4 md:p-5 shadow-lg ${
          proximoDARF?.status === 'vencido' ? 'border-red-500 dark:border-red-500' :
          proximoDARF?.status === 'vence_hoje' ? 'border-orange-500 dark:border-orange-500' :
          proximoDARF?.status === 'vence_em_breve' ? 'border-yellow-500 dark:border-yellow-500' :
          'border-border'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">Próximo DARF</div>
            {proximoDARF ? (
              proximoDARF.status === 'vencido' ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : proximoDARF.status === 'vence_hoje' ? (
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              ) : proximoDARF.status === 'vence_em_breve' ? (
                <Clock className="w-5 h-5 text-yellow-500" />
              ) : (
                <Calendar className="w-5 h-5 text-blue-500" />
              )
            ) : (
              <Calendar className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          {proximoDARF ? (
            <>
              <div className={`text-lg font-bold ${
                proximoDARF.status === 'vencido' ? 'text-red-600 dark:text-red-400' :
                proximoDARF.status === 'vence_hoje' ? 'text-orange-600 dark:text-orange-400' :
                proximoDARF.status === 'vence_em_breve' ? 'text-yellow-600 dark:text-yellow-400' :
                'text-foreground'
              }`}>
                {formatCurrency(proximoDARF.totalIR, '')}
              </div>
              <div className={`text-xs mt-1 ${
                proximoDARF.status === 'vencido' ? 'text-red-600 dark:text-red-400 font-semibold' :
                proximoDARF.status === 'vence_hoje' ? 'text-orange-600 dark:text-orange-400 font-semibold' :
                proximoDARF.status === 'vence_em_breve' ? 'text-yellow-600 dark:text-yellow-400' :
                'text-muted-foreground'
              }`}>
                {proximoDARF.status === 'vencido' ? `Vencido há ${Math.abs(proximoDARF.diasRestantes)} ${Math.abs(proximoDARF.diasRestantes) === 1 ? 'dia' : 'dias'}` :
                 proximoDARF.status === 'vence_hoje' ? 'Vence hoje!' :
                 proximoDARF.status === 'vence_em_breve' ? `Vence em ${proximoDARF.diasRestantes} ${proximoDARF.diasRestantes === 1 ? 'dia' : 'dias'}` :
                 `Vence em ${proximoDARF.diasRestantes} ${proximoDARF.diasRestantes === 1 ? 'dia' : 'dias'}`}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {proximoDARF.vencimento.toLocaleDateString('pt-BR')}
              </div>
            </>
          ) : (
            <>
              <div className="text-lg font-bold text-muted-foreground">
                Nenhum DARF pendente
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Sem vendas com IR no período
              </div>
            </>
          )}
        </div>
      </div>

      {/* Resumo Anual Consolidado */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4 md:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground">Resumo Anual {resumoAnual.ano}</h3>
              <p className="text-xs text-muted-foreground">Consolidado para declaração de IR</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportarParaXLSX('vendas')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              disabled={vendasFiltradas.length === 0}
            >
              <Download className="w-4 h-4" />
              Exportar Vendas
            </button>
            <button
              onClick={() => exportarParaXLSX('proventos')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              disabled={proventosFiltrados.length === 0}
            >
              <Download className="w-4 h-4" />
              Exportar Proventos
            </button>
            <button
              onClick={() => exportarParaXLSX('completo')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar Completo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card/50 rounded-lg p-4 border border-border">
            <div className="text-xs text-muted-foreground mb-1">IR sobre Vendas</div>
            <div className="text-xl font-bold text-foreground">
              {formatCurrency(resumoAnual.vendas.totalIR, '')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {resumoAnual.vendas.quantidade} {resumoAnual.vendas.quantidade === 1 ? 'venda' : 'vendas'}
            </div>
          </div>

          <div className="bg-card/50 rounded-lg p-4 border border-border">
            <div className="text-xs text-muted-foreground mb-1">IR sobre Proventos</div>
            <div className="text-xl font-bold text-foreground">
              {formatCurrency(resumoAnual.proventos.totalIR, '')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {resumoAnual.proventos.quantidade} {resumoAnual.proventos.quantidade === 1 ? 'provento' : 'proventos'}
            </div>
          </div>

          <div className="bg-card/50 rounded-lg p-4 border border-border">
            <div className="text-xs text-muted-foreground mb-1">Total de IR {resumoAnual.ano}</div>
            <div className="text-xl font-bold text-primary">
              {formatCurrency(resumoAnual.consolidado.totalIR, '')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Vendas + Proventos
            </div>
          </div>

          <div className="bg-card/50 rounded-lg p-4 border border-border">
            <div className="text-xs text-muted-foreground mb-1">Total Isento (Lucro)</div>
            <div className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(resumoAnual.consolidado.totalIsento, '')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Lucro isento de tributação
            </div>
          </div>
        </div>

        {/* Detalhamento do resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-sm font-semibold text-foreground mb-3">Vendas</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total de vendas:</span>
                <span className="font-medium">{formatCurrency(resumoAnual.vendas.totalVendas, '')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total de lucro:</span>
                <span className={`font-medium ${resumoAnual.vendas.totalLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {resumoAnual.vendas.totalLucro >= 0 ? '+' : ''}{formatCurrency(resumoAnual.vendas.totalLucro, '')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IR devido:</span>
                <span className="font-medium text-primary">{formatCurrency(resumoAnual.vendas.totalIR, '')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lucro isento:</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatCurrency(resumoAnual.vendas.totalIsento, '')}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-sm font-semibold text-foreground mb-3">Proventos</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total bruto:</span>
                <span className="font-medium">{formatCurrency(resumoAnual.proventos.totalBruto, '')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IR retido:</span>
                <span className="font-medium text-primary">{formatCurrency(resumoAnual.proventos.totalIR, '')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total líquido:</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatCurrency(resumoAnual.proventos.totalLiquido, '')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vendas por Tipo */}
      {vendasPorTipo.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground">Vendas por Tipo de Ativo</h3>
              <p className="text-xs text-muted-foreground">Detalhamento separado por tipo de ativo</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Tipo</th>
                  <th className="text-right py-3 px-4 font-semibold text-foreground">Qtd. Vendas</th>
                  <th className="text-right py-3 px-4 font-semibold text-foreground">Total Vendas</th>
                  <th className="text-right py-3 px-4 font-semibold text-foreground">Total Lucro</th>
                  <th className="text-right py-3 px-4 font-semibold text-foreground">IR Devido</th>
                  <th className="text-right py-3 px-4 font-semibold text-foreground">Lucro Isento</th>
                </tr>
              </thead>
              <tbody>
                {vendasPorTipo.map((item, index) => (
                  <tr 
                    key={index} 
                    className="border-b border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-foreground">{item.tipo}</td>
                    <td className="py-3 px-4 text-right text-muted-foreground">{item.quantidade}</td>
                    <td className="py-3 px-4 text-right font-medium">{formatCurrency(item.totalVendas, '')}</td>
                    <td className={`py-3 px-4 text-right font-medium ${item.totalLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.totalLucro >= 0 ? '+' : ''}{formatCurrency(item.totalLucro, '')}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-primary">
                      {formatCurrency(item.totalIR, '')}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(item.totalIsento, '')}
                    </td>
                  </tr>
                ))}
                {/* Linha de total */}
                <tr className="border-t-2 border-primary bg-muted/50 font-semibold">
                  <td className="py-3 px-4 text-foreground">TOTAL</td>
                  <td className="py-3 px-4 text-right text-foreground">
                    {vendasPorTipo.reduce((sum, item) => sum + item.quantidade, 0)}
                  </td>
                  <td className="py-3 px-4 text-right text-foreground">
                    {formatCurrency(vendasPorTipo.reduce((sum, item) => sum + item.totalVendas, 0), '')}
                  </td>
                  <td className={`py-3 px-4 text-right ${
                    resumoAnual.vendas.totalLucro >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {resumoAnual.vendas.totalLucro >= 0 ? '+' : ''}{formatCurrency(resumoAnual.vendas.totalLucro, '')}
                  </td>
                  <td className="py-3 px-4 text-right text-primary">
                    {formatCurrency(resumoAnual.vendas.totalIR, '')}
                  </td>
                  <td className="py-3 px-4 text-right text-green-600 dark:text-green-400">
                    {formatCurrency(resumoAnual.vendas.totalIsento, '')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">Importante sobre isenções:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>Ações: isenção de R$ 20.000/mês de lucro (apenas para ações, não inclui outros tipos)</li>
                  <li>Criptomoedas: isenção de R$ 35.000/mês de lucro (apenas para criptomoedas)</li>
                  <li>FIIs, ETFs e BDRs: sem isenção mensal</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DARFs Pendentes */}
      {darfsPendentes.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Calendar className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground">DARFs Pendentes</h3>
              <p className="text-xs text-muted-foreground">IR sobre vendas agrupado por mês de vencimento</p>
            </div>
          </div>

          <div className="space-y-3">
            {darfsPendentes.map((darf) => {
              const agora = new Date()
              agora.setHours(0, 0, 0, 0)
              const diasRestantes = Math.ceil((darf.vencimento.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24))
              const status = diasRestantes < 0 ? 'vencido' : 
                            diasRestantes === 0 ? 'vence_hoje' : 
                            diasRestantes <= 7 ? 'vence_em_breve' : 
                            'pendente'
              
              return (
                <div
                  key={darf.mes}
                  className={`border rounded-lg p-4 ${
                    status === 'vencido' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' :
                    status === 'vence_hoje' ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' :
                    status === 'vence_em_breve' ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800' :
                    'bg-muted/30 border-border'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-foreground">
                          DARF - {darf.vencimento.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </span>
                        {status === 'vencido' && (
                          <span className="px-2 py-0.5 rounded bg-red-500 text-white text-xs font-medium">
                            Vencido
                          </span>
                        )}
                        {status === 'vence_hoje' && (
                          <span className="px-2 py-0.5 rounded bg-orange-500 text-white text-xs font-medium">
                            Vence Hoje
                          </span>
                        )}
                        {status === 'vence_em_breve' && (
                          <span className="px-2 py-0.5 rounded bg-yellow-500 text-white text-xs font-medium">
                            Vence em Breve
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Vencimento: <strong>{darf.vencimento.toLocaleDateString('pt-BR')}</strong></div>
                        <div>
                          {status === 'vencido' ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              Vencido há {Math.abs(diasRestantes)} {Math.abs(diasRestantes) === 1 ? 'dia' : 'dias'}
                            </span>
                          ) : status === 'vence_hoje' ? (
                            <span className="text-orange-600 dark:text-orange-400 font-medium">Vence hoje!</span>
                          ) : status === 'vence_em_breve' ? (
                            <span className="text-yellow-600 dark:text-yellow-400">
                              Vence em {diasRestantes} {diasRestantes === 1 ? 'dia' : 'dias'}
                            </span>
                          ) : (
                            <span>Vence em {diasRestantes} {diasRestantes === 1 ? 'dia' : 'dias'}</span>
                          )}
                        </div>
                        <div>Quantidade de vendas: {darf.vendas.length}</div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Código de receita: <strong>6015</strong> (Ganho de capital - Operações no mercado à vista)
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(darf.totalIR, '')}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        IR a pagar
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {darfsPendentes.length > 1 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-foreground">Total de DARFs Pendentes:</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(totalDARFsPendentes, '')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Informações sobre as regras */}
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
            Fase 2 - Regras Completas Implementadas
          </div>
          <div className="text-xs text-green-800 dark:text-green-200 space-y-1">
            <p>✓ Isenção de R$ 20.000/mês para ações (operações comuns)</p>
            <p>✓ Isenção de R$ 35.000/mês para criptomoedas</p>
            <p>✓ Alíquotas progressivas para criptomoedas (15% a 22,5%)</p>
            <p>✓ Alíquotas progressivas para dividendos de BDR (7,5% a 27,5%)</p>
            <p>✓ Detecção de day trade (20% sempre, sem isenção)</p>
            <p>✓ Cálculo de preço médio usando FIFO</p>
          </div>
        </div>
      </div>

      {/* Orientações para Declaração */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 md:p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg md:text-xl font-semibold text-foreground">Orientações para Declaração de IR</h3>
        </div>

        <div className="space-y-4">
          <div className="bg-background/50 rounded-lg p-4 border border-blue-200/30">
            <div className="flex items-start gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground mb-2">Ganho de Capital (Vendas)</div>
                <ul className="text-xs text-muted-foreground space-y-1 ml-8">
                  <li>• Declare na ficha "Rendimentos Sujeitos à Tributação Exclusiva/Definitiva"</li>
                  <li>• Código: 31 (Ganhos líquidos em operações no mercado à vista de ações negociadas em bolsa)</li>
                  <li>• Para FIIs, ETFs, BDRs e criptomoedas, use os códigos específicos de cada tipo</li>
                  <li>• Day trade deve ser declarado separadamente (código 35)</li>
                  <li>• Operações isentas também devem ser declaradas (informe valor zero no IR devido)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-background/50 rounded-lg p-4 border border-blue-200/30">
            <div className="flex items-start gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground mb-2">Proventos (Dividendos e JCP)</div>
                <ul className="text-xs text-muted-foreground space-y-1 ml-8">
                  <li>• Dividendos de ações e FIIs são isentos e não precisam ser declarados como rendimento</li>
                  <li>• JCP (Juros sobre Capital Próprio) devem ser declarados (código 06)</li>
                  <li>• Dividendos de ETFs e BDRs devem ser declarados conforme tributação aplicável</li>
                  <li>• Valores já retidos na fonte aparecem automaticamente na pré-preenchida</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-background/50 rounded-lg p-4 border border-blue-200/30">
            <div className="flex items-start gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground mb-2">Pagamento de DARF</div>
                <ul className="text-xs text-muted-foreground space-y-1 ml-8">
                  <li>• IR sobre vendas deve ser pago via DARF até o último dia útil do mês seguinte à venda</li>
                  <li>• Código de receita: 6015 (Ganho de capital - Operações no mercado à vista)</li>
                  <li>• Para day trade: código 6016</li>
                  <li>• Mantenha comprovantes de pagamento para a declaração</li>
                  <li>• Use o relatório exportado como base para preencher o DARF</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Atenção:</strong> Estas são orientações gerais. Consulte sempre um contador ou a Receita Federal para casos específicos. 
                As regras podem mudar e cada situação pode ter particularidades.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Vendas */}
      {(filtroTipo === 'todos' || filtroTipo === 'vendas') && (
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg md:text-xl font-semibold">IR sobre Vendas (Ganho de Capital)</h3>
          </div>

          {loadingMovimentacoes ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando vendas...
            </div>
          ) : vendasFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Nenhuma venda registrada no período selecionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Data</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Ativo</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Tipo</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Quantidade</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Preço Venda</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Preço Médio</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Lucro</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Day Trade</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Alíquota</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">IR Calculado</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasFiltradas.map((venda, index) => (
                    <tr key={index} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-sm text-foreground">
                        {new Date(venda.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <TickerWithLogo ticker={venda.ticker} nome={venda.nome} />
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{venda.tipo}</td>
                      <td className="py-3 px-4 text-sm text-right">{venda.quantidade}</td>
                      <td className="py-3 px-4 text-sm text-right">{formatCurrency(venda.precoVenda, '')}</td>
                      <td className="py-3 px-4 text-sm text-right">
                        {venda.precoMedio > 0 ? formatCurrency(venda.precoMedio, '') : '-'}
                      </td>
                      <td className={`py-3 px-4 text-sm font-medium text-right ${
                        venda.lucro >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {venda.lucro >= 0 ? '+' : ''}{formatCurrency(venda.lucro, '')}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        {venda.dayTrade ? (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium">
                            Sim
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Não</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        {venda.isento ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">Isento</span>
                        ) : venda.aliquota > 0 ? (
                          `${venda.aliquota.toFixed(1)}%`
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-right">
                        {venda.isento ? (
                          <span className="text-green-600 dark:text-green-400">Isento</span>
                        ) : (
                          <span className="text-primary">{formatCurrency(venda.irCalculado, '')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td colSpan={9} className="py-3 px-4 text-right text-sm">Total IR:</td>
                    <td className="py-3 px-4 text-right text-primary">
                      {formatCurrency(vendasFiltradas.reduce((sum, v) => sum + v.irCalculado, 0), '')}
                    </td>
                  </tr>
                  {vendasFiltradas.some(v => v.isento) && (
                    <tr className="bg-green-50/50 dark:bg-green-950/20 font-medium">
                      <td colSpan={9} className="py-3 px-4 text-right text-sm text-green-700 dark:text-green-300">
                        Total Isento (Lucro):
                      </td>
                      <td className="py-3 px-4 text-right text-green-600 dark:text-green-400">
                        {formatCurrency(vendasFiltradas.filter(v => v.isento).reduce((sum, v) => sum + v.lucro, 0), '')}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Seção de Proventos */}
      {(filtroTipo === 'todos' || filtroTipo === 'proventos') && (
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-green-500/20">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg md:text-xl font-semibold">IR sobre Proventos</h3>
          </div>

          {loadingProventos ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando proventos...
            </div>
          ) : proventosFiltrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Nenhum provento registrado no período selecionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Data</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Ativo</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Tipo</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Valor Bruto</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Alíquota</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">IR Retido</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Valor Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {proventosFiltrados.map((provento, index) => (
                    <tr key={index} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-sm text-foreground">
                        {new Date(provento.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <TickerWithLogo ticker={provento.ticker} nome={provento.nome} />
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{provento.tipo}</td>
                      <td className="py-3 px-4 text-sm text-right">{formatCurrency(provento.valorBruto, '')}</td>
                      <td className="py-3 px-4 text-sm text-right">
                        {provento.isento ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">Isento</span>
                        ) : provento.aliquota > 0 ? (
                          `${provento.aliquota.toFixed(1)}%`
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-right">
                        {provento.isento ? (
                          <span className="text-green-600 dark:text-green-400">Isento</span>
                        ) : (
                          <span className="text-primary">{formatCurrency(provento.irRetido, '')}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-right text-green-600">
                        {formatCurrency(provento.valorLiquido, '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td colSpan={3} className="py-3 px-4 text-right text-sm">Total:</td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(proventosFiltrados.reduce((sum, p) => sum + p.valorBruto, 0), '')}
                    </td>
                    <td className="py-3 px-4"></td>
                    <td className="py-3 px-4 text-right text-primary">
                      {formatCurrency(proventosFiltrados.reduce((sum, p) => sum + p.irRetido, 0), '')}
                    </td>
                    <td className="py-3 px-4 text-right text-green-600">
                      {formatCurrency(proventosFiltrados.reduce((sum, p) => sum + p.valorLiquido, 0), '')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


