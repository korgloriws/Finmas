import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calculator, Calendar, TrendingUp, Landmark, Loader2, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { carteiraService } from '../services/api'
import { normalizeIndexerAnnualRate } from '../utils/fixedIncomeCalculator'
import { formatCurrency } from '../utils/formatters'

type TipoCalculo = 'CDI' | 'SELIC' | 'IPCA' | 'IPCA+' | 'PREFIXADO'

const getIofRate = (dias: number): number => {
  if (dias <= 0 || dias >= 30) return 0
  const tabela: Record<number, number> = {
    1: 0.96, 2: 0.93, 3: 0.9, 4: 0.86, 5: 0.83, 6: 0.8, 7: 0.76, 8: 0.73, 9: 0.7, 10: 0.66,
    11: 0.63, 12: 0.6, 13: 0.56, 14: 0.53, 15: 0.5, 16: 0.46, 17: 0.43, 18: 0.4, 19: 0.36, 20: 0.33,
    21: 0.3, 22: 0.26, 23: 0.23, 24: 0.2, 25: 0.16, 26: 0.13, 27: 0.1, 28: 0.06, 29: 0.03
  }
  return tabela[dias] ?? 0
}

const getIrRate = (dias: number): number => {
  if (dias <= 180) return 0.225
  if (dias <= 360) return 0.2
  if (dias <= 720) return 0.175
  return 0.15
}

