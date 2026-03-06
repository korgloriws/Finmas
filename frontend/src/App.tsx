import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { AnaliseProvider } from './contexts/AnaliseContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import SecurityCheck from './components/SecurityCheck'
import RootOrRedirect from './components/RootOrRedirect'
import ErrorBoundary from './components/ErrorBoundary'
// PERFORMANCE: Importar páginas diretamente (sem lazy) para navegação instantânea
// As páginas agora são carregadas no bundle inicial, mas a navegação é instantânea
import LoginPage from './pages/LoginPage'
import RecuperacaoSenhaPage from './pages/RecuperacaoSenhaPage'
import ConfigurarSegurancaPage from './pages/ConfigurarSegurancaPage'
import DetalhesPage from './pages/DetalhesPage'
import AnalisePage from './pages/AnalisePage'
import CarteiraPage from './pages/CarteiraPage'
import ControlePage from './pages/ControlePage'
import JurosCompostosPage from './pages/JurosCompostosPage'
import GuiaMercadoPage from './pages/GuiaMercadoPage'
import ConversorMoedasPage from './pages/ConversorMoedasPage'
import CorrecaoMonetariaPage from './pages/CorrecaoMonetariaPage'
import AgendaDividendosPage from './pages/AgendaDividendosPage'
import RankingsPage from './pages/RankingsPage'
import ConfiguracoesPage from './pages/ConfiguracoesPage'
import GoogleCallbackPage from './pages/GoogleCallbackPage'
import HomePage from './pages/HomePage'
import NoticiasPage from './pages/NoticiasPage'
import AcessoNegadoPage from './pages/AcessoNegadoPage'
import VendasPage from './pages/VendasPage'
import ConhecerPage from './pages/ConhecerPage'

function App() {
  return (
    <ErrorBoundary>
      <div className="h-full min-h-0">
        <AuthProvider>
          <ThemeProvider>
            <AnaliseProvider>
              <Routes>
          {/* Rotas públicas */}
          <Route path="/" element={<RootOrRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
          <Route path="/recuperar-senha" element={<RecuperacaoSenhaPage />} />
          <Route path="/configurar-seguranca" element={<ConfigurarSegurancaPage />} />
          <Route path="/vendas" element={<VendasPage />} />

          {/* Rotas públicas com Layout (gostinho: sem login) */}
          <Route path="/conhecer" element={<SecurityCheck><Layout><ConhecerPage /></Layout></SecurityCheck>} />
          <Route path="/guia" element={<SecurityCheck><Layout><GuiaMercadoPage /></Layout></SecurityCheck>} />
          <Route path="/juros-compostos" element={<SecurityCheck><Layout><JurosCompostosPage /></Layout></SecurityCheck>} />
          <Route path="/conversor" element={<SecurityCheck><Layout><ConversorMoedasPage /></Layout></SecurityCheck>} />
          <Route path="/correcao-monetaria" element={<SecurityCheck><Layout><CorrecaoMonetariaPage /></Layout></SecurityCheck>} />
          <Route path="/detalhes" element={<SecurityCheck><Layout><DetalhesPage /></Layout></SecurityCheck>} />
          
          {/* /home redireciona para / (entrada oficial é finmas.com.br) */}
          <Route path="/home" element={<Navigate to="/" replace />} />
          
          <Route path="/analise" element={
            <ProtectedRoute>
              <SecurityCheck>
                <Layout>
                  <AnalisePage />
                </Layout>
              </SecurityCheck>
            </ProtectedRoute>
          } />
          
          <Route path="/carteira" element={
            <ProtectedRoute>
              <SecurityCheck>
                <Layout>
                  <CarteiraPage />
                </Layout>
              </SecurityCheck>
            </ProtectedRoute>
          } />
          
          <Route path="/controle" element={
            <ProtectedRoute>
              <SecurityCheck>
                <Layout>
                  <ControlePage />
                </Layout>
              </SecurityCheck>
            </ProtectedRoute>
          } />

          <Route path="/agenda-dividendos" element={
            <ProtectedRoute>
              <SecurityCheck>
                <Layout>
                  <AgendaDividendosPage />
                </Layout>
              </SecurityCheck>
            </ProtectedRoute>
          } />

          <Route path="/rankings" element={
            <ProtectedRoute>
              <SecurityCheck>
                <Layout>
                  <RankingsPage />
                </Layout>
              </SecurityCheck>
            </ProtectedRoute>
          } />
          
          <Route path="/noticias" element={
            <ProtectedRoute>
              <SecurityCheck>
                <Layout>
                  <NoticiasPage />
                </Layout>
              </SecurityCheck>
            </ProtectedRoute>
          } />
          
          <Route path="/configuracoes" element={
            <ProtectedRoute>
              <SecurityCheck>
                <Layout>
                  <ConfiguracoesPage />
                </Layout>
              </SecurityCheck>
            </ProtectedRoute>
          } />

          <Route path="/acesso-negado" element={
            <ProtectedRoute>
              <SecurityCheck>
                <Layout>
                  <AcessoNegadoPage />
                </Layout>
              </SecurityCheck>
            </ProtectedRoute>
          } />

          {/* Redirect da rota antiga para a nova */}
          <Route path="/rankings-teste" element={<Navigate to="/rankings" replace />} />

              </Routes>
            </AnaliseProvider>
          </ThemeProvider>
        </AuthProvider>
      </div>
    </ErrorBoundary>
  )
}

export default App 