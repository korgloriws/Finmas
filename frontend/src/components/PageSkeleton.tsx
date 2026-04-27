
export default function PageSkeleton() {
  return (
    <div
      className="w-full min-h-[60vh] p-4 md:p-6 animate-pulse"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mb-5">
        <div className="h-5 w-40 rounded-md bg-muted/60 mb-2" />
        <div className="h-3 w-64 rounded bg-muted/40" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card/60 p-4"
          >
            <div className="h-3 w-20 rounded bg-muted/60 mb-3" />
            <div className="h-5 w-28 rounded bg-muted/80 mb-2" />
            <div className="h-2 w-16 rounded bg-muted/40" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card/60 p-4 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="h-3 w-40 rounded bg-muted/60" />
          <div className="h-3 w-20 rounded bg-muted/40" />
        </div>
        <div className="h-56 rounded bg-muted/30" />
      </div>

      <div className="rounded-lg border border-border bg-card/60 p-4">
        <div className="h-3 w-32 rounded bg-muted/60 mb-4" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 rounded bg-muted/30" />
          ))}
        </div>
      </div>

      <span className="sr-only">Carregando...</span>
    </div>
  )
}
