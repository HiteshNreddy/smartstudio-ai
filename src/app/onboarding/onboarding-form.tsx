'use client'

import { useActionState, useState } from 'react'
import { createStudioAction, type CreateStudioState } from './actions'

const initialState: CreateStudioState = {}

export default function OnboardingForm() {
  const [state, formAction, isPending] = useActionState(createStudioAction, initialState)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [isSlugCustomized, setIsSlugCustomized] = useState(false)

  const handleNameChange = (val: string) => {
    setName(val)
    if (!isSlugCustomized) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setSlug(generated)
    }
  }

  const handleSlugChange = (val: string) => {
    setIsSlugCustomized(true)
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="rounded-lg border border-status-error/30 bg-status-error/10 p-3.5 text-xs text-status-error leading-relaxed">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Studio Name <span className="text-status-error">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Muzico Studios Bengaluru"
          className="w-full rounded-lg border border-border-default bg-bg-primary px-3.5 py-2.5 text-sm text-text-primary transition-colors focus:border-accent-600 focus:outline-none focus:ring-1 focus:ring-accent-600/30"
        />
      </div>

      <div>
        <label htmlFor="slug" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Studio Slug <span className="text-status-error">*</span>
        </label>
        <div className="flex items-center rounded-lg border border-border-default bg-bg-primary overflow-hidden focus-within:border-accent-600 focus-within:ring-1 focus-within:ring-accent-600/30">
          <span className="bg-bg-secondary px-3 py-2.5 text-xs text-text-muted border-r border-border-default">
            smartstudio.ai/
          </span>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="muzico-studios"
            className="flex-1 bg-transparent px-3 py-2.5 text-sm text-text-primary focus:outline-none"
          />
        </div>
        <p className="mt-1 text-[11px] text-text-muted">
          3+ chars, lowercase letters, numbers, and hyphens. Used for tenant identification.
        </p>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="w-full rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/20 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Creating Studio...
            </>
          ) : (
            'Create Studio & Enter Dashboard'
          )}
        </button>
      </div>
    </form>
  )
}
