'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function registerCustomer(formData: FormData) {
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const fullName = (formData.get('fullName') as string)?.trim()
  const stageName = (formData.get('stageName') as string)?.trim() || fullName
  const genre = (formData.get('genre') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null

  if (!email || !password || !fullName) {
    redirect('/register?error=Name%2C+email%2C+and+password+are+required.')
  }

  if (password.length < 6) {
    redirect('/register?error=Password+must+be+at+least+6+characters.')
  }

  let supabase
  try {
    supabase = await createServerSupabaseClient()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database connection error'
    redirect(`/register?error=${encodeURIComponent(msg)}`)
  }

  // 1. Sign up user in Supabase Auth as client applicant (NOT staff)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        applicant_role: 'artist',
      },
    },
  })

  if (authError) {
    redirect(`/register?error=${encodeURIComponent(authError.message)}`)
  }

  const userId = authData.user?.id
  if (!userId) {
    redirect('/login?message=Registration+received.+Please+check+your+email+to+confirm+your+account.')
  }

  // 2. Discover target studio
  const { data: studios } = await supabase
    .from('studios')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)

  const studioId = studios?.[0]?.id

  if (studioId) {
    // 3. SECURITY RULE: Do NOT create any studio_memberships record!
    // Customer remains strictly an applicant until approved by Owner/Admin.
    // Create an access request:
    const { error: reqError } = await supabase.from('studio_access_requests').insert({
      studio_id: studioId,
      user_id: userId,
      requested_artist_name: stageName,
      genre,
      phone,
      status: 'pending',
      notes: `Public artist registration for ${fullName} (${email})`,
    })

    if (reqError) {
      // In case table is not yet migrated, fallback gracefully by saving unlinked artist record with status='new'
      await supabase.from('artists').insert({
        studio_id: studioId,
        name: stageName,
        genre,
        email,
        phone,
        status: 'new',
      })
    }
  }

  revalidatePath('/', 'layout')

  // If email confirmation is disabled and session is active, route to customer portal (shows pending screen)
  if (authData.session) {
    redirect('/customer')
  }

  redirect('/login?message=Registration+submitted+successfully.+Your+artist+access+request+is+pending+Owner%2FAdmin+approval.')
}
