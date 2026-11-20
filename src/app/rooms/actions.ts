'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  isSupabaseConfigured,
  requireAuthenticatedUser,
  getActiveStudio,
  assertStudioRole,
} from '@/lib/supabase/auth'

export interface RoomActionState {
  error?: string
  success?: boolean
}

const ROOM_MANAGEMENT_ROLES = ['owner' as const, 'admin' as const]

export async function createRoomAction(
  _prevState: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured. Supply credentials in .env.local.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) {
      return { error: 'No active studio membership found. Please create or join a studio first.' }
    }

    await assertStudioRole(activeStudio.studio.id, ROOM_MANAGEMENT_ROLES)

    const name = (formData.get('name') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const rateStr = formData.get('hourly_rate') as string
    const hourly_rate = rateStr ? Math.max(0, parseFloat(rateStr)) : null

    if (!name || name.length < 2) {
      return { error: 'Room name must be at least 2 characters.' }
    }

    if (hourly_rate !== null && (isNaN(hourly_rate) || hourly_rate < 0)) {
      return { error: 'Hourly rate must be a positive number.' }
    }

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('rooms').insert({
      studio_id: activeStudio.studio.id,
      name,
      description,
      hourly_rate,
    })

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/rooms')
    revalidatePath('/bookings')
    revalidatePath('/settings')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create room.'
    return { error: msg }
  }
}

export async function updateRoomAction(
  _prevState: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) {
      return { error: 'No active studio found.' }
    }

    await assertStudioRole(activeStudio.studio.id, ROOM_MANAGEMENT_ROLES)

    const id = formData.get('id') as string
    const name = (formData.get('name') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const rateStr = formData.get('hourly_rate') as string
    const hourly_rate = rateStr ? Math.max(0, parseFloat(rateStr)) : null

    if (!id) return { error: 'Missing room ID.' }
    if (!name || name.length < 2) return { error: 'Room name must be at least 2 characters.' }
    if (hourly_rate !== null && (isNaN(hourly_rate) || hourly_rate < 0)) {
      return { error: 'Hourly rate must be a positive number.' }
    }

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('rooms')
      .update({
        name,
        description,
        hourly_rate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('studio_id', activeStudio.studio.id)

    if (error) return { error: error.message }

    revalidatePath('/rooms')
    revalidatePath('/bookings')
    revalidatePath('/settings')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to update room.' }
  }
}

export async function deleteRoomAction(roomId: string): Promise<RoomActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) return { error: 'No active studio found.' }

    await assertStudioRole(activeStudio.studio.id, ROOM_MANAGEMENT_ROLES)

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId)
      .eq('studio_id', activeStudio.studio.id)

    if (error) return { error: error.message }

    revalidatePath('/rooms')
    revalidatePath('/bookings')
    revalidatePath('/settings')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to delete room.' }
  }
}
