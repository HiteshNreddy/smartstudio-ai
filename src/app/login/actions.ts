'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect('/login?error=Email+and+password+are+required')
  }

  let supabase
  try {
    supabase = await createServerSupabaseClient()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Supabase configuration error'
    redirect(`/login?error=${encodeURIComponent(message)}`)
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const fullName = (formData.get('fullName') as string)?.trim() || email.split('@')[0]

  if (!email || !password) {
    redirect('/login?error=Email+and+password+are+required')
  }

  let supabase
  try {
    supabase = await createServerSupabaseClient()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Supabase configuration error'
    redirect(`/login?error=${encodeURIComponent(message)}`)
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  // If email confirmation is required, session will be null
  if (data?.user && !data?.session) {
    redirect('/login?message=Account+created.+Please+check+your+email+to+confirm.')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOut() {
  try {
    const supabase = await createServerSupabaseClient()
    await supabase.auth.signOut()
  } catch {
    // If Supabase client fails, proceed with redirecting to login
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}
