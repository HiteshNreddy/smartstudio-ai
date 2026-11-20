import { Suspense } from 'react'
import { getActiveStudio, isSupabaseConfigured } from '@/lib/supabase/auth'
import AudioAnalysisClientView from './audio-analysis-client-view'

export const metadata = {
  title: 'Audio Analysis — SmartStudio AI',
  description: 'In-browser DSP audio metering, sample peak analysis, and mix diagnostics.',
}

function AudioAnalysisSkeleton() {
  return (
    <div className="animate-fade-in space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-48 bg-white/10 rounded" />
        <div className="h-4 w-72 bg-white/5 rounded" />
      </div>
      <div className="h-40 w-full bg-bg-secondary border border-border-default rounded-2xl" />
    </div>
  )
}

async function AudioAnalysisContent() {
  let studioName = 'Muzico Studio'
  let userRole = 'engineer'
  let activeStudio = null

  if (isSupabaseConfigured()) {
    try {
      activeStudio = await getActiveStudio()
      if (activeStudio) {
        studioName = activeStudio.studio.name
        userRole = activeStudio.role
      }
    } catch {
      // Gracefully fall back to defaults
    }
  }

  return (
    <AudioAnalysisClientView
      studioId={activeStudio?.studio.id}
      studioName={studioName}
      userRole={userRole}
    />
  )
}

export default function AudioAnalysisPage() {
  return (
    <Suspense fallback={<AudioAnalysisSkeleton />}>
      <AudioAnalysisContent />
    </Suspense>
  )
}
