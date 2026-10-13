import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  // If recovery type is explicitly declared, default redirect target to /reset-password
  const defaultNext = type === 'recovery' ? '/reset-password' : '/'
  const rawNext = searchParams.get('next') ?? defaultNext

  // Prevent open redirect: ensure path is relative and does not start with protocol-relative '//'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

  // 1. Handle PKCE authorization code exchange (standard flow via {{ .ConfirmationURL }})
  if (code) {
    try {
      const supabase = await createServerSupabaseClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } catch {
      const initErrorUrl = next === '/reset-password'
        ? `${origin}/reset-password?error=Failed+to+initialize+authentication+client`
        : `${origin}/login?error=Failed+to+initialize+Supabase+client`
      return NextResponse.redirect(initErrorUrl)
    }
  }

  // 2. Handle token_hash verification (direct OTP/hash flow via {{ .TokenHash }})
  if (tokenHash && type) {
    try {
      const supabase = await createServerSupabaseClient()
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      })
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } catch {
      const initErrorUrl = next === '/reset-password'
        ? `${origin}/reset-password?error=Failed+to+initialize+authentication+client`
        : `${origin}/login?error=Failed+to+initialize+Supabase+client`
      return NextResponse.redirect(initErrorUrl)
    }
  }

  const fallbackUrl = next === '/reset-password'
    ? `${origin}/reset-password?error=Invalid+or+expired+recovery+link.+Please+request+a+new+one.`
    : `${origin}/login?error=Invalid+or+expired+confirmation+code`

  return NextResponse.redirect(fallbackUrl)
}
