# SmartStudio AI

AI-powered music studio management and audio production assistant for **Muzico, Bengaluru**.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, TypeScript)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime)
- **Linting**: ESLint 9 with `eslint-config-next`

## Getting Started

### Prerequisites

- Node.js 18.17+ (recommended: 20 LTS or later)
- npm 9+
- Supabase CLI (`npx supabase`)

### 1. Clone the repository

```bash
git clone https://github.com/HiteshNreddy/smartstudio-ai.git
cd smartstudio-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your Supabase project credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

> **Tip**: Find these values in your [Supabase Dashboard](https://supabase.com/dashboard/project/_/settings/api) under Project Settings → API.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Type check & lint

```bash
npm run type-check
npm run lint
```

## Project Structure

```
smartstudio-ai/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── page.tsx          # Dashboard
│   │   ├── bookings/         # Booking calendar
│   │   ├── artists/          # Artists / CRM
│   │   ├── projects/         # Project tracking
│   │   ├── audio-analysis/   # Audio analysis tools
│   │   ├── analytics/        # Business analytics
│   │   ├── settings/         # Settings & integrations
│   │   ├── layout.tsx        # Root layout with sidebar
│   │   └── globals.css       # Design system & theme
│   ├── components/
│   │   └── sidebar.tsx       # Navigation sidebar
│   └── lib/
│       ├── demo-data.ts      # Fictional demo data
│       └── supabase/         # Supabase client config
│           ├── client.ts     # Browser client
│           ├── server.ts     # Server client (SSR)
│           └── database.types.ts  # DB type definitions
├── supabase/                 # Supabase CLI config (linked project)
│   └── config.toml
├── .env.example              # Environment variable template
├── next.config.ts            # Next.js configuration
├── tsconfig.json             # TypeScript configuration
├── eslint.config.mjs         # ESLint flat config
└── package.json
```

## Demo Data

The application ships with **fictional demo data** for UI demonstration. None of it represents real Muzico clients, sessions, or revenue. All demo entities are clearly prefixed with "Demo" labels.

## Supabase

The Supabase CLI is configured and linked to the project. No database tables or migrations have been created yet. To generate TypeScript types from your schema:

```bash
npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/database.types.ts
```

## License

ISC
