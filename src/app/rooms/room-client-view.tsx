'use client'

import { useState, useTransition } from 'react'
import type { Database, UserRole } from '@/lib/supabase/database.types'
import {
  createRoomAction,
  updateRoomAction,
  deleteRoomAction,
  type RoomActionState,
} from './actions'
import { provisionDefaultRoomsAction } from '@/app/bookings/actions'

type RoomRow = Database['public']['Tables']['rooms']['Row']

interface RoomClientViewProps {
  rooms: RoomRow[]
  isConfigured: boolean
  userRole?: UserRole
}

export default function RoomClientView({
  rooms,
  isConfigured,
  userRole,
}: RoomClientViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null)
  const [formState, setFormState] = useState<RoomActionState>({})
  const [isPending, startTransition] = useTransition()

  const canManageRooms = userRole === 'owner' || userRole === 'admin'

  const openCreateModal = () => {
    setEditingRoom(null)
    setFormState({})
    setIsModalOpen(true)
  }

  const openEditModal = (room: RoomRow) => {
    setEditingRoom(room)
    setFormState({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingRoom(null)
    setFormState({})
  }

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      let res: RoomActionState
      if (editingRoom) {
        formData.append('id', editingRoom.id)
        res = await updateRoomAction({}, formData)
      } else {
        res = await createRoomAction({}, formData)
      }

      if (res.error) {
        setFormState(res)
      } else {
        closeModal()
      }
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove room "${name}"? Existing bookings may be impacted.`)) return
    startTransition(async () => {
      const res = await deleteRoomAction(id)
      if (res.error) {
        alert(res.error)
      }
    })
  }

  const handleProvisionDefault = () => {
    if (!confirm('Provision default rooms (Studio A, Studio B, Vocal Booth)?')) return
    startTransition(async () => {
      const res = await provisionDefaultRoomsAction()
      if (res.error) {
        alert(res.error)
      }
    })
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Studio Rooms & Facilities</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Configure recording spaces, acoustic suites, and hourly booking rates.
          </p>
        </div>
        {canManageRooms && isConfigured && (
          <div className="flex items-center gap-3">
            {rooms.length === 0 && (
              <button
                onClick={handleProvisionDefault}
                disabled={isPending}
                className="rounded-lg border border-border-default bg-bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary"
              >
                Provision Default Rooms
              </button>
            )}
            <button
              onClick={openCreateModal}
              className="rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/20"
            >
              + Add Room
            </button>
          </div>
        )}
      </div>

      {!isConfigured && (
        <div className="mb-6 rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-xs text-status-warning flex items-center gap-3">
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Supabase is not configured. Configure credentials in .env.local to manage studio rooms.</span>
        </div>
      )}

      {/* Rooms Grid */}
      {rooms.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated border border-border-subtle text-text-muted mb-4">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-text-primary">No Studio Rooms Registered</h3>
          <p className="mt-1 text-xs text-text-secondary max-w-sm mx-auto">
            Get started by adding your acoustic live rooms, control rooms, or vocal booths with hourly pricing.
          </p>
          {canManageRooms && (
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={handleProvisionDefault}
                className="rounded-lg border border-border-default bg-bg-surface px-4 py-2 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              >
                Provision Default 3 Rooms
              </button>
              <button
                onClick={openCreateModal}
                className="rounded-lg bg-accent-600 px-4 py-2 text-xs font-medium text-white hover:bg-accent-700"
              >
                Create Room
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="glass-card flex flex-col justify-between rounded-xl p-6 transition-all hover:border-accent-500/30"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-bold text-text-primary">{room.name}</h3>
                  <span className="rounded-full bg-status-success/15 px-2.5 py-0.5 text-[11px] font-semibold text-status-success">
                    Active
                  </span>
                </div>
                <p className="mt-2 text-xs text-text-secondary line-clamp-3">
                  {room.description || 'No equipment or acoustics notes provided.'}
                </p>
              </div>

              <div className="mt-6 border-t border-border-subtle pt-4">
                <div className="flex items-baseline justify-between mb-4">
                  <span className="text-xs text-text-tertiary">Hourly Booking Rate</span>
                  <span className="text-lg font-extrabold text-accent-400">
                    {room.hourly_rate ? `₹${room.hourly_rate.toLocaleString('en-IN')}/hr` : 'Custom Rate'}
                  </span>
                </div>

                {canManageRooms && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(room)}
                      className="flex-1 rounded-lg border border-border-default bg-bg-surface py-2 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(room.id, room.name)}
                      className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-xs font-medium text-text-tertiary transition-colors hover:border-status-error/30 hover:bg-status-error/10 hover:text-status-error"
                      title="Delete room"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border-default bg-bg-secondary p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <h2 className="text-lg font-bold text-text-primary">
                {editingRoom ? 'Edit Studio Room' : 'Add New Room'}
              </h2>
              <button
                onClick={closeModal}
                className="text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            {formState.error && (
              <div className="mt-4 rounded-lg border border-status-error/30 bg-status-error/10 p-3 text-xs text-status-error">
                {formState.error}
              </div>
            )}

            <form
              action={handleSubmit}
              className="mt-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Room Name <span className="text-status-error">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingRoom?.name || ''}
                  placeholder="e.g. Studio A — Main Live Room"
                  className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Hourly Rate (₹ INR) <span className="text-status-error">*</span>
                </label>
                <input
                  type="number"
                  name="hourly_rate"
                  required
                  min="0"
                  step="1"
                  defaultValue={editingRoom?.hourly_rate || ''}
                  placeholder="e.g. 1500"
                  className="w-full rounded-lg border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Description & Acoustics / Gear
                </label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editingRoom?.description || ''}
                  placeholder="e.g. 450 sq.ft live tracking floor with SSL 4000 console, Neumann microphones, and drum isolation."
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
                  {isPending ? 'Saving...' : editingRoom ? 'Update Room' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
