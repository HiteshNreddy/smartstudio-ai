'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  isSupabaseConfigured,
  requireAuthenticatedUser,
  getActiveStudio,
  assertStudioRole,
} from '@/lib/supabase/auth'
import type { Database, ProjectStatus } from '@/lib/supabase/database.types'

export interface ProjectActionState {
  error?: string
  success?: string
}

const STAFF_ROLES = ['owner' as const, 'admin' as const, 'engineer' as const]

const VALID_STATUSES: ProjectStatus[] = [
  'in-progress',
  'mixing',
  'mastering',
  'delivered',
  'on-hold',
]

export async function createProjectAction(
  _prevState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured. Supply credentials in .env.local.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) {
      return { error: 'No active studio membership found. Please create or join a studio first.' }
    }

    await assertStudioRole(activeStudio.studio.id, STAFF_ROLES)
    const studioId = activeStudio.studio.id

    const title = (formData.get('title') as string | null)?.trim()
    const artistId = (formData.get('artist_id') as string | null)?.trim()
    const type = (formData.get('type') as string | null)?.trim() || null
    const rawStatus = (formData.get('status') as string | null)?.trim() || 'in-progress'
    const rawProgress = (formData.get('progress') as string | null)?.trim() || '0'
    const rawTracks = (formData.get('tracks') as string | null)?.trim() || '1'
    const rawDeadline = (formData.get('deadline') as string | null)?.trim()

    if (!title) {
      return { error: 'Project title is required.' }
    }

    if (!artistId) {
      return { error: 'Please select an artist for this project.' }
    }

    if (!VALID_STATUSES.includes(rawStatus as ProjectStatus)) {
      return { error: 'Invalid project status provided.' }
    }

    const progress = parseInt(rawProgress, 10)
    if (isNaN(progress) || progress < 0 || progress > 100) {
      return { error: 'Progress must be a percentage between 0 and 100.' }
    }

    const tracks = parseInt(rawTracks, 10)
    if (isNaN(tracks) || tracks < 1) {
      return { error: 'Track count must be at least 1.' }
    }

    let deadline: string | null = null
    if (rawDeadline) {
      const parsedDeadline = new Date(rawDeadline)
      if (isNaN(parsedDeadline.getTime())) {
        return { error: 'Invalid deadline date format.' }
      }
      deadline = parsedDeadline.toISOString()
    }

    const supabase = await createServerSupabaseClient()

    // Verify artist belongs to this studio
    const { data: artistCheck, error: artistErr } = await supabase
      .from('artists')
      .select('id')
      .eq('id', artistId)
      .eq('studio_id', studioId)
      .single()

    if (artistErr || !artistCheck) {
      return { error: 'Selected artist is not valid for this studio.' }
    }

    type ProjectInsert = Database['public']['Tables']['projects']['Insert']
    const insertPayload: ProjectInsert = {
      studio_id: studioId,
      artist_id: artistId,
      title,
      type,
      status: rawStatus as ProjectStatus,
      progress,
      tracks,
      deadline,
    }

    const { error: insertError } = await supabase
      .from('projects')
      .insert(insertPayload)

    if (insertError) {
      return { error: insertError.message || 'Failed to create project record.' }
    }

    revalidatePath('/projects')
    revalidatePath('/')
    return { success: 'Project created successfully.' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { error: message }
  }
}

export async function updateProjectAction(
  _prevState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured. Supply credentials in .env.local.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) {
      return { error: 'No active studio membership found.' }
    }

    await assertStudioRole(activeStudio.studio.id, STAFF_ROLES)
    const studioId = activeStudio.studio.id

    const id = (formData.get('id') as string | null)?.trim()
    const title = (formData.get('title') as string | null)?.trim()
    const artistId = (formData.get('artist_id') as string | null)?.trim()
    const type = (formData.get('type') as string | null)?.trim() || null
    const rawStatus = (formData.get('status') as string | null)?.trim() || 'in-progress'
    const rawProgress = (formData.get('progress') as string | null)?.trim() || '0'
    const rawTracks = (formData.get('tracks') as string | null)?.trim() || '1'
    const rawDeadline = (formData.get('deadline') as string | null)?.trim()

    if (!id) {
      return { error: 'Project ID is required.' }
    }

    if (!title) {
      return { error: 'Project title is required.' }
    }

    if (!artistId) {
      return { error: 'Please select an artist for this project.' }
    }

    if (!VALID_STATUSES.includes(rawStatus as ProjectStatus)) {
      return { error: 'Invalid project status provided.' }
    }

    const progress = parseInt(rawProgress, 10)
    if (isNaN(progress) || progress < 0 || progress > 100) {
      return { error: 'Progress must be a percentage between 0 and 100.' }
    }

    const tracks = parseInt(rawTracks, 10)
    if (isNaN(tracks) || tracks < 1) {
      return { error: 'Track count must be at least 1.' }
    }

    let deadline: string | null = null
    if (rawDeadline) {
      const parsedDeadline = new Date(rawDeadline)
      if (isNaN(parsedDeadline.getTime())) {
        return { error: 'Invalid deadline date format.' }
      }
      deadline = parsedDeadline.toISOString()
    }

    const supabase = await createServerSupabaseClient()

    // Verify artist belongs to this studio
    const { data: artistCheck, error: artistErr } = await supabase
      .from('artists')
      .select('id')
      .eq('id', artistId)
      .eq('studio_id', studioId)
      .single()

    if (artistErr || !artistCheck) {
      return { error: 'Selected artist is not valid for this studio.' }
    }

    type ProjectUpdate = Database['public']['Tables']['projects']['Update']
    const updatePayload: ProjectUpdate = {
      title,
      artist_id: artistId,
      type,
      status: rawStatus as ProjectStatus,
      progress,
      tracks,
      deadline,
    }

    const { error: updateError } = await supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', id)
      .eq('studio_id', studioId)

    if (updateError) {
      return { error: updateError.message || 'Failed to update project.' }
    }

    revalidatePath('/projects')
    revalidatePath('/')
    return { success: 'Project updated successfully.' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { error: message }
  }
}

export async function deleteProjectAction(
  _prevState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured. Supply credentials in .env.local.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) {
      return { error: 'No active studio membership found.' }
    }

    await assertStudioRole(activeStudio.studio.id, STAFF_ROLES)
    const studioId = activeStudio.studio.id

    const id = (formData.get('id') as string | null)?.trim()
    if (!id) {
      return { error: 'Project ID is required.' }
    }

    const supabase = await createServerSupabaseClient()
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('studio_id', studioId)

    if (deleteError) {
      return { error: deleteError.message || 'Failed to delete project.' }
    }

    revalidatePath('/projects')
    revalidatePath('/')
    return { success: 'Project deleted successfully.' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { error: message }
  }
}
