import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Database, UserRole } from './database.types'

export type { UserRole }

export interface StudioMembership {
  id: string
  studio_id: string
  user_id: string
  role: UserRole
  created_at: string
}

export interface UserStudioWithRole {
  studio: Database['public']['Tables']['studios']['Row']
  role: UserRole
}

/**
 * Checks whether Supabase environment variables are present and not default placeholders.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return false
  if (url.includes('your-project-ref') || key.includes('your-supabase-anon-key')) return false
  if (url.trim() === '' || key.trim() === '') return false

  return true
}

/**
 * Retrieves the currently authenticated user from Supabase Auth.
 * Returns null if unauthenticated or on auth failure.
 */
export async function getAuthenticatedUser() {
  if (!isSupabaseConfigured()) {
    return null
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }
    return user
  } catch {
    return null
  }
}

/**
 * Requires an authenticated user session.
 * Throws an Error if unauthenticated.
 */
export async function requireAuthenticatedUser() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please supply valid project credentials in .env.local.')
  }

  const user = await getAuthenticatedUser()
  if (!user) {
    throw new Error('Unauthorized: Authentication required')
  }
  return user
}

/**
 * Retrieves all studios the user is a member of, along with their assigned role.
 */
export async function getUserStudios(): Promise<UserStudioWithRole[]> {
  const user = await getAuthenticatedUser()
  if (!user) return []

  try {
    const supabase = await createServerSupabaseClient()
    const { data: memberships, error: memError } = await supabase
      .from('studio_memberships')
      .select('role, studio_id, studios(id, name, slug, created_at, updated_at)')
      .eq('user_id', user.id)

    if (memError || !memberships) {
      return []
    }

    return (memberships as unknown as Array<{
      role: UserRole
      studio_id: string
      studios: Database['public']['Tables']['studios']['Row'] | null
    }>)
      .filter((m) => m.studios !== null)
      .map((m) => ({
        studio: m.studios!,
        role: m.role,
      }))
  } catch {
    return []
  }
}

/**
 * Retrieves the active studio context for the current user.
 * Returns the first studio they belong to, or null if they have no studio memberships.
 */
export async function getActiveStudio(): Promise<UserStudioWithRole | null> {
  const studios = await getUserStudios()
  if (studios.length === 0) return null
  return studios[0]
}

/**
 * Fetches the membership record for the authenticated user in the specified studio.
 * Validates against both studio_id and auth.uid() to prevent IDOR / privilege escalation.
 */
export async function getUserStudioMembership(studioId: string): Promise<StudioMembership | null> {
  const user = await requireAuthenticatedUser()
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('studio_memberships')
    .select('id, studio_id, user_id, role, created_at')
    .eq('studio_id', studioId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    return null
  }

  return data as unknown as StudioMembership
}

/**
 * Asserts that the authenticated user is a member of the studio and possesses one of the allowed roles.
 */
export async function assertStudioRole(
  studioId: string,
  allowedRoles: UserRole[]
): Promise<StudioMembership> {
  const membership = await getUserStudioMembership(studioId)
  if (!membership) {
    throw new Error('Forbidden: User is not a member of this studio')
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new Error(`Forbidden: Insufficient privileges. Required: ${allowedRoles.join(', ')}`)
  }

  return membership
}
