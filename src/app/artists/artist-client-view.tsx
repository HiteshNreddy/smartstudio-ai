'use client'

import { useState, useTransition } from 'react'
import type { Database, UserRole } from '@/lib/supabase/database.types'
import {
  createArtistAction,
  updateArtistAction,
  deleteArtistAction,
  type ArtistActionState,
} from './actions'

type ArtistRow = Database['public']['Tables']['artists']['Row']

interface ArtistClientViewProps {
  artists: ArtistRow[]
  isConfigured: boolean
  userRole?: UserRole
}

export default function ArtistClientView({
  artists,
  isConfigured,
  userRole,
}: ArtistClientViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingArtist, setEditingArtist] = useState<ArtistRow | null>(null)
  const [formState, setFormState] = useState<ArtistActionState>({})
  const [isPending, startTransition] = useTransition()

  const isStaff = userRole === 'owner' || userRole === 'admin' || userRole === 'engineer'

  const openCreateModal = () => {
    setEditingArtist(null)
    setFormState({})
    setIsModalOpen(true)
  }

  const openEditModal = (artist: ArtistRow) => {
    setEditingArtist(artist)
    setFormState({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingArtist(null)
    setFormState({})
  }

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      let res: ArtistActionState
      if (editingArtist) {
        formData.append('id', editingArtist.id)
        res = await updateArtistAction({}, formData)
      } else {
        res = await createArtistAction({}, formData)
      }

      if (res.error) {
        setFormState(res)
      } else {
        closeModal()
      }
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove artist "${name}"?`)) return
    startTransition(async () => {
      const res = await deleteArtistAction(id)
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
          <h1 className="text-2xl font-bold text-text-primary">Artists & CRM</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage recording artists and client relationships.
          </p>
        </div>
        {isStaff && isConfigured && (
          <button
            onClick={openCreateModal}
            className="rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/20"
          >
            + Add Artist
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
            Database environment variables are placeholders in <code className="font-mono bg-bg-primary px-1 rounded">.env.local</code>. Database operations will be available once credentials are set.
          </p>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="stagger-children mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">Total Artists</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">{artists.length}</p>
          <p className="mt-1 text-xs text-text-muted">
            {artists.filter((a) => a.status === 'active').length} active ·{' '}
            {artists.filter((a) => a.status === 'new').length} new
          </p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">Active Roster</p>
          <p className="mt-2 text-2xl font-bold text-status-success">
            {artists.filter((a) => a.status === 'active').length}
          </p>
          <p className="mt-1 text-xs text-text-muted">Currently active clients</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">New Inquiries</p>
          <p className="mt-2 text-2xl font-bold text-accent-400">
            {artists.filter((a) => a.status === 'new').length}
          </p>
          <p className="mt-1 text-xs text-text-muted">Onboarding / pending</p>
        </div>
      </div>

      {/* Empty State */}
      {artists.length === 0 ? (
        <div className="glass-card rounded-2xl border border-dashed border-border-default p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-600/10 text-accent-400">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="16" y1="11" x2="22" y2="11" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text-primary">No artists registered yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-text-muted">
            Add recording artists or band contacts to manage studio bookings, project stems, and CRM records.
          </p>
          {isStaff && isConfigured && (
            <button
              onClick={openCreateModal}
              className="mt-5 rounded-lg bg-accent-600 px-4 py-2.5 text-xs font-medium text-white transition-all hover:bg-accent-700"
            >
              + Add First Artist
            </button>
          )}
        </div>
      ) : (
        /* Artist Cards Grid */
        <div className="stagger-children grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {artists.map((artist) => (
            <div key={artist.id} className="glass-card glass-card-hover rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-600/15 text-sm font-bold text-accent-400">
                      {artist.name
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">{artist.name}</p>
                      <p className="text-xs text-text-secondary">{artist.genre || 'General'}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      artist.status === 'active'
                        ? 'bg-status-success/10 text-status-success'
                        : artist.status === 'new'
                        ? 'bg-accent-500/10 text-accent-400'
                        : 'bg-text-muted/10 text-text-muted'
                    }`}
                  >
                    {artist.status || 'new'}
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-text-muted">
                  {artist.email && (
                    <div className="flex items-center gap-2">
                      <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <path d="m22 6-10 7L2 6" />
                      </svg>
                      <span className="truncate">{artist.email}</span>
                    </div>
                  )}
                  {artist.phone && (
                    <div className="flex items-center gap-2">
                      <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <span>{artist.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {isStaff && isConfigured && (
                <div className="mt-4 flex items-center justify-end gap-2 border-t border-border-subtle pt-3">
                  <button
                    onClick={() => openEditModal(artist)}
                    className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(artist.id, artist.name)}
                    className="text-xs text-status-error/80 hover:text-status-error px-2 py-1 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md rounded-2xl border border-border-default bg-[#161616] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">
                {editingArtist ? 'Edit Artist Record' : 'Add New Artist'}
              </h2>
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
                  Artist / Band Name <span className="text-status-error">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={editingArtist?.name || ''}
                  placeholder="e.g. Arijit Vocal Ensemble"
                  className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Primary Genre</label>
                <input
                  name="genre"
                  type="text"
                  defaultValue={editingArtist?.genre || ''}
                  placeholder="e.g. Indie Rock / Carnatic Fusion"
                  className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Email</label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={editingArtist?.email || ''}
                    placeholder="artist@example.com"
                    className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Phone</label>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={editingArtist?.phone || ''}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Status</label>
                <select
                  name="status"
                  defaultValue={editingArtist?.status || 'new'}
                  className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-600 focus:outline-none"
                >
                  <option value="new">New Inquiry</option>
                  <option value="active">Active Client</option>
                  <option value="inactive">Inactive</option>
                </select>
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
                  disabled={isPending}
                  className="rounded-lg bg-accent-600 px-4 py-2 text-xs font-medium text-white hover:bg-accent-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  {editingArtist ? 'Save Changes' : 'Create Artist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
