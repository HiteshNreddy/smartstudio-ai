'use client'

import { useState, useTransition } from 'react'
import type { Database, UserRole, ProjectStatus } from '@/lib/supabase/database.types'
import {
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
  type ProjectActionState,
} from './actions'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type ArtistRow = Database['public']['Tables']['artists']['Row']

export interface ProjectWithArtist extends ProjectRow {
  artists?: { name: string } | null
}

interface ProjectClientViewProps {
  projects: ProjectWithArtist[]
  artists: ArtistRow[]
  isConfigured: boolean
  userRole?: UserRole
}

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; badgeClass: string }
> = {
  'in-progress': {
    label: 'In Progress',
    badgeClass: 'bg-status-info/10 text-status-info border border-status-info/20',
  },
  mixing: {
    label: 'Mixing',
    badgeClass: 'bg-accent-500/10 text-accent-400 border border-accent-500/20',
  },
  mastering: {
    label: 'Mastering',
    badgeClass: 'bg-status-warning/10 text-status-warning border border-status-warning/20',
  },
  delivered: {
    label: 'Delivered',
    badgeClass: 'bg-status-success/10 text-status-success border border-status-success/20',
  },
  'on-hold': {
    label: 'On Hold',
    badgeClass: 'bg-text-muted/10 text-text-muted border border-border-default',
  },
}