export default function IndicadoresCalculatorPage() {
  const [tipo, setTipo] = useState<TipoCalculo>('CDI')
  const [valorInicial, setValorInicial] = useState('1000')
  const [percentualIndexador, setPercentualIndexador] = useState('100')
  const [taxaFixa, setTaxaFixa] = useState('2')
  const [dataInicio, setDataInicio] = useState('2024-01-01')
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10))
  const [modoAvancado, setModoAvancado] = useState(false)
  const [carenciaDias, setCarenciaDias] = useState('0')
  const [liquidezDiaria, setLiquidezDiaria] = useState(true)
  const [isentoIr, setIsentoIr] = useState(false)

  const { data: indicadores, isLoading } = useQuery({
    queryKey: ['indicadores-bcb-calculadora'],
    queryFn: carteiraService.getIndicadores,
    staleTime: 10 * 60 * 1000,
  })

  const resultado = useMemo(() => {
    const principal = parseFloat(valorInicial.replace(',', '.')) || 0
    const pctIndexador = parseFloat(percentualIndexador.replace(',', '.')) || 0
    const taxaFixaPct = parseFloat(taxaFixa.replace(',', '.')) || 0
    const carencia = Math.max(0, parseInt(carenciaDias || '0', 10) || 0)
    const inicio = new Date(`${dataInicio}T00:00:00`)
    const fim = new Date(`${dataFim}T00:00:00`)

    if (principal <= 0 || Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim <= inicio) {
      return null
    }

    const dias = Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
    if (dias <= 0) return null

    const taxaCdiAnual = normalizeIndexerAnnualRate('CDI', indicadores?.cdi) || 0
    const taxaSelicAnual = normalizeIndexerAnnualRate('SELIC', indicadores?.selic) || 0
    const taxaIpcaAnual = normalizeIndexerAnnualRate('IPCA', indicadores?.ipca) || 0

    let taxaBaseAnual = 0
    let taxaEfetivaAnual = 0
    if (tipo === 'CDI') {
      if (pctIndexador <= 0) return null
      taxaBaseAnual = taxaCdiAnual
      taxaEfetivaAnual = taxaBaseAnual * (pctIndexador / 100)
    } else if (tipo === 'SELIC') {
      if (pctIndexador <= 0) return null
      taxaBaseAnual = taxaSelicAnual
      taxaEfetivaAnual = taxaBaseAnual * (pctIndexador / 100)
    } else if (tipo === 'IPCA') {
      if (pctIndexador <= 0) return null
      taxaBaseAnual = taxaIpcaAnual
      taxaEfetivaAnual = taxaBaseAnual * (pctIndexador / 100)
    } else if (tipo === 'IPCA+') {
      taxaBaseAnual = taxaIpcaAnual
      taxaEfetivaAnual = taxaBaseAnual + taxaFixaPct
    } else {
      taxaBaseAnual = taxaFixaPct
      taxaEfetivaAnual = taxaFixaPct
    }

    if (taxaEfetivaAnual <= 0) return null

    const fator = Math.pow(1 + taxaEfetivaAnual / 100, dias / 365)
    const montanteFinal = principal * fator
    const rendimentoBruto = montanteFinal - principal

    const carenciaAtendida = dias >= carencia
    const iofRate = modoAvancado && liquidezDiaria && dias < 30 ? getIofRate(dias) : 0
    const iofValor = rendimentoBruto * iofRate
    const rendimentoAposIof = Math.max(0, rendimentoBruto - iofValor)
    const irRate = modoAvancado && !isentoIr ? getIrRate(dias) : 0
    const irValor = rendimentoAposIof * irRate
    const valorLiquido = principal + rendimentoAposIof - irValor
    const rendimentoLiquido = valorLiquido - principal

    return {
      dias,
      taxaBaseAnual,
      taxaEfetivaAnual,
      montanteFinal,
      rendimentoBruto,
      valorLiquido,
      rendimentoLiquido,
      iofRate,
      iofValor,
      irRate,
      irValor,
      carenciaAtendida,
      fator,
    }
  }, [carenciaDias, dataFim, dataInicio, indicadores?.cdi, indicadores?.ipca, indicadores?.selic, isentoIr, liquidezDiaria, modoAvancado, percentualIndexador, taxaFixa, tipo, valorInicial])

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center gap-3"
      >
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Landmark className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Calculadora por Indicadores (BCB)</h1>
          <p className="text-sm text-muted-foreground">
            Simule CDI, SELIC, IPCA, IPCA+ e Prefixado em modo simples ou completo.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.3 }}
        className="rounded-xl border border-border bg-primary/5 p-3 text-sm text-muted-foreground"
      >
        Dica: use <b>modo simples</b> para estimativa rápida e <b>modo completo</b> para simular resultado líquido com impostos.
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
        className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="indicador-bcb" className="block text-sm text-muted-foreground mb-1">Tipo de cálculo</label>
            <select
              id="indicador-bcb"
              aria-label="Selecionar tipo de cálculo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoCalculo)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
            >
              <option value="CDI">CDI</option>
              <option value="SELIC">SELIC</option>
              <option value="IPCA">IPCA</option>
              <option value="IPCA+">IPCA+</option>
              <option value="PREFIXADO">Prefixado</option>
            </select>
          </div>
          {(tipo === 'CDI' || tipo === 'SELIC' || tipo === 'IPCA') ? (
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
          ) : (
            <div>
              <label htmlFor="taxa-fixa-indicador" className="block text-sm text-muted-foreground mb-1">
                {tipo === 'IPCA+' ? 'Taxa fixa adicional (% a.a.)' : 'Taxa prefixada (% a.a.)'}
              </label>
              <input
                id="taxa-fixa-indicador"
                type="number"
                min="0"
                step="0.01"
                value={taxaFixa}
                onChange={(e) => setTaxaFixa(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
              />
            </div>
          )}
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

        <div className="border-t border-border pt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={modoAvancado} onChange={(e) => setModoAvancado(e.target.checked)} />
            Ativar modo completo (carência, liquidez, IR e IOF)
          </label>
          {modoAvancado && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="carencia-indicador" className="block text-sm text-muted-foreground mb-1">Carência (dias)</label>
                <input id="carencia-indicador" type="number" min="0" step="1" value={carenciaDias} onChange={(e) => setCarenciaDias(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground" />
              </div>
              <label className="flex items-center gap-2 text-sm mt-7">
                <input type="checkbox" checked={liquidezDiaria} onChange={(e) => setLiquidezDiaria(e.target.checked)} />
                Liquidez diária (IOF até 29 dias)
              </label>
              <label className="flex items-center gap-2 text-sm mt-7">
                <input type="checkbox" checked={isentoIr} onChange={(e) => setIsentoIr(e.target.checked)} />
                Isento de IR (LCI/LCA)
              </label>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.35 }}
        className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-3"
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          {modoAvancado ? <ShieldCheck className="w-5 h-5 text-primary" /> : <Calculator className="w-5 h-5 text-primary" />}
          Resultado da simulação {modoAvancado ? '(completo)' : ''}
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
            <div className="p-4 rounded-lg bg-muted/40 border border-border/60">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Taxa base anual</p>
              <p className="text-lg font-bold">{resultado.taxaBaseAnual.toFixed(2)}% a.a.</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/40 border border-border/60">
              <p className="text-xs text-muted-foreground">% efetivo aplicado</p>
              <p className="text-lg font-bold">{resultado.taxaEfetivaAnual.toFixed(2)}% a.a.</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/40 border border-border/60">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Período</p>
              <p className="text-lg font-bold">{resultado.dias} dias</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/40 border border-border/60">
              <p className="text-xs text-muted-foreground">Valor inicial</p>
              <p className="text-lg font-bold">{formatCurrency(parseFloat(valorInicial) || 0)}</p>
            </div>
            <div className="p-4 rounded-lg bg-primary/10 border-2 border-primary/40 shadow-lg shadow-primary/10">
              <p className="text-xs text-primary">Montante final</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(resultado.montanteFinal)}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/40 border border-border/60">
              <p className="text-xs text-muted-foreground">Rendimento bruto</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(resultado.rendimentoBruto)}</p>
            </div>
            {modoAvancado && (
              <>
                <div className="p-4 rounded-lg bg-muted/40 border border-border/60">
                  <p className="text-xs text-muted-foreground">IOF</p>
                  <p className="text-lg font-bold">{formatCurrency(resultado.iofValor)}</p>
                  <p className="text-xs text-muted-foreground">{(resultado.iofRate * 100).toFixed(1)}%</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40 border border-border/60">
                  <p className="text-xs text-muted-foreground">IR</p>
                  <p className="text-lg font-bold">{formatCurrency(resultado.irValor)}</p>
                  <p className="text-xs text-muted-foreground">{(resultado.irRate * 100).toFixed(1)}%</p>
                </div>
                <div className="p-4 rounded-lg bg-primary/10 border-2 border-primary/40 shadow-lg shadow-primary/10">
                  <p className="text-xs text-primary">Valor líquido</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(resultado.valorLiquido)}</p>
                  <p className="text-xs text-muted-foreground">Rendimento líquido: {formatCurrency(resultado.rendimentoLiquido)}</p>
                </div>
              </>
            )}
          </div>
        )}

        {modoAvancado && resultado && !resultado.carenciaAtendida && (
          <p className="text-sm text-amber-600">Atenção: período menor que a carência informada.</p>
        )}
      </motion.div>
    </div>
  )
}
