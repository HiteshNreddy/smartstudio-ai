'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/auth'

export async function requestPasswordResetAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(
      '/forgot-password?error=Supabase+is+not+configured.+Please+configure+credentials+in+.env.local'
    )
  }

  const email = (formData.get('email') as string)?.trim().toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect('/forgot-password?error=Please+enter+a+valid+email+address')
  }

  // Derive origin from request headers safely
  const headerList = await headers()
  const host = headerList.get('host') || 'localhost:3000'
  const proto = headerList.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  const origin = `${proto}://${host}`

  const redirectTo = `${origin}/auth/callback?next=/reset-password`

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      // Check specifically for rate limiting without leaking account existence
      if (
        error.message.toLowerCase().includes('rate limit') ||
        error.message.toLowerCase().includes('too many requests')
      ) {
        redirect(
          '/forgot-password?error=Too+many+requests.+Please+wait+before+requesting+another+reset+email.'
        )
      }
      // For any other error (including non-existent email), log internally and display generic message
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') {
      throw err
    }
    // Network or initialization error
  }

  // Generic success message to prevent user enumeration
  redirect(
    '/forgot-password?message=If+an+account+exists+with+that+email,+password+reset+instructions+have+been+sent.'
  )
}
