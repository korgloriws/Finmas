import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Calculator, Calendar, DollarSign, Loader2, Info, ArrowRight } from 'lucide-react'
import { correcaoMonetariaService } from '../services/api'
import { formatCurrency } from '../utils/formatters'

function formatDataParaInput(s: string): string {
  if (!s) return ''
  const d = s.replace(/\D/g, '')
  if (d.length <= 8) {
    const dd = d.slice(0, 2)
    const mm = d.slice(2, 4)
    const yyyy = d.slice(4, 8)
    return [dd, mm, yyyy].filter(Boolean).join('/')
  }
  return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4, 8)
}

export default function CorrecaoMonetariaPage() {
  const [indiceId, setIndiceId] = useState<string>('ipca')
  const [dataInicio, setDataInicio] = useState<string>('01/01/2020')
  const [dataFim, setDataFim] = useState<string>(() => {
    const d = new Date()
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  })
  const [valor, setValor] = useState<string>('1000')
  const [resultado, setResultado] = useState<{
    fator: number
    valor_corrigido: number
    meses: number
    indice_nome: string
    indices_usados: Array<{ data: string; valor: number }>
  } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [calculando, setCalculando] = useState(false)

  const { data: indices, isLoading: loadingIndices } = useQuery({
    queryKey: ['correcao-monetaria-indices'],
    queryFn: () => correcaoMonetariaService.getIndices(),
    staleTime: 10 * 60 * 1000,
  })

  const toApiDate = useCallback((ddmmyyyy: string) => {
    const parts = ddmmyyyy.replace(/\D/g, '').match(/(\d{2})(\d{2})(\d{4})/)
    if (!parts) return ''
    return `${parts[3]}-${parts[2]}-${parts[1]}`
  }, [])

  const handleCalcular = useCallback(async () => {
    setErro(null)
    setResultado(null)
    const v = parseFloat(valor.replace(/\s/g, '').replace(',', '.')) || 0
    const di = toApiDate(dataInicio)
    const df = toApiDate(dataFim)
    if (!di || !df) {
      setErro('Informe as datas no formato DD/MM/AAAA.')
      return
    }
    setCalculando(true)
    try {
      const res = await correcaoMonetariaService.calcular({
        indice_id: indiceId,
        data_inicio: di,
        data_fim: df,
        valor: v,
      })
      if (res.erro && res.fator == null) {
        setErro(res.erro)
        return
      }
      if (res.fator != null && res.valor_corrigido != null) {
        setResultado({
          fator: res.fator,
          valor_corrigido: res.valor_corrigido,
          meses: res.meses,
          indice_nome: res.indice_nome || indiceId.toUpperCase(),
          indices_usados: res.indices_usados || [],
        })
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao calcular.')
    } finally {
      setCalculando(false)
    }
  }, [indiceId, dataInicio, dataFim, valor, toApiDate])

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6">
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
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Correção Monetária</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Corrija valores pelo IPCA, INPC, IGP-M e outros índices do Banco Central
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex gap-3 p-4 rounded-xl border border-border bg-primary/5"
      >
        <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm text-foreground">
          <p className="font-medium mb-0.5">Calculadora do Cidadão</p>
          <p className="text-muted-foreground">
            Use os índices oficiais do Banco Central (BCB) para corrigir valores monetários por período. 
            O fator de correção é obtido pelo produto das variações mensais do índice no intervalo informado.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="bg-card border border-border rounded-xl shadow-sm p-4 sm:p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Período e valor
        </h2>

        {loadingIndices ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando índices...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="correcao-indice" className="block text-sm font-medium text-foreground mb-1">Índice</label>
                <select
                  id="correcao-indice"
                  value={indiceId}
                  onChange={(e) => setIndiceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  aria-label="Índice de correção monetária"
                >
                  {(indices || []).map((idx: { id: string; nome: string; descricao?: string }) => (
                    <option key={idx.id} value={idx.id}>
                      {idx.nome} {idx.descricao ? `— ${idx.descricao}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Valor a corrigir (R$)</label>
                <input
                  type="text"
                  value={valor}
                  onChange={(e) => setValor(e.target.value.replace(/\s/g, '').replace(',', '.'))}
                  placeholder="Ex: 1.000,00"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Data inicial</label>
                <input
                  type="text"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(formatDataParaInput(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Data final</label>
                <input
                  type="text"
                  value={dataFim}
                  onChange={(e) => setDataFim(formatDataParaInput(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCalcular}
              disabled={calculando}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {calculando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calculando...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  Corrigir valor
                </>
              )}
            </button>
          </>
        )}
      </motion.div>

      {erro && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-sm"
        >
          {erro}
        </motion.div>
      )}

      {resultado && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl shadow-sm p-4 sm:p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Resultado
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Valor corrigido ({resultado.indice_nome})</p>
              <p className="text-xl sm:text-2xl font-bold text-primary mt-1">
                {formatCurrency(resultado.valor_corrigido)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Fator acumulado</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                {resultado.fator.toFixed(4)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {resultado.meses} mês(es) no período
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowRight className="w-4 h-4" />
            {formatCurrency(parseFloat(valor) || 0)} (valor original) × {resultado.fator.toFixed(4)} = {formatCurrency(resultado.valor_corrigido)}
          </div>
        </motion.div>
      )}
    </div>
  )
}
