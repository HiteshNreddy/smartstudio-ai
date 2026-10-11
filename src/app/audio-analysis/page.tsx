import { audioAnalysisFeatures } from "@/lib/demo-data";

export const metadata = {
  title: "Audio Analysis — SmartStudio AI",
  description: "AI-powered audio analysis, metering, and mix assistance.",
};

export default function AudioAnalysisPage() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Audio Analysis</h1>
        <p className="mt-1 text-sm text-text-secondary">
          AI-powered tools for spectral analysis, loudness metering, and mix assistance.
        </p>
      </div>

      {/* Waveform Placeholder */}
      <div className="glass-card gradient-border mb-8 overflow-hidden rounded-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Waveform Preview</h2>
            <p className="mt-0.5 text-xs text-text-muted">Drop an audio file to begin analysis</p>
          </div>
          <button className="rounded-lg border border-border-default px-4 py-2 text-xs font-medium text-text-secondary transition-all hover:border-accent-600/50 hover:text-accent-400">
            Upload Audio
          </button>
        </div>

        {/* Simulated Waveform */}
        <div className="flex h-32 items-center justify-center gap-[2px] rounded-lg bg-bg-primary/60 px-4">
          {Array.from({ length: 80 }, (_, i) => {
            const pseudoRandom = Math.abs(Math.sin(i * 127.1) * 43758.5453) % 1;
            const height = Math.sin(i * 0.15) * 30 + pseudoRandom * 25 + 10;
            return (
              <div
                key={i}
                className="w-1 rounded-full bg-accent-600/40 transition-all hover:bg-accent-400"
                style={{ height: `${height}%`, minHeight: "4px" }}
              />
            );
          })}
        </div>

        {/* Transport Controls */}
        <div className="mt-4 flex items-center gap-4">
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-600 text-white transition-all hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/30">
            <svg className="h-4 w-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <div className="flex-1 rounded-full bg-bg-hover h-1.5">
            <div className="h-full w-1/3 rounded-full bg-accent-500" />
          </div>
          <span className="text-xs font-mono text-text-muted">1:23 / 3:45</span>
        </div>
      </div>

      {/* Metering Panels */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* LUFS Meter */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Integrated Loudness
          </h3>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-text-primary">-14.2</span>
            <span className="mb-1 text-sm text-text-muted">LUFS</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-bg-hover">
            <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-status-success to-status-warning" />
          </div>
          <p className="mt-2 text-[10px] text-status-success">✓ Streaming compliant</p>
        </div>

        {/* Dynamic Range */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Dynamic Range
          </h3>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-text-primary">8.4</span>
            <span className="mb-1 text-sm text-text-muted">dB</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-bg-hover">
            <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-accent-600 to-accent-400" />
          </div>
          <p className="mt-2 text-[10px] text-text-muted">Moderate compression</p>
        </div>

        {/* Stereo Width */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Stereo Correlation
          </h3>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-text-primary">+0.72</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] text-text-muted">-1</span>
            <div className="flex-1 h-2 rounded-full bg-bg-hover relative">
              <div className="absolute left-[86%] top-0 h-full w-1 rounded-full bg-accent-400" />
            </div>
            <span className="text-[10px] text-text-muted">+1</span>
          </div>
          <p className="mt-2 text-[10px] text-status-success">✓ Mono compatible</p>
        </div>
      </div>

      {/* Feature Cards */}
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
        Analysis Tools
      </h2>
      <div className="stagger-children grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {audioAnalysisFeatures.map((feature) => (
          <div
            key={feature.title}
            className="glass-card glass-card-hover rounded-xl p-5"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-600/10">
              <FeatureIcon type={feature.icon} />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">{feature.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-text-muted">
        Audio analysis features are placeholders. All displayed values are fictional demo data.
      </p>
    </div>
  );
}

function FeatureIcon({ type }: { type: string }) {
  const cls = "h-5 w-5 text-accent-400";
  switch (type) {
    case "spectrum":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path d="M2 12h2l3-9 4 18 4-18 3 9h2" />
        </svg>
      );
    case "volume":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      );
    case "stereo":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <circle cx="6" cy="12" r="4" /><circle cx="18" cy="12" r="4" /><path d="M10 12h4" />
        </svg>
      );
    case "dynamics":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path d="M3 3v18h18" /><path d="M7 17l4-8 4 4 5-9" />
        </svg>
      );
    case "compare":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M12 4v16" />
        </svg>
      );
    case "ai":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4zM6 12h12M6 12a6 6 0 0 0 12 0M8 20h8" />
        </svg>
      );
    default:
      return null;
  }
}
