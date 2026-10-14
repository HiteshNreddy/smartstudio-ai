import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  linearToDbfs,
  calculateSamplePeakDbfs,
  calculateBroadbandRmsDbfs,
  calculateCrestFactorDb,
  countNearFullScaleSamples,
  detectLowLevelAudioRegions,
  downsampleWaveformPeaks,
  validateAudioFileMetadata,
  analyzeAudioChannel,
  formatAudioDuration,
  formatFileSize,
  analyzeMultiChannelAudio,
  MAX_AUDIO_FILE_SIZE_BYTES,
  MIN_DBFS_FLOOR,
  NEAR_FULL_SCALE_THRESHOLD,
} from '../src/lib/audio/analysis.ts'

describe('Audio Analysis - Mathematical DSP & dBFS Conversions', () => {
  test('linearToDbfs converts full scale (1.0) to exactly 0 dBFS', () => {
    assert.equal(linearToDbfs(1.0), 0.0)
  })

  test('linearToDbfs converts half scale (0.5) to approximately -6.02 dBFS', () => {
    const db = linearToDbfs(0.5)
    assert.equal(db, -6.02)
  })

  test('linearToDbfs clamps zero, negative, and invalid values to MIN_DBFS_FLOOR (-120 dBFS)', () => {
    assert.equal(linearToDbfs(0), MIN_DBFS_FLOOR)
    assert.equal(linearToDbfs(-0.5), MIN_DBFS_FLOOR)
    assert.equal(linearToDbfs(Number.NaN), MIN_DBFS_FLOOR)
    assert.equal(linearToDbfs(-Infinity), MIN_DBFS_FLOOR)
  })

  test('calculateSamplePeakDbfs identifies maximum positive and negative peaks', () => {
    const positivePeak = new Float32Array([0.1, 0.4, 0.8, 0.2])
    assert.equal(calculateSamplePeakDbfs(positivePeak), -1.94) // 20*log10(0.8) = -1.938

    const negativePeak = new Float32Array([0.1, -0.9, 0.3, -0.5])
    assert.equal(calculateSamplePeakDbfs(negativePeak), -0.92) // 20*log10(0.9) = -0.915
  })

  test('calculateSamplePeakDbfs handles empty and corrupted buffers gracefully', () => {
    assert.equal(calculateSamplePeakDbfs([]), MIN_DBFS_FLOOR)
    assert.equal(calculateSamplePeakDbfs(new Float32Array(0)), MIN_DBFS_FLOOR)
    assert.equal(calculateSamplePeakDbfs([NaN, Infinity, -Infinity]), MIN_DBFS_FLOOR)
  })

  test('calculateBroadbandRmsDbfs computes accurate RMS for DC and sine wave signals', () => {
    // Constant DC signal of 0.5: RMS is exactly 0.5 -> -6.02 dBFS
    const dcSignal = new Float32Array(100).fill(0.5)
    assert.equal(calculateBroadbandRmsDbfs(dcSignal), -6.02)

    // Full-scale sine wave: RMS is 1 / sqrt(2) approx 0.7071 -> -3.01 dBFS
    const sampleRate = 48000
    const sineSamples = new Float32Array(sampleRate)
    for (let i = 0; i < sampleRate; i++) {
      sineSamples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate)
    }
    const sineRms = calculateBroadbandRmsDbfs(sineSamples)
    assert.ok(Math.abs(sineRms - -3.01) <= 0.05, `Expected ~ -3.01 dBFS, got ${sineRms}`)
  })

  test('calculateCrestFactorDb returns difference between peak and RMS', () => {
    // Peak 0 dBFS, RMS -12 dBFS -> Crest Factor = 12 dB
    assert.equal(calculateCrestFactorDb(0.0, -12.0), 12.0)

    // Peak -3 dBFS, RMS -15 dBFS -> Crest Factor = 12 dB
    assert.equal(calculateCrestFactorDb(-3.0, -15.0), 12.0)

    // Invalid / silent inputs return 0
    assert.equal(calculateCrestFactorDb(MIN_DBFS_FLOOR, MIN_DBFS_FLOOR), 0)
    assert.equal(calculateCrestFactorDb(NaN, -12.0), 0)
  })
})

