import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured, getActiveStudio, getAuthenticatedUser } from '@/lib/supabase/auth'
import type { Database } from '@/lib/supabase/database.types'
import BookingClientView, { type BookingWithDetails } from './booking-client-view'

type RoomRow = Database['public']['Tables']['rooms']['Row']
type ArtistRow = Database['public']['Tables']['artists']['Row']

export const metadata = {
  title: 'Bookings — SmartStudio AI',
  description: 'Studio session booking calendar and schedule management.',
}

export default async function BookingsPage() {
  const configured = isSupabaseConfigured()

  if (!configured) {
    return (
      <BookingClientView
        bookings={[]}
        rooms={[]}
        artists={[]}
        isConfigured={false}
      />
    )
  }

  const user = await getAuthenticatedUser()
  if (!user) {
    redirect('/login')
  }

  const activeStudio = await getActiveStudio()
  if (!activeStudio) {
    redirect('/onboarding')
  }

  const supabase = await createServerSupabaseClient()

  // Fetch rooms for this studio
  let { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('studio_id', activeStudio.studio.id)
    .order('name')

  // If newly created studio has no rooms yet, provision initial default rooms for convenience
  if ((!rooms || rooms.length === 0) && (activeStudio.role === 'owner' || activeStudio.role === 'admin')) {
    const defaultRooms = [
      { studio_id: activeStudio.studio.id, name: 'Studio A (Main Live Room)', description: 'Full tracking space with SSL console', hourly_rate: 150 },
      { studio_id: activeStudio.studio.id, name: 'Studio B (Mix Suite)', description: 'Surround mixing & mastering suite', hourly_rate: 100 },
      { studio_id: activeStudio.studio.id, name: 'Vocal Booth', description: 'Treated vocal & VO isolation booth', hourly_rate: 65 },
    ]
    await supabase.from('rooms').insert(defaultRooms)
    const refetched = await supabase
      .from('rooms')
      .select('*')
      .eq('studio_id', activeStudio.studio.id)
      .order('name')
    rooms = refetched.data
  }

  // Fetch artists for dropdown
  const { data: artists } = await supabase
    .from('artists')
    .select('*')
    .eq('studio_id', activeStudio.studio.id)
    .order('name')

  // Fetch bookings with joined room and artist names
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, rooms(name), artists(name)')
    .eq('studio_id', activeStudio.studio.id)
    .order('start_time', { ascending: false })

  return (
    <BookingClientView
      bookings={(bookings as unknown as BookingWithDetails[]) || []}
      rooms={(rooms as RoomRow[]) || []}
      artists={(artists as ArtistRow[]) || []}
      isConfigured={true}
      userRole={activeStudio.role}
    />
  )
}
