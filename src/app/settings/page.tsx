import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured, getActiveStudio, getAuthenticatedUser } from '@/lib/supabase/auth'
import type { Database } from '@/lib/supabase/database.types'

type RoomRow = Database['public']['Tables']['rooms']['Row']

export const metadata = {
  title: 'Settings — SmartStudio AI',
  description: 'Application settings, studio configuration, and room management.',
}

export default async function SettingsPage() {
  const configured = isSupabaseConfigured()

  if (!configured) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="rounded-xl border border-status-warning/40 bg-status-warning/10 p-6 text-status-warning">
          <h2 className="text-base font-bold">Supabase Environment Unconfigured</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Settings require an active database connection. Add valid Supabase keys to <code className="text-accent-400">.env.local</code> to manage your studio profile and rooms.
          </p>
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

  // Fetch real studio rooms
  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('studio_id', studioId)
    .order('name')

  const roomsList = (rooms as RoomRow[]) || []

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Studio Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your organization profile, recording rooms, and external service links.
        </p>
      </div>

      <div className="max-w-3xl space-y-8">
        {/* Studio Profile */}
        <section className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
                Studio Organization
              </h2>
              <p className="mt-0.5 text-xs text-text-muted">
                Tenant configuration and access identifiers.
              </p>
            </div>
            <span className="rounded-full bg-accent-600/20 px-3 py-1 text-xs font-semibold text-accent-400 border border-accent-600/30 uppercase tracking-wide">
              Role: {activeStudio.role}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Studio Name
              </label>
              <input
                type="text"
                value={activeStudio.studio.name}
                readOnly
                className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none cursor-default"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                URL Identifier (Slug)
              </label>
              <input
                type="text"
                value={activeStudio.studio.slug}
                readOnly
                className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2.5 font-mono text-sm text-text-muted outline-none cursor-default"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Tenant Studio ID
              </label>
              <input
                type="text"
                value={activeStudio.studio.id}
                readOnly
                className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2.5 font-mono text-xs text-text-muted outline-none cursor-default"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Authenticated User Email
              </label>
              <input
                type="text"
                value={user.email ?? 'No email provided'}
                readOnly
                className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none cursor-default"
              />
            </div>
          </div>
        </section>

        {/* Real Rooms Section */}
        <section className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
                Studio Rooms & Spaces
              </h2>
              <p className="mt-0.5 text-xs text-text-muted">
                Configured physical recording spaces for session booking.
              </p>
            </div>
            <Link
              href="/bookings"
              className="text-xs font-medium text-accent-400 hover:text-accent-300"
            >
              View in Bookings →
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {roomsList.length === 0 ? (
              <div className="py-6 text-center text-xs text-text-muted">
                No rooms configured yet for this studio.
              </div>
            ) : (
              roomsList.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between rounded-lg border border-border-subtle p-4 transition-colors hover:border-border-default bg-bg-surface/50"
                >
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{room.name}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {room.description || 'No description provided'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-accent-400">
                      {room.hourly_rate ? `₹${room.hourly_rate}/hr` : 'Custom Rate'}
                    </p>
                    <span className="text-[10px] text-text-tertiary">Active</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Integrations (Truthfully marked) */}
        <section className="glass-card rounded-xl p-6">
          <div className="pb-4 border-b border-border-subtle">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
              External Integrations
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Connection status of cloud services and third-party APIs.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border-subtle p-4 bg-bg-surface/50">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary">Supabase PostgreSQL</p>
                  <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-[10px] font-semibold text-status-success uppercase">
                    Connected
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  Primary relational database with tenant isolation and RLS policies.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border-subtle p-4 bg-bg-surface/50">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary">Google Calendar</p>
                  <span className="rounded-full bg-text-muted/10 px-2 py-0.5 text-[10px] font-semibold text-text-muted uppercase">
                    Not Connected
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  Calendar sync integration currently in development.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border-subtle p-4 bg-bg-surface/50">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary">Razorpay Invoicing</p>
                  <span className="rounded-full bg-text-muted/10 px-2 py-0.5 text-[10px] font-semibold text-text-muted uppercase">
                    Not Connected
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  Direct payment gateway integration pending configuration.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border-subtle p-4 bg-bg-surface/50">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary">WhatsApp Business</p>
                  <span className="rounded-full bg-text-muted/10 px-2 py-0.5 text-[10px] font-semibold text-text-muted uppercase">
                    Not Connected
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  Client booking notifications gateway pending API token.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