describe('Audio Analysis - Near-Full-Scale Diagnostic Indicators', () => {
  test('flags samples meeting near-full-scale threshold (>= 0.9999)', () => {
    assert.equal(NEAR_FULL_SCALE_THRESHOLD, 0.9999)
    // Signal with 2 samples at 1.0 (0 dBFS)
    const samples = new Float32Array([0.1, 0.5, 1.0, 0.3, -1.0, 0.2])
    const result = countNearFullScaleSamples(samples)

    assert.equal(result.count, 2)
    assert.equal(result.isDetected, true)
    assert.equal(result.ratio, Number((2 / 6).toFixed(6)))
  })

  test('does not flag signals safely below near-full-scale threshold', () => {
    // Hot signal peaked at 0.98 (-0.17 dBFS)
    const samples = new Float32Array([0.1, -0.98, 0.5, 0.95, -0.8])
    const result = countNearFullScaleSamples(samples)

    assert.equal(result.count, 0)
    assert.equal(result.isDetected, false)
    assert.equal(result.ratio, 0)
  })

  test('handles empty and corrupted sample arrays safely', () => {
    const emptyResult = countNearFullScaleSamples([])
    assert.equal(emptyResult.count, 0)
    assert.equal(emptyResult.isDetected, false)

    const corruptedResult = countNearFullScaleSamples([NaN, Infinity])
    assert.equal(corruptedResult.count, 0)
  })
})

describe('Audio Analysis - Low-Level Region & Silence Detection Heuristic', () => {
  test('detects low-level regions lasting at least 500 ms below -60 dBFS', () => {
    const sampleRate = 1000 // 1000 Hz for easy math
    // 1 second of silence (1000 samples) followed by 1 second of audio at 0.5 (1000 samples)
    const totalSamples = sampleRate * 2
    const samples = new Float32Array(totalSamples)

    // First 1000 samples are 0.0001 (-80 dBFS, below -60 dBFS)
    for (let i = 0; i < 1000; i++) {
      samples[i] = 0.0001
    }
    // Remaining 1000 samples are 0.5 (-6 dBFS, well above -60 dBFS)
    for (let i = 1000; i < totalSamples; i++) {
      samples[i] = 0.5
    }

    const result = detectLowLevelAudioRegions(samples, sampleRate, { minDurationSeconds: 0.5 })

    assert.ok(result.regions.length >= 1)
    assert.equal(result.leadingSilenceSeconds, 1.0)
    assert.equal(result.trailingSilenceSeconds, 0)
    assert.equal(result.totalLowLevelSeconds, 1.0)
  })

  test('ignores short dips below -60 dBFS that last less than 500 ms', () => {
    const sampleRate = 1000
    // 200 ms of silence (not enough for 500ms threshold) in the middle of 2 seconds of audio
    const totalSamples = sampleRate * 2
    const samples = new Float32Array(totalSamples).fill(0.4)

    // Dip for 200ms (samples 500 to 700)
    for (let i = 500; i < 700; i++) {
      samples[i] = 0
    }

    const result = detectLowLevelAudioRegions(samples, sampleRate, { minDurationSeconds: 0.5 })
    assert.equal(result.regions.length, 0)
    assert.equal(result.totalLowLevelSeconds, 0)
  })

  test('handles completely silent files cleanly', () => {
    const sampleRate = 44100
    const silentFile = new Float32Array(sampleRate * 2) // 2 seconds of zeros
    const result = detectLowLevelAudioRegions(silentFile, sampleRate)

    assert.ok(result.regions.length >= 1)
    assert.equal(result.leadingSilenceSeconds, 2.0)
    assert.equal(result.trailingSilenceSeconds, 2.0)
  })
})

