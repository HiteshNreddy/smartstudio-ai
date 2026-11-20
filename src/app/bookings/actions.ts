'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  isSupabaseConfigured,
  requireAuthenticatedUser,
  getActiveStudio,
  assertStudioRole,
} from '@/lib/supabase/auth'
import type { BookingStatus } from '@/lib/supabase/database.types'

export interface BookingActionState {
  error?: string
  success?: boolean
}

const STAFF_ROLES = ['owner' as const, 'admin' as const, 'engineer' as const]
const ROOM_MANAGEMENT_ROLES = ['owner' as const, 'admin' as const]

const VALID_BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
]

export async function createBookingAction(
  _prevState: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured. Supply credentials in .env.local.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) {
      return { error: 'No active studio found.' }
    }

    await assertStudioRole(activeStudio.studio.id, STAFF_ROLES)

    const roomId = formData.get('room_id') as string
    const artistId = formData.get('artist_id') as string
    const date = formData.get('date') as string
    const startTimeStr = formData.get('start_time') as string
    const durationHours = parseFloat((formData.get('duration') as string) || '2')
    const rawStatus = (formData.get('status') as BookingStatus) || 'pending'
    const notes = (formData.get('notes') as string)?.trim() || null

    if (!VALID_BOOKING_STATUSES.includes(rawStatus)) {
      return { error: 'Invalid booking status provided.' }
    }
    const status = rawStatus

    if (!roomId) return { error: 'Please select a studio room.' }
    if (!artistId) return { error: 'Please select an artist.' }
    if (!date || !startTimeStr) return { error: 'Date and start time are required.' }

    const startDateTime = new Date(`${date}T${startTimeStr}:00`)
    if (isNaN(startDateTime.getTime())) {
      return { error: 'Invalid start date or time format.' }
    }

    const endDateTime = new Date(startDateTime.getTime() + durationHours * 60 * 60 * 1000)

    if (startDateTime >= endDateTime) {
      return { error: 'End time must be after start time.' }
    }

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('bookings').insert({
      studio_id: activeStudio.studio.id,
      room_id: roomId,
      artist_id: artistId,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      status,
      notes,
    })

    if (error) {
      if (
        error.message.includes('overlapping') ||
        error.message.includes('no_overlapping_bookings') ||
        error.code === '23P01'
      ) {
        return {
          error:
            'Room conflict: The selected room already has an active booking during this time window. Please choose another room or time slot.',
        }
      }
      if (error.message.includes('valid_time_range')) {
        return { error: 'End time must be after start time.' }
      }
      return { error: error.message }
    }

    revalidatePath('/bookings')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to create booking.' }
  }
}

export async function updateBookingStatusAction(
  bookingId: string,
  newStatus: BookingStatus
): Promise<BookingActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured.' }
  }

  if (!VALID_BOOKING_STATUSES.includes(newStatus)) {
    return { error: 'Invalid booking status provided.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) return { error: 'No active studio found.' }

    await assertStudioRole(activeStudio.studio.id, STAFF_ROLES)

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('studio_id', activeStudio.studio.id)

    if (error) {
      if (
        error.message.includes('overlapping') ||
        error.message.includes('no_overlapping_bookings') ||
        error.code === '23P01'
      ) {
        return {
          error:
            'Room conflict: Cannot change booking status because the room already has an active booking during this time window.',
        }
      }
      return { error: error.message }
    }

    revalidatePath('/bookings')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to update booking.' }
  }
}

export async function deleteBookingAction(bookingId: string): Promise<BookingActionState> {
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
      .from('bookings')
      .delete()
      .eq('id', bookingId)
      .eq('studio_id', activeStudio.studio.id)

    if (error) return { error: error.message }

    revalidatePath('/bookings')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to delete booking.' }
  }
}

/**
 * Explicitly provisions default studio rooms for a newly initialized studio.
 *
 * Authorization:
 * - Requires authenticated user session.
 * - Restricts action to studio owners and admins via assertStudioRole.
 * - Never trusts a client-supplied studio ID; resolves studio identity strictly server-side.
 *
 * Duplicate Protection Note:
 * - Performs a pre-flight SELECT check to prevent duplicate provisioning under normal sequential flow.
 * - LIMITATION: In the absence of a database-level uniqueness constraint (e.g. UNIQUE(studio_id, name))
 *   or serializable transaction isolation, concurrent requests can still race if submitted simultaneously.
 */
export async function provisionDefaultRoomsAction(): Promise<BookingActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured. Supply credentials in .env.local.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) {
      return { error: 'No active studio found.' }
    }

    // Restrict action to authorized studio owners and admins only
    await assertStudioRole(activeStudio.studio.id, ROOM_MANAGEMENT_ROLES)

    const supabase = await createServerSupabaseClient()

    // Pre-flight check: sequential duplicate protection
    const { data: existingRooms, error: checkError } = await supabase
      .from('rooms')
      .select('id, name')
      .eq('studio_id', activeStudio.studio.id)

    if (checkError) {
      return { error: checkError.message }
    }

    if (existingRooms && existingRooms.length > 0) {
      return { error: 'Studio already has registered rooms. Provisioning aborted.' }
    }

    const defaultRooms = [
      {
        studio_id: activeStudio.studio.id,
        name: 'Studio A (Main Live Room)',
        description: 'Full tracking space with SSL console',
        hourly_rate: 150,
      },
      {
        studio_id: activeStudio.studio.id,
        name: 'Studio B (Mix Suite)',
        description: 'Surround mixing & mastering suite',
        hourly_rate: 100,
      },
      {
        studio_id: activeStudio.studio.id,
        name: 'Vocal Booth',
        description: 'Treated vocal & VO isolation booth',
        hourly_rate: 65,
      },
    ]

    const { error: insertError } = await supabase.from('rooms').insert(defaultRooms)

    if (insertError) {
      return { error: insertError.message }
    }

    revalidatePath('/bookings')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to provision default rooms.' }
  }
}
