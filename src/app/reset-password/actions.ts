'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUser, isSupabaseConfigured } from '@/lib/supabase/auth'

export async function resetPasswordAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(
      '/reset-password?error=Supabase+is+not+configured.+Please+configure+credentials+in+.env.local'
    )
  }

  const user = await getAuthenticatedUser()
  if (!user) {
    redirect(
      '/reset-password?error=Your+recovery+session+is+invalid+or+has+expired.+Please+request+a+new+reset+link.'
    )
  }

  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || !confirmPassword) {
    redirect('/reset-password?error=Please+enter+and+confirm+your+new+password.')
  }

  if (password.length < 8) {
    redirect('/reset-password?error=Password+must+be+at+least+8+characters+long.')
  }

  if (password !== confirmPassword) {
    redirect('/reset-password?error=Passwords+do+not+match.+Please+try+again.')
  }

  let updateError: string | null = null

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      updateError = error.message
    } else {
      // Clear current recovery session so user explicitly authenticates with new credentials
      await supabase.auth.signOut()
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') {
      throw err
    }
    updateError = err instanceof Error ? err.message : 'Failed to update password.'
  }

  if (updateError) {
    redirect(`/reset-password?error=${encodeURIComponent(updateError)}`)
  }

  redirect(
    '/login?message=Your+password+has+been+successfully+updated.+Please+sign+in+with+your+new+password.'
  )
}
