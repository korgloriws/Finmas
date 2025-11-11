import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Calculator, DollarSign, Loader2 } from 'lucide-react'
import { ativoService } from '../../services/api'
import { formatCurrency } from '../../utils/formatters'
import { normalizeTicker } from '../../utils/tickerUtils'

interface CalculadoraDividendosModalProps {
  isOpen: boolean
  onClose: () => void
  ticker?: string
  valorDividendo?: number
  nomeAtivo?: string
}

export default function CalculadoraDividendosModal({
  isOpen,
  onClose,
  ticker: tickerInicial,
  valorDividendo: valorDividendoInicial,
  nomeAtivo: nomeAtivoInicial
}: CalculadoraDividendosModalProps) {
  const [ticker, setTicker] = useState(tickerInicial || '')
  const [quantidade, setQuantidade] = useState<number | ''>('')
  const [valorDividendo, setValorDividendo] = useState<number | ''>(valorDividendoInicial || '')
  const [nomeAtivo, setNomeAtivo] = useState(nomeAtivoInicial || '')

  // Resetar quando o modal abrir com novos valores
  useEffect(() => {
    if (isOpen) {
      if (tickerInicial) {
        setTicker(tickerInicial)
        setNomeAtivo(nomeAtivoInicial || '')
      }
      if (valorDividendoInicial) {
        setValorDividendo(valorDividendoInicial)
      }
      if (!tickerInicial) {
        setTicker('')
        setQuantidade('')
        setValorDividendo('')
        setNomeAtivo('')
      }
    }
  }, [isOpen, tickerInicial, valorDividendoInicial, nomeAtivoInicial])

  // Buscar preço atual do ativo
  const { data: precoData, isLoading: loadingPreco, error: errorPreco } = useQuery({
    queryKey: ['preco-atual', ticker],
    queryFn: async () => {
      if (!ticker) return null
      const normalized = normalizeTicker(ticker)
      return await ativoService.getPrecoAtual(normalized)
    },
    enabled: !!ticker && isOpen,
    staleTime: 2 * 60 * 1000, // 2 minutos
    retry: 1,
  })

  // Calcular resultado
  const resultado = useMemo(() => {
    if (!quantidade || !valorDividendo) return null
    
    const qty = typeof quantidade === 'number' ? quantidade : parseFloat(String(quantidade))
    const valor = typeof valorDividendo === 'number' ? valorDividendo : parseFloat(String(valorDividendo))
    
    if (isNaN(qty) || isNaN(valor) || qty <= 0 || valor <= 0) return null
    
    const total = qty * valor
    const preco = precoData?.preco || 0
    const dividendYield = preco > 0 ? (valor / preco) * 100 : 0
    
    return {
      total,
      preco,
      dividendYield,
      quantidade: qty,
      valorDividendo: valor
    }
  }, [quantidade, valorDividendo, precoData])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Calculator className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Calculadora de Dividendos</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Ticker */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Ticker do Ativo
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="Ex: ALLD3, HGLG11"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {nomeAtivo && (
              <p className="mt-1 text-sm text-muted-foreground">{nomeAtivo}</p>
            )}
          </div>

          {/* Valor do Dividendo */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Valor do Dividendo por Ação (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorDividendo}
              onChange={(e) => {
                const val = e.target.value
                setValorDividendo(val === '' ? '' : parseFloat(val))
              }}
              placeholder="Ex: 1.91"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Quantidade de Ações
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={quantidade}
              onChange={(e) => {
                const val = e.target.value
                setQuantidade(val === '' ? '' : parseInt(val, 10))
              }}
              placeholder="Ex: 10"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Cotação Atual */}
          {ticker && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Cotação Atual</span>
                {loadingPreco ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Buscando...</span>
                  </div>
                ) : errorPreco ? (
                  <span className="text-sm text-red-500">Erro ao buscar cotação</span>
                ) : precoData?.preco ? (
                  <span className="text-lg font-bold text-foreground">
                    {formatCurrency(precoData.preco)}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Não disponível</span>
                )}
              </div>
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div className="bg-primary/10 border-2 border-primary rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-bold text-foreground">Resultado</h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Quantidade de ações:</span>
                  <span className="font-semibold text-foreground">{resultado.quantidade.toLocaleString('pt-BR')}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Valor do dividendo por ação:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(resultado.valorDividendo)}</span>
                </div>

                {resultado.preco > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Cotação atual:</span>
                    <span className="font-semibold text-foreground">{formatCurrency(resultado.preco)}</span>
                  </div>
                )}

                {resultado.dividendYield > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Dividend Yield:</span>
                    <span className="font-semibold text-primary">{resultado.dividendYield.toFixed(2)}%</span>
                  </div>
                )}

                <div className="pt-3 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-foreground">Total a Receber:</span>
                    <span className="text-3xl font-bold text-primary">
                      {formatCurrency(resultado.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instruções */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Como usar:</strong> Informe o ticker do ativo, o valor do dividendo por ação e a quantidade de ações que você possui. 
              O sistema buscará automaticamente a cotação atual e calculará o total que você receberá.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

