import { Link } from 'react-router-dom'
import { ArrowRight, Lock, Unlock } from 'lucide-react'
import { CONHECER_TELAS } from '../content/marketingContent'

export default function ConhecerPage() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Conhecer sistema completo</h1>
      <p className="text-muted-foreground mb-10">
        Cada tela foi pensada para trazer informação e controle para suas finanças e investimentos. Navegue pelas descrições abaixo e acesse as que estão liberadas; para as demais, faça login e aproveite tudo.
      </p>

      <div className="space-y-6">
        {CONHECER_TELAS.map(({ path, label, icon: Icon, description, requiresLogin }) => (
          <div
            key={path}
            className="p-6 rounded-2xl border border-border bg-card hover:border-primary/40 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex items-center gap-3 shrink-0">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Icon size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{label}</h2>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    {requiresLogin ? (
                      <>
                        <Lock size={12} />
                        Requer login
                      </>
                    ) : (
                      <>
                        <Unlock size={12} />
                        Acesso livre
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
                <Link
                  to={path}
                  className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-primary hover:underline"
                >
                  {requiresLogin ? 'Acessar (faça login se necessário)' : 'Acessar'}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 rounded-2xl bg-primary/10 border border-primary/20 text-center">
        <p className="text-sm font-medium text-foreground mb-2">
          Quer usar todas as telas?
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Crie sua conta ou faça login para acessar Home, Carteira, Controle, Análise, Notícias, Agenda e Rankings. Recursos premium podem exigir liberação pelo administrador.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Ir para o login
            <ArrowRight size={18} />
          </Link>
          <Link
            to="/vendas"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg border border-primary/30 text-primary font-medium hover:bg-primary/5 transition-colors"
          >
            Ver plano premium
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  )
}
