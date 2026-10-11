import { dashboardStats, recentActivity, bookings, projects } from "@/lib/demo-data";

export default function DashboardPage() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Welcome back. Here&apos;s your studio overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((stat) => (
          <div
            key={stat.label}
            className="glass-card glass-card-hover stat-glow rounded-xl p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                {stat.label}
              </p>
              <StatIcon type={stat.icon} />
            </div>
            <p className="mt-3 text-2xl font-bold text-text-primary">{stat.value}</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={`text-xs font-semibold ${
                  stat.change >= 0 ? "text-status-success" : "text-status-error"
                }`}
              >
                {stat.change >= 0 ? "↑" : "↓"} {Math.abs(stat.change)}%
              </span>
              <span className="text-xs text-text-muted">vs last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent Activity */}
        <div className="glass-card rounded-xl p-6 xl:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-bg-hover"
              >
                <ActivityDot type={item.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">{item.text}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick View: Upcoming Bookings */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
            Upcoming Bookings
          </h2>
          <div className="space-y-3">
            {bookings
              .filter((b) => b.status === "confirmed" || b.status === "pending")
              .slice(0, 5)
              .map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-lg border border-border-subtle p-3 transition-colors hover:border-border-default"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text-primary">
                      {booking.artist}
                    </p>
                    <StatusBadge status={booking.status} />
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {booking.room} · {booking.date} · {booking.time} ({booking.duration})
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Projects Summary */}
      <div className="mt-6 glass-card rounded-xl p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
          Active Projects
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {projects
            .filter((p) => p.status !== "delivered")
            .slice(0, 4)
            .map((project) => (
              <div
                key={project.id}
                className="rounded-lg border border-border-subtle p-4 transition-all hover:border-accent-600/30 hover:bg-bg-hover"
              >
                <p className="text-sm font-medium text-text-primary">{project.title}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{project.artist}</p>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-tertiary">{project.type}</span>
                    <span className="font-medium text-accent-400">{project.progress}%</span>
                  </div>
                  <div className="progress-bar mt-1.5">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Demo data notice */}
      <p className="mt-8 text-center text-xs text-text-muted">
        All data shown above is fictional demo data. It does not represent real Muzico information.
      </p>
    </div>
  );
}

/* ─── Helper Components ─────────────────────────────────────────────────────── */

function StatIcon({ type }: { type: string }) {
  const base = "h-8 w-8 rounded-lg flex items-center justify-center";
  switch (type) {
    case "calendar":
      return (
        <div className={`${base} bg-accent-600/10`}>
          <svg className="h-4 w-4 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </div>
      );
    case "users":
      return (
        <div className={`${base} bg-status-info/10`}>
          <svg className="h-4 w-4 text-status-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          </svg>
        </div>
      );
    case "revenue":
      return (
        <div className={`${base} bg-status-success/10`}>
          <svg className="h-4 w-4 text-status-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
      );
    case "clock":
      return (
        <div className={`${base} bg-status-warning/10`}>
          <svg className="h-4 w-4 text-status-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
        </div>
      );
    default:
      return null;
  }
}

function ActivityDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    project: "bg-accent-500",
    booking: "bg-status-info",
    payment: "bg-status-success",
    upload: "bg-status-warning",
    maintenance: "bg-text-tertiary",
  };
  return (
    <span className={`mt-1.5 block h-2 w-2 flex-shrink-0 rounded-full ${colors[type] ?? "bg-text-muted"}`} />
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: "bg-status-success/10 text-status-success",
    pending: "bg-status-warning/10 text-status-warning",
    completed: "bg-accent-500/10 text-accent-400",
    cancelled: "bg-status-error/10 text-status-error",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}
