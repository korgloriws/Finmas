import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, User, Lock, ArrowRight, RefreshCw, CheckCircle, XCircle, Sun, Moon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    nome: '',
    username: '',
    senha: '',
    pergunta_seguranca: '',
    resposta_seguranca: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const navigate = useNavigate()
  const { login, register } = useAuth()
  const { isDark, toggleTheme } = useTheme()


  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  
  const validatePasswordStrength = (password: string) => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*]/.test(password)
    }
    
    const score = Object.values(checks).filter(Boolean).length
    return { checks, score, isStrong: score >= 4 }
  }

  const passwordStrength = validatePasswordStrength(formData.senha)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

 
    if (!isLogin) {
      if (!formData.pergunta_seguranca.trim() || !formData.resposta_seguranca.trim()) {
        setError('Pergunta e resposta de segurança são obrigatórias')
        setLoading(false)
        return
      }
      
      if (!passwordStrength.isStrong) {
        setError('A senha deve ser mais forte. Use pelo menos 8 caracteres incluindo maiúsculas, minúsculas, números e símbolos.')
        setLoading(false)
        return
      }
    }

    try {
      if (isLogin) {
        await login(formData.username, formData.senha)
      } else {
        await register(formData.nome, formData.username, formData.senha, formData.pergunta_seguranca, formData.resposta_seguranca)
      }
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Erro ao processar solicitação')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="bg-card border border-border rounded-xl shadow-lg p-6 relative">
          {/* Theme Toggle */}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            onClick={toggleTheme}
            className="absolute top-4 right-4 p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors group"
            title={isDark ? 'Alternar para modo claro' : 'Alternar para modo escuro'}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-foreground group-hover:text-primary transition-colors" />
            ) : (
              <Moon className="w-4 h-4 text-foreground group-hover:text-primary transition-colors" />
            )}
          </motion.button>

          {/* Header */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3"
            >
              <User className="w-6 h-6 text-primary" />
            </motion.div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              {isLogin ? 'Bem-vindo de volta!' : 'Criar conta'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLogin ? 'Entre com suas credenciais' : 'Preencha os dados para se cadastrar'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Nome completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => handleInputChange('nome', e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
                      placeholder="Digite seu nome completo"
                      required={!isLogin}
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Pergunta de Segurança *
                  </label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.pergunta_seguranca}
                      onChange={(e) => handleInputChange('pergunta_seguranca', e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
                      placeholder="Ex: Qual é o nome do seu primeiro pet?"
                      required={!isLogin}
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Resposta de Segurança *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.resposta_seguranca}
                      onChange={(e) => handleInputChange('resposta_seguranca', e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
                      placeholder="Ex: Rex"
                      required={!isLogin}
                    />
                  </div>
                </motion.div>
              </>
            )}

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: isLogin ? 0.1 : 0.25 }}
            >
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
                  placeholder="Digite seu username"
                  required
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: isLogin ? 0.2 : 0.3 }}
            >
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Senha {!isLogin && '*'}
              </label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.senha}
                  onChange={(e) => handleInputChange('senha', e.target.value)}
                  className="w-full pl-9 pr-16 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
                  placeholder="Digite sua senha"
                  required
                />
                <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                  {!isLogin && (
                    <button
                      type="button"
                      onClick={() => handleInputChange('senha', generateStrongPassword())}
                      className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                      title="Gerar senha forte"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              
              {/* Indicador de força da senha (apenas no registro) */}
              {!isLogin && formData.senha && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Força da senha:</span>
                    <span className={`font-medium ${
                      passwordStrength.isStrong ? 'text-green-600' : 
                      passwordStrength.score >= 3 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {passwordStrength.isStrong ? 'Forte' : 
                       passwordStrength.score >= 3 ? 'Média' : 'Fraca'}
                    </span>
                  </div>
                  
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1.5 text-xs">
                      {passwordStrength.checks.length ? (
                        <CheckCircle className="w-2.5 h-2.5 text-green-600" />
                      ) : (
                        <XCircle className="w-2.5 h-2.5 text-red-600" />
                      )}
                      <span className={passwordStrength.checks.length ? 'text-green-600' : 'text-red-600'}>
                        Pelo menos 8 caracteres
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs">
                      {passwordStrength.checks.uppercase ? (
                        <CheckCircle className="w-2.5 h-2.5 text-green-600" />
                      ) : (
                        <XCircle className="w-2.5 h-2.5 text-red-600" />
                      )}
                      <span className={passwordStrength.checks.uppercase ? 'text-green-600' : 'text-red-600'}>
                        Uma letra maiúscula
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs">
                      {passwordStrength.checks.lowercase ? (
                        <CheckCircle className="w-2.5 h-2.5 text-green-600" />
                      ) : (
                        <XCircle className="w-2.5 h-2.5 text-red-600" />
                      )}
                      <span className={passwordStrength.checks.lowercase ? 'text-green-600' : 'text-red-600'}>
                        Uma letra minúscula
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs">
                      {passwordStrength.checks.number ? (
                        <CheckCircle className="w-2.5 h-2.5 text-green-600" />
                      ) : (
                        <XCircle className="w-2.5 h-2.5 text-red-600" />
                      )}
                      <span className={passwordStrength.checks.number ? 'text-green-600' : 'text-red-600'}>
                        Um número
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs">
                      {passwordStrength.checks.special ? (
                        <CheckCircle className="w-2.5 h-2.5 text-green-600" />
                      ) : (
                        <XCircle className="w-2.5 h-2.5 text-red-600" />
                      )}
                      <span className={passwordStrength.checks.special ? 'text-green-600' : 'text-red-600'}>
                        Um símbolo (!@#$%^&*)
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs"
              >
                {error}
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: isLogin ? 0.3 : 0.4 }}
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground font-medium py-2.5 px-3 rounded-lg transition-colors flex items-center justify-center space-x-1.5 text-sm"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Entrar' : 'Cadastrar'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </motion.button>
          </form>

                      {/* Toggle Login/Register */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4 text-center space-y-2"
            >
              {isLogin && (
                <p className="text-xs text-muted-foreground">
                  <button
                    onClick={() => navigate('/recuperar-senha')}
                    className="text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    Esqueceu sua senha?
                  </button>
                </p>
              )}
              
              <p className="text-xs text-muted-foreground">
                {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin)
                    setError('')
                    setFormData({ nome: '', username: '', senha: '', pergunta_seguranca: '', resposta_seguranca: '' })
                  }}
                  className="ml-1 text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {isLogin ? 'Cadastre-se' : 'Faça login'}
                </button>
              </p>
            </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export default LoginPage 