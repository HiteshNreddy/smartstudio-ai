/**
 * SmartStudio AI - Audio Analysis Utility Engine
 *
 * Pure, deterministic functions for audio file metadata validation,
 * sample peak metering, broadband RMS calculation, crest factor,
 * near-full-scale indicators, low-level region detection, and waveform downsampling.
 *
 * IMPORTANT ENGINEERING DISTINCTIONS & LIMITATIONS:
 * 1. Peak Level is calculated as *Sample Peak (dBFS)*, NOT inter-sample True Peak (dBTp).
 * 2. RMS is calculated as *Unweighted Broadband RMS (dBFS)* across all samples.
 *    This is NOT ITU-R BS.1770 / EBU R128 K-weighted integrated LUFS.
 * 3. Samples with |x| >= 0.9999 are counted as *Near-Full-Scale Indicators*.
 *    This is a diagnostic flag for potential digital clipping, not proof of analog clipping.
 * 4. Silence detection is a heuristic for audio below -60 dBFS for at least 500 ms.
 *    It does not guarantee pure digital silence (sample value === 0).
 * 5. File metadata validation is a preliminary MIME and extension check;
 *    it does not guarantee that file payloads contain valid decodable audio streams,
 *    nor that all client browsers support every format (e.g., FLAC/AAC codec availability).
 */

export const MAX_AUDIO_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MiB (52,428,800 bytes)
export const MIN_DBFS_FLOOR = -120;
export const NEAR_FULL_SCALE_THRESHOLD = 0.9999;
export const LOW_LEVEL_THRESHOLD_DBFS = -60;
export const MIN_LOW_LEVEL_DURATION_SECONDS = 0.5; // 500 ms

export const SUPPORTED_AUDIO_EXTENSIONS = [
  '.wav',
  '.mp3',
  '.flac',
  '.ogg',
  '.aac',
  '.m4a',
] as const;

export const SUPPORTED_AUDIO_MIME_TYPES = [
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/flac',
  'audio/x-flac',
  'audio/ogg',
  'application/ogg',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
] as const;

export interface FileMetadataInput {
  name: string;
  size: number;
  type?: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  extension?: string;
  mimeType?: string;
  sizeBytes?: number;
  warnings?: string[];
}

export interface LowLevelRegion {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
}

export interface AudioMetrics {
  /** Peak amplitude converted to dBFS (Sample Peak, not True Peak) */
  samplePeakDbfs: number;
  /** Unweighted broadband RMS level in dBFS (not ITU-R BS.1770 LUFS) */
  broadbandRmsDbfs: number;
  /** Difference in dB between sample peak and broadband RMS */
  crestFactorDb: number;
  /** Total count of samples with |amplitude| >= 0.9999 */
  nearFullScaleSampleCount: number;
  /** Percentage of total samples meeting near-full-scale threshold */
  nearFullScaleRatio: number;
  /** Boolean flag: true if any samples hit near-full-scale threshold */
  isNearFullScaleDetected: boolean;
  /** Duration of leading low-level audio region in seconds */
  leadingSilenceSeconds: number;
  /** Duration of trailing low-level audio region in seconds */
  trailingSilenceSeconds: number;
  /** Total duration of all detected low-level regions in seconds */
  totalLowLevelSeconds: number;
  /** Whether any low-level audio regions were detected */
  hasLowLevelRegions: boolean;
}

export interface AudioChannelAnalysis {
  metrics: AudioMetrics;
  lowLevelRegions: LowLevelRegion[];
  waveformPeaks: number[];
}

/**
 * Converts a linear amplitude value [0, 1+] to decibels relative to full scale (dBFS).
 * Clamps safely to MIN_DBFS_FLOOR (-120 dBFS) for zero, negative, or invalid values.
 */
export function linearToDbfs(linear: number, floor: number = MIN_DBFS_FLOOR): number {
  if (!Number.isFinite(linear) || linear <= 0) {
    return floor;
  }
  const db = 20 * Math.log10(linear);
  if (!Number.isFinite(db) || db < floor) {
    return floor;
  }
  return Number(db.toFixed(2));
}

/**
 * Validates audio file metadata against size and preliminary format criteria.
 *
 * Note: Passing this check only verifies file boundaries; it does not prove the file
 * contains valid audio or that the user's specific browser has decoding codec support.
 */
