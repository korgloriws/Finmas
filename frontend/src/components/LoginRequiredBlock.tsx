import { useNavigate, Link } from 'react-router-dom'
import { Lock, ArrowLeft } from 'lucide-react'

export default function LoginRequiredBlock() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center p-8 rounded-2xl border border-border bg-card">
        <div className="inline-flex p-4 rounded-full bg-muted text-muted-foreground mb-6">
          <Lock size={32} />
        </div>
        <h2 className="text-xl font-semibold mb-2">Faça login para acessar</h2>
        <p className="text-muted-foreground text-sm mb-8">
          Esta área é restrita. Entre na sua conta ou cadastre-se para continuar.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-background hover:bg-accent transition-colors"
          >
            <ArrowLeft size={18} />
            Voltar
          </button>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Entrar
          </Link>
        </div>
      </div>
    </div>
  )
}
