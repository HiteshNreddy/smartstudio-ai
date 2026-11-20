import Link from 'next/link'
import { Suspense } from 'react'
import { getAuthenticatedUser } from '@/lib/supabase/auth'
import { resetPasswordAction } from './actions'

interface ResetPasswordPageProps {
  searchParams: Promise<{ error?: string; message?: string }>
}

async function FeedbackBanner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const params = await searchParams
  const error = params?.error
  const message = params?.message

  if (!error && !message) {
    return null
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-lg border border-accent-500/30 bg-accent-500/10 p-3 text-xs text-accent-300">
          {message}
        </div>
      )}
    </>
  )
}

export const metadata = {
  title: 'Reset Password — SmartStudio AI',
  description: 'Set a new password for your SmartStudio account.',
}

function ResetPasswordSkeleton() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border-default bg-bg-secondary p-8 shadow-2xl animate-pulse">
      <div className="mb-6 text-center">
        <div className="h-7 w-40 bg-white/10 rounded mx-auto mb-3" />
        <div className="h-5 w-48 bg-white/10 rounded mx-auto mb-2" />
        <div className="h-3.5 w-64 bg-white/5 rounded mx-auto" />
      </div>
      <div className="space-y-4">
        <div>
          <div className="h-4 w-28 bg-white/10 rounded mb-1.5" />
          <div className="h-10 w-full bg-white/5 rounded-lg border border-border-default" />
        </div>
        <div>
          <div className="h-4 w-36 bg-white/10 rounded mb-1.5" />
          <div className="h-10 w-full bg-white/5 rounded-lg border border-border-default" />
        </div>
        <div className="mt-2 space-y-3 pt-2">
          <div className="h-10 w-full bg-accent-600/40 rounded-lg" />
          <div className="h-10 w-full bg-white/5 rounded-lg border border-border-default" />
        </div>
      </div>
    </div>
  )
}

async function ResetPasswordContent({ searchParams }: ResetPasswordPageProps) {
  const user = await getAuthenticatedUser()

  if (!user) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border-default bg-bg-secondary p-8 shadow-2xl text-center">
        <Link href="/login" className="text-2xl font-bold tracking-tight text-accent-400 hover:text-accent-300 transition-colors">
          SmartStudio AI
        </Link>
        <div className="mt-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-700/10 border border-accent-700/20 text-accent-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-text-primary">Reset Link Expired or Invalid</h1>
        <p className="mt-2 text-xs text-text-secondary leading-relaxed">
          This password recovery session is invalid, expired, or has already been used. Please request a new link to reset your password.
        </p>

        <Suspense fallback={null}>
          <div className="mt-4">
            <FeedbackBanner searchParams={searchParams} />
          </div>
        </Suspense>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/forgot-password"
            className="w-full rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-bg-primary hover:bg-accent-500 transition-colors"
          >
            Request New Reset Link
          </Link>
          <Link
            href="/login"
            className="w-full rounded-lg border border-border-default bg-transparent px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-white/5 transition-colors"
          >
            Return to Log In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-border-default bg-bg-secondary p-8 shadow-2xl">
      <div className="mb-6 text-center">
        <Link href="/login" className="text-2xl font-bold tracking-tight text-accent-400 hover:text-accent-300 transition-colors">
          SmartStudio AI
        </Link>
        <h1 className="mt-3 text-lg font-semibold text-text-primary">Set New Password</h1>
        <p className="mt-1 text-xs text-text-secondary">
          Choose a secure password with at least 8 characters for <span className="text-text-primary font-medium">{user.email}</span>.
        </p>
      </div>

      <Suspense fallback={null}>
        <FeedbackBanner searchParams={searchParams} />
      </Suspense>

      <form action={resetPasswordAction} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary" htmlFor="password">
            New Password
          </label>
          <input
            className="w-full rounded-lg border border-border-default bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 transition-colors"
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            minLength={8}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary" htmlFor="confirmPassword">
            Confirm New Password
          </label>
          <input
            className="w-full rounded-lg border border-border-default bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 transition-colors"
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Re-enter your new password"
            minLength={8}
            required
          />
        </div>

        <div className="mt-2 flex flex-col gap-3">
          <button
            type="submit"
            className="w-full rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-bg-primary hover:bg-accent-500 transition-colors cursor-pointer"
          >
            Update Password
          </button>
          <Link
            href="/login"
            className="w-full text-center rounded-lg border border-border-default bg-transparent px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-white/5 transition-colors"
          >
            Cancel and Back to Login
          </Link>
        </div>
      </form>
    </div>
  )
}

export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg-primary p-4 text-text-primary">
      <Suspense fallback={<ResetPasswordSkeleton />}>
        <ResetPasswordContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