describe('Audio Analysis - Waveform Downsampling', () => {
  test('downsamples audio buffer to requested number of normalized bins', () => {
    const samples = new Float32Array(1000)
    // Create peak at start and peak at end
    samples[10] = 0.8
    samples[990] = -0.9

    const waveform = downsampleWaveformPeaks(samples, 10)
    assert.equal(waveform.length, 10)
    assert.equal(waveform[0], 0.8)
    assert.equal(waveform[9], 0.9)
    // All values must be within [0, 1]
    waveform.forEach((val) => {
      assert.ok(val >= 0.0 && val <= 1.0)
    })
  })

  test('handles empty buffer by returning array of zeroes', () => {
    const waveform = downsampleWaveformPeaks([], 50)
    assert.equal(waveform.length, 50)
    assert.ok(waveform.every((v) => v === 0))
  })
})

describe('Audio Analysis - Preliminary File Metadata Validation', () => {
  test('accepts valid audio files across supported formats', () => {
    const validWav = validateAudioFileMetadata({
      name: 'master_track_48k.wav',
      size: 25 * 1024 * 1024, // 25 MiB
      type: 'audio/wav',
    })
    assert.equal(validWav.valid, true)
    assert.equal(validWav.extension, '.wav')

    const validMp3 = validateAudioFileMetadata({
      name: 'mixdown_rough.mp3',
      size: 8 * 1024 * 1024,
      type: 'audio/mpeg',
    })
    assert.equal(validMp3.valid, true)
    assert.equal(validMp3.extension, '.mp3')
  })

  test('includes browser codec warning for FLAC and AAC files', () => {
    const validFlac = validateAudioFileMetadata({
      name: 'stems_multitrack.flac',
      size: 30 * 1024 * 1024,
      type: 'audio/flac',
    })
    assert.equal(validFlac.valid, true)
    assert.ok(validFlac.warnings && validFlac.warnings.length > 0)
    assert.ok(validFlac.warnings[0].includes('browser and operating system'))
  })

  test('rejects files exceeding 50 MiB ceiling', () => {
    const oversizedFile = validateAudioFileMetadata({
      name: 'huge_session.wav',
      size: MAX_AUDIO_FILE_SIZE_BYTES + 1,
      type: 'audio/wav',
    })
    assert.equal(oversizedFile.valid, false)
    assert.ok(oversizedFile.error.includes('exceeds the 50 MiB limit'))
  })

  test('rejects empty or zero-byte files', () => {
    const emptyFile = validateAudioFileMetadata({
      name: 'empty.wav',
      size: 0,
      type: 'audio/wav',
    })
    assert.equal(emptyFile.valid, false)
    assert.ok(emptyFile.error.includes('empty or has an invalid size'))
  })

  test('rejects unsupported extensions and non-audio files', () => {
    const executable = validateAudioFileMetadata({
      name: 'installer.exe',
      size: 5000,
      type: 'application/octet-stream',
    })
    assert.equal(executable.valid, false)
    assert.ok(executable.error.includes('Unsupported file extension'))

    const pdfFile = validateAudioFileMetadata({
      name: 'lyrics_sheet.pdf',
      size: 15000,
      type: 'application/pdf',
    })
    assert.equal(pdfFile.valid, false)
  })

  test('rejects unsupported MIME types even if extension is audio', () => {
    const spoofedFile = validateAudioFileMetadata({
      name: 'fake.wav',
      size: 1000,
      type: 'image/png',
    })
    assert.equal(spoofedFile.valid, false)
    assert.ok(spoofedFile.error.includes('Unsupported audio MIME type'))
  })
})

describe('Audio Analysis - Unified Channel Analyzer', () => {
  test('returns comprehensive metrics package for a clean stereo channel', () => {
    const sampleRate = 48000
    // 1 second of sine wave at 0.5 peak amplitude
    const samples = new Float32Array(sampleRate)
    for (let i = 0; i < sampleRate; i++) {
      samples[i] = 0.5 * Math.sin((2 * Math.PI * 1000 * i) / sampleRate)
    }

    const analysis = analyzeAudioChannel(samples, sampleRate, 50)

    assert.equal(analysis.metrics.samplePeakDbfs, -6.02)
    assert.ok(analysis.metrics.broadbandRmsDbfs <= -9.0)
    assert.ok(analysis.metrics.crestFactorDb > 0)
    assert.equal(analysis.metrics.isNearFullScaleDetected, false)
    assert.equal(analysis.metrics.nearFullScaleSampleCount, 0)
    assert.equal(analysis.waveformPeaks.length, 50)
  })
})

