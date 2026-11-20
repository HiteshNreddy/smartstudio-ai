'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured, getAuthenticatedUser } from '@/lib/supabase/auth'

export interface CustomerActionState {
  error?: string
  success?: boolean
}

export async function requestSessionAction(
  _prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured.' }
  }

  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return { error: 'You must be signed in to request a studio session.' }
    }

    const roomId = formData.get('room_id') as string
    const date = formData.get('date') as string
    const startTimeStr = formData.get('start_time') as string
    const durationHours = parseFloat((formData.get('duration') as string) || '2')
    const notes = (formData.get('notes') as string)?.trim() || null

    if (!roomId) return { error: 'Please choose a recording room.' }
    if (!date || !startTimeStr) return { error: 'Please provide session date and time.' }
    if (isNaN(durationHours) || durationHours <= 0) return { error: 'Invalid session duration.' }

    const supabase = await createServerSupabaseClient()

    // 1. Find the artist record associated with this user
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id, studio_id')
      .eq('profile_id', user.id)
      .single()

    if (artistError || !artist) {
      return {
        error:
          'Your account is not yet linked to an active artist profile. Please contact the studio manager.',
      }
    }

    // 2. Compute ISO start and end timestamps
    const startIso = new Date(`${date}T${startTimeStr}:00`).toISOString()
    const endIso = new Date(
      new Date(startIso).getTime() + durationHours * 60 * 60 * 1000
    ).toISOString()

    // 3. Insert booking with status: 'pending' (requires studio approval)
    const { error: bookingError } = await supabase.from('bookings').insert({
      studio_id: artist.studio_id,
      artist_id: artist.id,
      room_id: roomId,
      start_time: startIso,
      end_time: endIso,
      status: 'pending',
      notes: notes ? `[Requested by Client] ${notes}` : '[Requested by Client]',
    })

    if (bookingError) {
      if (bookingError.message?.includes('no_overlapping_bookings')) {
        return { error: 'This room is already reserved for the selected time slot. Please choose another time.' }
      }
      return { error: bookingError.message }
    }

    revalidatePath('/customer')
    revalidatePath('/bookings')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to submit booking request.' }
  }
}
