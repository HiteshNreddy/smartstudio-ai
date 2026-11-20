import Link from 'next/link'
import { Suspense } from 'react'
import { login, signup } from './actions'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; message?: string }>
}

async function LoginFeedback({
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
          {error === 'true' ? 'Authentication failed. Please verify your credentials.' : error}
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

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-bg-primary text-text-primary">
      <div className="w-full max-w-md rounded-2xl border border-border-default bg-bg-secondary p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-accent-400">SmartStudio AI</h1>
          <p className="mt-2 text-sm text-text-secondary">Sign in to manage Muzico Studio</p>
        </div>

        <Suspense fallback={null}>
          <LoginFeedback searchParams={searchParams} />
        </Suspense>

        <form className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary" htmlFor="email">
              Email
            </label>
            <input
              className="w-full rounded-lg border border-border-default bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 transition-colors"
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-text-secondary" htmlFor="password">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-accent-400 hover:text-accent-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <input
              className="w-full rounded-lg border border-border-default bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 transition-colors"
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary" htmlFor="fullName">
              Full Name <span className="text-xs text-text-muted">(for Sign Up)</span>
            </label>
            <input
              className="w-full rounded-lg border border-border-default bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 transition-colors"
              id="fullName"
              name="fullName"
              type="text"
              placeholder="Alex Producer"
            />
          </div>
          
          <div className="mt-2 flex flex-col gap-3">
            <button
              formAction={login}
              className="w-full rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-bg-primary hover:bg-accent-500 transition-colors cursor-pointer"
            >
              Log In
            </button>
            <button
              formAction={signup}
              className="w-full rounded-lg border border-border-default bg-transparent px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
            >
              Sign Up
            </button>
          </div>

          <div className="pt-4 text-center border-t border-border-default text-xs text-text-muted">
            Artist or Band Client?{' '}
            <Link href="/register" className="font-semibold text-accent-400 hover:text-accent-300">
              Register for Client Portal →
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
