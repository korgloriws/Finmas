import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, DollarSign, BarChart3 } from 'lucide-react'
import { carteiraService, ativoService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

interface EditAtivoModalProps {
  open: boolean
  onClose: () => void
  ativo: {
    id: number
    ticker: string
    nome_completo: string
    quantidade: number
    preco_atual: number
    valor_total: number
    preco_compra?: number | null
    preco_medio?: number | null
  } | null
}

type ModoAjuste = 'preco_compra' | 'preco_medio'

export default function EditAtivoModal({ open, onClose, ativo }: EditAtivoModalProps) {
  const [modo, setModo] = useState<ModoAjuste>('preco_compra')
  // Preço de compra: origem do valor (atual, histórico, manual)
  const [tipoPreco, setTipoPreco] = useState<'atual' | 'historico' | 'manual'>('atual')
  const [precoManualCompra, setPrecoManualCompra] = useState('')
  const [dataOperacao, setDataOperacao] = useState('')
  const [precoAtual, setPrecoAtual] = useState<{ preco: number; data: string; ticker: string } | null>(null)
  const [precoHistorico, setPrecoHistorico] = useState<{
    preco: number
    data_historico: string
    data_solicitada: string
    ticker: string
  } | null>(null)
  const [erroPrecoHistorico, setErroPrecoHistorico] = useState('')
  const [carregandoPreco, setCarregandoPreco] = useState(false)
  // Preço médio: único campo manual (ajuste direto, não altera o cálculo em outras partes)
  const [precoMedioManual, setPrecoMedioManual] = useState('')

  const queryClient = useQueryClient()
  const { user } = useAuth()

  useEffect(() => {
    if (open && ativo) {
      setModo('preco_compra')
      setTipoPreco('atual')
      setPrecoManualCompra('')
      setDataOperacao('')
      setPrecoAtual(null)
      setPrecoHistorico(null)
      setErroPrecoHistorico('')
      const pm = (ativo as any).preco_medio ?? ativo.preco_compra
      setPrecoMedioManual(pm != null && Number(pm) > 0 ? String(Number(pm).toFixed(2)) : '')
    }
  }, [open, ativo])

  useEffect(() => {
    if (open && ativo && tipoPreco === 'atual' && !precoAtual) {
      const buscarPrecoAtual = async () => {
        try {
          setCarregandoPreco(true)
          const ticker = ativo.ticker.toUpperCase()
          const isRendaFixa =
            ticker.includes('TD-') ||
            ticker.includes('CDB') ||
            ticker.includes('LCI') ||
            ticker.includes('LCA') ||
            ticker.includes('DEB') ||
            ticker.includes('TESOURO') ||
            ativo.ticker.includes('renda fixa')
          if (isRendaFixa) {
            setPrecoAtual({
              preco: ativo.preco_atual,
              data: new Date().toISOString().split('T')[0],
              ticker: ativo.ticker,
            })
          } else {
            const resultado = await ativoService.getPrecoAtual(ativo.ticker)
            setPrecoAtual(resultado)
          }
        } catch {
          setPrecoAtual({
            preco: ativo.preco_atual,
            data: new Date().toISOString().split('T')[0],
            ticker: ativo.ticker,
          })
        } finally {
          setCarregandoPreco(false)
        }
      }
      buscarPrecoAtual()
    }
  }, [open, ativo, tipoPreco])

  useEffect(() => {
    if (open && ativo && tipoPreco === 'historico' && dataOperacao) {
      const buscarPrecoHistorico = async () => {
        try {
          setCarregandoPreco(true)
          setErroPrecoHistorico('')
          const ticker = ativo.ticker.toUpperCase()
          const isRendaFixa =
            ticker.includes('TD-') ||
            ticker.includes('CDB') ||
            ticker.includes('LCI') ||
            ticker.includes('LCA') ||
            ticker.includes('DEB') ||
            ticker.includes('TESOURO') ||
            ativo.ticker.includes('renda fixa')
          if (isRendaFixa) {
            setPrecoHistorico({
              preco: ativo.preco_atual,
              data_historico: dataOperacao,
              data_solicitada: dataOperacao,
              ticker: ativo.ticker,
            })
          } else {
            const resultado = await ativoService.getPrecoHistorico(ativo.ticker, dataOperacao)
            setPrecoHistorico(resultado)
          }
        } catch (error: any) {
          setErroPrecoHistorico(error.response?.data?.error || 'Erro ao buscar preço histórico')
          setPrecoHistorico(null)
        } finally {
          setCarregandoPreco(false)
        }
      }
      buscarPrecoHistorico()
    }
  }, [open, ativo, tipoPreco, dataOperacao])

  const valorPrecoCompra =
    tipoPreco === 'atual' && precoAtual
      ? precoAtual.preco
      : tipoPreco === 'historico' && precoHistorico
        ? precoHistorico.preco
        : tipoPreco === 'manual' && precoManualCompra
          ? parseFloat(precoManualCompra.replace(',', '.'))
          : null

  const valorPrecoMedio = precoMedioManual.trim()
    ? parseFloat(precoMedioManual.replace(',', '.'))
    : null

  const atualizarMutation = useMutation({
    mutationFn: async () => {
      if (!ativo) return
      if (modo === 'preco_compra') {
        const preco = valorPrecoCompra
        if (preco == null || preco <= 0) return
        return carteiraService.atualizarAtivo(ativo.id, {
          quantidade: ativo.quantidade,
          preco_compra: preco,
        })
      } else {
        const pm = valorPrecoMedio
        if (pm == null || pm <= 0) return
        return carteiraService.atualizarAtivo(ativo.id, { preco_medio: pm })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carteira', user] })
      queryClient.invalidateQueries({ queryKey: ['movimentacoes', user] })
      queryClient.invalidateQueries({ queryKey: ['carteira-insights', user] })
      queryClient.invalidateQueries({ queryKey: ['home-resumo', user] })
      queryClient.invalidateQueries({ queryKey: ['carteira-historico', user] })
      queryClient.invalidateQueries({ queryKey: ['carteira'] })
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] })
      queryClient.invalidateQueries({ queryKey: ['carteira-insights'] })
      queryClient.refetchQueries({ queryKey: ['carteira', user] })
      queryClient.refetchQueries({ queryKey: ['carteira'] })
      onClose()
    },
  })

  const podeConfirmar =
    modo === 'preco_compra'
      ? valorPrecoCompra != null && valorPrecoCompra > 0
      : valorPrecoMedio != null && valorPrecoMedio > 0

  if (!open || !ativo) return null

  const precoMedioAtual = (ativo as any).preco_medio ?? ativo.preco_compra ?? null
  const precoCompraAtual = ativo.preco_compra ?? null

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="font-semibold">Ajustar ativo — {ativo.ticker}</div>
            <button onClick={onClose} className="p-2 rounded hover:bg-accent" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Ativo</div>
              <div className="font-medium">{ativo.nome_completo}</div>
              <div className="text-sm text-muted-foreground">
                {ativo.quantidade} × R$ {ativo.preco_atual.toFixed(2)} = R$ {ativo.valor_total.toFixed(2)}
              </div>
              {(precoCompraAtual != null || precoMedioAtual != null) && (
                <div className="text-sm text-muted-foreground mt-1">
                  Preço de compra: {precoCompraAtual != null ? `R$ ${Number(precoCompraAtual).toFixed(2)}` : '—'} · Preço médio: {precoMedioAtual != null ? `R$ ${Number(precoMedioAtual).toFixed(2)}` : '—'}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium">O que deseja ajustar?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModo('preco_compra')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    modo === 'preco_compra'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  Preço de compra
                </button>
                <button
                  type="button"
                  onClick={() => setModo('preco_medio')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    modo === 'preco_medio'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Preço médio
                </button>
              </div>
            </div>

            {modo === 'preco_compra' && (
              <>
                <div className="space-y-4">
                  <label className="block text-sm font-medium">Novo preço de compra</label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="preco-atual-edit"
                        name="tipo-preco-edit"
                        checked={tipoPreco === 'atual'}
                        onChange={() => setTipoPreco('atual')}
                        className="text-primary"
                      />
                      <label htmlFor="preco-atual-edit" className="text-sm">Preço atual</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="preco-historico-edit"
                        name="tipo-preco-edit"
                        checked={tipoPreco === 'historico'}
                        onChange={() => setTipoPreco('historico')}
                        className="text-primary"
                      />
                      <label htmlFor="preco-historico-edit" className="text-sm">Preço histórico</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="preco-manual-edit"
                        name="tipo-preco-edit"
                        checked={tipoPreco === 'manual'}
                        onChange={() => setTipoPreco('manual')}
                        className="text-primary"
                      />
                      <label htmlFor="preco-manual-edit" className="text-sm">Preço manual</label>
                    </div>
                  </div>

                  {tipoPreco === 'historico' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Data da operação</label>
                      <input
                        type="date"
                        value={dataOperacao}
                        onChange={(e) => setDataOperacao(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 bg-background border border-border rounded"
                        aria-label="Data da operação"
                      />
                      {precoHistorico && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-200">
                          Preço encontrado: R$ {precoHistorico.preco.toFixed(2)} (data: {new Date(precoHistorico.data_historico).toLocaleDateString('pt-BR')})
                        </div>
                      )}
                      {erroPrecoHistorico && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                          {erroPrecoHistorico}
                        </div>
                      )}
                    </div>
                  )}

                  {tipoPreco === 'manual' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Preço por unidade (R$)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex.: 10,50"
                        value={precoManualCompra}
                        onChange={(e) => setPrecoManualCompra(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded"
                      />
                      {ativo?.ticker && /\-USD$/i.test(ativo.ticker) && (
                        <p className="text-xs text-muted-foreground">Para criptomoedas, informe o valor em R$.</p>
                      )}
                    </div>
                  )}

                  {tipoPreco === 'atual' && (
                    <div>
                      {carregandoPreco && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                          Buscando preço atual...
                        </div>
                      )}
                      {precoAtual && !carregandoPreco && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                          Preço atual: R$ {precoAtual.preco.toFixed(2)} (data: {new Date(precoAtual.data).toLocaleDateString('pt-BR')})
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {valorPrecoCompra != null && valorPrecoCompra > 0 && (
                  <div className="bg-muted/30 p-4 rounded-lg text-sm">
                    Será definido como preço de compra: <strong>R$ {valorPrecoCompra.toFixed(2)}</strong>. A quantidade não será alterada.
                  </div>
                )}
              </>
            )}

            {modo === 'preco_medio' && (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Novo preço médio (R$)</label>
                  <p className="text-xs text-muted-foreground">
                    O preço médio é usado no cálculo da valorização do ativo na carteira. Este ajuste apenas altera o valor exibido e usado nesse cálculo; não altera a lógica de cálculo do preço médio em outras partes do sistema (ex.: novas compras).
                  </p>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex.: 12,75"
                    value={precoMedioManual}
                    onChange={(e) => setPrecoMedioManual(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded"
                  />
                </div>
                {valorPrecoMedio != null && valorPrecoMedio > 0 && (
                  <div className="bg-muted/30 p-4 rounded-lg text-sm">
                    Será definido como preço médio: <strong>R$ {valorPrecoMedio.toFixed(2)}</strong>.
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => atualizarMutation.mutate()}
                disabled={atualizarMutation.isPending || !podeConfirmar}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {atualizarMutation.isPending ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
