export default function Loading() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center animate-fade-in">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
        <p className="text-xs text-text-muted">Loading studio data...</p>
      </div>
    </div>
  )
}
