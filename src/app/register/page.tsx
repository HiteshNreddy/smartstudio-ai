import Link from 'next/link'
import { registerCustomer } from './actions'

export const metadata = {
  title: 'Artist & Client Registration — SmartStudio AI',
  description: 'Register for private studio access, booking requests, and project tracking.',
}

interface RegisterPageProps {
  searchParams: Promise<{ error?: string; message?: string }>
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams
  const error = params?.error
  const message = params?.message

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg-primary p-4 text-text-primary">
      <div className="w-full max-w-lg rounded-2xl border border-border-default bg-bg-secondary p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-600 text-bg-primary">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Artist Client Registration</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Create an artist account for Muzico Studios session booking and project delivery.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-status-error/30 bg-status-error/10 p-3.5 text-xs text-status-error">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-lg border border-accent-500/30 bg-accent-500/10 p-3.5 text-xs text-accent-300">
            {message}
          </div>
        )}

        <form action={registerCustomer} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary" htmlFor="fullName">
                Full Legal Name <span className="text-status-error">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                placeholder="Rohan Mehra"
                className="w-full rounded-lg border border-border-default bg-bg-elevated px-3.5 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary" htmlFor="stageName">
                Artist / Band Name
              </label>
              <input
                id="stageName"
                name="stageName"
                type="text"
                placeholder="Rohan & The Beats"
                className="w-full rounded-lg border border-border-default bg-bg-elevated px-3.5 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary" htmlFor="email">
              Email Address <span className="text-status-error">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="rohan@example.com"
              className="w-full rounded-lg border border-border-default bg-bg-elevated px-3.5 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary" htmlFor="password">
              Password <span className="text-status-error">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              className="w-full rounded-lg border border-border-default bg-bg-elevated px-3.5 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary" htmlFor="genre">
                Musical Genre
              </label>
              <input
                id="genre"
                name="genre"
                type="text"
                placeholder="Indie Pop / Rock / Electronic"
                className="w-full rounded-lg border border-border-default bg-bg-elevated px-3.5 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary" htmlFor="phone">
                Phone / WhatsApp
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-border-default bg-bg-elevated px-3.5 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-bg-primary transition-all hover:bg-accent-500 hover:shadow-lg hover:shadow-accent-600/20 cursor-pointer"
            >
              Complete Artist Registration
            </button>
          </div>

          <div className="pt-4 text-center border-t border-border-default text-xs text-text-muted">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-accent-400 hover:text-accent-300">
              Sign in here →
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
