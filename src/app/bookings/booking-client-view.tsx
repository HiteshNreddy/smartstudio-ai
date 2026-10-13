'use client'

import { useState, useTransition } from 'react'
import type { Database, UserRole, BookingStatus } from '@/lib/supabase/database.types'
import {
  createBookingAction,
  updateBookingStatusAction,
  deleteBookingAction,
  type BookingActionState,
} from './actions'

type BookingRow = Database['public']['Tables']['bookings']['Row']
type RoomRow = Database['public']['Tables']['rooms']['Row']
type ArtistRow = Database['public']['Tables']['artists']['Row']

export interface BookingWithDetails extends BookingRow {
  rooms?: { name: string } | null
  artists?: { name: string } | null
}

interface BookingClientViewProps {
  bookings: BookingWithDetails[]
  rooms: RoomRow[]
  artists: ArtistRow[]
  isConfigured: boolean
  userRole?: UserRole
}

export default function BookingClientView({
  bookings,
  rooms,
  artists,
  isConfigured,
  userRole,
}: BookingClientViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formState, setFormState] = useState<BookingActionState>({})
  const [isPending, startTransition] = useTransition()

  const isStaff = userRole === 'owner' || userRole === 'admin' || userRole === 'engineer'

  const openModal = () => {
    setFormState({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setFormState({})
  }

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await createBookingAction({}, formData)
      if (res.error) {
        setFormState(res)
      } else {
        closeModal()
      }
    })
  }

  const handleStatusChange = (bookingId: string, status: BookingStatus) => {
    startTransition(async () => {
      const res = await updateBookingStatusAction(bookingId, status)
      if (res.error) {
        alert(res.error)
      }
    })
  }

  const handleDelete = (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel and remove this booking?')) return
    startTransition(async () => {
      const res = await deleteBookingAction(bookingId)
      if (res.error) {
        alert(res.error)
      }
    })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Bookings</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Studio session calendar and room schedule.
          </p>
        </div>
        {isStaff && isConfigured && (
          <button
            onClick={openModal}
            className="rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/20"
          >
            + New Booking
          </button>
        )}
      </div>

      {!isConfigured && (
        <div className="mb-6 rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-xs text-status-warning flex items-center gap-3">
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>
            Database environment variables are placeholders in <code className="font-mono bg-bg-primary px-1 rounded">.env.local</code>. Real bookings will appear once connected.
          </p>
        </div>
      )}

      {/* KPI Stats */}
      <div className="stagger-children mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">Total Bookings</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">{bookings.length}</p>
          <p className="mt-1 text-xs text-text-muted">
            {bookings.filter((b) => b.status === 'confirmed').length} confirmed ·{' '}
            {bookings.filter((b) => b.status === 'pending').length} pending
          </p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">Confirmed Sessions</p>
          <p className="mt-2 text-2xl font-bold text-status-success">
            {bookings.filter((b) => b.status === 'confirmed').length}
          </p>
          <p className="mt-1 text-xs text-text-muted">Ready on calendar</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">Studio Rooms</p>
          <p className="mt-2 text-2xl font-bold text-accent-400">{rooms.length}</p>
          <p className="mt-1 text-xs text-text-muted">Available recording spaces</p>
        </div>
      </div>

      {/* Empty State */}
      {bookings.length === 0 ? (
        <div className="glass-card rounded-2xl border border-dashed border-border-default p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-600/10 text-accent-400">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text-primary">No sessions booked yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-text-muted">
            {artists.length === 0
              ? 'To schedule a booking, add at least one artist in the Artists section first.'
              : 'Create a room booking to schedule studio recording, mixing, or rehearsal time.'}
          </p>
          {isStaff && isConfigured && (
            <button
              onClick={openModal}
              className="mt-5 rounded-lg bg-accent-600 px-4 py-2.5 text-xs font-medium text-white transition-all hover:bg-accent-700"
            >
              + Create Booking
            </button>
          )}
        </div>
      ) : (
        /* Bookings Table */
        <div className="glass-card overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left">
                  <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-text-muted">Artist</th>
                  <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-text-muted">Room</th>
                  <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-text-muted">Schedule</th>
                  <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-text-muted">Duration</th>
                  <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-text-muted">Status</th>
                  {isStaff && (
                    <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-text-muted text-right">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const start = new Date(booking.start_time)
                  const end = new Date(booking.end_time)
                  const diffHours = ((end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(1)

                  return (
                    <tr
                      key={booking.id}
                      className="border-b border-border-subtle transition-colors hover:bg-bg-hover last:border-b-0"
                    >
                      <td className="px-5 py-4 font-medium text-text-primary">
                        {booking.artists?.name || 'Unnamed Artist'}
                      </td>
                      <td className="px-5 py-4 text-text-secondary">
                        {booking.rooms?.name || 'Room Space'}
                      </td>
                      <td className="px-5 py-4 text-text-secondary text-xs">
                        <div>{start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div className="text-text-muted mt-0.5">
                          {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-text-secondary text-xs">{diffHours} hrs</td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            booking.status === 'confirmed'
                              ? 'bg-status-success/10 text-status-success'
                              : booking.status === 'pending'
                              ? 'bg-status-warning/10 text-status-warning'
                              : 'bg-status-error/10 text-status-error'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </td>
                      {isStaff && (
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {booking.status !== 'confirmed' && (
                              <button
                                onClick={() => handleStatusChange(booking.id, 'confirmed')}
                                className="text-xs text-status-success hover:underline px-1 py-0.5"
                              >
                                Confirm
                              </button>
                            )}
                            {booking.status !== 'cancelled' && (
                              <button
                                onClick={() => handleStatusChange(booking.id, 'cancelled')}
                                className="text-xs text-status-warning hover:underline px-1 py-0.5"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(booking.id)}
                              className="text-xs text-status-error/80 hover:text-status-error px-1 py-0.5"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md rounded-2xl border border-border-default bg-[#161616] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">Create Studio Booking</h2>
              <button onClick={closeModal} className="text-text-muted hover:text-text-primary">
                ✕
              </button>
            </div>

            {formState.error && (
              <div className="mb-4 rounded-lg border border-status-error/30 bg-status-error/10 p-3 text-xs text-status-error">
                {formState.error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const data = new FormData(e.currentTarget)
                handleSubmit(data)
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Studio Room <span className="text-status-error">*</span>
                </label>
                <select
                  name="room_id"
                  required
                  className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-600 focus:outline-none"
                >
                  <option value="">Select a room...</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.hourly_rate ? `(₹${r.hourly_rate}/hr)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Artist / Client <span className="text-status-error">*</span>
                </label>
                <select
                  name="artist_id"
                  required
                  className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-600 focus:outline-none"
                >
                  <option value="">Select an artist...</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.genre || 'General'})
                    </option>
                  ))}
                </select>
                {artists.length === 0 && (
                  <p className="mt-1 text-[11px] text-status-warning">
                    No artists registered. Please add an artist first.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Date <span className="text-status-error">*</span>
                  </label>
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={todayStr}
                    className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Start Time <span className="text-status-error">*</span>
                  </label>
                  <input
                    name="start_time"
                    type="time"
                    required
                    defaultValue="14:00"
                    className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Duration (hours) <span className="text-status-error">*</span>
                  </label>
                  <select
                    name="duration"
                    defaultValue="2"
                    className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-600 focus:outline-none"
                  >
                    <option value="1">1 hour</option>
                    <option value="2">2 hours</option>
                    <option value="3">3 hours</option>
                    <option value="4">4 hours</option>
                    <option value="8">8 hours (Full day)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Initial Status</label>
                  <select
                    name="status"
                    defaultValue="pending"
                    className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-600 focus:outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Session Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="e.g. Lead vocal tracking with U87, producer requested SSL preamps"
                  className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-600 focus:outline-none resize-none"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-border-default px-4 py-2 text-xs font-medium text-text-secondary hover:bg-bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || artists.length === 0}
                  className="rounded-lg bg-accent-600 px-4 py-2 text-xs font-medium text-white hover:bg-accent-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  Schedule Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
