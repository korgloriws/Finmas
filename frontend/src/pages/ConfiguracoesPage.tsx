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
  AlertTriangle
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { perfilService, adminService } from '../services/api'
import { toast } from 'react-hot-toast'
import HelpTips from '../components/HelpTips'

export default function ConfiguracoesPage() {
  const { user, isAdmin } = useAuth()
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

  // Carregar perfil
  const { data: perfil, isLoading: loadingPerfil } = useQuery({
    queryKey: ['perfil'],
    queryFn: perfilService.obterPerfil,
    enabled: !!user,
  })

  // Carregar lista de usuários (apenas admin)
  const { data: usuariosData, isLoading: loadingUsuarios } = useQuery({
    queryKey: ['admin-usuarios'],
    queryFn: adminService.listarUsuarios,
    enabled: !!user && isAdmin,
  })

  useEffect(() => {
    if (perfil) {
      setNome(perfil.nome || '')
      setEmail(perfil.email || '')
    }
  }, [perfil])

  useEffect(() => {
    if (usuariosData) {
      setUsuarios(usuariosData)
    }
  }, [usuariosData])

  // Mutations
  const atualizarPerfilMutation = useMutation({
    mutationFn: () => perfilService.atualizarPerfil(nome, email),
    onSuccess: () => {
      toast.success('Perfil atualizado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['perfil'] })
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
      // O logout será feito automaticamente pelo backend
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

  const usuariosFiltrados = usuarios.filter(u => 
    u.username.toLowerCase().includes(filtroUsuario.toLowerCase()) ||
    u.nome?.toLowerCase().includes(filtroUsuario.toLowerCase())
  )

  if (loadingPerfil) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Configurações</h1>
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
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('perfil')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'perfil'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Perfil
          </div>
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'admin'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Gerenciar Usuários
            </div>
          </button>
        )}
      </div>

      {/* Conteúdo das Tabs */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
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

            {/* Alterar Senha */}
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
          </motion.div>
        )}

        {activeTab === 'admin' && isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Gerenciar Usuários
              </h2>
              <div className="flex items-center gap-2">
                <label htmlFor="filtro-usuario-input" className="sr-only">Buscar usuário</label>
                <input
                  id="filtro-usuario-input"
                  type="text"
                  value={filtroUsuario}
                  onChange={(e) => setFiltroUsuario(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  placeholder="Buscar usuário..."
                  aria-label="Buscar usuário"
                />
              </div>
            </div>

            {loadingUsuarios ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-2">
                {usuariosFiltrados.map((usuario) => (
                  <div
                    key={usuario.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{usuario.nome || usuario.username}</span>
                        <span className="text-sm text-muted-foreground">@{usuario.username}</span>
                        {usuario.email && (
                          <span className="text-sm text-muted-foreground">• {usuario.email}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {usuario.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                            <ShieldCheck className="w-3 h-3" />
                            Administrador
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">
                            <User className="w-3 h-3" />
                            Usuário
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Cadastrado em: {new Date(usuario.data_cadastro).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {usuario.role === 'admin' ? (
                        <button
                          onClick={() => handleDefinirRole(usuario.username, 'usuario')}
                          disabled={definirRoleMutation.isPending}
                          className="px-3 py-1.5 text-sm bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
                        >
                          Remover Admin
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDefinirRole(usuario.username, 'admin')}
                          disabled={definirRoleMutation.isPending}
                          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          Tornar Admin
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
          </motion.div>
        )}
      </div>
    </div>
  )
}

