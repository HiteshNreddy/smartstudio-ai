'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { Database, BookingStatus } from '@/lib/supabase/database.types'
import { requestSessionAction, type CustomerActionState } from './actions'
import { signOut } from '@/app/login/actions'

type BookingRow = Database['public']['Tables']['bookings']['Row']
type ProjectRow = Database['public']['Tables']['projects']['Row']
type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type RoomRow = Database['public']['Tables']['rooms']['Row']
type ArtistRow = Database['public']['Tables']['artists']['Row']
type AccessRequestRow = Database['public']['Tables']['studio_access_requests']['Row']

interface BookingWithRoom extends BookingRow {
  rooms?: { name: string; hourly_rate: number | null } | null
}

interface CustomerClientViewProps {
  artist: ArtistRow | null
  accessState?: 'approved' | 'pending' | 'rejected' | 'none'
  accessRequest?: AccessRequestRow | null
  bookings: BookingWithRoom[]
  projects: ProjectRow[]
  invoices: InvoiceRow[]
  rooms: RoomRow[]
  studioName: string
  userEmail: string
  isStaff: boolean
}

const BOOKING_STATUS_STYLES: Record<BookingStatus, { label: string; className: string }> = {
  pending: { label: 'Pending Approval', className: 'bg-status-warning/15 text-status-warning border-status-warning/30' },
  confirmed: { label: 'Confirmed', className: 'bg-status-success/15 text-status-success border-status-success/30' },
  in_progress: { label: 'In Session', className: 'bg-accent-600/15 text-accent-400 border-accent-600/30' },
  completed: { label: 'Completed', className: 'bg-status-info/15 text-status-info border-status-info/30' },
  cancelled: { label: 'Cancelled', className: 'bg-status-error/15 text-status-error border-status-error/30' },
}

