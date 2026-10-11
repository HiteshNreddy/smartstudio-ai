/**
 * DEMO DATA — Realistic but fictional.
 * None of this data represents real Muzico clients, sessions, or revenue.
 * All names, dates, and figures are fabricated for UI demonstration purposes.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Booking {
  id: string;
  artist: string;
  room: string;
  date: string;
  time: string;
  duration: string;
  status: "confirmed" | "pending" | "completed" | "cancelled";
}

export interface Artist {
  id: string;
  name: string;
  genre: string;
  email: string;
  phone: string;
  sessions: number;
  revenue: number;
  lastVisit: string;
  status: "active" | "inactive" | "new";
}

export interface Project {
  id: string;
  title: string;
  artist: string;
  type: string;
  progress: number;
  tracks: number;
  deadline: string;
  status: "in-progress" | "mixing" | "mastering" | "delivered" | "on-hold";
}

export interface AnalyticsMetric {
  label: string;
  value: string;
  change: number;
  trend: "up" | "down" | "flat";
}

export interface RevenueDataPoint {
  month: string;
  revenue: number;
  bookings: number;
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export const dashboardStats = [
  { label: "Total Bookings", value: "184", change: +12, icon: "calendar" },
  { label: "Active Artists", value: "47", change: +5, icon: "users" },
  { label: "Monthly Revenue", value: "₹8,42,000", change: +18, icon: "revenue" },
  { label: "Studio Hours", value: "312h", change: -3, icon: "clock" },
] as const;

export const recentActivity = [
  { id: "1", text: "Demo Artist Priya completed mastering for 'Midnight Echoes'", time: "2 hours ago", type: "project" as const },
  { id: "2", text: "New booking: Demo Artist Karthik — Studio A, Oct 12", time: "4 hours ago", type: "booking" as const },
  { id: "3", text: "Invoice #INV-0042 paid by Demo Artist Ravi", time: "6 hours ago", type: "payment" as const },
  { id: "4", text: "Demo Artist Meera uploaded 3 reference tracks", time: "Yesterday", type: "upload" as const },
  { id: "5", text: "Equipment maintenance: Neve 1073 preamp serviced", time: "Yesterday", type: "maintenance" as const },
];

// ─── Bookings ────────────────────────────────────────────────────────────────

export const bookings: Booking[] = [
  { id: "BK-001", artist: "Demo Artist Priya", room: "Studio A", date: "2026-10-12", time: "10:00", duration: "4h", status: "confirmed" },
  { id: "BK-002", artist: "Demo Artist Karthik", room: "Studio B", date: "2026-10-12", time: "14:00", duration: "3h", status: "confirmed" },
  { id: "BK-003", artist: "Demo Artist Meera", room: "Vocal Booth", date: "2026-10-13", time: "09:00", duration: "2h", status: "pending" },
  { id: "BK-004", artist: "Demo Artist Ravi", room: "Studio A", date: "2026-10-13", time: "13:00", duration: "5h", status: "confirmed" },
  { id: "BK-005", artist: "Demo Artist Ananya", room: "Mix Room", date: "2026-10-14", time: "11:00", duration: "6h", status: "pending" },
  { id: "BK-006", artist: "Demo Band Horizon", room: "Live Room", date: "2026-10-15", time: "10:00", duration: "8h", status: "confirmed" },
  { id: "BK-007", artist: "Demo Artist Vikram", room: "Studio B", date: "2026-10-16", time: "15:00", duration: "3h", status: "completed" },
  { id: "BK-008", artist: "Demo Artist Priya", room: "Mix Room", date: "2026-10-17", time: "10:00", duration: "4h", status: "confirmed" },
];

// ─── Artists / CRM ───────────────────────────────────────────────────────────

export const artists: Artist[] = [
  { id: "ART-001", name: "Demo Artist Priya", genre: "Indie Pop", email: "priya@demo.example", phone: "+91 98XXX XXXXX", sessions: 24, revenue: 192000, lastVisit: "2026-10-10", status: "active" },
  { id: "ART-002", name: "Demo Artist Karthik", genre: "Carnatic Fusion", email: "karthik@demo.example", phone: "+91 97XXX XXXXX", sessions: 18, revenue: 156000, lastVisit: "2026-10-08", status: "active" },
  { id: "ART-003", name: "Demo Artist Meera", genre: "R&B / Soul", email: "meera@demo.example", phone: "+91 99XXX XXXXX", sessions: 12, revenue: 98000, lastVisit: "2026-10-05", status: "active" },
  { id: "ART-004", name: "Demo Artist Ravi", genre: "Hip-Hop", email: "ravi@demo.example", phone: "+91 96XXX XXXXX", sessions: 31, revenue: 248000, lastVisit: "2026-10-09", status: "active" },
  { id: "ART-005", name: "Demo Artist Ananya", genre: "Electronic", email: "ananya@demo.example", phone: "+91 95XXX XXXXX", sessions: 8, revenue: 64000, lastVisit: "2026-09-28", status: "active" },
  { id: "ART-006", name: "Demo Band Horizon", genre: "Alt Rock", email: "horizon@demo.example", phone: "+91 94XXX XXXXX", sessions: 15, revenue: 180000, lastVisit: "2026-10-07", status: "active" },
  { id: "ART-007", name: "Demo Artist Vikram", genre: "Classical Crossover", email: "vikram@demo.example", phone: "+91 93XXX XXXXX", sessions: 5, revenue: 40000, lastVisit: "2026-09-15", status: "inactive" },
  { id: "ART-008", name: "Demo Artist Zara", genre: "Pop", email: "zara@demo.example", phone: "+91 92XXX XXXXX", sessions: 2, revenue: 16000, lastVisit: "2026-10-10", status: "new" },
];

// ─── Projects ────────────────────────────────────────────────────────────────

export const projects: Project[] = [
  { id: "PRJ-001", title: "Midnight Echoes (EP)", artist: "Demo Artist Priya", type: "EP (5 tracks)", progress: 85, tracks: 5, deadline: "2026-10-30", status: "mastering" },
  { id: "PRJ-002", title: "Roots & Routes", artist: "Demo Artist Karthik", type: "Album (12 tracks)", progress: 40, tracks: 12, deadline: "2026-12-15", status: "in-progress" },
  { id: "PRJ-003", title: "Neon Nights (Single)", artist: "Demo Artist Meera", type: "Single", progress: 95, tracks: 1, deadline: "2026-10-15", status: "mastering" },
  { id: "PRJ-004", title: "Street Poetry Vol. 2", artist: "Demo Artist Ravi", type: "Mixtape (8 tracks)", progress: 60, tracks: 8, deadline: "2026-11-20", status: "mixing" },
  { id: "PRJ-005", title: "Frequencies", artist: "Demo Artist Ananya", type: "EP (4 tracks)", progress: 25, tracks: 4, deadline: "2026-11-30", status: "in-progress" },
  { id: "PRJ-006", title: "Edge of Dawn", artist: "Demo Band Horizon", type: "Album (10 tracks)", progress: 70, tracks: 10, deadline: "2026-11-10", status: "mixing" },
  { id: "PRJ-007", title: "Raga Reimagined", artist: "Demo Artist Vikram", type: "Single", progress: 100, tracks: 1, deadline: "2026-09-30", status: "delivered" },
  { id: "PRJ-008", title: "First Light", artist: "Demo Artist Zara", type: "Single", progress: 10, tracks: 1, deadline: "2026-12-01", status: "in-progress" },
];

// ─── Analytics ───────────────────────────────────────────────────────────────

export const analyticsMetrics: AnalyticsMetric[] = [
  { label: "Avg. Session Duration", value: "3.8h", change: +8, trend: "up" },
  { label: "Client Retention Rate", value: "87%", change: +2, trend: "up" },
  { label: "Studio Utilization", value: "74%", change: -5, trend: "down" },
  { label: "Revenue per Hour", value: "₹2,700", change: +11, trend: "up" },
];

export const revenueData: RevenueDataPoint[] = [
  { month: "May", revenue: 620000, bookings: 128 },
  { month: "Jun", revenue: 710000, bookings: 145 },
  { month: "Jul", revenue: 680000, bookings: 138 },
  { month: "Aug", revenue: 790000, bookings: 162 },
  { month: "Sep", revenue: 820000, bookings: 170 },
  { month: "Oct", revenue: 842000, bookings: 184 },
];

export const roomUtilization = [
  { room: "Studio A", utilization: 82, color: "#7c3aed" },
  { room: "Studio B", utilization: 68, color: "#8b5cf6" },
  { room: "Vocal Booth", utilization: 91, color: "#a78bfa" },
  { room: "Mix Room", utilization: 73, color: "#c4b5fd" },
  { room: "Live Room", utilization: 45, color: "#ddd6fe" },
];

// ─── Audio Analysis (placeholder metrics) ────────────────────────────────────

export const audioAnalysisFeatures = [
  { title: "Spectral Analysis", description: "Visualize frequency distribution across your mixes with real-time FFT spectrograms.", icon: "spectrum" },
  { title: "Loudness Metering", description: "LUFS-integrated loudness measurement for broadcast and streaming compliance.", icon: "volume" },
  { title: "Stereo Imaging", description: "Correlation metering and stereo field visualization for mix width analysis.", icon: "stereo" },
  { title: "Dynamic Range", description: "Crest factor and dynamic range analysis with per-band compression detection.", icon: "dynamics" },
  { title: "Reference Matching", description: "A/B comparison tools to match tonal balance against reference tracks.", icon: "compare" },
  { title: "AI Mix Assistant", description: "AI-powered suggestions for EQ, compression, and spatial placement.", icon: "ai" },
];
