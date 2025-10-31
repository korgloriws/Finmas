import { motion } from 'framer-motion'
import { 
  FileText, 
  Building2, 
  Target, 
  Globe, 
  Users, 
  ExternalLink
} from 'lucide-react'

// Componente para seção de informações
function InfoSection({ 
  title, 
  icon: Icon, 
  children 
}: {
  title: string
  icon: any
  children: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:shadow-lg transition-all duration-300">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-primary text-primary-foreground shadow-lg">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-foreground">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  )
}

// Componente para linha de informação
function InfoRow({ 
  label, 
  value, 
  icon: Icon 
}: {
  label: string
  value: string | number | null | undefined
  icon: any
}) {
  if (!value || value === '-') return null

  return (
    <div className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="w-4 h-4 text-primary/70" />
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium text-foreground">
        {typeof value === 'string' && value.startsWith('http') ? (
          <a 
            href={value} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
            title="Abrir link"
          >
            <span>Website</span>
            <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
          </a>
        ) : (
          value
        )}
      </span>
    </div>
  )
}

interface DetalhesHistoryTabProps {
  info: any
}

export default function DetalhesHistoryTab({
  info
}: DetalhesHistoryTabProps) {
  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <InfoSection title="História e Atuação" icon={FileText}>
        <div className="space-y-3">
          <div className="text-sm leading-relaxed text-foreground/90">
            {(info.longBusinessSummary && String(info.longBusinessSummary).trim())
              ? String(info.longBusinessSummary)
              : 'Resumo não disponível.'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow label="Setor" value={info.sector} icon={Building2} />
            <InfoRow label="Indústria" value={info.industry} icon={Target} />
            <InfoRow label="País" value={info.country} icon={Globe} />
            <InfoRow label="Funcionários" value={info.fullTimeEmployees?.toLocaleString('pt-BR')} icon={Users} />
            <InfoRow label="Endereço" value={[info.address1, info.address2, info.city, info.state, info.zip, info.country].filter(Boolean).join(', ') || '-'} icon={FileText} />
            <InfoRow label="Telefone" value={info.phone} icon={FileText} />
            <InfoRow label="Website" value={info.website} icon={ExternalLink} />
          </div>
        </div>
      </InfoSection>

      <InfoSection title="Diretoria e Contatos (se disponível)" icon={Users}>
        <div className="space-y-0.5">
          <InfoRow label="Cidade" value={info.city} icon={Globe} />
          <InfoRow label="Estado" value={info.state} icon={Globe} />
          <InfoRow label="Código Postal" value={info.zip} icon={FileText} />
          <InfoRow label="Fax" value={info.fax} icon={FileText} />
        </div>
      </InfoSection>
    </motion.div>
  )
}
