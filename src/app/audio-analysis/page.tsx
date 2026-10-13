import Link from 'next/link'

export const metadata = {
  title: 'Audio Analysis — SmartStudio AI',
  description: 'AI-assisted audio analysis, spectral metering, and mix tools.',
}

export default function AudioAnalysisPage() {
  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Audio Analysis</h1>
        <p className="mt-1 text-sm text-text-secondary">
          AI-assisted audio processing, spectral metering, and mix diagnostics.
        </p>
      </div>

      {/* Unavailable / Feature Preview Banner */}
      <div className="rounded-xl border border-accent-500/30 bg-accent-600/10 p-5 text-text-primary">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-accent-600/20 p-2 text-accent-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">
              AI Audio Processing Pipeline: Offline
            </h2>
            <p className="mt-1 text-xs text-text-secondary leading-relaxed">
              The AI audio analysis backend (spectral analysis, DSP metering, and automated mastering assistant) is currently in active development.
              No audio files can be processed or analyzed at this time. To manage studio projects and track recording sessions, navigate to Projects.
            </p>
            <div className="mt-3">
              <Link
                href="/projects"
                className="text-xs font-semibold text-accent-400 hover:text-accent-300"
              >
                Go to Projects →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Architecture Cards (labeled as In-Development) */}
      <div>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Planned Analysis Modules
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <PlannedFeatureCard
            title="Integrated LUFS Metering"
            description="True-peak and integrated loudness analysis compliant with streaming standards (Spotify, Apple Music, YouTube)."
            status="Backend Pending"
          />
          <PlannedFeatureCard
            title="Spectral Balance & EQ Curve"
            description="Real-time FFT frequency response analysis to detect mud, harshness, or low-end buildup in tracking rooms."
            status="In Development"
          />
          <PlannedFeatureCard
            title="Stereo Correlation & Phase"
            description="Mono-compatibility checks and stereo field vector scope metering to safeguard vinyl and broadcast cuts."
            status="In Development"
          />
          <PlannedFeatureCard
            title="Dynamic Range Inspection"
            description="Crest-factor and micro-dynamic punch monitoring across stem groups and master buses."
            status="Planned"
          />
          <PlannedFeatureCard
            title="Reference Track Matching"
            description="Compare your mix curves against commercial reference tracks with spectral difference visualization."
            status="Planned"
          />
          <PlannedFeatureCard
            title="AI Stem Separation"
            description="Demucs-powered deep learning isolation for vocals, drums, bass, and other acoustic instruments."
            status="Research"
          />
        </div>
      </div>
    </div>
  )
}

function PlannedFeatureCard({
  title,
  description,
  status,
}: {
  title: string
  description: string
  status: string
}) {
  return (
    <div className="glass-card rounded-xl p-5 border border-border-subtle">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-text-primary">{title}</h3>
        <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold text-text-muted border border-border-subtle">
          {status}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-text-secondary">{description}</p>
    </div>
  )
}
