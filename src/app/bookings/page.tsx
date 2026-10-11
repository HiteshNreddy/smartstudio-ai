import { bookings } from "@/lib/demo-data";

export const metadata = {
  title: "Bookings — SmartStudio AI",
  description: "Studio session booking calendar and management.",
};

const timeSlots = [
  "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00",
];


const weekDates = [
  { day: "Mon", date: "Oct 12" },
  { day: "Tue", date: "Oct 13" },
  { day: "Wed", date: "Oct 14" },
  { day: "Thu", date: "Oct 15" },
  { day: "Fri", date: "Oct 16" },
  { day: "Sat", date: "Oct 17" },
  { day: "Sun", date: "Oct 18" },
];

export default function BookingsPage() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Bookings</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage studio sessions and availability.
          </p>
        </div>
        <button className="rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/20">
          + New Booking
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="glass-card overflow-hidden rounded-xl">
        {/* Week Header */}
        <div className="grid grid-cols-8 border-b border-border-subtle">
          <div className="border-r border-border-subtle p-3">
            <p className="text-xs font-medium text-text-muted">Time</p>
          </div>
          {weekDates.map((d) => (
            <div
              key={d.day}
              className="border-r border-border-subtle p-3 text-center last:border-r-0"
            >
              <p className="text-xs font-medium text-text-tertiary">{d.day}</p>
              <p className="text-sm font-semibold text-text-primary">{d.date}</p>
            </div>
          ))}
        </div>

        {/* Time Slots */}
        <div className="max-h-[540px] overflow-y-auto">
          {timeSlots.map((time) => (
            <div key={time} className="grid grid-cols-8 border-b border-border-subtle last:border-b-0">
              <div className="flex items-center border-r border-border-subtle p-3">
                <p className="text-xs font-medium text-text-muted">{time}</p>
              </div>
              {weekDates.map((d) => {
                const booking = bookings.find(
                  (b) => b.time === time && d.date.includes(b.date.slice(-2))
                );
                return (
                  <div
                    key={`${time}-${d.day}`}
                    className="min-h-[60px] border-r border-border-subtle p-1 last:border-r-0"
                  >
                    {booking && (
                      <div
                        className={`h-full rounded-md p-2 text-[10px] leading-tight transition-all hover:scale-[1.02] ${
                          booking.status === "confirmed"
                            ? "bg-accent-600/15 border border-accent-600/30 text-accent-300"
                            : booking.status === "pending"
                            ? "bg-status-warning/10 border border-status-warning/30 text-status-warning"
                            : "bg-bg-hover border border-border-default text-text-secondary"
                        }`}
                      >
                        <p className="font-semibold truncate">{booking.artist.replace("Demo ", "")}</p>
                        <p className="mt-0.5 text-text-muted">{booking.room}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="mt-6 glass-card rounded-xl p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
          All Bookings
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-text-muted">ID</th>
                <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-text-muted">Artist</th>
                <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-text-muted">Room</th>
                <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-text-muted">Date</th>
                <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-text-muted">Time</th>
                <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-text-muted">Duration</th>
                <th className="pb-3 text-xs font-medium uppercase tracking-wider text-text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-border-subtle transition-colors hover:bg-bg-hover">
                  <td className="py-3 pr-4 font-mono text-xs text-text-muted">{b.id}</td>
                  <td className="py-3 pr-4 font-medium text-text-primary">{b.artist}</td>
                  <td className="py-3 pr-4 text-text-secondary">{b.room}</td>
                  <td className="py-3 pr-4 text-text-secondary">{b.date}</td>
                  <td className="py-3 pr-4 text-text-secondary">{b.time}</td>
                  <td className="py-3 pr-4 text-text-secondary">{b.duration}</td>
                  <td className="py-3">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-text-muted">
        All booking data shown is fictional demo data.
      </p>
    </div>
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
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}
