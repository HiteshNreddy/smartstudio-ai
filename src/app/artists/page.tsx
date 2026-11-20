import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured, getActiveStudio, getAuthenticatedUser } from '@/lib/supabase/auth'
import type { Database } from '@/lib/supabase/database.types'
import ArtistClientView from './artist-client-view'

type ArtistRow = Database['public']['Tables']['artists']['Row']
type AccessRequestRow = Database['public']['Tables']['studio_access_requests']['Row']

export const metadata = {
  title: 'Artists & CRM — SmartStudio AI',
  description: 'Artist relationship management and client tracking.',
}

export default async function ArtistsPage() {
  const configured = isSupabaseConfigured()

  if (!configured) {
    return <ArtistClientView artists={[]} accessRequests={[]} isConfigured={false} />
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

  const [artistsRes, requestsRes] = await Promise.all([
    supabase
      .from('artists')
      .select('*')
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false }),
    supabase
      .from('studio_access_requests')
      .select('*')
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false }),
  ])

  return (
    <ArtistClientView
      artists={(artistsRes.data as ArtistRow[]) || []}
      accessRequests={(requestsRes.data as AccessRequestRow[]) || []}
      isConfigured={true}
      userRole={activeStudio.role}
    />
  )
}
