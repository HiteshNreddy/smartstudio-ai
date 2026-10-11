import { projects } from "@/lib/demo-data";

export const metadata = {
  title: "Projects — SmartStudio AI",
  description: "Track recording, mixing, and mastering projects.",
};

export default function ProjectsPage() {
  const statusGroups = {
    "In Progress": projects.filter((p) => p.status === "in-progress"),
    Mixing: projects.filter((p) => p.status === "mixing"),
    Mastering: projects.filter((p) => p.status === "mastering"),
    Delivered: projects.filter((p) => p.status === "delivered"),
    "On Hold": projects.filter((p) => p.status === "on-hold"),
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Projects</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Track all recording, mixing, and mastering projects.
          </p>
        </div>
        <button className="rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/20">
          + New Project
        </button>
      </div>

      {/* Status Overview */}
      <div className="stagger-children mb-6 flex flex-wrap gap-3">
        {Object.entries(statusGroups).map(([label, items]) => (
          <div
            key={label}
            className="glass-card rounded-lg px-4 py-2.5 text-center"
          >
            <p className="text-lg font-bold text-text-primary">{items.length}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
          </div>
        ))}
      </div>

      {/* Projects Table */}
      <div className="glass-card overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-text-muted">Project</th>
                <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-text-muted">Artist</th>
                <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-text-muted">Type</th>
                <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-text-muted">Progress</th>
                <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-text-muted">Deadline</th>
                <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-border-subtle transition-colors hover:bg-bg-hover last:border-b-0"
                >
                  <td className="px-5 py-4">
                    <div>
                      <p className="font-medium text-text-primary">{project.title}</p>
                      <p className="text-xs text-text-muted">{project.id}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">{project.artist}</td>
                  <td className="px-5 py-4 text-text-secondary">{project.type}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="progress-bar w-24">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-accent-400">{project.progress}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">{project.deadline}</td>
                  <td className="px-5 py-4">
                    <ProjectStatusBadge status={project.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-text-muted">
        All project data shown is fictional demo data.
      </p>
    </div>
  );
}

function ProjectStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "in-progress": "bg-status-info/10 text-status-info",
    mixing: "bg-accent-500/10 text-accent-400",
    mastering: "bg-status-warning/10 text-status-warning",
    delivered: "bg-status-success/10 text-status-success",
    "on-hold": "bg-text-muted/10 text-text-muted",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status] ?? ""}`}>
      {status.replace("-", " ")}
    </span>
  );
}
