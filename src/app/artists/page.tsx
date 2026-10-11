import { artists } from "@/lib/demo-data";

export const metadata = {
  title: "Artists & CRM — SmartStudio AI",
  description: "Artist relationship management and client tracking.",
};

export default function ArtistsPage() {
  const totalRevenue = artists.reduce((sum, a) => sum + a.revenue, 0);
  const totalSessions = artists.reduce((sum, a) => sum + a.sessions, 0);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Artists & CRM</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage artist relationships and track engagement.
          </p>
        </div>
        <button className="rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/20">
          + Add Artist
        </button>
      </div>

      {/* Summary Cards */}
      <div className="stagger-children mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">Total Artists</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">{artists.length}</p>
          <p className="mt-1 text-xs text-text-muted">
            {artists.filter((a) => a.status === "active").length} active · {artists.filter((a) => a.status === "new").length} new
          </p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">Total Sessions</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">{totalSessions}</p>
          <p className="mt-1 text-xs text-text-muted">Across all artists</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">Total Revenue</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">
            ₹{(totalRevenue / 100000).toFixed(1)}L
          </p>
          <p className="mt-1 text-xs text-text-muted">Lifetime (demo)</p>
        </div>
      </div>

      {/* Artist Cards Grid */}
      <div className="stagger-children grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {artists.map((artist) => (
          <div
            key={artist.id}
            className="glass-card glass-card-hover rounded-xl p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-600/15 text-sm font-bold text-accent-400">
                  {artist.name
                    .replace("Demo ", "")
                    .split(" ")
                    .map((w) => w[0])
                    .join("")}
                </div>
                <div>
                  <p className="font-medium text-text-primary">{artist.name}</p>
                  <p className="text-xs text-text-secondary">{artist.genre}</p>
                </div>
              </div>
              <StatusPill status={artist.status} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-bg-primary/50 p-3">
              <div className="text-center">
                <p className="text-lg font-bold text-text-primary">{artist.sessions}</p>
                <p className="text-[10px] text-text-muted">Sessions</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-text-primary">
                  ₹{(artist.revenue / 1000).toFixed(0)}k
                </p>
                <p className="text-[10px] text-text-muted">Revenue</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-text-primary">
                  {artist.lastVisit.slice(-5)}
                </p>
                <p className="text-[10px] text-text-muted">Last Visit</p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <path d="m22 6-10 7L2 6" />
              </svg>
              {artist.email}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-text-muted">
        All artist data shown is fictional demo data. No real Muzico client data is displayed.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-status-success/10 text-status-success",
    inactive: "bg-text-muted/10 text-text-muted",
    new: "bg-accent-500/10 text-accent-400",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}
