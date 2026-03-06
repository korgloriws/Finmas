import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, DollarSign, TrendingDown } from 'lucide-react'
import { carteiraService, ativoService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

interface VenderAtivoModalProps {
  open: boolean
  onClose: () => void
  ativo: {
    id: number
    ticker: string
    nome_completo: string
    quantidade: number
    preco_atual: number
    valor_total: number
  } | null
}

export default function VenderAtivoModal({ open, onClose, ativo }: VenderAtivoModalProps) {
  const [quantidadeVender, setQuantidadeVender] = useState('')
  const [venderTudo, setVenderTudo] = useState(false)
  const [tipoPreco, setTipoPreco] = useState<'atual' | 'historico' | 'manual'>('atual')
  const [precoManual, setPrecoManual] = useState('')
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

  const queryClient = useQueryClient()
  const { user } = useAuth()

  useEffect(() => {
    if (open && ativo) {
      setQuantidadeVender('')
      setVenderTudo(false)
      setTipoPreco('atual')
      setPrecoManual('')
      setDataOperacao('')
      setPrecoAtual(null)
      setPrecoHistorico(null)
      setErroPrecoHistorico('')
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

  const precoVenda =
    tipoPreco === 'atual' && precoAtual
      ? precoAtual.preco
      : tipoPreco === 'historico' && precoHistorico
        ? precoHistorico.preco
        : tipoPreco === 'manual' && precoManual.trim()
          ? parseFloat(precoManual.replace(',', '.'))
          : null

  const qtyToSell = venderTudo ? ativo?.quantidade ?? 0 : (quantidadeVender.trim() ? parseFloat(quantidadeVender.replace(',', '.')) : 0)
  const quantidadeRestante = ativo ? Math.max(0, ativo.quantidade - qtyToSell) : 0
  const valorVenda = precoVenda != null && precoVenda > 0 && qtyToSell > 0 ? qtyToSell * precoVenda : 0

  const vendaValida =
    ativo &&
    qtyToSell > 0 &&
    qtyToSell <= ativo.quantidade &&
    precoVenda != null &&
    precoVenda > 0

  const venderMutation = useMutation({
    mutationFn: async () => {
      if (!ativo || !vendaValida) return
      const novaQuantidade = quantidadeRestante
      await carteiraService.atualizarAtivo(ativo.id, {
        quantidade: novaQuantidade,
        preco_atual: precoVenda!,
      })
      if (novaQuantidade === 0) {
        await carteiraService.removerAtivo(ativo.id)
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
      queryClient.refetchQueries({ queryKey: ['carteira', user] })
      queryClient.refetchQueries({ queryKey: ['carteira'] })
      onClose()
    },
  })

  if (!open || !ativo) return null

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="font-semibold flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              Vender ativo — {ativo.ticker}
            </div>
            <button onClick={onClose} className="p-2 rounded hover:bg-accent" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Posição atual</div>
              <div className="font-medium">{ativo.nome_completo}</div>
              <div className="text-sm text-muted-foreground">
                {ativo.quantidade} × R$ {ativo.preco_atual.toFixed(2)} = R$ {ativo.valor_total.toFixed(2)}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Quantidade a vender</label>
              <input
                type="text"
                value={venderTudo ? ativo.quantidade.toString() : quantidadeVender}
                onChange={(e) => setQuantidadeVender(e.target.value)}
                placeholder="Ex.: 100"
                disabled={venderTudo}
                className="w-full px-3 py-2 bg-background border border-border rounded disabled:opacity-70"
                aria-label="Quantidade a vender"
              />
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="vender-tudo"
                  checked={venderTudo}
                  onChange={(e) => {
                    setVenderTudo(e.target.checked)
                    if (e.target.checked) setQuantidadeVender(ativo.quantidade.toString())
                  }}
                  className="rounded"
                />
                <label htmlFor="vender-tudo" className="text-sm font-medium text-red-600 dark:text-red-400">
                  Vender tudo ({ativo.quantidade} unidades)
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium flex items-center gap-2">
                <DollarSign size={14} />
                Preço da venda
              </label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="preco-atual-venda"
                    name="tipo-preco-venda"
                    checked={tipoPreco === 'atual'}
                    onChange={() => setTipoPreco('atual')}
                    className="text-primary"
                  />
                  <label htmlFor="preco-atual-venda" className="text-sm">Preço atual</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="preco-historico-venda"
                    name="tipo-preco-venda"
                    checked={tipoPreco === 'historico'}
                    onChange={() => setTipoPreco('historico')}
                    className="text-primary"
                  />
                  <label htmlFor="preco-historico-venda" className="text-sm">Preço histórico</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="preco-manual-venda"
                    name="tipo-preco-venda"
                    checked={tipoPreco === 'manual'}
                    onChange={() => setTipoPreco('manual')}
                    className="text-primary"
                  />
                  <label htmlFor="preco-manual-venda" className="text-sm">Preço manual</label>
                </div>
              </div>

              {tipoPreco === 'historico' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Data da venda</label>
                  <input
                    type="date"
                    value={dataOperacao}
                    onChange={(e) => setDataOperacao(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-background border border-border rounded"
                    aria-label="Data da venda"
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
                    value={precoManual}
                    onChange={(e) => setPrecoManual(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded"
                    aria-label="Preço por unidade"
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

            {vendaValida && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Resumo da venda</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Quantidade a vender:</span>
                    <span>{qtyToSell}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Preço:</span>
                    <span>R$ {precoVenda!.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>Valor da venda:</span>
                    <span className="text-red-600">− R$ {valorVenda.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Quantidade restante:</span>
                    <span>{quantidadeRestante}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => venderMutation.mutate()}
                disabled={venderMutation.isPending || !vendaValida}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {venderMutation.isPending ? 'Processando...' : venderTudo ? 'Vender tudo' : 'Confirmar venda'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
