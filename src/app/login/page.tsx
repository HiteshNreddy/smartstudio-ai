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
        <div className="mb-4 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-xs text-violet-300">
          {message}
        </div>
      )}
    </>
  )
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#111] text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161616] p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-violet-500">SmartStudio AI</h1>
          <p className="mt-2 text-sm text-white/60">Sign in to manage Muzico Studio</p>
        </div>

        <Suspense fallback={null}>
          <LoginFeedback searchParams={searchParams} />
        </Suspense>

        <form className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80" htmlFor="email">
              Email
            </label>
            <input
              className="w-full rounded-lg border border-white/10 bg-[#222] px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-white/80" htmlFor="password">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <input
              className="w-full rounded-lg border border-white/10 bg-[#222] px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80" htmlFor="fullName">
              Full Name <span className="text-xs text-white/40">(for Sign Up)</span>
            </label>
            <input
              className="w-full rounded-lg border border-white/10 bg-[#222] px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
              id="fullName"
              name="fullName"
              type="text"
              placeholder="Alex Producer"
            />
          </div>
          
          <div className="mt-2 flex flex-col gap-3">
            <button
              formAction={login}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors cursor-pointer"
            >
              Log In
            </button>
            <button
              formAction={signup}
              className="w-full rounded-lg border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
