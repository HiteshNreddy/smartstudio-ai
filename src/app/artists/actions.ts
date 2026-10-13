'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  isSupabaseConfigured,
  requireAuthenticatedUser,
  getActiveStudio,
  assertStudioRole,
} from '@/lib/supabase/auth'

export interface ArtistActionState {
  error?: string
  success?: boolean
}

const STAFF_ROLES = ['owner' as const, 'admin' as const, 'engineer' as const]

const VALID_ARTIST_STATUSES = ['new', 'active', 'inactive'] as const

export async function createArtistAction(
  _prevState: ArtistActionState,
  formData: FormData
): Promise<ArtistActionState> {
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

    const name = (formData.get('name') as string)?.trim()
    const genre = (formData.get('genre') as string)?.trim() || null
    const email = (formData.get('email') as string)?.trim() || null
    const phone = (formData.get('phone') as string)?.trim() || null
    const status = (formData.get('status') as string)?.trim() || 'new'

    if (!name || name.length < 2) {
      return { error: 'Artist name must be at least 2 characters.' }
    }

    if (!VALID_ARTIST_STATUSES.includes(status as typeof VALID_ARTIST_STATUSES[number])) {
      return { error: 'Invalid artist status provided.' }
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'Invalid email address format.' }
    }

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('artists').insert({
      studio_id: activeStudio.studio.id,
      name,
      genre,
      email,
      phone,
      status,
    })

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/artists')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create artist.'
    return { error: msg }
  }
}

export async function updateArtistAction(
  _prevState: ArtistActionState,
  formData: FormData
): Promise<ArtistActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) {
      return { error: 'No active studio found.' }
    }

    await assertStudioRole(activeStudio.studio.id, STAFF_ROLES)

    const id = formData.get('id') as string
    const name = (formData.get('name') as string)?.trim()
    const genre = (formData.get('genre') as string)?.trim() || null
    const email = (formData.get('email') as string)?.trim() || null
    const phone = (formData.get('phone') as string)?.trim() || null
    const status = (formData.get('status') as string)?.trim() || 'active'

    if (!id) return { error: 'Missing artist ID.' }
    if (!name || name.length < 2) return { error: 'Artist name must be at least 2 characters.' }
    if (!VALID_ARTIST_STATUSES.includes(status as typeof VALID_ARTIST_STATUSES[number])) {
      return { error: 'Invalid artist status provided.' }
    }

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('artists')
      .update({ name, genre, email, phone, status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('studio_id', activeStudio.studio.id)

    if (error) return { error: error.message }

    revalidatePath('/artists')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to update artist.' }
  }
}

export async function deleteArtistAction(artistId: string): Promise<ArtistActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) return { error: 'No active studio found.' }

    await assertStudioRole(activeStudio.studio.id, STAFF_ROLES)

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('artists')
      .delete()
      .eq('id', artistId)
      .eq('studio_id', activeStudio.studio.id)

    if (error) return { error: error.message }

    revalidatePath('/artists')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to delete artist.' }
  }
}
