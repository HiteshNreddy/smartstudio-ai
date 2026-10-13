import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured, getActiveStudio, getAuthenticatedUser } from '@/lib/supabase/auth'
import type { Database, BookingStatus, ProjectStatus } from '@/lib/supabase/database.types'

type BookingRow = Database['public']['Tables']['bookings']['Row']
type ProjectRow = Database['public']['Tables']['projects']['Row']

interface BookingWithJoins extends BookingRow {
  rooms?: { name: string } | null
  artists?: { name: string } | null
}

interface ProjectWithArtist extends ProjectRow {
  artists?: { name: string } | null
}

export const metadata = {
  title: 'Dashboard — SmartStudio AI',
  description: 'Studio operations overview, upcoming sessions, and active projects.',
}

export default async function DashboardPage() {
  const configured = isSupabaseConfigured()

  if (!configured) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="rounded-xl border border-status-warning/40 bg-status-warning/10 p-6 text-status-warning">
          <div className="flex items-start gap-4">
            <svg
              className="h-6 w-6 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h2 className="text-base font-bold">Supabase Environment Unconfigured</h2>
              <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                Your <code className="text-accent-400">.env.local</code> contains placeholder values.
                To view live studio metrics, connect your local Supabase instance by setting{' '}
                <code className="text-accent-400">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
                <code className="text-accent-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
              </p>
              <div className="mt-4">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700"
                >
                  Go to Authentication
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Zero state dashboard grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Bookings" value="0" subtitle="Awaiting database connection" />
          <StatCard label="Active Artists" value="0" subtitle="Awaiting database connection" />
          <StatCard label="Active Projects" value="0" subtitle="Awaiting database connection" />
          <StatCard label="Studio Rooms" value="0" subtitle="Awaiting database connection" />
        </div>
      </div>
    )
  }

  const user = await getAuthenticatedUser()
  if (!user) {
    redirect('/login')
  }

  const activeStudio = await getActiveStudio()
  if (!activeStudio) {
    redirect('/onboarding')
  }

  const studioId = activeStudio.studio.id
  const supabase = await createServerSupabaseClient()

  // Real database metrics queries
  const [artistsRes, bookingsRes, projectsRes, roomsRes, upcomingBookingsRes, activeProjectsRes] =
    await Promise.all([
      supabase.from('artists').select('*', { count: 'exact', head: true }).eq('studio_id', studioId),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('studio_id', studioId),
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq('studio_id', studioId),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('studio_id', studioId),
      supabase
        .from('bookings')
        .select('*, rooms(name), artists(name)')
        .eq('studio_id', studioId)
        .order('start_time', { ascending: false })
        .limit(5),
      supabase
        .from('projects')
        .select('*, artists(name)')
        .eq('studio_id', studioId)
        .neq('status', 'delivered')
        .order('updated_at', { ascending: false })
        .limit(4),
    ])

  const artistsCount = artistsRes.count ?? 0
  const bookingsCount = bookingsRes.count ?? 0
  const projectsCount = projectsRes.count ?? 0
  const roomsCount = roomsRes.count ?? 0
  const upcomingBookings = (upcomingBookingsRes.data as unknown as BookingWithJoins[]) || []
  const activeProjects = (activeProjectsRes.data as unknown as ProjectWithArtist[]) || []

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Live operations overview for{' '}
            <span className="font-semibold text-accent-400">{activeStudio.studio.name}</span>{' '}
            ({activeStudio.role})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/bookings"
            className="rounded-lg bg-accent-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/20"
          >
            + New Booking
          </Link>
          <Link
            href="/projects"
            className="rounded-lg border border-border-default bg-bg-surface px-3.5 py-2 text-xs font-semibold text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary"
          >
            + New Project
          </Link>
        </div>
      </div>

      {/* Real Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Bookings"
          value={bookingsCount.toString()}
          subtitle="Scheduled across all rooms"
          href="/bookings"
          icon="calendar"
        />
        <StatCard
          label="Registered Artists"
          value={artistsCount.toString()}
          subtitle="Artists in studio CRM"
          href="/artists"
          icon="users"
        />
        <StatCard
          label="Active Projects"
          value={projectsCount.toString()}
          subtitle="Tracking, mixing, & mastering"
          href="/projects"
          icon="projects"
        />
        <StatCard
          label="Studio Rooms"
          value={roomsCount.toString()}
          subtitle="Configured recording spaces"
          href="/settings"
          icon="rooms"
        />
      </div>

      {/* Two Column Layout: Upcoming Bookings & Active Projects */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Upcoming Bookings */}
        <div className="glass-card rounded-xl p-6 xl:col-span-2">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
              Upcoming Bookings
            </h2>
            <Link
              href="/bookings"
              className="text-xs font-medium text-accent-400 hover:text-accent-300 transition-colors"
            >
              View Calendar →
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {upcomingBookings.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-text-primary">No bookings scheduled</p>
                <p className="mt-1 text-xs text-text-muted">
                  Schedule recording and mixing sessions to see them appear here.
                </p>
                <div className="mt-4">
                  <Link
                    href="/bookings"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover"
                  >
                    Open Bookings Schedule
                  </Link>
                </div>
              </div>
            ) : (
              upcomingBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border-subtle p-3.5 transition-colors hover:border-border-default hover:bg-bg-hover"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">
                        {b.artists?.name || 'Unassigned Artist'}
                      </p>
                      <BookingBadge status={b.status as BookingStatus} />
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      {b.rooms?.name || 'Studio Room'} ·{' '}
                      {new Date(b.start_time).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      -{' '}
                      {new Date(b.end_time).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {b.notes && (
                    <p className="text-xs text-text-secondary italic max-w-xs truncate">
                      &quot;{b.notes}&quot;
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Projects Summary */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
              Active Projects
            </h2>
            <Link
              href="/projects"
              className="text-xs font-medium text-accent-400 hover:text-accent-300 transition-colors"
            >
              All Projects →
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {activeProjects.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-text-primary">No active projects</p>
                <p className="mt-1 text-xs text-text-muted">
                  Create albums, EPs, or singles in the projects workspace.
                </p>
                <div className="mt-4">
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover"
                  >
                    Create Project
                  </Link>
                </div>
              </div>
            ) : (
              activeProjects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-border-subtle p-3.5 transition-all hover:border-accent-600/30 hover:bg-bg-hover"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-primary truncate">{p.title}</p>
                    <ProjectBadge status={p.status as ProjectStatus} />
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {p.artists?.name || 'Unassigned Artist'} · {p.type || 'Standard'}
                  </p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text-tertiary">Progress</span>
                      <span className="font-mono font-medium text-accent-400">{p.progress ?? 0}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-bg-surface overflow-hidden border border-border-subtle">
                      <div
                        className="h-full bg-accent-500 rounded-full transition-all"
                        style={{ width: `${p.progress ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  subtitle,
  href,
  icon,
}: {
  label: string
  value: string
  subtitle: string
  href?: string
  icon?: string
}) {
  const content = (
    <div className="glass-card glass-card-hover rounded-xl p-5 transition-all hover:border-accent-500/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">{label}</p>
        {icon && <StatIcon type={icon} />}
      </div>
      <p className="mt-3 text-3xl font-extrabold text-text-primary">{value}</p>
      <p className="mt-1 text-xs text-text-muted">{subtitle}</p>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

function StatIcon({ type }: { type: string }) {
  const cls = 'h-5 w-5 text-accent-400'
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-600/10">
      {type === 'calendar' && (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      )}
      {type === 'users' && (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
      )}
      {type === 'projects' && (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      )}
      {type === 'rooms' && (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M9 4v16M15 4v16M4 9h16M4 15h16" />
        </svg>
      )}
    </div>
  )
}

function BookingBadge({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, string> = {
    confirmed: 'bg-status-success/10 text-status-success border border-status-success/20',
    pending: 'bg-status-warning/10 text-status-warning border border-status-warning/20',
    in_progress: 'bg-status-info/10 text-status-info border border-status-info/20',
    completed: 'bg-accent-500/10 text-accent-400 border border-accent-500/20',
    cancelled: 'bg-status-error/10 text-status-error border border-status-error/20',
  }
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${styles[status] ?? 'bg-bg-elevated text-text-muted'}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

function ProjectBadge({ status }: { status: ProjectStatus }) {
  const styles: Record<ProjectStatus, string> = {
    'in-progress': 'bg-status-info/10 text-status-info border border-status-info/20',
    mixing: 'bg-accent-500/10 text-accent-400 border border-accent-500/20',
    mastering: 'bg-status-warning/10 text-status-warning border border-status-warning/20',
    delivered: 'bg-status-success/10 text-status-success border border-status-success/20',
    'on-hold': 'bg-text-muted/10 text-text-muted border border-border-default',
  }
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${styles[status] ?? 'bg-bg-elevated text-text-muted'}`}
    >
      {status.replace('-', ' ')}
    </span>
  )
}
