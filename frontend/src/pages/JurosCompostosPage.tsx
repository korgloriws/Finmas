import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Calculator,
  TrendingUp,
  Lightbulb,
  Target,
  Zap,
  DollarSign,
  PiggyBank,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from '../components/LazyChart'

type NumberInputEvent = React.ChangeEvent<HTMLInputElement>

const PRESETS = [
  { label: 'Conservador', taxa: 6, anos: 10 },
  { label: 'Moderado', taxa: 12, anos: 15 },
  { label: 'Agressivo', taxa: 15, anos: 20 },
  { label: 'Longo prazo', taxa: 10, anos: 30 },
]

export default function JurosCompostosPage() {
  const [valorInicial, setValorInicial] = useState<string>('1000')
  const [aporteMensal, setAporteMensal] = useState<string>('100')
  const [taxaAnualPct, setTaxaAnualPct] = useState<string>('12')
  const [anos, setAnos] = useState<string>('10')

  const parsed = useMemo(() => {
    const vi = parseFloat(valorInicial || '0') || 0
    const am = parseFloat(aporteMensal || '0') || 0
    const t = (parseFloat(taxaAnualPct || '0') || 0) / 100
    const n = Math.max(0, Math.min(50, Math.floor(parseFloat(anos || '0') || 0)))
    return { vi, am, t, n }
  }, [valorInicial, aporteMensal, taxaAnualPct, anos])

  const dados = useMemo(() => {
    const { vi, am, t, n } = parsed
    const resultados: { ano: number; semJuros: number; comJuros: number }[] = []

    let saldoSem = vi
    let saldoCom = vi

    for (let ano = 1; ano <= n; ano++) {
      saldoSem += am * 12
      let saldoComAno = saldoCom
      const taxaMensal = Math.pow(1 + t, 1 / 12) - 1
      for (let m = 0; m < 12; m++) {
        saldoComAno = saldoComAno * (1 + taxaMensal) + am
      }
      saldoCom = saldoComAno
      resultados.push({ ano, semJuros: saldoSem, comJuros: saldoCom })
    }
    return resultados
  }, [parsed])

  const totalAportado = parsed.vi + parsed.am * 12 * parsed.n
  const montanteFinal = dados.length ? dados[dados.length - 1].comJuros : parsed.vi
  const montanteSemJuros = dados.length ? dados[dados.length - 1].semJuros : parsed.vi
  const jurosGerados = Math.max(0, montanteFinal - totalAportado)

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  const handleNumber = (setter: (v: string) => void) => (e: NumberInputEvent) =>
    setter(e.target.value.replace(/,/g, '.'))

  const applyPreset = (taxa: number, anosVal: number) => {
    setTaxaAnualPct(String(taxa))
    setAnos(String(anosVal))
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Calculator className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Calculadora de Juros Compostos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Simule crescimento com aportes e taxa de retorno
            </p>
          </div>
        </div>
      </motion.div>

      {/* Dica */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex gap-3 p-4 rounded-xl border border-border dark:border-white/20 bg-primary/5 dark:bg-primary/10"
      >
        <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm text-foreground">
          <p className="font-medium mb-0.5">O dinheiro trabalha por você</p>
          <p className="text-muted-foreground">
            Nos juros compostos, os rendimentos entram sobre o valor já acumulado. Quanto mais tempo e consistência, maior o efeito.
          </p>
        </div>
      </motion.div>

      {/* Presets */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <p className="text-sm font-medium text-foreground mb-2">Cenários rápidos</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.taxa, p.anos)}
              className="px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 text-sm font-medium transition-colors"
            >
              {p.label} ({p.taxa}% a.a., {p.anos}a)
            </button>
          ))}
        </div>
      </motion.div>

      {/* Inputs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          { id: 'valor-inicial', label: 'Valor inicial', value: valorInicial, set: setValorInicial, placeholder: 'Ex.: 1000' },
          { id: 'aporte-mensal', label: 'Aporte mensal', value: aporteMensal, set: setAporteMensal, placeholder: 'Ex.: 100' },
          { id: 'taxa-anual', label: 'Taxa a.a. (%)', value: taxaAnualPct, set: setTaxaAnualPct, placeholder: 'Ex.: 12' },
          { id: 'periodo-anos', label: 'Período (anos)', value: anos, set: setAnos, placeholder: 'Ex.: 10' },
        ].map((field) => (
          <div
            key={field.id}
            className="bg-card border border-border dark:border-white/20 rounded-xl p-4 shadow-sm hover:border-primary/20 transition-colors"
          >
            <label htmlFor={field.id} className="block text-sm text-muted-foreground mb-2">
              {field.label}
            </label>
            <input
              type="number"
              inputMode="decimal"
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
              value={field.value}
              onChange={handleNumber(field.set)}
              min="0"
              step={field.id === 'taxa-anual' ? '0.01' : undefined}
              id={field.id}
              placeholder={field.placeholder}
            />
          </div>
        ))}
      </motion.div>

      {/* Resultado em destaque - Juros gerados */}
      {dados.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <div className="bg-card border border-border dark:border-white/20 rounded-xl p-5 shadow-sm">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1">
              <PiggyBank className="w-4 h-4" />
              Total aportado
            </p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalAportado)}</p>
          </div>
          <div className="bg-card border border-border dark:border-white/20 rounded-xl p-5 shadow-sm">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1">
              <Target className="w-4 h-4" />
              Montante sem juros
            </p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(montanteSemJuros)}</p>
          </div>
          <div className="bg-card border-2 border-primary/50 dark:border-primary/40 rounded-xl p-5 shadow-lg shadow-primary/10 bg-primary/5 dark:bg-primary/10">
            <p className="text-sm text-primary font-medium flex items-center gap-1.5 mb-1">
              <Zap className="w-4 h-4" />
              Juros gerados
            </p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(jurosGerados)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalAportado > 0
                ? `${((jurosGerados / totalAportado) * 100).toFixed(0)}% sobre o que você aportou`
                : 'Ajuste os valores acima'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Gráfico */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="bg-card border border-border dark:border-white/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-md bg-primary/10">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Evolução do patrimônio</h2>
        </div>
        <div className="h-72 sm:h-80 md:h-96">
          {dados.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dados}
                margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                isAnimationActive
                animationDuration={1200}
                animationEasing="ease-out"
              >
                <defs>
                  <linearGradient id="jurosComJuros" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="jurosSemJuros" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="ano"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `Ano ${v}`}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  width={52}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                  formatter={(value: unknown) => formatCurrency(Number(value))}
                  labelFormatter={(l) => (l != null ? `Ano ${l}` : '')}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="semJuros"
                  name="Sem juros"
                  stroke="hsl(var(--muted-foreground))"
                  fill="url(#jurosSemJuros)"
                  strokeWidth={2}
                  isAnimationActive
                  animationDuration={800}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="comJuros"
                  name="Com juros compostos"
                  stroke="hsl(var(--primary))"
                  fill="url(#jurosComJuros)"
                  strokeWidth={2.5}
                  isAnimationActive
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground rounded-lg bg-muted/30">
              <DollarSign className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">Informe o período em anos para ver o gráfico</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Montante final em card */}
      {dados.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="bg-card border border-border dark:border-white/20 rounded-xl p-5 text-center"
        >
          <p className="text-sm text-muted-foreground mb-1">Montante final (com juros compostos)</p>
          <p className="text-2xl sm:text-3xl font-bold text-primary">{formatCurrency(montanteFinal)}</p>
        </motion.div>
      )}
    </div>
  )
}
