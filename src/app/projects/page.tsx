import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured, getActiveStudio, getAuthenticatedUser } from '@/lib/supabase/auth'
import type { Database } from '@/lib/supabase/database.types'
import ProjectClientView, { type ProjectWithArtist } from './project-client-view'

type ArtistRow = Database['public']['Tables']['artists']['Row']

export const metadata = {
  title: 'Projects — SmartStudio AI',
  description: 'Track recording, mixing, and mastering projects.',
}

export default async function ProjectsPage() {
  const configured = isSupabaseConfigured()

  if (!configured) {
    return (
      <ProjectClientView
        projects={[]}
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

  // Fetch artists for dropdown selection
  const { data: artists } = await supabase
    .from('artists')
    .select('*')
    .eq('studio_id', activeStudio.studio.id)
    .order('name')

  // Fetch projects with artist name join
  const { data: projects } = await supabase
    .from('projects')
    .select('*, artists(name)')
    .eq('studio_id', activeStudio.studio.id)
    .order('created_at', { ascending: false })

  return (
    <ProjectClientView
      projects={(projects as unknown as ProjectWithArtist[]) || []}
      artists={(artists as ArtistRow[]) || []}
      isConfigured={true}
      userRole={activeStudio.role}
    />
  )
}