export function validateAudioFileMetadata(file: FileMetadataInput): FileValidationResult {
  if (!file || typeof file.name !== 'string') {
    return { valid: false, error: 'Invalid file object: filename is required.' };
  }

  if (typeof file.size !== 'number' || !Number.isFinite(file.size) || file.size <= 0) {
    return { valid: false, error: 'File is empty or has an invalid size.' };
  }

  if (file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
    const sizeMiB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size exceeds the 50 MiB limit (current size: ${sizeMiB} MiB).`,
      sizeBytes: file.size,
    };
  }

  const lastDotIndex = file.name.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === file.name.length - 1) {
    return {
      valid: false,
      error: 'File lacks a recognizable file extension.',
      sizeBytes: file.size,
    };
  }

  const extension = file.name.slice(lastDotIndex).toLowerCase();
  const isExtensionSupported = (SUPPORTED_AUDIO_EXTENSIONS as readonly string[]).includes(extension);

  if (!isExtensionSupported) {
    return {
      valid: false,
      error: `Unsupported file extension (${extension}). Supported formats: ${SUPPORTED_AUDIO_EXTENSIONS.join(', ')}.`,
      extension,
      sizeBytes: file.size,
    };
  }

  const mimeType = file.type ? file.type.toLowerCase().trim() : '';
  const warnings: string[] = [];

  // Browser codec limitation notice
  if (extension === '.flac' || extension === '.aac' || extension === '.m4a') {
    warnings.push(
      `Format ${extension} support depends on client browser and operating system media decoders.`
    );
  }

  if (mimeType) {
    const isMimeSupported = (SUPPORTED_AUDIO_MIME_TYPES as readonly string[]).includes(mimeType);
    if (!isMimeSupported) {
      return {
        valid: false,
        error: `Unsupported audio MIME type: ${mimeType}.`,
        extension,
        mimeType,
        sizeBytes: file.size,
      };
    }
  }

  return {
    valid: true,
    extension,
    mimeType: mimeType || undefined,
    sizeBytes: file.size,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Calculates Sample Peak level in dBFS across a PCM sample array.
 * Note: This reflects discrete sample peaks, NOT true-peak oversampled values.
 */
export function calculateSamplePeakDbfs(samples: ArrayLike<number>): number {
  if (!samples || samples.length === 0) {
    return MIN_DBFS_FLOOR;
  }

  let maxLinear = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (Number.isFinite(s)) {
      const absVal = Math.abs(s);
      if (absVal > maxLinear) {
        maxLinear = absVal;
      }
    }
  }

  return linearToDbfs(maxLinear);
}

/**
 * Calculates Unweighted Broadband RMS level in dBFS across a PCM sample array.
 * Note: This is NOT ITU-R BS.1770 / EBU R128 integrated loudness (LUFS).
 */
export function calculateBroadbandRmsDbfs(samples: ArrayLike<number>): number {
  if (!samples || samples.length === 0) {
    return MIN_DBFS_FLOOR;
  }

  let sumSquares = 0;
  let validCount = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (Number.isFinite(s)) {
      sumSquares += s * s;
      validCount++;
    }
  }

  if (validCount === 0) {
    return MIN_DBFS_FLOOR;
  }

  const rms = Math.sqrt(sumSquares / validCount);
  return linearToDbfs(rms);
}

/**
 * Calculates the Crest Factor (dynamic range ratio) in dB:
 * Crest Factor = Sample Peak (dBFS) - Broadband RMS (dBFS).
 */
export function calculateCrestFactorDb(samplePeakDbfs: number, broadbandRmsDbfs: number): number {
  if (
    !Number.isFinite(samplePeakDbfs) ||
    !Number.isFinite(broadbandRmsDbfs) ||
    samplePeakDbfs <= MIN_DBFS_FLOOR ||
    broadbandRmsDbfs <= MIN_DBFS_FLOOR
  ) {
    return 0;
  }

  const crest = samplePeakDbfs - broadbandRmsDbfs;
  return Number(Math.max(0, crest).toFixed(2));
}

/**
 * Counts samples that reach or exceed the near-full-scale threshold (|s| >= 0.9999).
 * Used as a diagnostic indicator for potential digital clipping.
 */
export function countNearFullScaleSamples(
  samples: ArrayLike<number>,
  threshold: number = NEAR_FULL_SCALE_THRESHOLD
): { count: number; ratio: number; isDetected: boolean } {
  if (!samples || samples.length === 0) {
    return { count: 0, ratio: 0, isDetected: false };
  }

  let count = 0;
  let validCount = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (Number.isFinite(s)) {
      validCount++;
      if (Math.abs(s) >= threshold) {
        count++;
      }
    }
  }

  const ratio = validCount > 0 ? Number((count / validCount).toFixed(6)) : 0;
  return {
    count,
    ratio,
    isDetected: count > 0,
  };
}

/**
 * Detects low-level audio regions (below -60 dBFS for at least 500 ms).
 * This is a diagnostic heuristic and does not guarantee pure digital silence (zeroes).
 */
export function detectLowLevelAudioRegions(
  samples: ArrayLike<number>,
  sampleRate: number,
  options: {
    thresholdDbfs?: number;
    minDurationSeconds?: number;
    windowSizeMs?: number;
  } = {}
): {
  regions: LowLevelRegion[];
  leadingSilenceSeconds: number;
  trailingSilenceSeconds: number;
  totalLowLevelSeconds: number;
} {
  const thresholdDbfs = options.thresholdDbfs ?? LOW_LEVEL_THRESHOLD_DBFS;
  const minDurationSeconds = options.minDurationSeconds ?? MIN_LOW_LEVEL_DURATION_SECONDS;
  const windowSizeMs = options.windowSizeMs ?? 50;

  if (!samples || samples.length === 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return {
      regions: [],
      leadingSilenceSeconds: 0,
      trailingSilenceSeconds: 0,
      totalLowLevelSeconds: 0,
    };
  }

  const linearThreshold = Math.pow(10, thresholdDbfs / 20);
  const windowSize = Math.max(1, Math.floor((sampleRate * windowSizeMs) / 1000));
  const numWindows = Math.ceil(samples.length / windowSize);

  // Calculate RMS for each window
  const isWindowQuiet: boolean[] = new Array(numWindows);
  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSize;
    const end = Math.min(start + windowSize, samples.length);
    let sumSquares = 0;
    let count = 0;

    for (let i = start; i < end; i++) {
      const s = samples[i];
      if (Number.isFinite(s)) {
        sumSquares += s * s;
        count++;
      }
    }

    const windowRms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
    isWindowQuiet[w] = windowRms < linearThreshold;
  }

  // Find contiguous quiet window sequences that satisfy minDurationSeconds
  const minQuietWindows = Math.ceil((minDurationSeconds * 1000) / windowSizeMs);
  const regions: LowLevelRegion[] = [];

  let currentStartWindow: number | null = null;
  for (let w = 0; w < numWindows; w++) {
    if (isWindowQuiet[w]) {
      if (currentStartWindow === null) {
        currentStartWindow = w;
      }
    } else {
      if (currentStartWindow !== null) {
        const quietWindowsCount = w - currentStartWindow;
        if (quietWindowsCount >= minQuietWindows) {
          const startSeconds = Number(((currentStartWindow * windowSize) / sampleRate).toFixed(2));
          const endSeconds = Number(((w * windowSize) / sampleRate).toFixed(2));
          regions.push({
            startSeconds,
            endSeconds,
            durationSeconds: Number((endSeconds - startSeconds).toFixed(2)),
          });
        }
        currentStartWindow = null;
      }
    }
  }

  // Check final region if it reached the end
  if (currentStartWindow !== null) {
    const quietWindowsCount = numWindows - currentStartWindow;
    if (quietWindowsCount >= minQuietWindows) {
      const startSeconds = Number(((currentStartWindow * windowSize) / sampleRate).toFixed(2));
      const totalDuration = Number((samples.length / sampleRate).toFixed(2));
      regions.push({
        startSeconds,
        endSeconds: totalDuration,
        durationSeconds: Number((totalDuration - startSeconds).toFixed(2)),
      });
    }
  }

  let leadingSilenceSeconds = 0;
  let trailingSilenceSeconds = 0;
  let totalLowLevelSeconds = 0;

  for (const r of regions) {
    totalLowLevelSeconds += r.durationSeconds;
    if (r.startSeconds === 0) {
      leadingSilenceSeconds = r.durationSeconds;
    }
    const totalDuration = samples.length / sampleRate;
    if (Math.abs(r.endSeconds - totalDuration) <= 0.1) {
      trailingSilenceSeconds = r.durationSeconds;
    }
  }

  return {
    regions,
    leadingSilenceSeconds: Number(leadingSilenceSeconds.toFixed(2)),
    trailingSilenceSeconds: Number(trailingSilenceSeconds.toFixed(2)),
    totalLowLevelSeconds: Number(totalLowLevelSeconds.toFixed(2)),
  };
}

/**
 * Downsamples PCM samples into normalized peak amplitude bins for SVG waveform rendering.
 * Returns an array of normalized values between 0.0 and 1.0.
 */
export function downsampleWaveformPeaks(
  samples: ArrayLike<number>,
  numBins: number = 100
): number[] {
  if (!samples || samples.length === 0 || numBins <= 0) {
    return new Array(numBins).fill(0);
  }

  const actualBins = Math.min(numBins, samples.length);
  const result: number[] = new Array(actualBins);
  const samplesPerBin = samples.length / actualBins;

  for (let b = 0; b < actualBins; b++) {
    const start = Math.floor(b * samplesPerBin);
    const end = Math.floor((b + 1) * samplesPerBin);
    let binPeak = 0;

    for (let i = start; i < end; i++) {
      const s = samples[i];
      if (Number.isFinite(s)) {
        const absVal = Math.abs(s);
        if (absVal > binPeak) {
          binPeak = absVal;
        }
      }
    }

    // Clamp normalized amplitude to [0, 1]
    result[b] = Number(Math.min(1.0, binPeak).toFixed(3));
  }

  // If actualBins < numBins, pad to numBins
  if (actualBins < numBins) {
    while (result.length < numBins) {
      result.push(0);
    }
  }

  return result;
}

/**
 * Aggregates all audio channel analysis metrics into a unified structure.
 */
export function analyzeAudioChannel(
  samples: ArrayLike<number>,
  sampleRate: number,
  waveformBins: number = 100
): AudioChannelAnalysis {
  const samplePeakDbfs = calculateSamplePeakDbfs(samples);
  const broadbandRmsDbfs = calculateBroadbandRmsDbfs(samples);
  const crestFactorDb = calculateCrestFactorDb(samplePeakDbfs, broadbandRmsDbfs);
  const { count: nearFullScaleSampleCount, ratio: nearFullScaleRatio, isDetected: isNearFullScaleDetected } =
    countNearFullScaleSamples(samples);
  const lowLevelResult = detectLowLevelAudioRegions(samples, sampleRate);
  const waveformPeaks = downsampleWaveformPeaks(samples, waveformBins);

  return {
    metrics: {
      samplePeakDbfs,
      broadbandRmsDbfs,
      crestFactorDb,
      nearFullScaleSampleCount,
      nearFullScaleRatio,
      isNearFullScaleDetected,
      leadingSilenceSeconds: lowLevelResult.leadingSilenceSeconds,
      trailingSilenceSeconds: lowLevelResult.trailingSilenceSeconds,
      totalLowLevelSeconds: lowLevelResult.totalLowLevelSeconds,
      hasLowLevelRegions: lowLevelResult.regions.length > 0,
    },
    lowLevelRegions: lowLevelResult.regions,
    waveformPeaks,
  };
}

/**
 * Formats duration in seconds to standard studio timestamp mm:ss.ms.
 */
export function formatAudioDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const minsStr = String(mins).padStart(2, '0');
  const secsStr = secs.toFixed(2).padStart(5, '0');
  return `${minsStr}:${secsStr}`;
}

/**
 * Formats file size in bytes to human-readable string (B, KB, MB).
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface MultiChannelAudioAnalysis {
  durationSeconds: number;
  sampleRate: number;
  numberOfChannels: number;
  channelAnalyses: AudioChannelAnalysis[];
  combinedMetrics: {
    samplePeakDbfs: number;
    broadbandRmsDbfs: number;
    crestFactorDb: number;
    nearFullScaleSampleCount: number;
    nearFullScaleRatio: number;
    isNearFullScaleDetected: boolean;
    leadingSilenceSeconds: number;
    trailingSilenceSeconds: number;
    totalLowLevelSeconds: number;
    hasLowLevelRegions: boolean;
  };
  waveformPeaks: number[];
}

/**
 * Performs complete multi-channel analysis across an array of channel sample buffers.
 */
export function analyzeMultiChannelAudio(
  channelBuffers: ArrayLike<number>[],
  sampleRate: number,
  durationSeconds: number,
  waveformBins: number = 100
): MultiChannelAudioAnalysis {
  if (!channelBuffers || channelBuffers.length === 0) {
    return {
      durationSeconds: 0,
      sampleRate: sampleRate || 0,
      numberOfChannels: 0,
      channelAnalyses: [],
      combinedMetrics: {
        samplePeakDbfs: MIN_DBFS_FLOOR,
        broadbandRmsDbfs: MIN_DBFS_FLOOR,
        crestFactorDb: 0,
        nearFullScaleSampleCount: 0,
        nearFullScaleRatio: 0,
        isNearFullScaleDetected: false,
        leadingSilenceSeconds: 0,
        trailingSilenceSeconds: 0,
        totalLowLevelSeconds: 0,
        hasLowLevelRegions: false,
      },
      waveformPeaks: new Array(waveformBins).fill(0),
    };
  }

  const channelAnalyses: AudioChannelAnalysis[] = [];
  let maxPeakDbfs = MIN_DBFS_FLOOR;
  let totalNearFullScaleCount = 0;
  let totalSamplesEvaluated = 0;
  let sumSquaredRmsLinear = 0;

  for (const ch of channelBuffers) {
    const analysis = analyzeAudioChannel(ch, sampleRate, waveformBins);
    channelAnalyses.push(analysis);

    if (analysis.metrics.samplePeakDbfs > maxPeakDbfs) {
      maxPeakDbfs = analysis.metrics.samplePeakDbfs;
    }
    totalNearFullScaleCount += analysis.metrics.nearFullScaleSampleCount;
    totalSamplesEvaluated += ch.length;

    if (analysis.metrics.broadbandRmsDbfs > MIN_DBFS_FLOOR) {
      const linearRms = Math.pow(10, analysis.metrics.broadbandRmsDbfs / 20);
      sumSquaredRmsLinear += ch.length * (linearRms * linearRms);
    }
  }

  const combinedLinearRms =
    totalSamplesEvaluated > 0
      ? Math.sqrt(sumSquaredRmsLinear / totalSamplesEvaluated)
      : 0;
  const combinedRmsDbfs = linearToDbfs(combinedLinearRms);
  const combinedCrestFactorDb = calculateCrestFactorDb(maxPeakDbfs, combinedRmsDbfs);

  const combinedNearFullScaleRatio =
    totalSamplesEvaluated > 0
      ? Number((totalNearFullScaleCount / totalSamplesEvaluated).toFixed(6))
      : 0;

  // Build combined waveform by taking max peak across all channels per bin
  const combinedWaveform: number[] = new Array(waveformBins).fill(0);
  for (let b = 0; b < waveformBins; b++) {
    let binMax = 0;
    for (const ca of channelAnalyses) {
      if (ca.waveformPeaks[b] > binMax) {
        binMax = ca.waveformPeaks[b];
      }
    }
    combinedWaveform[b] = binMax;
  }

  const primarySilence = channelAnalyses[0]?.metrics;

  return {
    durationSeconds: Number(durationSeconds.toFixed(2)),
    sampleRate,
    numberOfChannels: channelBuffers.length,
    channelAnalyses,
    combinedMetrics: {
      samplePeakDbfs: maxPeakDbfs,
      broadbandRmsDbfs: combinedRmsDbfs,
      crestFactorDb: combinedCrestFactorDb,
      nearFullScaleSampleCount: totalNearFullScaleCount,
      nearFullScaleRatio: combinedNearFullScaleRatio,
      isNearFullScaleDetected: totalNearFullScaleCount > 0,
      leadingSilenceSeconds: primarySilence?.leadingSilenceSeconds ?? 0,
      trailingSilenceSeconds: primarySilence?.trailingSilenceSeconds ?? 0,
      totalLowLevelSeconds: primarySilence?.totalLowLevelSeconds ?? 0,
      hasLowLevelRegions: primarySilence?.hasLowLevelRegions ?? false,
    },
    waveformPeaks: combinedWaveform,
  };
}
