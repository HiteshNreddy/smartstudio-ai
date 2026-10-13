import Link from 'next/link'

export const metadata = {
  title: 'Analytics — SmartStudio AI',
  description: 'Business analytics and revenue insights for the studio.',
}

export default function AnalyticsPage() {
  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Business Analytics</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Revenue trends, studio utilization metrics, and financial reporting.
        </p>
      </div>

      {/* Notice Banner */}
      <div className="rounded-xl border border-accent-500/30 bg-accent-600/10 p-5 text-text-primary">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-accent-600/20 p-2 text-accent-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">Analytics Engine: Feature Preview</h2>
            <p className="mt-1 text-xs text-text-secondary leading-relaxed">
              Business intelligence calculations require historical session records and paid invoice data.
              Fabricated demo trends have been removed to preserve data integrity. Once your studio has logged ongoing sessions, genuine automated reporting will populate here.
            </p>
            <div className="mt-3 flex gap-3">
              <Link
                href="/bookings"
                className="text-xs font-semibold text-accent-400 hover:text-accent-300"
              >
                Log Sessions in Bookings →
              </Link>
              <Link
                href="/projects"
                className="text-xs font-semibold text-accent-400 hover:text-accent-300"
              >
                Track Projects →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards (Clean zero/awaiting state) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Monthly Revenue
          </p>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">₹0</p>
          <p className="mt-1 text-xs text-text-muted">Awaiting invoice payments</p>
        </div>

        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Avg Room Utilization
          </p>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">--%</p>
          <p className="mt-1 text-xs text-text-muted">Calculated across 30 days</p>
        </div>

        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Completed Sessions
          </p>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">0</p>
          <p className="mt-1 text-xs text-text-muted">Sessions with completed status</p>
        </div>

        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Client Retention
          </p>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">--%</p>
          <p className="mt-1 text-xs text-text-muted">Repeat artists over 90 days</p>
        </div>
      </div>

      {/* Placeholder Chart Container */}
      <div className="glass-card rounded-xl p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated border border-border-subtle text-text-muted mb-4">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-text-primary">
          Revenue & Utilization Graphs Unavailable
        </h3>
        <p className="mt-1 text-xs text-text-secondary max-w-md mx-auto">
          Graphical analysis requires aggregate transactions over time. Once bookings and billing records accumulate, detailed time-series charts will be generated here automatically.
        </p>
      </div>
    </div>
  )
}
