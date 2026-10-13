import { redirect } from 'next/navigation'
import {
  isSupabaseConfigured,
  getAuthenticatedUser,
  getUserStudios,
} from '@/lib/supabase/auth'
import OnboardingForm from './onboarding-form'

export const metadata = {
  title: 'Setup Studio — SmartStudio AI',
  description: 'Create your music studio workspace to get started.',
}

export default async function OnboardingPage() {
  const configured = isSupabaseConfigured()

  if (!configured) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <div className="glass-card max-w-lg w-full rounded-2xl border border-status-warning/30 bg-[#161616] p-8 shadow-2xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-status-warning/10 text-status-warning">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-text-primary">Configuration Required</h1>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            SmartStudio AI detected placeholder values in <code className="rounded bg-bg-primary px-1.5 py-0.5 text-xs text-accent-400">.env.local</code>.
          </p>
          <div className="mt-4 rounded-lg bg-bg-primary/80 p-4 text-xs text-text-muted space-y-2">
            <p className="font-medium text-text-secondary">To connect your development database:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open your Supabase project dashboard (project: <span className="font-mono text-accent-400">smartstudio-ai-dev</span>)</li>
              <li>Navigate to Project Settings &rarr; API</li>
              <li>Replace the placeholder URL and anon key in <code className="text-white">.env.local</code></li>
              <li>Restart the dev server and refresh this page</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  const user = await getAuthenticatedUser()
  if (!user) {
    redirect('/login')
  }

  const studios = await getUserStudios()
  if (studios.length > 0) {
    redirect('/')
  }

  return (
    <div className="flex min-h-[85vh] items-center justify-center p-4">
      <div className="glass-card max-w-lg w-full rounded-2xl border border-border-default bg-[#161616] p-8 shadow-2xl animate-fade-in">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-600/20 text-accent-400">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Create Your Studio</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Set up your studio workspace. You will be assigned as the founding Owner.
          </p>
        </div>

        <OnboardingForm />
      </div>
    </div>
  )
}