export default function ProjectClientView({
  projects,
  artists,
  isConfigured,
  userRole,
}: ProjectClientViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectWithArtist | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [formState, setFormState] = useState<ProjectActionState>({})
  const [isPending, startTransition] = useTransition()

  // Form field states for controlled inputs inside modal
  const [modalTitle, setModalTitle] = useState('')
  const [modalArtistId, setModalArtistId] = useState('')
  const [modalType, setModalType] = useState('Single')
  const [modalStatus, setModalStatus] = useState<ProjectStatus>('in-progress')
  const [modalProgress, setModalProgress] = useState(0)
  const [modalTracks, setModalTracks] = useState(1)
  const [modalDeadline, setModalDeadline] = useState('')

  const isStaff = userRole === 'owner' || userRole === 'admin' || userRole === 'engineer'

  const openCreateModal = () => {
    setEditingProject(null)
    setModalTitle('')
    setModalArtistId(artists[0]?.id || '')
    setModalType('Single')
    setModalStatus('in-progress')
    setModalProgress(0)
    setModalTracks(1)
    setModalDeadline('')
    setFormState({})
    setIsModalOpen(true)
  }

  const openEditModal = (project: ProjectWithArtist) => {
    setEditingProject(project)
    setModalTitle(project.title)
    setModalArtistId(project.artist_id)
    setModalType(project.type || 'Single')
    setModalStatus((project.status as ProjectStatus) || 'in-progress')
    setModalProgress(project.progress ?? 0)
    setModalTracks(project.tracks ?? 1)
    setModalDeadline(
      project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : ''
    )
    setFormState({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingProject(null)
    setFormState({})
  }

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      let res: ProjectActionState
      if (editingProject) {
        res = await updateProjectAction({}, formData)
      } else {
        res = await createProjectAction({}, formData)
      }

      if (res.error) {
        setFormState(res)
      } else {
        closeModal()
      }
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('id', id)
      const res = await deleteProjectAction({}, formData)
      if (res.error) {
        setFormState(res)
      } else {
        setDeleteConfirmId(null)
      }
    })
  }

  const filteredProjects = projects.filter((p) => {
    const matchesFilter = filterStatus === 'all' || p.status === filterStatus
    const artistName = p.artists?.name || ''
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artistName.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // Count by status
  const counts: Record<string, number> = {
    all: projects.length,
    'in-progress': projects.filter((p) => p.status === 'in-progress').length,
    mixing: projects.filter((p) => p.status === 'mixing').length,
    mastering: projects.filter((p) => p.status === 'mastering').length,
    delivered: projects.filter((p) => p.status === 'delivered').length,
    'on-hold': projects.filter((p) => p.status === 'on-hold').length,
  }

  return (
    <div className="animate-fade-in space-y-6">
      {!isConfigured && (
        <div className="rounded-xl border border-status-warning/40 bg-status-warning/10 p-5 text-status-warning">
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 shrink-0"
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
              <p className="font-semibold text-sm">Supabase Environment Unconfigured</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Configure genuine credentials in <code className="text-accent-400">.env.local</code> to access database records.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Projects</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Track and manage recording, mixing, and mastering production workflows.
          </p>
        </div>
        {isStaff && isConfigured && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/20"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        )}
      </div>

      {/* Metric Cards / Status Pills */}
      <div className="flex flex-wrap gap-2.5">
        {(
          [
            ['all', 'All Projects'],
            ['in-progress', 'In Progress'],
            ['mixing', 'Mixing'],
            ['mastering', 'Mastering'],
            ['delivered', 'Delivered'],
            ['on-hold', 'On Hold'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`glass-card flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
              filterStatus === key
                ? 'border-accent-500/50 bg-accent-600/20 text-white ring-1 ring-accent-500/30'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            <span>{label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                filterStatus === key
                  ? 'bg-accent-500 text-white'
                  : 'bg-bg-elevated text-text-muted'
              }`}
            >
              {counts[key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            placeholder="Search by title or artist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 pl-9 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent-500"
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Projects Table */}
      <div className="glass-card overflow-hidden rounded-xl">
        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated text-text-muted border border-border-subtle mb-4">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary">No projects found</h3>
            <p className="mt-1 text-xs text-text-secondary max-w-sm mx-auto">
              {projects.length === 0
                ? isStaff
                  ? 'Start by creating your first production project. You can track track counts, progress, and stage statuses.'
                  : 'No projects have been assigned or created for this studio yet.'
                : 'No projects matched your search criteria.'}
            </p>
            {isStaff && isConfigured && projects.length === 0 && (
              <div className="mt-5">
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-accent-700"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create First Project
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Project
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Artist
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Type / Tracks
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Progress
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Deadline
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Status
                  </th>
                  {isStaff && (
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredProjects.map((project) => {
                  const statusInfo =
                    STATUS_CONFIG[project.status as ProjectStatus] || {
                      label: project.status || 'Unknown',
                      badgeClass: 'bg-bg-elevated text-text-secondary',
                    }

                  return (
                    <tr
                      key={project.id}
                      className="transition-colors hover:bg-bg-hover"
                    >
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-text-primary">{project.title}</p>
                          <p className="font-mono text-[11px] text-text-muted">
                            {project.id.slice(0, 8)}...
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-medium text-text-secondary">
                          {project.artists?.name || 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs text-text-secondary">
                          <span>{project.type || 'Standard'}</span>
                          <span className="text-text-muted ml-1.5">
                            ({project.tracks ?? 1} {project.tracks === 1 ? 'track' : 'tracks'})
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 w-36">
                          <div className="h-1.5 flex-1 rounded-full bg-bg-surface overflow-hidden border border-border-subtle">
                            <div
                              className="h-full bg-accent-500 rounded-full transition-all"
                              style={{ width: `${project.progress ?? 0}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-medium text-accent-400">
                            {project.progress ?? 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-text-secondary">
                        {project.deadline
                          ? new Date(project.deadline).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'No deadline'}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusInfo.badgeClass}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      {isStaff && (
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(project)}
                              className="rounded p-1 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
                              title="Edit Project"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(project.id)}
                              className="rounded p-1 text-text-muted transition-colors hover:bg-status-error/10 hover:text-status-error"
                              title="Delete Project"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
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
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm rounded-xl p-6 border border-border-default">
            <h3 className="text-base font-semibold text-text-primary">Delete Project</h3>
            <p className="mt-2 text-xs text-text-secondary leading-relaxed">
              Are you sure you want to delete this project? This will permanently remove the record and cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={isPending}
                className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={isPending}
                className="rounded-lg bg-status-error px-3 py-1.5 text-xs font-medium text-white hover:bg-status-error/80 disabled:opacity-50"
              >
                {isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl p-6 border border-border-default shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <h3 className="text-lg font-bold text-text-primary">
                {editingProject ? 'Edit Project' : 'Create New Project'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded p-1 text-text-muted hover:text-text-primary"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {formState.error && (
              <div className="mt-4 rounded-lg border border-status-error/30 bg-status-error/10 p-3 text-xs text-status-error">
                {formState.error}
              </div>
            )}

            <form
              action={handleSubmit}
              className="mt-4 space-y-4"
            >
              {editingProject && (
                <input type="hidden" name="id" value={editingProject.id} />
              )}

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="e.g. Midnight Horizons LP"
                  className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Artist *
                  </label>
                  {artists.length === 0 ? (
                    <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-2 text-[11px] text-status-warning">
                      No artists registered. Please add an artist in CRM first.
                    </div>
                  ) : (
                    <select
                      name="artist_id"
                      required
                      value={modalArtistId}
                      onChange={(e) => setModalArtistId(e.target.value)}
                      className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-500"
                    >
                      {artists.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Project Type
                  </label>
                  <input
                    type="text"
                    name="type"
                    value={modalType}
                    onChange={(e) => setModalType(e.target.value)}
                    placeholder="Single, EP, Album, Film Score..."
                    className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value as ProjectStatus)}
                    className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-500"
                  >
                    <option value="in-progress">In Progress</option>
                    <option value="mixing">Mixing</option>
                    <option value="mastering">Mastering</option>
                    <option value="delivered">Delivered</option>
                    <option value="on-hold">On Hold</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Track Count
                  </label>
                  <input
                    type="number"
                    name="tracks"
                    min="1"
                    value={modalTracks}
                    onChange={(e) => setModalTracks(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-text-secondary">
                    Progress Percentage
                  </label>
                  <span className="font-mono text-xs font-bold text-accent-400">
                    {modalProgress}%
                  </span>
                </div>
                <input
                  type="range"
                  name="progress"
                  min="0"
                  max="100"
                  value={modalProgress}
                  onChange={(e) => setModalProgress(parseInt(e.target.value, 10) || 0)}
                  className="w-full accent-accent-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Target Deadline
                </label>
                <input
                  type="date"
                  name="deadline"
                  value={modalDeadline}
                  onChange={(e) => setModalDeadline(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-500"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isPending}
                  className="rounded-lg border border-border-default px-4 py-2 text-xs font-medium text-text-secondary hover:bg-bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || artists.length === 0}
                  className="rounded-lg bg-accent-600 px-5 py-2 text-xs font-medium text-white transition-all hover:bg-accent-700 disabled:opacity-50"
                >
                  {isPending
                    ? 'Saving...'
                    : editingProject
                    ? 'Update Project'
                    : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
