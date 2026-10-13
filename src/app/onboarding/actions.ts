'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured, requireAuthenticatedUser } from '@/lib/supabase/auth'

export interface CreateStudioState {
  error?: string
  success?: boolean
}

export async function createStudioAction(
  _prevState: CreateStudioState,
  formData: FormData
): Promise<CreateStudioState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        'Supabase configuration is missing or contains placeholder values. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local before creating a studio.',
    }
  }

  try {
    await requireAuthenticatedUser()
  } catch {
    redirect('/login')
  }

  const name = (formData.get('name') as string)?.trim()
  let slug = (formData.get('slug') as string)?.trim().toLowerCase()

  if (!name || name.length < 2) {
    return { error: 'Studio name must be at least 2 characters.' }
  }

  if (!slug) {
    slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/
  if (slug.length < 3 || !slugRegex.test(slug)) {
    return {
      error:
        'Studio slug must be at least 3 characters and consist of lowercase alphanumeric characters and hyphens (no leading or trailing hyphens).',
    }
  }

  interface RpcClient {
    rpc(
      fn: string,
      args?: Record<string, unknown>
    ): Promise<{ data: string | null; error: { message: string } | null }>
  }

  const supabase = await createServerSupabaseClient()
  const rpcClient = supabase as unknown as RpcClient
  const { data: studioId, error } = await rpcClient.rpc('create_studio', {
    studio_name: name,
    studio_slug: slug,
  })

  if (error) {
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      return { error: `The studio slug "${slug}" is already taken. Please choose a different slug.` }
    }
    return { error: error.message }
  }

  if (!studioId) {
    return { error: 'Failed to create studio. Please try again.' }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