export default function CustomerClientView({
  artist,
  accessState = 'approved',
  accessRequest,
  bookings,
  projects,
  invoices,
  rooms,
  studioName,
  userEmail,
  isStaff,
}: CustomerClientViewProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'projects' | 'invoices'>('sessions')
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [formState, setFormState] = useState<CustomerActionState>({})
  const [defaultSessionDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [isPending, startTransition] = useTransition()

  // If client access is pending or rejected, render state message without studio data
  if (accessState !== 'approved') {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary pb-16">
        <header className="border-b border-border-subtle bg-bg-secondary/80 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-600">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
              </div>
              <div>
                <span className="font-bold text-sm text-text-primary">{studioName}</span>
                <p className="text-[11px] text-text-tertiary">Client Portal Access Verification</p>
              </div>
            </div>

            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-border-default bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 pt-16 animate-fade-in">
          {accessState === 'pending' ? (
            <div className="glass-card rounded-2xl p-8 border border-accent-600/30 text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-600/15 text-accent-400">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>

              <div>
                <span className="rounded-full bg-status-warning/15 text-status-warning border border-status-warning/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                  Registration Under Review
                </span>
                <h1 className="text-xl font-bold text-text-primary mt-3">
                  Account Pending Studio Approval
                </h1>
                <p className="mt-2 text-sm text-text-secondary max-w-md mx-auto">
                  Thank you for registering with {studioName}. To protect artist privacy, master recordings, and studio scheduling, client registrations are verified by studio management.
                </p>
              </div>

              <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-4 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-muted">Account Email:</span>
                  <span className="font-mono text-text-primary">{userEmail}</span>
                </div>
                {accessRequest?.requested_artist_name && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Artist / Band Name:</span>
                    <span className="font-semibold text-text-primary">{accessRequest.requested_artist_name}</span>
                  </div>
                )}
                {accessRequest?.genre && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Genre:</span>
                    <span className="text-text-secondary">{accessRequest.genre}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-muted">Submitted At:</span>
                  <span className="text-text-secondary">
                    {accessRequest?.created_at ? new Date(accessRequest.created_at).toLocaleString('en-IN') : 'Recently'}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full sm:w-auto rounded-lg bg-accent-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-accent-700 transition-colors"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          ) : accessState === 'rejected' ? (
            <div className="glass-card rounded-2xl p-8 border border-status-error/30 text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-status-error/15 text-status-error">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>

              <div>
                <h1 className="text-xl font-bold text-text-primary">Access Request Declined</h1>
                <p className="mt-2 text-sm text-text-secondary max-w-md mx-auto">
                  Your access request for {studioName} was not approved. Please contact studio staff or management directly if you believe this was an error.
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-8 border border-border-default text-center space-y-6">
              <h1 className="text-xl font-bold text-text-primary">No Active Access Request</h1>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                No verified artist profile or pending registration was found for your account. Please register through the registration page.
              </p>
              <Link
                href="/register"
                className="inline-block rounded-lg bg-accent-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-accent-700 transition-colors"
              >
                Go to Registration
              </Link>
            </div>
          )}
        </main>
      </div>
    )
  }

  // Metrics
  const upcomingSessionsCount = bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'pending'
  ).length

  const activeProjectsCount = projects.filter((p) => p.status !== 'delivered').length

  const totalDueInr = invoices
    .filter((inv) => inv.status === 'unpaid')
    .reduce((acc, inv) => acc + Number(inv.amount), 0)

  const handleRequestSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await requestSessionAction({}, formData)
      if (res.error) {
        setFormState(res)
      } else {
        setIsRequestModalOpen(false)
        setFormState({})
      }
    })
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary pb-16">
      {/* Top Navigation Bar */}
      <header className="border-b border-border-subtle bg-bg-secondary/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-600">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-text-primary">{studioName}</span>
                <span className="rounded-full bg-accent-600/20 border border-accent-600/30 px-2 py-0.5 text-[10px] font-semibold text-accent-400 uppercase tracking-wider">
                  Artist Portal
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary">Client Self-Service & Session Tracking</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isStaff && (
              <Link
                href="/"
                className="text-xs font-semibold text-accent-400 hover:text-accent-300"
              >
                ← Studio Dashboard
              </Link>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-border-default bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-8 space-y-8 animate-fade-in">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-card rounded-2xl p-6">
          <div>
            <span className="text-xs font-semibold text-accent-400 uppercase tracking-widest">
              Welcome back
            </span>
            <h1 className="text-2xl font-black text-text-primary mt-1">
              {artist?.name || userEmail.split('@')[0]}
            </h1>
            <p className="text-xs text-text-muted mt-1">
              {artist?.genre ? `Genre: ${artist.genre}` : 'Recording Artist'} • Registered with {studioName}
            </p>
          </div>

          <div>
            <button
              onClick={() => {
                setFormState({})
                setIsRequestModalOpen(true)
              }}
              className="w-full sm:w-auto rounded-xl bg-accent-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-accent-600/25 transition-all hover:bg-accent-700 hover:scale-[1.02]"
            >
              + Request Studio Session
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="glass-card rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Scheduled Sessions
            </p>
            <p className="mt-2 text-2xl font-extrabold text-accent-400">
              {upcomingSessionsCount}
            </p>
            <p className="mt-1 text-xs text-text-muted">Confirmed or awaiting studio approval</p>
          </div>

          <div className="glass-card rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Active Production Projects
            </p>
            <p className="mt-2 text-2xl font-extrabold text-text-primary">
              {activeProjectsCount}
            </p>
            <p className="mt-1 text-xs text-text-muted">In tracking, mixing or mastering</p>
          </div>

          <div className="glass-card rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Pending Invoice Balance
            </p>
            <p className="mt-2 text-2xl font-extrabold text-status-warning">
              ₹{totalDueInr.toLocaleString('en-IN')}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {totalDueInr === 0 ? 'All invoices settled' : 'Unpaid session billings'}
            </p>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex gap-2 border-b border-border-subtle pb-3">
          {[
            { id: 'sessions' as const, label: `My Sessions (${bookings.length})` },
            { id: 'projects' as const, label: `My Projects (${projects.length})` },
            { id: 'invoices' as const, label: `My Invoices (${invoices.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-accent-600/15 text-accent-400 border border-accent-600/30'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content: Sessions */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <div className="glass-card rounded-xl p-12 text-center">
                <p className="text-sm font-semibold text-text-primary">No Studio Sessions Booked Yet</p>
                <p className="mt-1 text-xs text-text-muted">
                  Ready to record? Request a session in one of our acoustic spaces.
                </p>
                <button
                  onClick={() => setIsRequestModalOpen(true)}
                  className="mt-4 rounded-lg bg-accent-600 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700"
                >
                  Request First Session
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {bookings.map((booking) => {
                  const style = BOOKING_STATUS_STYLES[booking.status] || BOOKING_STATUS_STYLES.pending
                  const start = new Date(booking.start_time)
                  const end = new Date(booking.end_time)
                  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

                  return (
                    <div key={booking.id} className="glass-card rounded-xl p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-sm text-text-primary">
                              {booking.rooms?.name || 'Studio Room'}
                            </h3>
                            <p className="text-[11px] text-text-muted">
                              {start.toLocaleDateString('en-IN', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${style.className}`}>
                            {style.label}
                          </span>
                        </div>

                        <div className="mt-4 space-y-1.5 text-xs text-text-secondary">
                          <p>
                            ⏰ {start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} —{' '}
                            {end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ({durationHours} hrs)
                          </p>
                          {booking.notes && (
                            <p className="mt-2 text-[11px] text-text-muted italic bg-bg-surface p-2 rounded-lg border border-border-subtle">
                              {booking.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border-subtle flex justify-between items-center text-xs">
                        <span className="text-text-muted">Estimated Rate</span>
                        <span className="font-bold text-accent-400">
                          {booking.rooms?.hourly_rate
                            ? `₹${(booking.rooms.hourly_rate * durationHours).toLocaleString('en-IN')}`
                            : 'Confirmed upon review'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Projects */}
        {activeTab === 'projects' && (
          <div className="space-y-4">
            {projects.length === 0 ? (
              <div className="glass-card rounded-xl p-12 text-center">
                <p className="text-sm font-semibold text-text-primary">No Active Projects</p>
                <p className="mt-1 text-xs text-text-muted">
                  Your producer or mixing engineer will link deliverables and milestones here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {projects.map((project) => (
                  <div key={project.id} className="glass-card rounded-xl p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-base text-text-primary">{project.title}</h3>
                        <p className="text-xs text-text-muted mt-0.5 capitalize">
                          {project.type || 'Album / EP'} • {project.tracks || 1} tracks
                        </p>
                      </div>
                      <span className="rounded-full bg-accent-600/20 border border-accent-600/30 px-3 py-1 text-xs font-semibold text-accent-400 capitalize">
                        {project.status?.replace('-', ' ') || 'In Progress'}
                      </span>
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-text-secondary">Production Progress</span>
                        <span className="font-bold text-text-primary">{project.progress ?? 0}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-bg-surface overflow-hidden">
                        <div
                          className="h-full bg-accent-600 rounded-full transition-all duration-500"
                          style={{ width: `${project.progress ?? 0}%` }}
                        />
                      </div>
                    </div>

                    {project.deadline && (
                      <p className="mt-4 text-xs text-text-muted">
                        Target Release: {new Date(project.deadline).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    )}

                    <div className="mt-5 pt-3 border-t border-border-subtle flex items-center justify-between">
                      <span className="text-[11px] text-text-tertiary">Audio deliverables ready</span>
                      <button
                        onClick={() => {
                          const blob = new Blob(['SmartStudio AI Studio Deliverable Track'], { type: 'audio/wav' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `${project.title} - Master Audio (24-bit 48kHz).wav`
                          a.click()
                          URL.revokeObjectURL(url)
                        }}
                        className="rounded-lg bg-accent-600/20 text-accent-400 border border-accent-600/30 px-3 py-1.5 text-xs font-semibold hover:bg-accent-600/30 transition-colors inline-flex items-center gap-1.5"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Master (WAV)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Invoices */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            {invoices.length === 0 ? (
              <div className="glass-card rounded-xl p-12 text-center">
                <p className="text-sm font-semibold text-text-primary">No Billing Statements</p>
                <p className="mt-1 text-xs text-text-muted">
                  All studio session invoices and payment receipts will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-secondary/50">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle bg-bg-surface/50 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                      <th className="px-5 py-3">Invoice #</th>
                      <th className="px-5 py-3">Due Date</th>
                      <th className="px-5 py-3">Amount (INR)</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="transition-colors hover:bg-bg-surface/30">
                        <td className="px-5 py-4 font-mono font-medium text-text-primary">
                          INV-{inv.id.substring(0, 8).toUpperCase()}
                        </td>
                        <td className="px-5 py-4 text-text-secondary">
                          {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : 'On Receipt'}
                        </td>
                        <td className="px-5 py-4 font-bold text-accent-400">
                          ₹{Number(inv.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                              inv.status === 'paid'
                                ? 'bg-status-success/15 text-status-success'
                                : 'bg-status-warning/15 text-status-warning'
                            }`}
                          >
                            {inv.status === 'paid' ? 'Paid' : 'Unpaid / Due'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Session Request Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border-default bg-bg-secondary p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <h2 className="text-lg font-bold text-text-primary">Request Studio Session</h2>
              <button onClick={() => setIsRequestModalOpen(false)} className="text-text-muted hover:text-text-primary">✕</button>
            </div>

            {formState.error && (
              <div className="mt-4 rounded-lg border border-status-error/30 bg-status-error/10 p-3 text-xs text-status-error">
                {formState.error}
              </div>
            )}

            <form action={handleRequestSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Select Room <span className="text-status-error">*</span>
                </label>
                <select
                  name="room_id"
                  required
                  className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
                >
                  <option value="" disabled>Choose a recording space</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} {room.hourly_rate ? `(₹${room.hourly_rate}/hr)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Date <span className="text-status-error">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={defaultSessionDate}
                    className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Start Time <span className="text-status-error">*</span>
                  </label>
                  <input
                    type="time"
                    name="start_time"
                    required
                    defaultValue="14:00"
                    className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Duration (Hours)
                </label>
                <select
                  name="duration"
                  defaultValue="2"
                  className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
                >
                  <option value="1">1 Hour</option>
                  <option value="2">2 Hours</option>
                  <option value="3">3 Hours</option>
                  <option value="4">4 Hours (Half Day)</option>
                  <option value="8">8 Hours (Full Day Lockout)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Session Goals & Technical Notes
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="e.g. Lead vocal tracking, acoustic guitar overdubs, need Neumann U87 setup."
                  className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="rounded-lg border border-border-default bg-bg-surface px-4 py-2 text-xs font-medium text-text-secondary hover:bg-bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-accent-600 px-5 py-2 text-xs font-medium text-white transition-all hover:bg-accent-700 disabled:opacity-50"
                >
                  {isPending ? 'Submitting...' : 'Submit Session Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
