import { login, signup } from './actions'

export default function LoginPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#111] text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161616] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-violet-500">SmartStudio AI</h1>
          <p className="mt-2 text-sm text-white/60">Sign in to manage Muzico Studio</p>
        </div>

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
            <label className="mb-1.5 block text-sm font-medium text-white/80" htmlFor="password">
              Password
            </label>
            <input
              className="w-full rounded-lg border border-white/10 bg-[#222] px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>
          
          <div className="mt-4 flex flex-col gap-3">
            <button
              formAction={login}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
            >
              Log In
            </button>
            <button
              formAction={signup}
              className="w-full rounded-lg border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-white hover:bg-white/5 transition-colors"
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
