import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos - cache mais longo
      gcTime: 1000 * 60 * 5, // 5 minutos - reduzido para limpar queries não usadas mais rápido
      retry: 1,
      refetchOnWindowFocus: false, 
      refetchOnMount: false, // PERFORMANCE: Não recarrega ao montar - usa cache se disponível
      refetchOnReconnect: false, // Não recarrega ao reconectar
      throwOnError: false, // Não quebrar app em caso de erro
      // PERFORMANCE: Cancelar queries automaticamente quando componente desmonta
      // React Query já faz isso por padrão, mas garantimos que está ativo
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)


document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loaded')
}) 


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}