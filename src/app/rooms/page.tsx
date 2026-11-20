import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured, getActiveStudio, getAuthenticatedUser } from '@/lib/supabase/auth'
import type { Database } from '@/lib/supabase/database.types'
import RoomClientView from './room-client-view'

type RoomRow = Database['public']['Tables']['rooms']['Row']

export const metadata = {
  title: 'Studio Rooms — SmartStudio AI',
  description: 'Manage recording spaces, live rooms, and studio rates.',
}

export default async function RoomsPage() {
  const configured = isSupabaseConfigured()

  if (!configured) {
    return <RoomClientView rooms={[]} isConfigured={false} />
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
  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('studio_id', activeStudio.studio.id)
    .order('name')

  return (
    <RoomClientView
      rooms={(rooms as RoomRow[]) || []}
      isConfigured={true}
      userRole={activeStudio.role}
    />
  )
}
