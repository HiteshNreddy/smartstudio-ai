import { analyticsMetrics, revenueData, roomUtilization } from "@/lib/demo-data";

export const metadata = {
  title: "Analytics — SmartStudio AI",
  description: "Business analytics and revenue insights for the studio.",
};

export default function AnalyticsPage() {
  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue));

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Business Analytics</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Revenue trends, utilization metrics, and business insights.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="stagger-children mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {analyticsMetrics.map((metric) => (
          <div key={metric.label} className="glass-card glass-card-hover rounded-xl p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-text-primary">{metric.value}</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={`text-xs font-semibold ${
                  metric.trend === "up" ? "text-status-success" : metric.trend === "down" ? "text-status-error" : "text-text-muted"
                }`}
              >
                {metric.trend === "up" ? "↑" : metric.trend === "down" ? "↓" : "→"}{" "}
                {Math.abs(metric.change)}%
              </span>
              <span className="text-xs text-text-muted">vs last month</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Revenue Chart (CSS bar chart) */}
        <div className="glass-card rounded-xl p-6 xl:col-span-2">
          <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
            Monthly Revenue
          </h2>
          <div className="flex h-52 items-end gap-3">
            {revenueData.map((d) => (
              <div key={d.month} className="flex flex-1 flex-col items-center gap-2">
                <p className="text-xs font-semibold text-accent-400">
                  ₹{(d.revenue / 100000).toFixed(1)}L
                </p>
                <div className="w-full max-w-[40px] relative group">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-accent-700 to-accent-400 transition-all group-hover:from-accent-600 group-hover:to-accent-300"
                    style={{ height: `${(d.revenue / maxRevenue) * 160}px` }}
                  />
                </div>
                <p className="text-xs text-text-muted">{d.month}</p>
              </div>
            ))}
          </div>

          {/* Bookings trend beneath */}
          <div className="mt-6 flex items-center gap-4 rounded-lg bg-bg-primary/50 p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent-500" />
              <span className="text-xs text-text-secondary">Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-status-info" />
              <span className="text-xs text-text-secondary">
                Bookings: {revenueData[revenueData.length - 1].bookings} this month
              </span>
            </div>
          </div>
        </div>

        {/* Room Utilization */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
            Room Utilization
          </h2>
          <div className="space-y-5">
            {roomUtilization.map((room) => (
              <div key={room.room}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-sm text-text-secondary">{room.room}</p>
                  <p className="text-sm font-semibold text-text-primary">{room.utilization}%</p>
                </div>
                <div className="h-2 rounded-full bg-bg-hover">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${room.utilization}%`,
                      backgroundColor: room.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 glass-card rounded-xl p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
          AI Insights
        </h2>
        <div className="stagger-children grid grid-cols-1 gap-4 md:grid-cols-3">
          <InsightCard
            title="Peak Hours"
            value="2 PM – 6 PM"
            description="Highest booking density. Consider premium pricing for these slots."
            color="accent"
          />
          <InsightCard
            title="Growth Opportunity"
            value="Live Room"
            description="45% utilization — lowest among all rooms. Promote band recording packages."
            color="warning"
          />
          <InsightCard
            title="Top Client"
            value="Demo Artist Ravi"
            description="31 sessions, highest lifetime value. Offer a loyalty retention package."
            color="success"
          />
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-text-muted">
        All analytics data is fictional demo data. No real Muzico business data is displayed.
      </p>
    </div>
  );
}

function InsightCard({
  title,
  value,
  description,
  color,
}: {
  title: string;
  value: string;
  description: string;
  color: string;
}) {
  const dotColor: Record<string, string> = {
    accent: "bg-accent-500",
    warning: "bg-status-warning",
    success: "bg-status-success",
  };
  return (
    <div className="rounded-lg border border-border-subtle p-4 transition-all hover:border-border-default hover:bg-bg-hover">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotColor[color] ?? "bg-text-muted"}`} />
        <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">{title}</p>
      </div>
      <p className="mt-2 text-lg font-bold text-text-primary">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-text-secondary">{description}</p>
    </div>
  );
}
