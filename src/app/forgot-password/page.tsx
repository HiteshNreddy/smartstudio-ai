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
        <div className="mb-4 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-xs text-violet-300">
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
    <div className="flex min-h-screen w-full items-center justify-center bg-[#111] p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161616] p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <Link href="/login" className="text-2xl font-bold tracking-tight text-violet-500 hover:text-violet-400 transition-colors">
            SmartStudio AI
          </Link>
          <h1 className="mt-3 text-lg font-semibold text-white">Reset your password</h1>
          <p className="mt-1 text-xs text-white/60">
            Enter the email address associated with your studio account to receive a secure recovery link.
          </p>
        </div>

        <Suspense fallback={null}>
          <FeedbackBanner searchParams={searchParams} />
        </Suspense>

        <form action={requestPasswordResetAction} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80" htmlFor="email">
              Email Address
            </label>
            <input
              className="w-full rounded-lg border border-white/10 bg-[#222] px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
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
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors cursor-pointer"
            >
              Send Reset Link
            </button>
            <Link
              href="/login"
              className="w-full text-center rounded-lg border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5 transition-colors"
            >
              Back to Log In
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
