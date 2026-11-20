'use client'

import { useState, useTransition } from 'react'
import type { Database, UserRole, InvoiceStatus } from '@/lib/supabase/database.types'
import {
  createInvoiceAction,
  updateInvoiceStatusAction,
  deleteInvoiceAction,
  type InvoiceActionState,
} from './actions'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type ArtistRow = Database['public']['Tables']['artists']['Row']
type BookingRow = Database['public']['Tables']['bookings']['Row']
type RoomRow = Database['public']['Tables']['rooms']['Row']

export interface EnrichedInvoice extends InvoiceRow {
  artist?: ArtistRow | null
  booking?: BookingRow | null
}

interface InvoiceClientViewProps {
  invoices: EnrichedInvoice[]
  artists: ArtistRow[]
  bookings: BookingRow[]
  rooms: RoomRow[]
  isConfigured: boolean
  userRole?: UserRole
}

const STATUS_BADGE: Record<InvoiceStatus, { label: string; className: string }> = {
  unpaid: { label: 'Unpaid / Due', className: 'bg-status-warning/15 text-status-warning border border-status-warning/20' },
  paid: { label: 'Paid', className: 'bg-status-success/15 text-status-success border border-status-success/20' },
  refunded: { label: 'Refunded', className: 'bg-text-muted/15 text-text-muted border border-text-muted/20' },
  cancelled: { label: 'Cancelled', className: 'bg-status-error/15 text-status-error border border-status-error/20' },
}