describe('Audio Analysis - Formatting & Multi-Channel Evaluation', () => {
  test('formatAudioDuration formats seconds into mm:ss.ms', () => {
    assert.equal(formatAudioDuration(0), '00:00.00')
    assert.equal(formatAudioDuration(-5), '00:00.00')
    assert.equal(formatAudioDuration(Number.NaN), '00:00.00')
    assert.equal(formatAudioDuration(65.5), '01:05.50')
    assert.equal(formatAudioDuration(214.25), '03:34.25')
  })

  test('formatFileSize formats byte quantities to human readable units', () => {
    assert.equal(formatFileSize(0), '0 B')
    assert.equal(formatFileSize(-10), '0 B')
    assert.equal(formatFileSize(512), '512 B')
    assert.equal(formatFileSize(2048), '2.0 KB')
    assert.equal(formatFileSize(10 * 1024 * 1024), '10.00 MB')
  })

  test('analyzeMultiChannelAudio processes stereo audio with proper channel isolation and combination', () => {
    const sampleRate = 48000
    // Left channel: 0.5 peak (-6.02 dBFS)
    const leftChannel = new Float32Array(sampleRate).fill(0.5)
    // Right channel: 1.0 peak (0.0 dBFS, includes near-full-scale)
    const rightChannel = new Float32Array(sampleRate).fill(0.2)
    rightChannel[100] = 1.0

    const result = analyzeMultiChannelAudio([leftChannel, rightChannel], sampleRate, 1.0, 20)

    assert.equal(result.numberOfChannels, 2)
    assert.equal(result.durationSeconds, 1.0)
    assert.equal(result.channelAnalyses.length, 2)

    // Combined peak should be 0.0 dBFS (from right channel)
    assert.equal(result.combinedMetrics.samplePeakDbfs, 0.0)
    // Left channel peak is -6.02 dBFS
    assert.equal(result.channelAnalyses[0].metrics.samplePeakDbfs, -6.02)
    // Right channel peak is 0.0 dBFS
    assert.equal(result.channelAnalyses[1].metrics.samplePeakDbfs, 0.0)

    // Near full scale indicator: detected because right channel hit 1.0
    assert.equal(result.combinedMetrics.isNearFullScaleDetected, true)
    assert.equal(result.combinedMetrics.nearFullScaleSampleCount, 1)

    // Waveform: length 20
    assert.equal(result.waveformPeaks.length, 20)
  })

  test('analyzeMultiChannelAudio correctly weights RMS by sample length when channels differ in size', () => {
    // Ch 1: 1000 samples of 1.0 (RMS = 1.0)
    const ch1 = new Float32Array(1000).fill(1.0)
    // Ch 2: 3000 samples of 0.0 (RMS = 0.0)
    const ch2 = new Float32Array(3000).fill(0.0)

    // Total 4000 samples with 1000 ones and 3000 zeros:
    // Combined RMS = sqrt(1000 / 4000) = sqrt(0.25) = 0.5 -> -6.02 dBFS
    const result = analyzeMultiChannelAudio([ch1, ch2], 48000, 4.0, 10)

    assert.equal(result.combinedMetrics.broadbandRmsDbfs, -6.02)
  })

  test('analyzeMultiChannelAudio handles empty channel lists safely', () => {
    const result = analyzeMultiChannelAudio([], 48000, 0, 50)
    assert.equal(result.numberOfChannels, 0)
    assert.equal(result.combinedMetrics.samplePeakDbfs, MIN_DBFS_FLOOR)
    assert.equal(result.waveformPeaks.length, 50)
  })
})
