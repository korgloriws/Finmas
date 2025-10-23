import { useQuery } from '@tanstack/react-query'
import { controleService } from '../services/api'

/**
 * Hook otimizado para dados de controle
 * Busca todos os dados de uma vez ao invés de múltiplas chamadas
 */
export function useOptimizedControle(mes?: string, ano?: string) {
  return useQuery({
    queryKey: ['controle-completo', mes, ano],
    queryFn: () => controleService.getDadosCompletos(mes, ano),
    retry: 2,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
    // Configurações para performance
    refetchOnMount: false,
    refetchOnReconnect: false,
  })
}

/**
 * Hook para dados de controle com fallback para queries individuais
 * Usa o endpoint otimizado quando possível, fallback para individuais
 */
export function useControleData(mes?: string, ano?: string) {
  const { data: dadosCompletos, isLoading, error } = useOptimizedControle(mes, ano)
  
  // Se o endpoint otimizado falhar, usar queries individuais como fallback
  const { data: receitas } = useQuery({
    queryKey: ['receitas', mes, ano],
    queryFn: () => controleService.getReceitas(mes, ano),
    enabled: !!error, // Só executa se o endpoint otimizado falhar
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })
  
  const { data: outros } = useQuery({
    queryKey: ['outros', mes, ano],
    queryFn: () => controleService.getOutros(mes, ano),
    enabled: !!error,
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })
  
  const { data: saldo } = useQuery({
    queryKey: ['saldo', mes, ano],
    queryFn: () => controleService.getSaldo(mes, ano),
    enabled: !!error,
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })
  
  const { data: evolucao } = useQuery({
    queryKey: ['evolucao-financeira', mes, ano],
    queryFn: () => controleService.getEvolucaoFinanceira(mes, ano),
    enabled: !!error,
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })
  
  const { data: receitasDespesas } = useQuery({
    queryKey: ['receitas-despesas', mes, ano],
    queryFn: () => controleService.getReceitasDespesas(mes, ano),
    enabled: !!error,
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })
  
  // Retornar dados otimizados ou fallback
  if (dadosCompletos && !error) {
    return {
      receitas: dadosCompletos.receitas,
      outros: dadosCompletos.outros,
      saldo: dadosCompletos.saldo,
      evolucao: dadosCompletos.evolucao,
      receitasDespesas: dadosCompletos.receitas_despesas,
      isLoading,
      error: null
    }
  }
  
  // Fallback para queries individuais
  return {
    receitas: receitas || [],
    outros: outros || [],
    saldo: saldo?.saldo || 0,
    evolucao: evolucao || [],
    receitasDespesas: receitasDespesas || { receitas: 0, despesas: 0 },
    isLoading: isLoading,
    error
  }
}
