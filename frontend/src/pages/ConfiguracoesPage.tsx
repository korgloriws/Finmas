import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  User, 
  Lock, 
  Trash2, 
  Save, 
  Users, 
  Shield, 
  ShieldCheck,
  AlertTriangle,
  Plus,
  Ban,
  LockKeyhole,
  LayoutGrid,
  Mail,
  Eye
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { perfilService, adminService, TELAS_APP } from '../services/api'
import { toast } from 'react-hot-toast'
import HelpTips from '../components/HelpTips'

function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return ''
  const d = new Date(lastSeenAt)
  if (Number.isNaN(d.getTime())) return String(lastSeenAt)
  return `Última vez: ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

function formatLastSeenShort(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return ''
  const d = new Date(lastSeenAt)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  if (diffH < 24) return `há ${diffH} h`
  if (diffD === 1) return 'ontem'
  if (diffD < 7) return `há ${diffD} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function ConfiguracoesPage() {
  const { user, isAdmin, refreshAllowedScreens } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'perfil' | 'admin'>('perfil')
  
  // Estados do formulário de perfil
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState('')
  
  // Estados do admin
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [mostrarFormCriar, setMostrarFormCriar] = useState(false)
  const [novoUsuario, setNovoUsuario] = useState({
    nome: '',
    username: '',
    senha: '',
    email: '',
    role: 'usuario' as 'usuario' | 'admin'
  })
  const [usuarioParaExcluir, setUsuarioParaExcluir] = useState<string | null>(null)
  const [confirmacaoExclusaoAdmin, setConfirmacaoExclusaoAdmin] = useState('')
  const [usuarioParaSenha, setUsuarioParaSenha] = useState<string | null>(null)
  const [usuarioParaTelas, setUsuarioParaTelas] = useState<any | null>(null)
  const [novaSenhaAdmin, setNovaSenhaAdmin] = useState('')
  const [confirmarSenhaAdmin, setConfirmarSenhaAdmin] = useState('')
  const [telasSelecionadas, setTelasSelecionadas] = useState<string[]>([])
  const [usuarioVerDados, setUsuarioVerDados] = useState<string | null>(null)
  const [verDadosTab, setVerDadosTab] = useState<'dados' | 'carteira' | 'movimentacoes' | 'controle' | 'marmitas'>('dados')
  const [verDadosFiltroMes, setVerDadosFiltroMes] = useState<string>('')
  const [verDadosFiltroAno, setVerDadosFiltroAno] = useState<string>('')

  // Carregar perfil
  //  SEGURANÇA: Incluir user na queryKey para isolamento entre usuários
  const { data: perfil, isLoading: loadingPerfil } = useQuery({
    queryKey: ['perfil', user],
    queryFn: perfilService.obterPerfil,
    enabled: !!user,
  })

  // Carregar lista de usuários (apenas admin); atualiza a cada 30s na aba Admin para ver quem está online
  const { data: usuariosData, isLoading: loadingUsuarios } = useQuery({
    queryKey: ['admin-usuarios'],
    queryFn: adminService.listarUsuarios,
    enabled: !!user && isAdmin,
    refetchInterval: activeTab === 'admin' ? 30_000 : false,
  })

  // Dados read-only do usuário (modal Ver dados)
  const { data: verDadosUsuario, isLoading: loadingVerDados } = useQuery({
    queryKey: ['admin-dados-usuario', usuarioVerDados],
    queryFn: () => adminService.getDadosUsuario(usuarioVerDados!),
    enabled: !!usuarioVerDados && verDadosTab === 'dados',
  })
  const { data: verCarteiraUsuario, isLoading: loadingVerCarteira } = useQuery({
    queryKey: ['admin-carteira-usuario', usuarioVerDados],
    queryFn: () => adminService.getCarteiraUsuario(usuarioVerDados!),
    enabled: !!usuarioVerDados && verDadosTab === 'carteira',
  })
  const { data: verMovimentacoesUsuario, isLoading: loadingVerMovimentacoes } = useQuery({
    queryKey: ['admin-movimentacoes-usuario', usuarioVerDados, verDadosFiltroMes, verDadosFiltroAno],
    queryFn: () => adminService.getMovimentacoesUsuario(
      usuarioVerDados!,
      verDadosFiltroMes || undefined,
      verDadosFiltroAno || undefined
    ),
    enabled: !!usuarioVerDados && verDadosTab === 'movimentacoes',
  })
  const { data: verControleUsuario, isLoading: loadingVerControle } = useQuery({
    queryKey: ['admin-controle-usuario', usuarioVerDados],
    queryFn: () => adminService.getControleUsuario(usuarioVerDados!),
    enabled: !!usuarioVerDados && verDadosTab === 'controle',
  })
  const { data: verMarmitasUsuario, isLoading: loadingVerMarmitas } = useQuery({
    queryKey: ['admin-marmitas-usuario', usuarioVerDados, verDadosFiltroMes, verDadosFiltroAno],
    queryFn: () => adminService.getMarmitasUsuario(
      usuarioVerDados!,
      verDadosFiltroMes || undefined,
      verDadosFiltroAno || undefined
    ),
    enabled: !!usuarioVerDados && verDadosTab === 'marmitas',
  })

  useEffect(() => {
    if (perfil) {
      setNome(perfil.nome || '')
      setEmail(perfil.email || '')
    }
  }, [perfil])

  useEffect(() => {
    if (usuariosData) {
      console.log('[ADMIN] Dados de usuários recebidos do backend:', usuariosData)
      // Validar e filtrar usuários com dados inválidos
      const usuariosValidos = usuariosData.filter((u: any) => {
        const isValid = u && u.username && typeof u.username === 'string' && u.username.trim() !== '' && u.username !== '..'
        if (!isValid) {
          console.warn('[ADMIN] Usuário com dados inválidos encontrado:', u)
        }
        return isValid
      })
      setUsuarios(usuariosValidos)
    }
  }, [usuariosData])

  // Mutations
  const atualizarPerfilMutation = useMutation({
    mutationFn: () => perfilService.atualizarPerfil(nome, email),
    onSuccess: () => {
      toast.success('Perfil atualizado com sucesso!')
      //  SEGURANÇA: Incluir user na invalidação para garantir isolamento
      queryClient.invalidateQueries({ queryKey: ['perfil', user] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao atualizar perfil')
    },
  })

  const atualizarSenhaMutation = useMutation({
    mutationFn: () => perfilService.atualizarSenha(senhaAtual, novaSenha),
    onSuccess: () => {
      toast.success('Senha atualizada com sucesso!')
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmarSenha('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao atualizar senha')
    },
  })

  const excluirContaMutation = useMutation({
    mutationFn: () => perfilService.excluirConta(confirmacaoExclusao),
    onSuccess: () => {
      toast.success('Conta excluída com sucesso')
      
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao excluir conta')
    },
  })

  const definirRoleMutation = useMutation({
    mutationFn: ({ username, role }: { username: string; role: 'usuario' | 'admin' }) =>
      adminService.definirRole(username, role),
    onSuccess: () => {
      toast.success('Role atualizado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao atualizar role')
    },
  })

  const criarUsuarioMutation = useMutation({
    mutationFn: () => adminService.criarUsuario(
      novoUsuario.nome,
      novoUsuario.username,
      novoUsuario.senha,
      novoUsuario.email || undefined,
      novoUsuario.role
    ),
    onSuccess: () => {
      toast.success('Usuário criado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] })
      setMostrarFormCriar(false)
      setNovoUsuario({ nome: '', username: '', senha: '', email: '', role: 'usuario' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao criar usuário')
    },
  })

  const excluirUsuarioMutation = useMutation({
    mutationFn: (username: string) => adminService.excluirUsuario(username),
    onSuccess: () => {
      toast.success('Usuário excluído com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] })
      setUsuarioParaExcluir(null)
      setConfirmacaoExclusaoAdmin('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao excluir usuário')
    },
  })

  const bloquearUsuarioMutation = useMutation({
    mutationFn: ({ username, blocked }: { username: string; blocked: boolean }) =>
      adminService.bloquearUsuario(username, blocked),
    onSuccess: (_, { blocked }) => {
      toast.success(blocked ? 'Usuário bloqueado.' : 'Usuário desbloqueado.')
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao atualizar bloqueio')
    },
  })

  const alterarSenhaUsuarioMutation = useMutation({
    mutationFn: ({ username, novaSenha }: { username: string; novaSenha: string }) =>
      adminService.alterarSenhaUsuario(username, novaSenha),
    onSuccess: () => {
      toast.success('Senha alterada com sucesso!')
      setUsuarioParaSenha(null)
      setNovaSenhaAdmin('')
      setConfirmarSenhaAdmin('')
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao alterar senha')
    },
  })

  const atualizarTelasUsuarioMutation = useMutation({
    mutationFn: ({ username, telas }: { username: string; telas: string[] | null }) =>
      adminService.atualizarTelasUsuario(username, telas),
    onSuccess: (_, { username }) => {
      toast.success('Telas atualizadas!')
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] })
      setUsuarioParaTelas(null)
      setTelasSelecionadas([])
      if (user === username) refreshAllowedScreens()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao atualizar telas')
    },
  })

  const handleAtualizarPerfil = () => {
    if (!nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    atualizarPerfilMutation.mutate()
  }

  const handleAtualizarSenha = () => {
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      toast.error('Preencha todos os campos')
      return
    }
    if (novaSenha !== confirmarSenha) {
      toast.error('As senhas não coincidem')
      return
    }
    if (novaSenha.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }
    atualizarSenhaMutation.mutate()
  }

  const handleExcluirConta = () => {
    if (confirmacaoExclusao !== 'EXCLUIR') {
      toast.error('Digite "EXCLUIR" para confirmar')
      return
    }
    if (!window.confirm('Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita!')) {
      return
    }
    excluirContaMutation.mutate()
  }

  const handleDefinirRole = (username: string, novoRole: 'usuario' | 'admin') => {
    if (!window.confirm(`Tem certeza que deseja definir ${username} como ${novoRole}?`)) {
      return
    }
    definirRoleMutation.mutate({ username, role: novoRole })
  }

  const handleCriarUsuario = () => {
    if (!novoUsuario.nome.trim() || !novoUsuario.username.trim() || !novoUsuario.senha.trim()) {
      toast.error('Nome, username e senha são obrigatórios')
      return
    }
    if (novoUsuario.senha.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }
    criarUsuarioMutation.mutate()
  }

  const handleExcluirUsuario = (username: string | null) => {
    if (!username) {
      toast.error('Usuário não especificado')
      return
    }
    // Validação adicional do username
    if (username === '..' || username.trim() === '' || username.includes('..')) {
      console.error('[ADMIN] ERRO: Username inválido detectado:', username)
      toast.error('Erro: Username inválido. Por favor, recarregue a página.')
      return
    }
    if (confirmacaoExclusaoAdmin !== 'EXCLUIR') {
      toast.error('Digite "EXCLUIR" para confirmar')
      return
    }
    console.log('[ADMIN] Excluindo usuário:', username)
    excluirUsuarioMutation.mutate(username)
  }

  const usuariosFiltrados = usuarios.filter(u => 
    u.username.toLowerCase().includes(filtroUsuario.toLowerCase()) ||
    u.nome?.toLowerCase().includes(filtroUsuario.toLowerCase())
  )

  // PERFORMANCE: Não bloquear renderização - mostrar skeleton enquanto carrega
  // if (loadingPerfil) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  //     </div>
  //   )
  // }

  return (
    <div className="space-y-6 p-4 sm:p-6 overflow-x-hidden">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">Configurações</h1>
          <HelpTips
            title="Configurações"
            tips={[
              { title: 'Perfil', content: 'Atualize suas informações pessoais e senha.' },
              { title: 'Exclusão', content: 'A exclusão de conta é permanente e não pode ser desfeita (LGPD).' },
              { title: 'Admin', content: 'Apenas administradores podem gerenciar usuários e roles.' },
            ]}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab('perfil')}
          className={`px-3 sm:px-4 py-2.5 font-medium transition-colors shrink-0 ${
            activeTab === 'perfil'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 shrink-0" />
            <span>Perfil</span>
          </div>
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3 sm:px-4 py-2.5 font-medium transition-colors shrink-0 ${
              activeTab === 'admin'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">Gerenciar Usuários</span>
            </div>
          </button>
        )}
      </div>

      {/* Conteúdo das Tabs */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-lg">
        {activeTab === 'perfil' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Informações do Perfil */}
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Informações do Perfil
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="nome-input" className="block text-sm font-medium mb-1">Nome</label>
                  <input
                    id="nome-input"
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <label htmlFor="email-input" className="block text-sm font-medium mb-1">Email</label>
                  <input
                    id="email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    placeholder="seu@email.com"
                  />
                </div>
                <div>
                  <label htmlFor="username-input" className="block text-sm font-medium mb-1">Username</label>
                  <input
                    id="username-input"
                    type="text"
                    value={user || ''}
                    disabled
                    aria-label="Username (não pode ser alterado)"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Username não pode ser alterado</p>
                </div>
                <button
                  onClick={handleAtualizarPerfil}
                  disabled={atualizarPerfilMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {atualizarPerfilMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>

            {/* Alterar Senha - Apenas para usuários proprietários */}
            {perfil?.auth_provider !== 'google' ? (
              <div className="border-t border-border pt-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Alterar Senha
                </h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="senha-atual-input" className="block text-sm font-medium mb-1">Senha Atual</label>
                    <input
                      id="senha-atual-input"
                      type="password"
                      value={senhaAtual}
                      onChange={(e) => setSenhaAtual(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      placeholder="Digite sua senha atual"
                    />
                  </div>
                  <div>
                    <label htmlFor="nova-senha-input" className="block text-sm font-medium mb-1">Nova Senha</label>
                    <input
                      id="nova-senha-input"
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      placeholder="Digite sua nova senha"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmar-senha-input" className="block text-sm font-medium mb-1">Confirmar Nova Senha</label>
                    <input
                      id="confirmar-senha-input"
                      type="password"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      placeholder="Confirme sua nova senha"
                    />
                  </div>
                  <button
                    onClick={handleAtualizarSenha}
                    disabled={atualizarSenhaMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4" />
                    {atualizarSenhaMutation.isPending ? 'Atualizando...' : 'Atualizar Senha'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-border pt-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Autenticação
                </h2>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Login com Google
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                        Você faz login usando sua conta Google. A senha é gerenciada pelo Google e não pode ser alterada aqui. Para alterar sua senha, acesse sua conta Google.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Excluir Conta */}
            <div className="border-t border-border pt-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-red-500">
                <Trash2 className="w-5 h-5" />
                Excluir Conta
              </h2>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Esta ação não pode ser desfeita
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                      Ao excluir sua conta, todos os seus dados serão permanentemente removidos (LGPD).
                    </p>
                  </div>
                </div>
                <div>
                  <label htmlFor="confirmacao-exclusao-input" className="block text-sm font-medium mb-1 text-red-800 dark:text-red-200">
                    Digite "EXCLUIR" para confirmar
                  </label>
                  <input
                    id="confirmacao-exclusao-input"
                    type="text"
                    value={confirmacaoExclusao}
                    onChange={(e) => setConfirmacaoExclusao(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-background text-foreground"
                    placeholder="EXCLUIR"
                  />
                </div>
                <button
                  onClick={handleExcluirConta}
                  disabled={excluirContaMutation.isPending || confirmacaoExclusao !== 'EXCLUIR'}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  {excluirContaMutation.isPending ? 'Excluindo...' : 'Excluir Conta Permanentemente'}
                </button>
              </div>
            </div>

            {/* Suporte / Contato — sistema web: abrir Gmail (compose) como ação padrão */}
            <div className="border-t border-border pt-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Suporte
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Dúvidas, problemas ou solicitações? Entre em contato com o administrador pelo e-mail.
              </p>
              <a
                href="https://mail.google.com/mail/?view=cm&to=finmasfinanceiro@gmail.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Mail className="w-4 h-4" />
                Enviar e-mail para o suporte
              </a>
            </div>
          </motion.div>
        )}

        {activeTab === 'admin' && isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 shrink-0">
                <Users className="w-5 h-5 shrink-0" />
                Gerenciar Usuários
              </h2>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:min-w-0">
                <label htmlFor="filtro-usuario-input" className="sr-only">Buscar usuário</label>
                <input
                  id="filtro-usuario-input"
                  type="text"
                  value={filtroUsuario}
                  onChange={(e) => setFiltroUsuario(e.target.value)}
                  className="min-w-0 flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm sm:text-base"
                  placeholder="Buscar usuário..."
                  aria-label="Buscar usuário"
                />
                <button
                  onClick={() => setMostrarFormCriar(!mostrarFormCriar)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm sm:text-base shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  {mostrarFormCriar ? 'Cancelar' : 'Criar Usuário'}
                </button>
              </div>
            </div>

            {/* Formulário de Criar Usuário */}
            {mostrarFormCriar && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-muted/50 border border-border rounded-lg p-4 space-y-4"
              >
                <h3 className="font-semibold flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Criar Novo Usuário
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="novo-usuario-nome" className="block text-sm font-medium mb-1">
                      Nome *
                    </label>
                    <input
                      id="novo-usuario-nome"
                      type="text"
                      value={novoUsuario.nome}
                      onChange={(e) => setNovoUsuario({ ...novoUsuario, nome: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      placeholder="Nome completo"
                    />
                  </div>
                  <div>
                    <label htmlFor="novo-usuario-username" className="block text-sm font-medium mb-1">
                      Username *
                    </label>
                    <input
                      id="novo-usuario-username"
                      type="text"
                      value={novoUsuario.username}
                      onChange={(e) => setNovoUsuario({ ...novoUsuario, username: e.target.value.toLowerCase() })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      placeholder="username"
                    />
                  </div>
                  <div>
                    <label htmlFor="novo-usuario-email" className="block text-sm font-medium mb-1">
                      Email
                    </label>
                    <input
                      id="novo-usuario-email"
                      type="email"
                      value={novoUsuario.email}
                      onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="novo-usuario-senha" className="block text-sm font-medium mb-1">
                      Senha *
                    </label>
                    <input
                      id="novo-usuario-senha"
                      type="password"
                      value={novoUsuario.senha}
                      onChange={(e) => setNovoUsuario({ ...novoUsuario, senha: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div>
                    <label htmlFor="novo-usuario-role" className="block text-sm font-medium mb-1">
                      Tipo de Usuário
                    </label>
                    <select
                      id="novo-usuario-role"
                      value={novoUsuario.role}
                      onChange={(e) => setNovoUsuario({ ...novoUsuario, role: e.target.value as 'usuario' | 'admin' })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    >
                      <option value="usuario">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setMostrarFormCriar(false)
                      setNovoUsuario({ nome: '', username: '', senha: '', email: '', role: 'usuario' })
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCriarUsuario}
                    disabled={criarUsuarioMutation.isPending}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    {criarUsuarioMutation.isPending ? 'Criando...' : 'Criar Usuário'}
                  </button>
                </div>
              </motion.div>
            )}

            {loadingUsuarios ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-2">
                {usuariosFiltrados.map((usuario) => (
                  <div
                    key={usuario.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-medium truncate max-w-[180px] sm:max-w-none" title={usuario.nome || usuario.username}>
                          {usuario.nome || usuario.username}
                        </span>
                        <span className="text-sm text-muted-foreground shrink-0">@{usuario.username}</span>
                        {usuario.email && (
                          <span className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-none" title={usuario.email}>
                            • {usuario.email}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {usuario.blocked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-destructive/10 text-destructive rounded text-xs font-medium shrink-0">
                            <Ban className="w-3 h-3" />
                            Bloqueado
                          </span>
                        )}
                        {usuario.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium shrink-0">
                            <ShieldCheck className="w-3 h-3" />
                            Administrador
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs shrink-0">
                            <User className="w-3 h-3" />
                            Usuário
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0">
                          Cadastrado: {new Date(usuario.data_cadastro).toLocaleDateString('pt-BR')}
                        </span>
                        {usuario.online ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 shrink-0" title="Usuário online">
                            <span className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400 shrink-0" />
                            Online
                          </span>
                        ) : usuario.last_seen_at ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground shrink-0" title={formatLastSeen(usuario.last_seen_at)}>
                            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 shrink-0" />
                            Visto {formatLastSeenShort(usuario.last_seen_at)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setUsuarioVerDados(usuario.username)
                          setVerDadosTab('dados')
                        }}
                        className="p-1.5 sm:px-3 sm:py-1.5 text-sm bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors shrink-0"
                        title="Ver dados (somente leitura)"
                      >
                        <Eye className="w-4 h-4 inline" />
                      </button>
                      {usuario.username !== user && (
                        <>
                          <button
                            onClick={() => bloquearUsuarioMutation.mutate({ username: usuario.username, blocked: !usuario.blocked })}
                            disabled={bloquearUsuarioMutation.isPending}
                            className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors disabled:opacity-50 shrink-0 ${
                              usuario.blocked
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-amber-600 text-white hover:bg-amber-700'
                            }`}
                            title={usuario.blocked ? 'Desbloquear' : 'Bloquear'}
                          >
                            {usuario.blocked ? 'Desbloquear' : 'Bloquear'}
                          </button>
                          <button
                            onClick={() => { setUsuarioParaSenha(usuario.username); setNovaSenhaAdmin(''); setConfirmarSenhaAdmin(''); }}
                            disabled={alterarSenhaUsuarioMutation.isPending}
                            className="p-1.5 sm:px-3 sm:py-1.5 text-sm bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50 shrink-0"
                            title="Alterar senha"
                          >
                            <LockKeyhole className="w-4 h-4 inline" />
                          </button>
                          <button
                            onClick={() => {
                              setUsuarioParaTelas(usuario)
                              setTelasSelecionadas(usuario.allowed_screens ?? TELAS_APP.map((t) => t.id))
                            }}
                            disabled={atualizarTelasUsuarioMutation.isPending}
                            className="p-1.5 sm:px-3 sm:py-1.5 text-sm bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50 shrink-0"
                            title="Telas permitidas"
                          >
                            <LayoutGrid className="w-4 h-4 inline" />
                          </button>
                        </>
                      )}
                      {usuario.role === 'admin' ? (
                        <button
                          onClick={() => handleDefinirRole(usuario.username, 'usuario')}
                          disabled={definirRoleMutation.isPending}
                          className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50 shrink-0"
                        >
                          Remover Admin
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDefinirRole(usuario.username, 'admin')}
                          disabled={definirRoleMutation.isPending}
                          className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
                        >
                          Tornar Admin
                        </button>
                      )}
                      {usuario.username !== user && (
                        <button
                          onClick={() => {
                            console.log('[ADMIN] Botão excluir clicado - Dados completos do usuário:', usuario)
                            console.log('[ADMIN] Username:', usuario.username, 'Tipo:', typeof usuario.username)
                            if (!usuario.username || usuario.username === '..' || usuario.username.trim() === '') {
                              console.error('[ADMIN] ERRO: Username inválido!', usuario)
                              toast.error('Erro: Username inválido. Por favor, recarregue a página.')
                              return
                            }
                            setUsuarioParaExcluir(usuario.username)
                          }}
                          disabled={excluirUsuarioMutation.isPending}
                          className="p-1.5 sm:px-3 sm:py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 shrink-0"
                          title="Excluir usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {usuariosFiltrados.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </div>
                )}
              </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {usuarioParaExcluir && (
              <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 sm:p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card border border-border rounded-t-xl sm:rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-500 mb-2">
                        Excluir Usuário
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Tem certeza que deseja excluir o usuário <strong>@{usuarioParaExcluir}</strong>?
                        Esta ação não pode ser desfeita e todos os dados do usuário serão permanentemente removidos (LGPD).
                      </p>
                      <div className="space-y-2">
                        <label htmlFor="confirmacao-exclusao-admin-input" className="block text-sm font-medium text-red-800 dark:text-red-200">
                          Digite "EXCLUIR" para confirmar
                        </label>
                        <input
                          id="confirmacao-exclusao-admin-input"
                          type="text"
                          value={confirmacaoExclusaoAdmin}
                          onChange={(e) => setConfirmacaoExclusaoAdmin(e.target.value)}
                          className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-background text-foreground"
                          placeholder="EXCLUIR"
                          autoFocus
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
                    <button
                      onClick={() => {
                        setUsuarioParaExcluir(null)
                        setConfirmacaoExclusaoAdmin('')
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        if (!usuarioParaExcluir) {
                          toast.error('Usuário não especificado')
                          return
                        }
                        handleExcluirUsuario(usuarioParaExcluir)
                      }}
                      disabled={excluirUsuarioMutation.isPending || confirmacaoExclusaoAdmin !== 'EXCLUIR' || !usuarioParaExcluir}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                      {excluirUsuarioMutation.isPending ? 'Excluindo...' : 'Excluir Usuário'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Modal Alterar senha (admin) */}
            {usuarioParaSenha && (
              <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card border border-border rounded-t-xl sm:rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4"
                >
                  <h3 className="text-lg font-semibold text-foreground">Alterar senha de @{usuarioParaSenha}</h3>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Nova senha</label>
                    <input
                      type="password"
                      value={novaSenhaAdmin}
                      onChange={(e) => setNovaSenhaAdmin(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      placeholder="Mínimo 4 caracteres"
                      autoFocus
                    />
                    <label className="block text-sm font-medium text-foreground">Confirmar senha</label>
                    <input
                      type="password"
                      value={confirmarSenhaAdmin}
                      onChange={(e) => setConfirmarSenhaAdmin(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      placeholder="Repita a senha"
                    />
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                    <button
                      onClick={() => { setUsuarioParaSenha(null); setNovaSenhaAdmin(''); setConfirmarSenhaAdmin(''); }}
                      className="w-full sm:w-auto px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        if (!novaSenhaAdmin || novaSenhaAdmin.length < 4) {
                          toast.error('Senha deve ter pelo menos 4 caracteres')
                          return
                        }
                        if (novaSenhaAdmin !== confirmarSenhaAdmin) {
                          toast.error('As senhas não coincidem')
                          return
                        }
                        alterarSenhaUsuarioMutation.mutate({ username: usuarioParaSenha, novaSenha: novaSenhaAdmin })
                      }}
                      disabled={alterarSenhaUsuarioMutation.isPending || !novaSenhaAdmin || novaSenhaAdmin !== confirmarSenhaAdmin}
                      className="w-full sm:w-auto px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      {alterarSenhaUsuarioMutation.isPending ? 'Salvando...' : 'Alterar senha'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Modal Telas permitidas (admin) */}
            {usuarioParaTelas && (
              <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card border border-border rounded-t-xl sm:rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
                >
                  <h3 className="text-lg font-semibold text-foreground mb-2">Telas permitidas para @{usuarioParaTelas.username}</h3>
                  <p className="text-sm text-muted-foreground mb-4">Marque as telas que o usuário pode acessar. Deixe todas desmarcadas para negar acesso a tudo (exceto a página de acesso negado).</p>
                  <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                    {TELAS_APP.map((tela) => (
                      <label key={tela.id} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={telasSelecionadas.includes(tela.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTelasSelecionadas((prev) => [...prev, tela.id])
                            } else {
                              setTelasSelecionadas((prev) => prev.filter((id) => id !== tela.id))
                            }
                          }}
                          className="rounded border-border"
                        />
                        <span className="text-sm text-foreground">{tela.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-border shrink-0">
                    <button
                      onClick={() => { setUsuarioParaTelas(null); setTelasSelecionadas([]); }}
                      className="w-full sm:w-auto px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        const telas = telasSelecionadas.length === TELAS_APP.length ? null : telasSelecionadas
                        atualizarTelasUsuarioMutation.mutate({ username: usuarioParaTelas.username, telas })
                      }}
                      disabled={atualizarTelasUsuarioMutation.isPending}
                      className="w-full sm:w-auto px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      {atualizarTelasUsuarioMutation.isPending ? 'Salvando...' : 'Salvar telas'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Modal Ver dados do usuário (somente leitura) */}
            {usuarioVerDados && (
              <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card border border-border rounded-t-xl sm:rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                >
                  <div className="flex items-center justify-between gap-2 mb-4 shrink-0">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Eye className="w-5 h-5 text-muted-foreground" />
                      Dados do usuário @{usuarioVerDados} <span className="text-sm font-normal text-muted-foreground">(somente leitura)</span>
                    </h3>
                    <button
                      onClick={() => {
                        setUsuarioVerDados(null)
                        setVerDadosFiltroMes('')
                        setVerDadosFiltroAno('')
                      }}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                      aria-label="Fechar"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 border-b border-border pb-2 mb-2 shrink-0">
                    {(['dados', 'carteira', 'movimentacoes', 'controle', 'marmitas'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setVerDadosTab(tab)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          verDadosTab === tab
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {tab === 'dados' && 'Dados cadastrais'}
                        {tab === 'carteira' && 'Carteira'}
                        {tab === 'movimentacoes' && 'Movimentações'}
                        {tab === 'controle' && 'Controle'}
                        {tab === 'marmitas' && 'Marmitas'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 shrink-0">
                    Carteira: estado atual. Movimentações e Marmitas: todo o histórico (opcional: filtrar por mês/ano). Controle: últimas 200 linhas por tipo.
                  </p>
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {verDadosTab === 'dados' && (
                      <>
                        {loadingVerDados && <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}
                        {!loadingVerDados && verDadosUsuario && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            {Object.entries(verDadosUsuario).filter(([k]) => !['senha', 'password'].includes(k.toLowerCase())).map(([key, value]) => (
                              <div key={key} className="flex gap-2">
                                <span className="text-muted-foreground shrink-0">{key}:</span>
                                <span className="break-all">{value != null ? String(value) : '—'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {verDadosTab === 'carteira' && (
                      <>
                        {loadingVerCarteira && <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}
                        {!loadingVerCarteira && verCarteiraUsuario && (
                          <div className="space-y-3">
                            {Array.isArray(verCarteiraUsuario) ? (
                              <table className="w-full text-sm border-collapse">
                                <thead><tr className="border-b border-border">{verCarteiraUsuario.length > 0 && Object.keys(verCarteiraUsuario[0]).map((k) => <th key={k} className="text-left py-2 pr-2">{k}</th>)}</tr></thead>
                                <tbody>{verCarteiraUsuario.map((row: Record<string, unknown>, i: number) => <tr key={i} className="border-b border-border/50">{Object.values(row).map((v, j) => <td key={j} className="py-1.5 pr-2">{String(v ?? '')}</td>)}</tr>)}</tbody>
                              </table>
                            ) : verCarteiraUsuario.ativos ? (
                              <>
                                <table className="w-full text-sm border-collapse">
                                  <thead><tr className="border-b border-border"><th className="text-left py-2 pr-2">Ticker</th><th className="text-left py-2 pr-2">Nome</th><th className="text-right py-2">Qtd</th><th className="text-right py-2">Preço</th><th className="text-right py-2">Total</th></tr></thead>
                                  <tbody>{(verCarteiraUsuario.ativos || []).map((a: any, i: number) => <tr key={i} className="border-b border-border/50"><td className="py-1.5">{a.ticker}</td><td className="py-1.5">{a.nome_completo}</td><td className="text-right py-1.5">{a.quantidade}</td><td className="text-right py-1.5">{a.preco_medio != null ? Number(a.preco_medio).toFixed(2) : '—'}</td><td className="text-right py-1.5">{a.valor_total != null ? Number(a.valor_total).toFixed(2) : '—'}</td></tr>)}</tbody>
                                </table>
                                {verCarteiraUsuario.totais && <p className="text-muted-foreground text-sm mt-2">Totais: {JSON.stringify(verCarteiraUsuario.totais)}</p>}
                              </>
                            ) : (
                              <pre className="text-xs overflow-x-auto p-2 bg-muted/50 rounded">{JSON.stringify(verCarteiraUsuario, null, 2)}</pre>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    {verDadosTab === 'movimentacoes' && (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="text-sm text-muted-foreground">Filtrar:</span>
                          <input
                            type="number"
                            min={1}
                            max={12}
                            placeholder="Mês"
                            value={verDadosFiltroMes}
                            onChange={(e) => setVerDadosFiltroMes(e.target.value.replace(/^0+/, '') || '')}
                            className="w-16 px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm"
                          />
                          <input
                            type="number"
                            min={2000}
                            max={2100}
                            placeholder="Ano"
                            value={verDadosFiltroAno}
                            onChange={(e) => setVerDadosFiltroAno(e.target.value || '')}
                            className="w-20 px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => { setVerDadosFiltroMes(''); setVerDadosFiltroAno(''); }}
                            className="text-sm text-muted-foreground hover:text-foreground underline"
                          >
                            Todo o período
                          </button>
                        </div>
                        {loadingVerMovimentacoes && <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}
                        {!loadingVerMovimentacoes && verMovimentacoesUsuario && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead><tr className="border-b border-border"><th className="text-left py-2 pr-2">Data</th><th className="text-left py-2 pr-2">Ticker</th><th className="text-left py-2 pr-2">Nome</th><th className="text-right py-2">Qtd</th><th className="text-right py-2">Preço</th><th className="text-left py-2">Tipo</th></tr></thead>
                              <tbody>{(Array.isArray(verMovimentacoesUsuario) ? verMovimentacoesUsuario : []).map((m: any, i: number) => <tr key={m.id ?? i} className="border-b border-border/50"><td className="py-1.5">{m.data}</td><td className="py-1.5">{m.ticker}</td><td className="py-1.5">{m.nome_completo}</td><td className="text-right py-1.5">{m.quantidade}</td><td className="text-right py-1.5">{m.preco != null ? Number(m.preco).toFixed(2) : '—'}</td><td className="py-1.5">{m.tipo}</td></tr>)}</tbody>
                            </table>
                            {(Array.isArray(verMovimentacoesUsuario) ? verMovimentacoesUsuario : []).length === 0 && <p className="text-muted-foreground text-sm py-4">Nenhuma movimentação.</p>}
                          </div>
                        )}
                      </>
                    )}
                    {verDadosTab === 'controle' && (
                      <>
                        {loadingVerControle && <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}
                        {!loadingVerControle && verControleUsuario && (
                          <div className="space-y-4">
                            {verControleUsuario.receitas && (
                              <div>
                                <h4 className="font-medium text-sm mb-2">Receitas</h4>
                                <table className="w-full text-sm border-collapse"><thead><tr className="border-b border-border">{verControleUsuario.receitas[0] && Object.keys(verControleUsuario.receitas[0]).map((k) => <th key={k} className="text-left py-2 pr-2">{k}</th>)}</tr></thead><tbody>{verControleUsuario.receitas.map((r: Record<string, unknown>, i: number) => <tr key={i} className="border-b border-border/50">{Object.values(r).map((v, j) => <td key={j} className="py-1.5 pr-2">{String(v ?? '')}</td>)}</tr>)}</tbody></table>
                              </div>
                            )}
                            {verControleUsuario.cartoes && (
                              <div>
                                <h4 className="font-medium text-sm mb-2">Cartões</h4>
                                <table className="w-full text-sm border-collapse"><thead><tr className="border-b border-border">{verControleUsuario.cartoes[0] && Object.keys(verControleUsuario.cartoes[0]).map((k) => <th key={k} className="text-left py-2 pr-2">{k}</th>)}</tr></thead><tbody>{verControleUsuario.cartoes.map((c: Record<string, unknown>, i: number) => <tr key={i} className="border-b border-border/50">{Object.values(c).map((v, j) => <td key={j} className="py-1.5 pr-2">{String(v ?? '')}</td>)}</tr>)}</tbody></table>
                              </div>
                            )}
                            {verControleUsuario.outros_gastos && (
                              <div>
                                <h4 className="font-medium text-sm mb-2">Outros gastos</h4>
                                <table className="w-full text-sm border-collapse"><thead><tr className="border-b border-border">{verControleUsuario.outros_gastos[0] && Object.keys(verControleUsuario.outros_gastos[0]).map((k) => <th key={k} className="text-left py-2 pr-2">{k}</th>)}</tr></thead><tbody>{verControleUsuario.outros_gastos.map((o: Record<string, unknown>, i: number) => <tr key={i} className="border-b border-border/50">{Object.values(o).map((v, j) => <td key={j} className="py-1.5 pr-2">{String(v ?? '')}</td>)}</tr>)}</tbody></table>
                              </div>
                            )}
                            {(!verControleUsuario.receitas?.length && !verControleUsuario.cartoes?.length && !verControleUsuario.outros_gastos?.length) && <p className="text-muted-foreground text-sm">Nenhum dado de controle.</p>}
                          </div>
                        )}
                      </>
                    )}
                    {verDadosTab === 'marmitas' && (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="text-sm text-muted-foreground">Filtrar:</span>
                          <input
                            type="number"
                            min={1}
                            max={12}
                            placeholder="Mês"
                            value={verDadosFiltroMes}
                            onChange={(e) => setVerDadosFiltroMes(e.target.value.replace(/^0+/, '') || '')}
                            className="w-16 px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm"
                          />
                          <input
                            type="number"
                            min={2000}
                            max={2100}
                            placeholder="Ano"
                            value={verDadosFiltroAno}
                            onChange={(e) => setVerDadosFiltroAno(e.target.value || '')}
                            className="w-20 px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => { setVerDadosFiltroMes(''); setVerDadosFiltroAno(''); }}
                            className="text-sm text-muted-foreground hover:text-foreground underline"
                          >
                            Todo o período
                          </button>
                        </div>
                        {loadingVerMarmitas && <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}
                        {!loadingVerMarmitas && verMarmitasUsuario && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead><tr className="border-b border-border"><th className="text-left py-2 pr-2">Data</th><th className="text-right py-2">Valor</th><th className="text-left py-2">Comprou</th></tr></thead>
                              <tbody>{(Array.isArray(verMarmitasUsuario) ? verMarmitasUsuario : []).map((m: any, i: number) => <tr key={m.id ?? i} className="border-b border-border/50"><td className="py-1.5">{m.data}</td><td className="text-right py-1.5">{m.valor != null ? Number(m.valor).toFixed(2) : '—'}</td><td className="py-1.5">{m.comprou != null ? String(m.comprou) : '—'}</td></tr>)}</tbody>
                            </table>
                            {(Array.isArray(verMarmitasUsuario) ? verMarmitasUsuario : []).length === 0 && <p className="text-muted-foreground text-sm py-4">Nenhuma marmita.</p>}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

