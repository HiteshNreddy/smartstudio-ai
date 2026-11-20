import Link from 'next/link'
import { Suspense } from 'react'
import { requestPasswordResetAction } from './actions'

interface ForgotPasswordPageProps {
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
  title: 'Forgot Password — SmartStudio AI',
  description: 'Request a password reset link for your SmartStudio account.',
}

export default function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg-primary p-4 text-text-primary">
      <div className="w-full max-w-md rounded-2xl border border-border-default bg-bg-secondary p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <Link href="/login" className="text-2xl font-bold tracking-tight text-accent-400 hover:text-accent-300 transition-colors">
            SmartStudio AI
          </Link>
          <h1 className="mt-3 text-lg font-semibold text-text-primary">Reset your password</h1>
          <p className="mt-1 text-xs text-text-secondary">
            Enter the email address associated with your studio account to receive a secure recovery link.
          </p>
        </div>

        <Suspense fallback={null}>
          <FeedbackBanner searchParams={searchParams} />
        </Suspense>

        <form action={requestPasswordResetAction} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary" htmlFor="email">
              Email Address
            </label>
            <input
              className="w-full rounded-lg border border-border-default bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 transition-colors"
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div className="mt-2 flex flex-col gap-3">
            <button
              type="submit"
              className="w-full rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-bg-primary hover:bg-accent-500 transition-colors cursor-pointer"
            >
              Send Reset Link
            </button>
            <Link
              href="/login"
              className="w-full text-center rounded-lg border border-border-default bg-transparent px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-white/5 transition-colors"
            >
              Back to Log In
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
