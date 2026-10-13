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
