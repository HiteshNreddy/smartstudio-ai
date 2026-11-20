import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured, getAuthenticatedUser } from '@/lib/supabase/auth'
import type { Database } from '@/lib/supabase/database.types'
import CustomerClientView from './customer-client-view'

type BookingRow = Database['public']['Tables']['bookings']['Row']
type ProjectRow = Database['public']['Tables']['projects']['Row']
type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type RoomRow = Database['public']['Tables']['rooms']['Row']
type ArtistRow = Database['public']['Tables']['artists']['Row']
type AccessRequestRow = Database['public']['Tables']['studio_access_requests']['Row']

interface BookingWithRoom extends BookingRow {
  rooms?: { name: string; hourly_rate: number | null } | null
}

export const metadata = {
  title: 'Client Portal — SmartStudio AI',
  description: 'Artist self-service portal for studio sessions, projects, and invoices.',
}

export default async function CustomerPortalPage() {
  const configured = isSupabaseConfigured()

  if (!configured) {
    redirect('/login')
  }

  const user = await getAuthenticatedUser()
  if (!user) {
    redirect('/login')
  }

  const supabase = await createServerSupabaseClient()

  // 1. Check if user is linked to an artist record
  const { data: artistRecord } = await supabase
    .from('artists')
    .select('*')
    .eq('profile_id', user.id)
    .maybeSingle()

  // 2. Discover default studio
  const { data: studios } = await supabase
    .from('studios')
    .select('*')
    .limit(1)

  const studio = studios?.[0]
  const studioId = artistRecord?.studio_id || studio?.id

  // 3. Check user membership role (if any)
  const { data: membership } = await supabase
    .from('studio_memberships')
    .select('role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const isStaff = membership?.role === 'owner' || membership?.role === 'admin' || membership?.role === 'engineer'

  // 4. Determine customer access state
  let accessRequest: AccessRequestRow | null = null
  let accessState: 'approved' | 'pending' | 'rejected' | 'none' = 'none'

  if (artistRecord || isStaff) {
    accessState = 'approved'
  } else {
    const { data: req } = await supabase
      .from('studio_access_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    accessRequest = (req as AccessRequestRow) || null
    if (accessRequest) {
      if (accessRequest.status === 'pending') {
        accessState = 'pending'
      } else if (accessRequest.status === 'rejected') {
        accessState = 'rejected'
      } else if (accessRequest.status === 'approved') {
        accessState = 'approved'
      }
    }
  }

  // If approved or staff, query the artist's bookings, projects, invoices
  let bookings: BookingWithRoom[] = []
  let projects: ProjectRow[] = []
  let invoices: InvoiceRow[] = []
  let rooms: RoomRow[] = []

  if (accessState === 'approved' && studioId) {
    const artistId = artistRecord?.id

    const [bookingsRes, projectsRes, invoicesRes, roomsRes] = await Promise.all([
      artistId
        ? supabase
            .from('bookings')
            .select('*, rooms(name, hourly_rate)')
            .eq('artist_id', artistId)
            .order('start_time', { ascending: false })
        : Promise.resolve({ data: [] }),
      artistId
        ? supabase
            .from('projects')
            .select('*')
            .eq('artist_id', artistId)
            .order('updated_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      artistId
        ? supabase
            .from('invoices')
            .select('*')
            .eq('artist_id', artistId)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase
        .from('rooms')
        .select('*')
        .eq('studio_id', studioId)
        .order('name'),
    ])

    bookings = (bookingsRes.data as unknown as BookingWithRoom[]) || []
    projects = (projectsRes.data as ProjectRow[]) || []
    invoices = (invoicesRes.data as InvoiceRow[]) || []
    rooms = (roomsRes.data as RoomRow[]) || []
  }

  return (
    <CustomerClientView
      artist={(artistRecord as ArtistRow) || null}
      accessState={accessState}
      accessRequest={accessRequest}
      bookings={bookings}
      projects={projects}
      invoices={invoices}
      rooms={rooms}
      studioName={studio?.name || 'Muzico Studios'}
      userEmail={user.email || ''}
      isStaff={isStaff}
    />
  )
}
