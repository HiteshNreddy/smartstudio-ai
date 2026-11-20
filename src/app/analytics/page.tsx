import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured, getActiveStudio, getAuthenticatedUser } from '@/lib/supabase/auth'
import AnalyticsClientView, { type AnalyticsData } from './analytics-client-view'

export const metadata = {
  title: 'Business Analytics — SmartStudio AI',
  description: 'Studio performance, booking utilization, and financial intelligence.',
}

interface AnalyticsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const configured = isSupabaseConfigured()

  if (!configured) {
    return (
      <AnalyticsClientView
        data={{
          timeRange: '30d',
          totalRevenue: 0,
          pendingRevenue: 0,
          totalInvoicesCount: 0,
          paidInvoicesCount: 0,
          totalSessions: 0,
          completedSessions: 0,
          confirmedSessions: 0,
          totalBookedHours: 0,
          utilizationRate: 0,
          uniqueArtistsCount: 0,
          repeatArtistRate: 0,
          roomStats: [],
          statusBreakdown: { completed: 0, confirmed: 0, pending: 0, cancelled: 0, in_progress: 0 },
        }}
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

  const resolvedSearchParams = await searchParams
  const rangeParam = typeof resolvedSearchParams?.range === 'string' ? resolvedSearchParams.range : '30d'

  // Determine date boundary
  let cutoffDate: Date | null = null
  let daysInPeriod = 30
  const now = new Date()

  if (rangeParam === '7d') {
    cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    daysInPeriod = 7
  } else if (rangeParam === '30d') {
    cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    daysInPeriod = 30
  } else if (rangeParam === '90d') {
    cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    daysInPeriod = 90
  } else {
    daysInPeriod = 180 // For utilization calculation of 'all'
  }

  const supabase = await createServerSupabaseClient()
  const studioId = activeStudio.studio.id

  // Query Invoices, Bookings, Rooms
  const [invoicesRes, bookingsRes, roomsRes] = await Promise.all([
    supabase.from('invoices').select('*').eq('studio_id', studioId),
    supabase.from('bookings').select('*').eq('studio_id', studioId),
    supabase.from('rooms').select('*').eq('studio_id', studioId),
  ])

  const allInvoices = invoicesRes.data || []
  const allBookings = bookingsRes.data || []
  const rooms = roomsRes.data || []

  // Filter by date cutoff if specified
  const invoices = cutoffDate
    ? allInvoices.filter((inv) => new Date(inv.created_at) >= cutoffDate!)
    : allInvoices

  const bookings = cutoffDate
    ? allBookings.filter((b) => new Date(b.start_time) >= cutoffDate!)
    : allBookings

  // Revenue metrics
  const totalRevenue = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + Number(inv.amount), 0)

  const pendingRevenue = invoices
    .filter((inv) => inv.status === 'unpaid')
    .reduce((sum, inv) => sum + Number(inv.amount), 0)

  const paidInvoicesCount = invoices.filter((inv) => inv.status === 'paid').length

  // Booking & Session metrics
  const statusBreakdown = {
    completed: bookings.filter((b) => b.status === 'completed').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
    in_progress: bookings.filter((b) => b.status === 'in_progress').length,
  }

  const totalSessions = bookings.length
  const completedSessions = statusBreakdown.completed
  const confirmedSessions = statusBreakdown.confirmed

  // Calculate booked hours
  let totalBookedHours = 0
  for (const b of bookings) {
    if (b.status !== 'cancelled') {
      const start = new Date(b.start_time).getTime()
      const end = new Date(b.end_time).getTime()
      const durationHours = Math.max(0, (end - start) / (1000 * 60 * 60))
      totalBookedHours += durationHours
    }
  }

  // Room Utilization Rate (% of capacity assuming 10 hours/day operating time)
  const roomCount = Math.max(1, rooms.length)
  const theoreticalCapacityHours = roomCount * 10 * daysInPeriod
  const utilizationRate = Math.min(100, (totalBookedHours / theoreticalCapacityHours) * 100)

  // Client Retention
  const artistBookingCounts = new Map<string, number>()
  for (const b of bookings) {
    if (b.artist_id) {
      artistBookingCounts.set(b.artist_id, (artistBookingCounts.get(b.artist_id) || 0) + 1)
    }
  }
  const uniqueArtistsCount = artistBookingCounts.size
  const repeatArtistsCount = Array.from(artistBookingCounts.values()).filter((c) => c > 1).length
  const repeatArtistRate = uniqueArtistsCount > 0 ? (repeatArtistsCount / uniqueArtistsCount) * 100 : 0

  // Room-by-room breakdown
  const roomStats = rooms.map((room) => {
    const roomBookings = bookings.filter((b) => b.room_id === room.id && b.status !== 'cancelled')
    let roomHours = 0
    for (const b of roomBookings) {
      const start = new Date(b.start_time).getTime()
      const end = new Date(b.end_time).getTime()
      roomHours += Math.max(0, (end - start) / (1000 * 60 * 60))
    }
    const estimatedYield = room.hourly_rate ? Math.round(roomHours * room.hourly_rate) : 0

    return {
      id: room.id,
      name: room.name,
      hourlyRate: room.hourly_rate,
      sessionCount: roomBookings.length,
      bookedHours: roomHours,
      revenue: estimatedYield,
    }
  })

  const analyticsData: AnalyticsData = {
    timeRange: rangeParam,
    totalRevenue,
    pendingRevenue,
    totalInvoicesCount: invoices.length,
    paidInvoicesCount,
    totalSessions,
    completedSessions,
    confirmedSessions,
    totalBookedHours,
    utilizationRate,
    uniqueArtistsCount,
    repeatArtistRate,
    roomStats,
    statusBreakdown,
  }

  return <AnalyticsClientView data={analyticsData} isConfigured={true} />
}
