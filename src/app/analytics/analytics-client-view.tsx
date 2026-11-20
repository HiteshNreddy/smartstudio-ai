'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export interface AnalyticsData {
  timeRange: string
  totalRevenue: number
  pendingRevenue: number
  totalInvoicesCount: number
  paidInvoicesCount: number
  totalSessions: number
  completedSessions: number
  confirmedSessions: number
  totalBookedHours: number
  utilizationRate: number
  uniqueArtistsCount: number
  repeatArtistRate: number
  roomStats: Array<{
    id: string
    name: string
    hourlyRate: number | null
    sessionCount: number
    bookedHours: number
    revenue: number
  }>
  statusBreakdown: {
    completed: number
    confirmed: number
    pending: number
    cancelled: number
    in_progress: number
  }
}

interface AnalyticsClientViewProps {
  data: AnalyticsData
  isConfigured: boolean
}

export default function AnalyticsClientView({ data, isConfigured }: AnalyticsClientViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentRange = searchParams.get('range') || '30d'

  const handleRangeChange = (range: string) => {
    router.push(`/analytics?range=${range}`)
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header & Date Range Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Studio Business Intelligence</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Real-time revenue metrics, space utilization rates, and artist retention analytics.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 rounded-xl border border-border-default bg-bg-surface p-1">
          {[
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: '90d', label: '90 Days' },
            { id: 'all', label: 'All Time' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => handleRangeChange(pill.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                currentRange === pill.id
                  ? 'bg-accent-600 text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {!isConfigured && (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-xs text-status-warning flex items-center gap-3">
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Connect Supabase in .env.local to aggregate real studio financial and booking records.</span>
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Paid Revenue
            </p>
            <span className="rounded-full bg-status-success/15 px-2 py-0.5 text-[10px] font-bold text-status-success">
              {data.paidInvoicesCount} invoices
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">
            ₹{data.totalRevenue.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {data.pendingRevenue > 0
              ? `₹${data.pendingRevenue.toLocaleString('en-IN')} pending`
              : 'All invoices settled'}
          </p>
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Room Utilization
            </p>
            <span className="rounded-full bg-accent-600/15 px-2 py-0.5 text-[10px] font-bold text-accent-400">
              {data.totalBookedHours.toFixed(1)} hrs booked
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-accent-400">
            {data.utilizationRate.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-text-muted">Based on 10h/day studio capacity</p>
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Completed Sessions
            </p>
            <span className="rounded-full bg-status-info/15 px-2 py-0.5 text-[10px] font-bold text-status-info">
              {data.totalSessions} total
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">
            {data.completedSessions}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {data.confirmedSessions} upcoming confirmed
          </p>
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Client Retention
            </p>
            <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-[10px] font-bold text-status-warning">
              {data.uniqueArtistsCount} clients
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">
            {data.repeatArtistRate.toFixed(0)}%
          </p>
          <p className="mt-1 text-xs text-text-muted">Clients with multiple sessions</p>
        </div>
      </div>

      {/* Two-Column Analytics Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Room Performance Breakdown */}
        <div className="lg:col-span-2 glass-card rounded-xl p-6">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div>
              <h2 className="text-base font-bold text-text-primary">Room Utilization & Yield</h2>
              <p className="mt-0.5 text-xs text-text-muted">
                Session volume, booked duration, and revenue by physical space.
              </p>
            </div>
            <Link href="/rooms" className="text-xs font-medium text-accent-400 hover:text-accent-300">
              Manage Rooms →
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto">
            {data.roomStats.length === 0 ? (
              <p className="py-8 text-center text-xs text-text-muted">
                No rooms registered in the studio yet.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-[10px] uppercase tracking-wider text-text-tertiary">
                    <th className="pb-3">Room</th>
                    <th className="pb-3">Rate</th>
                    <th className="pb-3">Sessions</th>
                    <th className="pb-3">Total Hours</th>
                    <th className="pb-3 text-right">Yield (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {data.roomStats.map((room) => (
                    <tr key={room.id} className="transition-colors hover:bg-bg-surface/30">
                      <td className="py-3.5 font-semibold text-text-primary">{room.name}</td>
                      <td className="py-3.5 text-text-secondary">
                        {room.hourlyRate ? `₹${room.hourlyRate}/hr` : 'Custom'}
                      </td>
                      <td className="py-3.5">
                        <span className="rounded-md bg-bg-surface px-2 py-0.5 font-mono text-text-primary border border-border-subtle">
                          {room.sessionCount}
                        </span>
                      </td>
                      <td className="py-3.5 font-medium text-text-secondary">
                        {room.bookedHours.toFixed(1)} hrs
                      </td>
                      <td className="py-3.5 text-right font-bold text-accent-400">
                        ₹{room.revenue.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Booking Status Distribution */}
        <div className="glass-card rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-text-primary">Booking Distribution</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Current lifecycle status across all logged bookings.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-text-secondary">Confirmed</span>
                  <span className="font-bold text-text-primary">{data.statusBreakdown.confirmed}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-bg-surface overflow-hidden">
                  <div
                    className="h-full bg-status-success rounded-full"
                    style={{
                      width: `${data.totalSessions ? (data.statusBreakdown.confirmed / data.totalSessions) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-text-secondary">Completed</span>
                  <span className="font-bold text-text-primary">{data.statusBreakdown.completed}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-bg-surface overflow-hidden">
                  <div
                    className="h-full bg-status-info rounded-full"
                    style={{
                      width: `${data.totalSessions ? (data.statusBreakdown.completed / data.totalSessions) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-text-secondary">In Progress</span>
                  <span className="font-bold text-text-primary">{data.statusBreakdown.in_progress}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-bg-surface overflow-hidden">
                  <div
                    className="h-full bg-accent-400 rounded-full"
                    style={{
                      width: `${data.totalSessions ? (data.statusBreakdown.in_progress / data.totalSessions) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-text-secondary">Pending Approval</span>
                  <span className="font-bold text-text-primary">{data.statusBreakdown.pending}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-bg-surface overflow-hidden">
                  <div
                    className="h-full bg-status-warning rounded-full"
                    style={{
                      width: `${data.totalSessions ? (data.statusBreakdown.pending / data.totalSessions) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-text-secondary">Cancelled</span>
                  <span className="font-bold text-text-primary">{data.statusBreakdown.cancelled}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-bg-surface overflow-hidden">
                  <div
                    className="h-full bg-status-error/60 rounded-full"
                    style={{
                      width: `${data.totalSessions ? (data.statusBreakdown.cancelled / data.totalSessions) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border-subtle flex justify-between items-center text-xs">
            <span className="text-text-muted">Total logged bookings</span>
            <span className="font-bold text-text-primary">{data.totalSessions}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
