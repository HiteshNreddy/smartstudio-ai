'use client'

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react'
import {
  validateAudioFileMetadata,
  analyzeMultiChannelAudio,
  formatAudioDuration,
  formatFileSize,
  type MultiChannelAudioAnalysis,
  SUPPORTED_AUDIO_EXTENSIONS,
} from '@/lib/audio/analysis'
import {
  saveAudioAnalysisAction,
  deleteAudioAnalysisAction,
  listStudioAudioAnalysesAction,
  type AudioAnalysisRow,
} from './actions'

interface AudioAnalysisClientViewProps {
  studioId?: string
  studioName?: string
  userRole?: string
}

export default function AudioAnalysisClientView({
  studioId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  studioName = 'Muzico Studio',
  userRole = 'engineer',
}: AudioAnalysisClientViewProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDecoding, setIsDecoding] = useState<boolean>(false)
  const [decodingStep, setDecodingStep] = useState<string>('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validationWarnings, setValidationWarnings] = useState<string[] | null>(null)
  const [analysisResult, setAnalysisResult] = useState<MultiChannelAudioAnalysis | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [activeChannelTab, setActiveChannelTab] = useState<'combined' | 'per-channel'>('combined')

  // Save report dialog state
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string>('')
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const processAudioFile = useCallback(async (selectedFile: File) => {
    setValidationError(null)
    setValidationWarnings(null)
    setAnalysisResult(null)

    // 1. Preliminary file metadata validation (MIME, size, extension)
    const validation = validateAudioFileMetadata({
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
    })

    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid audio file selected.')
      return
    }

    if (validation.warnings && validation.warnings.length > 0) {
      setValidationWarnings(validation.warnings)
    }

    setFile(selectedFile)
    setIsDecoding(true)
    setDecodingStep('Reading audio buffer from file...')

    let audioCtx: AudioContext | null = null

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      setDecodingStep('Decoding audio stream via Web Audio API...')

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext

      if (!AudioContextClass) {
        throw new Error('The Web Audio API is not supported in this browser environment.')
      }

      audioCtx = new AudioContextClass()
      // Browser Web Audio decoding
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

      setDecodingStep('Computing peak, RMS, crest factor, and silence heuristics...')

      // Extract raw PCM float arrays per channel
      const channelData: Float32Array[] = []
      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        channelData.push(audioBuffer.getChannelData(i))
      }

      // Execute pure deterministic analysis
      const analysis = analyzeMultiChannelAudio(
        channelData,
        audioBuffer.sampleRate,
        audioBuffer.duration,
        120 // 120 SVG waveform bins
      )

      setAnalysisResult(analysis)
    } catch (err: unknown) {
      let message = 'Unable to decode the audio file.'
      if (err instanceof Error) {
        if (err.name === 'EncodingError' || err.message.includes('decodeAudioData')) {
          message =
            'Web Audio decoding failed: The file stream may be corrupted, empty, or encoded in a codec/bit-depth not supported by this browser.'
        } else {
          message = err.message
        }
      }
      setValidationError(message)
      setAnalysisResult(null)
    } finally {
      setIsDecoding(false)
      setDecodingStep('')
      if (audioCtx && audioCtx.state !== 'closed') {
        try {
          await audioCtx.close()
        } catch {
          // Ignore release errors
        }
      }
    }
  }, [])

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      processAudioFile(droppedFile)
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0]
      processAudioFile(selected)
    }
  }

  const handleReset = () => {
    setFile(null)
    setAnalysisResult(null)
    setValidationError(null)
    setValidationWarnings(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setSaveSuccess(null)
    setSaveError(null)
    setNotes('')
    setShowSaveDialog(false)
  }

  const handleSave = async () => {
    if (!analysisResult || !file) return
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(null)

    const res = await saveAudioAnalysisAction({
      studioId,
      projectId: null,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || 'audio/wav',
      durationSeconds: analysisResult.durationSeconds,
      sampleRate: analysisResult.sampleRate,
      channelCount: analysisResult.numberOfChannels,
      diagnosticsPayload: analysisResult,
      notes: notes || undefined,
    })

    setIsSaving(false)
    if (!res.success) {
      setSaveError(res.error || 'Failed to save analysis report.')
    } else {
      setSaveSuccess('Audio analysis report successfully saved to studio database!')
      setShowSaveDialog(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text-primary">Audio Analysis</h1>
            <span className="rounded-full bg-accent-600/20 px-2.5 py-0.5 text-xs font-medium text-accent-400 border border-accent-500/30">
              {studioName}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            In-browser DSP metering, sample peak analysis, and mix dynamic diagnostics.
          </p>
        </div>
        {userRole && (
          <span className="self-start rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/60 capitalize">
            Role: {userRole}
          </span>
        )}
      </div>

      {/* Upload Dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload audio file for mix analysis"
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isDecoding) {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isDecoding && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-500/50 ${
          isDragging
            ? 'border-accent-500 bg-accent-500/10'
            : 'border-white/15 bg-[#161616] hover:border-accent-500/50 hover:bg-[#1a1a1a]'
        } ${isDecoding ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_AUDIO_EXTENSIONS.join(',')}
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isDecoding}
        />

        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-600/20 text-accent-400 mb-3 border border-accent-500/30">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        </div>

        <h3 className="text-base font-semibold text-text-primary">
          {file ? `Selected: ${file.name}` : 'Drop master audio file or click to browse'}
        </h3>
        <p className="mt-1 text-xs text-text-secondary max-w-md">
          Supported formats: {SUPPORTED_AUDIO_EXTENSIONS.join(', ')} • Maximum file size: 50 MiB.
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {['WAV', 'MP3', 'FLAC', 'OGG', 'AAC'].map((fmt) => (
            <span
              key={fmt}
              className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono text-white/50 border border-white/5"
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>

      {/* Decoding Loading State */}
      {isDecoding && (
        <div className="rounded-xl border border-accent-500/30 bg-accent-600/10 p-5 animate-pulse">
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 animate-spin text-accent-400 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-text-primary">Analyzing Audio Stream...</h4>
              <p className="text-xs text-accent-300 mt-0.5">{decodingStep}</p>
            </div>
          </div>
        </div>
      )}

      {/* Validation / Error Banner */}
      {validationError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 flex items-start gap-3">
          <svg className="h-5 w-5 shrink-0 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-xs leading-relaxed flex-1">
            <span className="font-bold text-red-200">Analysis Error: </span>
            {validationError}
          </div>
          <button
            onClick={() => setValidationError(null)}
            className="text-red-400 hover:text-red-300 text-xs font-semibold ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Validation Warnings */}
      {validationWarnings && validationWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 text-xs flex items-start gap-3">
          <svg className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="space-y-1">
            {validationWarnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostic Results Section */}
      {analysisResult && file && (
        <div className="space-y-6">
          {/* Session Notice & Actions Bar */}
          <div className="rounded-xl border border-accent-500/30 bg-accent-600/5 p-4 text-xs text-text-secondary flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-accent-400 animate-pulse" />
              <span>DSP measurements computed in browser memory. Metadata-only persistence ready.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSaveDialog(!showSaveDialog)}
                disabled={isSaving}
                className="rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-500 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save to Studio Database'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 transition-colors"
              >
                Clear Analysis
              </button>
            </div>
          </div>

          {/* Save Status / Error Feedback */}
          {saveSuccess && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300 flex items-center justify-between">
              <span>{saveSuccess}</span>
              <button onClick={() => setSaveSuccess(null)} className="text-green-400 hover:text-green-200">✕</button>
            </div>
          )}
          {saveError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center justify-between">
              <span>{saveError}</span>
              <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-200">✕</button>
            </div>
          )}

          {/* Save Report Options Panel */}
          {showSaveDialog && (
            <div className="glass-card rounded-xl p-4 border border-accent-500/30 space-y-3 bg-bg-surface">
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Save Analysis Report</h4>
              <p className="text-xs text-text-muted">
                Save audio diagnostics metadata to studio <strong>{studioName}</strong>. Raw audio is never uploaded.
              </p>
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">
                  Engineer Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Master vocal bus punch check, mix revision 2 notes..."
                  className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary focus:border-accent-500 focus:outline-none resize-none h-16"
                  maxLength={500}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(false)}
                  className="rounded-lg border border-white/10 px-3 py-1 text-xs text-text-muted hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-lg bg-accent-600 px-4 py-1 text-xs font-semibold text-white hover:bg-accent-500 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Confirm Save'}
                </button>
              </div>
            </div>
          )}

          {/* File Overview Bar */}
          <div className="glass-card rounded-xl p-5 border border-border-subtle flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-text-primary break-all">{file.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                <span>Size: <strong className="text-white/90">{formatFileSize(file.size)}</strong></span>
                <span>•</span>
                <span>Duration: <strong className="text-white/90">{formatAudioDuration(analysisResult.durationSeconds)}</strong> ({analysisResult.durationSeconds}s)</span>
                <span>•</span>
                <span>Sample Rate: <strong className="text-white/90">{analysisResult.sampleRate.toLocaleString()} Hz</strong></span>
                <span>•</span>
                <span>Channels: <strong className="text-white/90">{analysisResult.numberOfChannels === 1 ? '1 Channel (Mono)' : `${analysisResult.numberOfChannels} Channels (Stereo)`}</strong></span>
              </div>
            </div>

            {analysisResult.numberOfChannels > 1 && (
              <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveChannelTab('combined')}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    activeChannelTab === 'combined'
                      ? 'bg-accent-600 text-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Combined Master
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChannelTab('per-channel')}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    activeChannelTab === 'per-channel'
                      ? 'bg-accent-600 text-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Channel Breakdown
                </button>
              </div>
            )}
          </div>

          {/* SVG Waveform Visualization */}
          <div className="glass-card rounded-xl p-5 border border-border-subtle space-y-3">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="font-semibold uppercase tracking-wider text-[11px] text-text-tertiary">
                Dynamic Waveform Contour (Peak Normalized)
              </span>
              <span className="text-[11px] text-white/50">
                Red highlights indicate near-full-scale amplitude (≥ 0.9999)
              </span>
            </div>

            <div className="h-28 w-full rounded-lg bg-[#0e0e0e] border border-white/5 p-2 flex items-center">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 120 100">
                {analysisResult.waveformPeaks.map((peak, idx) => {
                  const barHeight = Math.max(3, peak * 90)
                  const y = 50 - barHeight / 2
                  const isClipping = peak >= 0.9999
                  const isHigh = peak >= 0.89

                  return (
                    <rect
                      key={idx}
                      x={idx}
                      y={y}
                      width={0.75}
                      height={barHeight}
                      rx={0.3}
                      fill={isClipping ? '#ef4444' : isHigh ? '#f59e0b' : '#8b5cf6'}
                      opacity={isClipping ? 1.0 : isHigh ? 0.9 : 0.75}
                    />
                  )
                })}
              </svg>
            </div>
          </div>

          {/* Primary Metric Grid (Combined View) */}
          {activeChannelTab === 'combined' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Metric 1: Sample Peak */}
              <div className="glass-card rounded-xl p-4 border border-border-subtle flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      Sample Peak
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                        analysisResult.combinedMetrics.samplePeakDbfs >= 0.0
                          ? 'bg-red-500/20 text-red-300 border-red-500/30'
                          : analysisResult.combinedMetrics.samplePeakDbfs >= -0.5
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {analysisResult.combinedMetrics.samplePeakDbfs >= 0.0
                        ? '0 dBFS Hit'
                        : analysisResult.combinedMetrics.samplePeakDbfs >= -0.5
                        ? 'Near Ceiling'
                        : 'Clean Headroom'}
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-bold font-mono text-text-primary">
                    {analysisResult.combinedMetrics.samplePeakDbfs.toFixed(2)}{' '}
                    <span className="text-xs font-sans text-text-secondary font-normal">dBFS</span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-text-secondary leading-normal">
                  Peak sample value. (Discrete sample peak, not inter-sample True Peak).
                </p>
              </div>

              {/* Metric 2: Broadband RMS */}
              <div className="glass-card rounded-xl p-4 border border-border-subtle flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      Broadband RMS
                    </span>
                    <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold text-text-muted border border-border-subtle">
                      Unweighted
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-bold font-mono text-text-primary">
                    {analysisResult.combinedMetrics.broadbandRmsDbfs.toFixed(2)}{' '}
                    <span className="text-xs font-sans text-text-secondary font-normal">dBFS</span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-text-secondary leading-normal">
                  Root mean square across full signal. (Unweighted broadband RMS, not LUFS).
                </p>
              </div>

              {/* Metric 3: Crest Factor */}
              <div className="glass-card rounded-xl p-4 border border-border-subtle flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      Crest Factor
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                        analysisResult.combinedMetrics.crestFactorDb >= 14
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : analysisResult.combinedMetrics.crestFactorDb >= 8
                          ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {analysisResult.combinedMetrics.crestFactorDb >= 14
                        ? 'High Dynamic'
                        : analysisResult.combinedMetrics.crestFactorDb >= 8
                        ? 'Commercial Mix'
                        : 'Heavily Limited'}
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-bold font-mono text-text-primary">
                    {analysisResult.combinedMetrics.crestFactorDb.toFixed(2)}{' '}
                    <span className="text-xs font-sans text-text-secondary font-normal">dB</span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-text-secondary leading-normal">
                  Dynamic range ratio (Peak dBFS − RMS dBFS).
                </p>
              </div>

              {/* Metric 4: Near-Full-Scale Samples */}
              <div className="glass-card rounded-xl p-4 border border-border-subtle flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      Near Full-Scale
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                        analysisResult.combinedMetrics.isNearFullScaleDetected
                          ? 'bg-red-500/20 text-red-300 border-red-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {analysisResult.combinedMetrics.isNearFullScaleDetected ? 'Detected' : 'None'}
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-bold font-mono text-text-primary">
                    {analysisResult.combinedMetrics.nearFullScaleSampleCount.toLocaleString()}{' '}
                    <span className="text-xs font-sans text-text-secondary font-normal">
                      samples ({analysisResult.combinedMetrics.nearFullScaleRatio.toFixed(4)}%)
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-text-secondary leading-normal">
                  Samples with |x| ≥ 0.9999. (Diagnostic clipping flag, not proof of analog clipping).
                </p>
              </div>
            </div>
          )}

          {/* Per-Channel Breakdown View */}
          {activeChannelTab === 'per-channel' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysisResult.channelAnalyses.map((ch, idx) => (
                <div key={idx} className="glass-card rounded-xl p-5 border border-border-subtle space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-sm font-bold text-text-primary">
                      {idx === 0 ? 'Left Channel (Ch 1)' : 'Right Channel (Ch 2)'}
                    </h3>
                    <span className="text-xs font-mono text-accent-400">
                      Peak: {ch.metrics.samplePeakDbfs.toFixed(2)} dBFS
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-black/30 p-2.5 border border-white/5">
                      <span className="text-text-secondary block">Sample Peak</span>
                      <strong className="text-sm font-mono text-white mt-1 block">
                        {ch.metrics.samplePeakDbfs.toFixed(2)} dBFS
                      </strong>
                    </div>
                    <div className="rounded-lg bg-black/30 p-2.5 border border-white/5">
                      <span className="text-text-secondary block">Broadband RMS</span>
                      <strong className="text-sm font-mono text-white mt-1 block">
                        {ch.metrics.broadbandRmsDbfs.toFixed(2)} dBFS
                      </strong>
                    </div>
                    <div className="rounded-lg bg-black/30 p-2.5 border border-white/5">
                      <span className="text-text-secondary block">Crest Factor</span>
                      <strong className="text-sm font-mono text-white mt-1 block">
                        {ch.metrics.crestFactorDb.toFixed(2)} dB
                      </strong>
                    </div>
                    <div className="rounded-lg bg-black/30 p-2.5 border border-white/5">
                      <span className="text-text-secondary block">Near-Full-Scale</span>
                      <strong className={`text-sm font-mono mt-1 block ${ch.metrics.isNearFullScaleDetected ? 'text-red-400' : 'text-emerald-400'}`}>
                        {ch.metrics.nearFullScaleSampleCount.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Low-Level Audio & Silence Analysis */}
          <div className="glass-card rounded-xl p-5 border border-border-subtle">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <svg className="h-4 w-4 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
              Low-Level Audio & Silence Inspection (Heuristic)
            </h3>
            <p className="mt-1 text-xs text-text-secondary leading-relaxed">
              Detects continuous regions below −60 dBFS for at least 500 ms. This heuristic identifies silent gaps,
              extended fades, or trailing blank space, but does not indicate zero-value digital silence.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-black/30 p-3 border border-white/5 text-xs">
                <span className="text-text-secondary block">Leading Silence (Start)</span>
                <strong className="text-sm font-mono text-white mt-1 block">
                  {analysisResult.combinedMetrics.leadingSilenceSeconds.toFixed(2)} s
                </strong>
              </div>
              <div className="rounded-lg bg-black/30 p-3 border border-white/5 text-xs">
                <span className="text-text-secondary block">Trailing Silence (Outro)</span>
                <strong className="text-sm font-mono text-white mt-1 block">
                  {analysisResult.combinedMetrics.trailingSilenceSeconds.toFixed(2)} s
                </strong>
              </div>
              <div className="rounded-lg bg-black/30 p-3 border border-white/5 text-xs">
                <span className="text-text-secondary block">Total Low-Level Duration</span>
                <strong className="text-sm font-mono text-white mt-1 block">
                  {analysisResult.combinedMetrics.totalLowLevelSeconds.toFixed(2)} s
                </strong>
              </div>
            </div>
          </div>

          {/* Technical Limitations & Engineering Standards Note */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/70 leading-relaxed space-y-2">
            <h4 className="font-semibold text-white/90 uppercase tracking-wider text-[11px]">
              Audio Engineering Standards & Limitations Notice
            </h4>
            <p>
              • <strong>Sample Peak vs. True Peak</strong>: The sample peak displayed here represents the highest discrete numerical
              sample value (20 · log10 max |sample|). It does not perform 4× oversampling interpolation required for ITU-R BS.1770
              True Peak (dBTP) metering.
            </p>
            <p>
              • <strong>Broadband RMS vs. Integrated LUFS</strong>: The RMS metric is an unweighted root-mean-square amplitude calculation
              across the full audible spectrum. It does not apply K-weighting filters or silence gating defined by broadcast standards (EBU R128 / ITU-R BS.1770).
            </p>
            <p>
              • <strong>Near-Full-Scale Indicator</strong>: Samples reaching |sample| &ge; 0.9999 indicate digital ceiling saturation.
              This acts as a diagnostic flag for clipping, but cannot determine if distortion is perceptually audible.
            </p>
            <p>
              • <strong>Browser Decoding</strong>: Audio decoding is performed via your browser&apos;s native Web Audio API. Codec support
              varies across browsers (for instance, certain FLAC or AAC profiles depend on OS decoders).
            </p>
          </div>
        </div>
      )}

      {/* Planned Feature Architecture Cards */}
      <div className="pt-4 border-t border-border-subtle">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Planned Future DSP & AI Modules (Backend Roadmap)
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
