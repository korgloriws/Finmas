import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitCompareArrows, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { carteiraService } from '../services/api'
import { normalizeIndexerAnnualRate } from '../utils/fixedIncomeCalculator'
import { formatCurrency } from '../utils/formatters'

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

type ResultadoProduto = {
  nome: string
  taxaEfetivaAnual: number
  bruto: number
  iof: number
  ir: number
  liquido: number
  rendimentoLiquido: number
}

export default function ComparacaoInvestimentosPage() {
  const [valorInicial, setValorInicial] = useState('10000')
  const [dataInicio, setDataInicio] = useState('2026-01-01')
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10))
  const [cdbPctCdi, setCdbPctCdi] = useState('100')
  const [lciPctCdi, setLciPctCdi] = useState('95')
  const [tesouroSpread, setTesouroSpread] = useState('0')
  const [ipcaPct, setIpcaPct] = useState('100')
  const [ipcaMaisTaxa, setIpcaMaisTaxa] = useState('7')
  const [prefixadoTaxa, setPrefixadoTaxa] = useState('14')

  const applyPreset = (preset: 'conservador' | 'moderado' | 'arrojado') => {
    if (preset === 'conservador') {
      setCdbPctCdi('100')
      setLciPctCdi('92')
      setTesouroSpread('0')
      setIpcaPct('100')
      setIpcaMaisTaxa('5')
      setPrefixadoTaxa('12')
      return
    }
    if (preset === 'moderado') {
      setCdbPctCdi('110')
      setLciPctCdi('95')
      setTesouroSpread('0.10')
      setIpcaPct('100')
      setIpcaMaisTaxa('6')
      setPrefixadoTaxa('13')
      return
    }
    setCdbPctCdi('120')
    setLciPctCdi('98')
    setTesouroSpread('0.20')
    setIpcaPct('110')
    setIpcaMaisTaxa('7')
    setPrefixadoTaxa('14')
  }

  const { data: indicadores, isLoading } = useQuery({
    queryKey: ['indicadores-bcb-comparacao'],
    queryFn: carteiraService.getIndicadores,
    staleTime: 10 * 60 * 1000,
  })

  const resultado = useMemo(() => {
    const principal = parseFloat(valorInicial.replace(',', '.')) || 0
    const inicio = new Date(`${dataInicio}T00:00:00`)
    const fim = new Date(`${dataFim}T00:00:00`)
    const cdbPct = parseFloat(cdbPctCdi.replace(',', '.')) || 0
    const lciPct = parseFloat(lciPctCdi.replace(',', '.')) || 0
    const spreadTesouro = parseFloat(tesouroSpread.replace(',', '.')) || 0
    const ipcaPercentual = parseFloat(ipcaPct.replace(',', '.')) || 0
    const ipcaMais = parseFloat(ipcaMaisTaxa.replace(',', '.')) || 0
    const prefixado = parseFloat(prefixadoTaxa.replace(',', '.')) || 0

    if (principal <= 0 || Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim <= inicio) {
      return null
    }
    const dias = Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
    if (dias <= 0) return null

    const cdiAnual = normalizeIndexerAnnualRate('CDI', indicadores?.cdi) || 0
    const selicAnual = normalizeIndexerAnnualRate('SELIC', indicadores?.selic) || 0
    const ipcaAnual = normalizeIndexerAnnualRate('IPCA', indicadores?.ipca) || 0
    if (cdiAnual <= 0 || selicAnual <= 0 || ipcaAnual <= 0) return null

    const irRate = getIrRate(dias)
    const iofRate = getIofRate(dias)

    const calculaProduto = ({
      nome,
      taxaEfetivaAnual,
      temIr,
      temIof,
    }: {
      nome: string
      taxaEfetivaAnual: number
      temIr: boolean
      temIof: boolean
    }): ResultadoProduto => {
      const fator = Math.pow(1 + taxaEfetivaAnual / 100, dias / 365)
      const bruto = principal * fator
      const rendimentoBruto = bruto - principal
      const iof = temIof ? rendimentoBruto * iofRate : 0
      const baseIr = Math.max(0, rendimentoBruto - iof)
      const ir = temIr ? baseIr * irRate : 0
      const liquido = principal + baseIr - ir
      return {
        nome,
        taxaEfetivaAnual,
        bruto,
        iof,
        ir,
        liquido,
        rendimentoLiquido: liquido - principal,
      }
    }

    const produtos: ResultadoProduto[] = [
      calculaProduto({
        nome: `CDB ${cdbPct.toFixed(0)}% CDI`,
        taxaEfetivaAnual: cdiAnual * (cdbPct / 100),
        temIr: true,
        temIof: true,
      }),
      calculaProduto({
        nome: `Tesouro Selic ${spreadTesouro >= 0 ? '+' : ''}${spreadTesouro.toFixed(2)}%`,
        taxaEfetivaAnual: selicAnual + spreadTesouro,
        temIr: true,
        temIof: true,
      }),
      calculaProduto({
        nome: `LCI/LCA ${lciPct.toFixed(0)}% CDI`,
        taxaEfetivaAnual: cdiAnual * (lciPct / 100),
        temIr: false,
        temIof: false,
      }),
      calculaProduto({
        nome: `IPCA ${ipcaPercentual.toFixed(0)}%`,
        taxaEfetivaAnual: ipcaAnual * (ipcaPercentual / 100),
        temIr: true,
        temIof: true,
      }),
      calculaProduto({
        nome: `IPCA+ ${ipcaMais.toFixed(2)}%`,
        taxaEfetivaAnual: ipcaAnual + ipcaMais,
        temIr: true,
        temIof: true,
      }),
      calculaProduto({
        nome: `Prefixado ${prefixado.toFixed(2)}% a.a.`,
        taxaEfetivaAnual: prefixado,
        temIr: true,
        temIof: true,
      }),
    ].sort((a, b) => b.liquido - a.liquido)

    return { dias, cdiAnual, selicAnual, ipcaAnual, irRate, iofRate, produtos }
  }, [cdbPctCdi, dataFim, dataInicio, indicadores?.cdi, indicadores?.ipca, indicadores?.selic, ipcaMaisTaxa, ipcaPct, lciPctCdi, prefixadoTaxa, tesouroSpread, valorInicial])

  const resumoTopo = useMemo(() => {
    if (!resultado || !resultado.produtos.length) return null
    const melhor = resultado.produtos[0]
    const segundo = resultado.produtos[1]
    const diferenca = segundo ? melhor.liquido - segundo.liquido : 0
    return { melhor, diferenca }
  }, [resultado])

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center gap-3"
      >
        <div className="p-2.5 rounded-xl bg-primary/10">
          <GitCompareArrows className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Comparação de Investimentos</h1>
          <p className="text-sm text-muted-foreground">Compare CDB, Tesouro Selic e LCI/LCA com retorno líquido equivalente.</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.3 }}
        className="rounded-xl border border-border bg-primary/5 p-3 text-sm text-muted-foreground"
      >
        O card destacado mostra a melhor opção líquida para o período e taxas informadas.
      </motion.div>

      {resumoTopo && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <div className="rounded-xl border-2 border-primary/40 bg-primary/10 p-4 shadow-lg shadow-primary/10">
            <p className="text-xs text-primary font-medium">Melhor retorno líquido</p>
            <p className="text-sm mt-1">{resumoTopo.melhor.nome}</p>
            <motion.p
              key={`melhor-${resumoTopo.melhor.liquido.toFixed(2)}`}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="text-2xl sm:text-3xl font-extrabold text-primary mt-1"
            >
              {formatCurrency(resumoTopo.melhor.liquido)}
            </motion.p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Vantagem para o 2º colocado</p>
            <motion.p
              key={`diff-${resumoTopo.diferenca.toFixed(2)}`}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1"
            >
              {formatCurrency(resumoTopo.diferenca)}
            </motion.p>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
        className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">Cenários rápidos:</span>
          <button type="button" onClick={() => applyPreset('conservador')} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/60 transition-colors">Conservador</button>
          <button type="button" onClick={() => applyPreset('moderado')} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/60 transition-colors">Moderado</button>
          <button type="button" onClick={() => applyPreset('arrojado')} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/60 transition-colors">Arrojado</button>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">1) Base da simulação</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="comp-valor" className="block text-sm text-muted-foreground mb-1">Valor inicial (R$)</label>
              <input id="comp-valor" type="number" min="0" step="0.01" value={valorInicial} onChange={(e) => setValorInicial(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
            </div>
            <div>
              <label htmlFor="comp-inicio" className="block text-sm text-muted-foreground mb-1">Data início</label>
              <input id="comp-inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
            </div>
            <div>
              <label htmlFor="comp-fim" className="block text-sm text-muted-foreground mb-1">Data fim</label>
              <input id="comp-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">2) Taxas dos produtos para comparar</h3>
          <p className="text-xs text-muted-foreground">Ajuste os percentuais conforme as ofertas que você está analisando.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="comp-cdb" className="block text-sm text-muted-foreground mb-1">CDB (% CDI)</label>
              <input id="comp-cdb" type="number" min="0" step="0.01" value={cdbPctCdi} onChange={(e) => setCdbPctCdi(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
            </div>
            <div>
              <label htmlFor="comp-lci" className="block text-sm text-muted-foreground mb-1">LCI/LCA (% CDI)</label>
              <input id="comp-lci" type="number" min="0" step="0.01" value={lciPctCdi} onChange={(e) => setLciPctCdi(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
            </div>
            <div>
              <label htmlFor="comp-tesouro" className="block text-sm text-muted-foreground mb-1">Spread Tesouro Selic (% a.a.)</label>
              <input id="comp-tesouro" type="number" step="0.01" value={tesouroSpread} onChange={(e) => setTesouroSpread(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
            </div>
            <div>
              <label htmlFor="comp-ipca-pct" className="block text-sm text-muted-foreground mb-1">IPCA (% do índice)</label>
              <input id="comp-ipca-pct" type="number" min="0" step="0.01" value={ipcaPct} onChange={(e) => setIpcaPct(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
            </div>
            <div>
              <label htmlFor="comp-ipca-mais" className="block text-sm text-muted-foreground mb-1">IPCA+ (taxa fixa % a.a.)</label>
              <input id="comp-ipca-mais" type="number" min="0" step="0.01" value={ipcaMaisTaxa} onChange={(e) => setIpcaMaisTaxa(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
            </div>
            <div>
              <label htmlFor="comp-prefixado" className="block text-sm text-muted-foreground mb-1">Prefixado (% a.a.)</label>
              <input id="comp-prefixado" type="number" min="0" step="0.01" value={prefixadoTaxa} onChange={(e) => setPrefixadoTaxa(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.35 }}
        className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-3"
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando indicadores...</div>
        ) : !resultado ? (
          <p className="text-sm text-muted-foreground">Preencha os campos para comparar.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Período: <b>{resultado.dias}</b> dias | CDI: <b>{resultado.cdiAnual.toFixed(2)}%</b> a.a. | SELIC: <b>{resultado.selicAnual.toFixed(2)}%</b> a.a. | IPCA: <b>{resultado.ipcaAnual.toFixed(2)}%</b> a.a.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
              {resultado.produtos.map((p, idx) => (
                <motion.div
                  key={p.nome}
                  layout
                  whileHover={{ y: -3, scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                  className={`rounded-2xl p-5 border transition-all ${idx === 0 ? 'bg-primary/10 border-2 border-primary/40 shadow-xl shadow-primary/10' : 'bg-card border-border shadow-md'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-base">{p.nome}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Taxa efetiva estimada: <b>{p.taxaEfetivaAnual.toFixed(2)}% a.a.</b>
                      </p>
                    </div>
                    {idx === 0 && (
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-semibold whitespace-nowrap">
                        Melhor opção
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/40 border border-border/60 p-3">
                      <p className="text-xs text-muted-foreground">Valor bruto</p>
                      <p className="text-base font-semibold">{formatCurrency(p.bruto)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 border border-border/60 p-3">
                      <p className="text-xs text-muted-foreground">Custos (IOF + IR)</p>
                      <p className="text-base font-semibold">{formatCurrency(p.iof + p.ir)}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <p className="text-muted-foreground">IOF: <b className="text-foreground">{formatCurrency(p.iof)}</b></p>
                    <p className="text-muted-foreground">IR: <b className="text-foreground">{formatCurrency(p.ir)}</b></p>
                  </div>

                  <div className="mt-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                    <p className="text-xs font-medium text-primary uppercase tracking-wide">Resultado líquido final</p>
                    <motion.p
                      key={`liq-${p.nome}-${p.liquido.toFixed(2)}`}
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.22 }}
                      className="text-2xl sm:text-3xl font-extrabold text-primary mt-1"
                    >
                      {formatCurrency(p.liquido)}
                    </motion.p>
                    <motion.p
                      key={`rend-${p.nome}-${p.rendimentoLiquido.toFixed(2)}`}
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.22 }}
                      className="text-emerald-600 font-semibold mt-1"
                    >
                      Ganho líquido: {formatCurrency(p.rendimentoLiquido)}
                    </motion.p>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