export default function InvoiceClientView({
  invoices,
  artists,
  bookings,
  rooms,
  isConfigured,
  userRole,
}: InvoiceClientViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [formState, setFormState] = useState<InvoiceActionState>({})
  const [selectedArtistId, setSelectedArtistId] = useState<string>('')
  const [selectedBookingId, setSelectedBookingId] = useState<string>('')
  const [suggestedAmount, setSuggestedAmount] = useState<string>('')
  const [defaultDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })
  const [isPending, startTransition] = useTransition()

  const canManageBilling = userRole === 'owner' || userRole === 'admin'

  // Summary Metrics
  const totalBilled = invoices
    .filter((inv) => inv.status !== 'cancelled')
    .reduce((acc, inv) => acc + Number(inv.amount), 0)

  const totalPaid = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((acc, inv) => acc + Number(inv.amount), 0)

  const totalPending = invoices
    .filter((inv) => inv.status === 'unpaid')
    .reduce((acc, inv) => acc + Number(inv.amount), 0)

  const filteredInvoices = invoices.filter((inv) => {
    if (filterStatus === 'all') return true
    return inv.status === filterStatus
  })

  const openCreateModal = () => {
    setFormState({})
    setSelectedArtistId(artists[0]?.id || '')
    setSelectedBookingId('')
    setSuggestedAmount('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setFormState({})
  }

  const handleBookingSelect = (bookingId: string) => {
    setSelectedBookingId(bookingId)
    if (!bookingId) return

    const booking = bookings.find((b) => b.id === bookingId)
    if (booking) {
      if (booking.artist_id) setSelectedArtistId(booking.artist_id)
      const room = rooms.find((r) => r.id === booking.room_id)
      if (room && room.hourly_rate) {
        const start = new Date(booking.start_time).getTime()
        const end = new Date(booking.end_time).getTime()
        const hours = Math.max(1, Math.round((end - start) / (1000 * 60 * 60)))
        setSuggestedAmount((room.hourly_rate * hours).toString())
      }
    }
  }

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await createInvoiceAction({}, formData)
      if (res.error) {
        setFormState(res)
      } else {
        closeModal()
      }
    })
  }

  const handleUpdateStatus = (invoiceId: string, status: InvoiceStatus) => {
    startTransition(async () => {
      const res = await updateInvoiceStatusAction(invoiceId, status)
      if (res.error) alert(res.error)
    })
  }

  const handleDelete = (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return
    startTransition(async () => {
      const res = await deleteInvoiceAction(invoiceId)
      if (res.error) alert(res.error)
    })
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Invoices & Billing</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage recording session billings, studio payments, and client receipts in INR.
          </p>
        </div>
        {canManageBilling && isConfigured && (
          <button
            onClick={openCreateModal}
            className="rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/20"
          >
            + Create Invoice
          </button>
        )}
      </div>

      {!isConfigured && (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-xs text-status-warning flex items-center gap-3">
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Supabase is not configured. Configure credentials in .env.local to manage studio invoices.</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Total Revenue Collected
          </p>
          <p className="mt-2 text-2xl font-extrabold text-status-success">
            ₹{totalPaid.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-xs text-text-muted">Paid in full</p>
        </div>

        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Outstanding Receivables
          </p>
          <p className="mt-2 text-2xl font-extrabold text-status-warning">
            ₹{totalPending.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-xs text-text-muted">Awaiting client payment</p>
        </div>

        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Gross Billed Volume
          </p>
          <p className="mt-2 text-2xl font-extrabold text-accent-400">
            ₹{totalBilled.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-xs text-text-muted">Active invoices across studio</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-border-subtle pb-3">
        {['all', 'unpaid', 'paid', 'cancelled'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterStatus(tab)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium capitalize transition-all ${
              filterStatus === tab
                ? 'bg-accent-600/15 text-accent-400 shadow-sm border border-accent-600/30'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            {tab === 'all' ? 'All Invoices' : tab}
          </button>
        ))}
      </div>

      {/* Invoices Table */}
      {filteredInvoices.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated border border-border-subtle text-text-muted mb-4">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16l3-1.5 3 1.5 3-1.5 3 1.5 3-1.5 3 1.5V4a2 2 0 00-2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h8M8 12h8M8 16h5" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-text-primary">No Invoices Found</h3>
          <p className="mt-1 text-xs text-text-secondary max-w-sm mx-auto">
            {filterStatus === 'all'
              ? 'Create your first invoice for a studio session or client project.'
              : `No invoices match the status "${filterStatus}".`}
          </p>
          {canManageBilling && filterStatus === 'all' && (
            <button
              onClick={openCreateModal}
              className="mt-4 rounded-lg bg-accent-600 px-4 py-2 text-xs font-medium text-white hover:bg-accent-700"
            >
              Create Invoice
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-secondary/50">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-surface/50 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                <th className="px-5 py-3">Invoice ID / Due Date</th>
                <th className="px-5 py-3">Client / Artist</th>
                <th className="px-5 py-3">Linked Session</th>
                <th className="px-5 py-3">Amount (INR)</th>
                <th className="px-5 py-3">Status</th>
                {canManageBilling && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs">
              {filteredInvoices.map((inv) => {
                const artist = inv.artist || artists.find((a) => a.id === inv.artist_id)
                const booking = inv.booking || bookings.find((b) => b.id === inv.booking_id)
                const room = booking ? rooms.find((r) => r.id === booking.room_id) : null
                const badge = STATUS_BADGE[inv.status] || STATUS_BADGE.unpaid

                return (
                  <tr key={inv.id} className="transition-colors hover:bg-bg-surface/30">
                    <td className="px-5 py-4">
                      <p className="font-mono text-xs font-medium text-text-primary">
                        INV-{inv.id.substring(0, 8).toUpperCase()}
                      </p>
                      <p className="mt-0.5 text-[10px] text-text-muted">
                        Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : 'On Receipt'}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-semibold text-text-primary">{artist?.name || 'Unknown Artist'}</p>
                      <p className="text-[10px] text-text-muted">{artist?.email || artist?.phone || 'No contact info'}</p>
                    </td>

                    <td className="px-5 py-4">
                      {booking ? (
                        <div>
                          <p className="font-medium text-text-secondary">{room?.name || 'Studio Session'}</p>
                          <p className="text-[10px] text-text-muted">
                            {new Date(booking.start_time).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-text-tertiary">Direct / Custom Invoice</span>
                      )}
                    </td>

                    <td className="px-5 py-4 font-bold text-accent-400">
                      ₹{Number(inv.amount).toLocaleString('en-IN')}
                    </td>

                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>

                    {canManageBilling && (
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {inv.status === 'unpaid' && (
                            <button
                              onClick={() => handleUpdateStatus(inv.id, 'paid')}
                              disabled={isPending}
                              className="rounded-lg bg-status-success/15 border border-status-success/30 px-2.5 py-1 text-[11px] font-medium text-status-success hover:bg-status-success/25"
                            >
                              Mark Paid
                            </button>
                          )}
                          {inv.status === 'paid' && (
                            <button
                              onClick={() => handleUpdateStatus(inv.id, 'refunded')}
                              disabled={isPending}
                              className="rounded-lg border border-border-default bg-bg-surface px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-bg-hover"
                            >
                              Refund
                            </button>
                          )}
                          {inv.status === 'unpaid' && (
                            <button
                              onClick={() => handleUpdateStatus(inv.id, 'cancelled')}
                              disabled={isPending}
                              className="rounded-lg border border-border-subtle bg-bg-surface px-2 py-1 text-[11px] font-medium text-text-muted hover:text-status-error"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(inv.id)}
                            disabled={isPending}
                            className="rounded-lg p-1 text-text-muted hover:text-status-error"
                            title="Delete invoice"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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
      )}

      {/* Create Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border-default bg-bg-secondary p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <h2 className="text-lg font-bold text-text-primary">Create Client Invoice</h2>
              <button onClick={closeModal} className="text-text-muted hover:text-text-primary">✕</button>
            </div>

            {formState.error && (
              <div className="mt-4 rounded-lg border border-status-error/30 bg-status-error/10 p-3 text-xs text-status-error">
                {formState.error}
              </div>
            )}

            <form action={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Client / Artist <span className="text-status-error">*</span>
                </label>
                <select
                  name="artist_id"
                  required
                  value={selectedArtistId}
                  onChange={(e) => setSelectedArtistId(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
                >
                  <option value="" disabled>Select an artist</option>
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.name} {artist.genre ? `(${artist.genre})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Linked Session (Optional)
                </label>
                <select
                  name="booking_id"
                  value={selectedBookingId}
                  onChange={(e) => handleBookingSelect(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
                >
                  <option value="">No linked booking (Custom invoice)</option>
                  {bookings.map((booking) => {
                    const room = rooms.find((r) => r.id === booking.room_id)
                    const dateStr = new Date(booking.start_time).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    return (
                      <option key={booking.id} value={booking.id}>
                        {room?.name || 'Studio'} — {dateStr} ({booking.status})
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Amount (₹ INR) <span className="text-status-error">*</span>
                </label>
                <input
                  type="number"
                  name="amount"
                  required
                  min="1"
                  step="0.01"
                  value={suggestedAmount}
                  onChange={(e) => setSuggestedAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Payment Status
                </label>
                <select
                  name="status"
                  defaultValue="unpaid"
                  className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
                >
                  <option value="unpaid">Unpaid / Due</option>
                  <option value="paid">Paid in Full</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  name="due_date"
                  defaultValue={defaultDueDate}
                  className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-border-default bg-bg-surface px-4 py-2 text-xs font-medium text-text-secondary hover:bg-bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-accent-600 px-5 py-2 text-xs font-medium text-white transition-all hover:bg-accent-700 disabled:opacity-50"
                >
                  {isPending ? 'Generating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
