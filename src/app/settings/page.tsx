export const metadata = {
  title: "Settings — SmartStudio AI",
  description: "Application settings and configuration.",
};

const settingSections = [
  {
    title: "Studio Profile",
    description: "Configure your studio name, location, and branding.",
    fields: [
      { label: "Studio Name", value: "Muzico Studios", type: "text" },
      { label: "Location", value: "Bengaluru, Karnataka", type: "text" },
      { label: "Contact Email", value: "contact@example.com", type: "email" },
      { label: "Phone", value: "+91 80-XXXX-XXXX", type: "tel" },
    ],
  },
  {
    title: "Rooms & Equipment",
    description: "Manage studio rooms and their configurations.",
    rooms: [
      { name: "Studio A", rate: "₹3,500/hr", gear: "SSL Console, Neve Preamps" },
      { name: "Studio B", rate: "₹2,500/hr", gear: "API Preamps, Universal Audio" },
      { name: "Vocal Booth", rate: "₹1,500/hr", gear: "U87 Mic, Avalon Channel Strip" },
      { name: "Mix Room", rate: "₹2,000/hr", gear: "Genelec Monitors, Pro Tools HDX" },
      { name: "Live Room", rate: "₹4,000/hr", gear: "Full Band Setup, 32-ch Console" },
    ],
  },
  {
    title: "Integrations",
    description: "Connect external services and APIs.",
    integrations: [
      { name: "Supabase", status: "configured", description: "Database & authentication backend" },
      { name: "Google Calendar", status: "not_connected", description: "Sync bookings with Google Calendar" },
      { name: "Razorpay", status: "not_connected", description: "Payment processing for invoices" },
      { name: "WhatsApp Business", status: "not_connected", description: "Client communication & notifications" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your studio configuration and integrations.
        </p>
      </div>

      <div className="max-w-3xl space-y-8">
        {/* Studio Profile */}
        <section className="glass-card rounded-xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
            {settingSections[0].title}
          </h2>
          <p className="mt-1 text-xs text-text-muted">{settingSections[0].description}</p>
          <div className="mt-5 space-y-4">
            {settingSections[0].fields!.map((field) => (
              <div key={field.label}>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                  {field.label}
                </label>
                <input
                  type={field.type}
                  defaultValue={field.value}
                  className="w-full rounded-lg border border-border-default bg-bg-primary px-3.5 py-2.5 text-sm text-text-primary transition-colors focus:border-accent-600 focus:outline-none focus:ring-1 focus:ring-accent-600/30"
                  readOnly
                />
              </div>
            ))}
          </div>
          <button className="mt-5 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/20">
            Save Changes
          </button>
        </section>

        {/* Rooms */}
        <section className="glass-card rounded-xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
            {settingSections[1].title}
          </h2>
          <p className="mt-1 text-xs text-text-muted">{settingSections[1].description}</p>
          <div className="mt-5 space-y-3">
            {settingSections[1].rooms!.map((room) => (
              <div
                key={room.name}
                className="flex items-center justify-between rounded-lg border border-border-subtle p-4 transition-colors hover:border-border-default"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">{room.name}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{room.gear}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-accent-400">{room.rate}</p>
                  <button className="mt-1 text-[10px] text-text-tertiary hover:text-text-secondary">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Integrations */}
        <section className="glass-card rounded-xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
            {settingSections[2].title}
          </h2>
          <p className="mt-1 text-xs text-text-muted">{settingSections[2].description}</p>
          <div className="mt-5 space-y-3">
            {settingSections[2].integrations!.map((integration) => (
              <div
                key={integration.name}
                className="flex items-center justify-between rounded-lg border border-border-subtle p-4 transition-colors hover:border-border-default"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{integration.name}</p>
                    <IntegrationBadge status={integration.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted">{integration.description}</p>
                </div>
                <button
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    integration.status === "configured"
                      ? "border border-border-default text-text-secondary hover:text-text-primary"
                      : "bg-accent-600 text-white hover:bg-accent-700"
                  }`}
                >
                  {integration.status === "configured" ? "Manage" : "Connect"}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="rounded-xl border border-status-error/20 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-status-error">
            Danger Zone
          </h2>
          <p className="mt-1 text-xs text-text-muted">Irreversible actions.</p>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-status-error/20 p-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Reset Demo Data</p>
              <p className="text-xs text-text-muted">Clear all demo data and start fresh.</p>
            </div>
            <button className="rounded-lg border border-status-error/30 px-3 py-1.5 text-xs font-medium text-status-error transition-all hover:bg-status-error/10">
              Reset
            </button>
          </div>
        </section>
      </div>

      <p className="mt-8 text-center text-xs text-text-muted">
        Settings shown are demo defaults. No production configuration is modified.
      </p>
    </div>
  );
}

function IntegrationBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        status === "configured"
          ? "bg-status-success/10 text-status-success"
          : "bg-text-muted/10 text-text-muted"
      }`}
    >
      {status === "configured" ? "Connected" : "Not Connected"}
    </span>
  );
}
