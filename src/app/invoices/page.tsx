import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured, getActiveStudio, getAuthenticatedUser } from '@/lib/supabase/auth'
import type { Database } from '@/lib/supabase/database.types'
import InvoiceClientView, { type EnrichedInvoice } from './invoice-client-view'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type ArtistRow = Database['public']['Tables']['artists']['Row']
type BookingRow = Database['public']['Tables']['bookings']['Row']
type RoomRow = Database['public']['Tables']['rooms']['Row']

export const metadata = {
  title: 'Invoices & Billing — SmartStudio AI',
  description: 'Manage client billing, session invoices, and payments.',
}

export default async function InvoicesPage() {
  const configured = isSupabaseConfigured()

  if (!configured) {
    return (
      <InvoiceClientView
        invoices={[]}
        artists={[]}
        bookings={[]}
        rooms={[]}
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
  const studioId = activeStudio.studio.id

  // Fetch invoices, artists, bookings, and rooms in parallel
  const [invoicesRes, artistsRes, bookingsRes, roomsRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('*')
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false }),
    supabase
      .from('artists')
      .select('*')
      .eq('studio_id', studioId)
      .order('name'),
    supabase
      .from('bookings')
      .select('*')
      .eq('studio_id', studioId)
      .order('start_time', { ascending: false }),
    supabase
      .from('rooms')
      .select('*')
      .eq('studio_id', studioId)
      .order('name'),
  ])

  const rawInvoices = (invoicesRes.data as InvoiceRow[]) || []
  const artists = (artistsRes.data as ArtistRow[]) || []
  const bookings = (bookingsRes.data as BookingRow[]) || []
  const rooms = (roomsRes.data as RoomRow[]) || []

  const invoices: EnrichedInvoice[] = rawInvoices.map((inv) => ({
    ...inv,
    artist: artists.find((a) => a.id === inv.artist_id) || null,
    booking: bookings.find((b) => b.id === inv.booking_id) || null,
  }))

  return (
    <InvoiceClientView
      invoices={invoices}
      artists={artists}
      bookings={bookings}
      rooms={rooms}
      isConfigured={true}
      userRole={activeStudio.role}
    />
  )
}
