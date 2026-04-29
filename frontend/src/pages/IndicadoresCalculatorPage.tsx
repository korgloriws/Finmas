import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calculator, Calendar, TrendingUp, Landmark, Loader2 } from 'lucide-react'
import { carteiraService } from '../services/api'
import { normalizeIndexerAnnualRate } from '../utils/fixedIncomeCalculator'
import { formatCurrency } from '../utils/formatters'

type Indicador = 'CDI' | 'SELIC' | 'IPCA'

export default function IndicadoresCalculatorPage() {
  const [indicador, setIndicador] = useState<Indicador>('CDI')
  const [valorInicial, setValorInicial] = useState('1000')
  const [percentualIndexador, setPercentualIndexador] = useState('100')
  const [dataInicio, setDataInicio] = useState('2024-01-01')
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10))

  const { data: indicadores, isLoading } = useQuery({
    queryKey: ['indicadores-bcb-calculadora'],
    queryFn: carteiraService.getIndicadores,
    staleTime: 10 * 60 * 1000,
  })

  const resultado = useMemo(() => {
    const principal = parseFloat(valorInicial.replace(',', '.')) || 0
    const pctIndexador = parseFloat(percentualIndexador.replace(',', '.')) || 0
    const inicio = new Date(`${dataInicio}T00:00:00`)
    const fim = new Date(`${dataFim}T00:00:00`)

    if (principal <= 0 || pctIndexador <= 0 || Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim <= inicio) {
      return null
    }

    const dias = Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
    if (dias <= 0) return null

    const taxaBaseAnual =
      indicador === 'CDI'
        ? normalizeIndexerAnnualRate('CDI', indicadores?.cdi)
        : indicador === 'SELIC'
          ? normalizeIndexerAnnualRate('SELIC', indicadores?.selic)
          : normalizeIndexerAnnualRate('IPCA', indicadores?.ipca)

    if (!taxaBaseAnual || taxaBaseAnual <= 0) return null

    const taxaEfetivaAnual = taxaBaseAnual * (pctIndexador / 100)
    const fator = Math.pow(1 + taxaEfetivaAnual / 100, dias / 365)
    const montanteFinal = principal * fator
    const rendimento = montanteFinal - principal

    return {
      dias,
      taxaBaseAnual,
      taxaEfetivaAnual,
      montanteFinal,
      rendimento,
      fator,
    }
  }, [dataFim, dataInicio, indicador, indicadores?.cdi, indicadores?.ipca, indicadores?.selic, percentualIndexador, valorInicial])

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Landmark className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Calculadora por Indicadores (BCB)</h1>
          <p className="text-sm text-muted-foreground">
            Simule rendimentos usando CDI, SELIC ou IPCA com as taxas atuais do Banco Central.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="indicador-bcb" className="block text-sm text-muted-foreground mb-1">Indicador</label>
            <select
              id="indicador-bcb"
              aria-label="Selecionar indicador do Banco Central"
              value={indicador}
              onChange={(e) => setIndicador(e.target.value as Indicador)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
            >
              <option value="CDI">CDI</option>
              <option value="SELIC">SELIC</option>
              <option value="IPCA">IPCA</option>
            </select>
          </div>
          <div>
            <label htmlFor="percentual-indicador" className="block text-sm text-muted-foreground mb-1">% do indicador</label>
            <input
              id="percentual-indicador"
              type="number"
              min="0"
              step="0.01"
              value={percentualIndexador}
              onChange={(e) => setPercentualIndexador(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
              placeholder="Ex.: 100, 120"
            />
          </div>
          <div>
            <label htmlFor="valor-inicial-indicador" className="block text-sm text-muted-foreground mb-1">Valor inicial (R$)</label>
            <input
              id="valor-inicial-indicador"
              type="number"
              min="0"
              step="0.01"
              value={valorInicial}
              onChange={(e) => setValorInicial(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="data-inicio-indicador" className="block text-sm text-muted-foreground mb-1">Data início</label>
              <input
                id="data-inicio-indicador"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
              />
            </div>
            <div>
              <label htmlFor="data-fim-indicador" className="block text-sm text-muted-foreground mb-1">Data fim</label>
              <input
                id="data-fim-indicador"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          Resultado da simulação
        </h2>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando taxas do Banco Central...
          </div>
        ) : !resultado ? (
          <p className="text-sm text-muted-foreground">
            Preencha os dados com período válido para calcular.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="p-4 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Taxa base anual</p>
              <p className="text-lg font-bold">{resultado.taxaBaseAnual.toFixed(2)}% a.a.</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground">% efetivo aplicado</p>
              <p className="text-lg font-bold">{resultado.taxaEfetivaAnual.toFixed(2)}% a.a.</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Período</p>
              <p className="text-lg font-bold">{resultado.dias} dias</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground">Valor inicial</p>
              <p className="text-lg font-bold">{formatCurrency(parseFloat(valorInicial) || 0)}</p>
            </div>
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <p className="text-xs text-primary">Montante final</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(resultado.montanteFinal)}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground">Rendimento total</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(resultado.rendimento)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
