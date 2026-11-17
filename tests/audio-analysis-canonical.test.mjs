import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCanonicalRatio,
  canonicalizeJson,
  computeCanonicalPayloadSha256,
} from '../src/lib/audio/canonical.ts';

describe('Audio Analysis Canonical Ratio & Serialization Tests', () => {
  describe('computeCanonicalRatio - Exact Decimal Rounding Agreement', () => {
    it('returns exact 0.000000 when near-full-scale count is zero', () => {
      assert.equal(computeCanonicalRatio(0, 44100), '0.000000');
      assert.equal(computeCanonicalRatio(0, 192000), '0.000000');
      assert.equal(computeCanonicalRatio(0, 10000000), '0.000000');
    });

    it('returns exact 1.000000 when near-full-scale count equals total samples', () => {
      assert.equal(computeCanonicalRatio(44100, 44100), '1.000000');
      assert.equal(computeCanonicalRatio(1000000, 1000000), '1.000000');
    });

    it('rounds exact midpoint 35 / 10,000,000 to 0.000004 (round-half-up)', () => {
      // 35 / 10^7 = 0.00000350. Round-half-up to 6 decimals gives 0.000004.
      assert.equal(computeCanonicalRatio(35, 10000000), '0.000004');
    });

    it('rounds just below midpoint 34 / 10,000,000 to 0.000003', () => {
      // 34 / 10^7 = 0.00000340.
      assert.equal(computeCanonicalRatio(34, 10000000), '0.000003');
    });

    it('rounds just above midpoint 36 / 10,000,000 to 0.000004', () => {
      // 36 / 10^7 = 0.00000360.
      assert.equal(computeCanonicalRatio(36, 10000000), '0.000004');
    });

    it('handles large denominator (1 hour at 192 kHz = 691,200,000 samples)', () => {
      const total = 691200000;
      // 1 count: ~1.4467e-9 -> 0.000000
      assert.equal(computeCanonicalRatio(1, total), '0.000000');
      // Midpoint: 345,600 / 691,200,000 = 0.00050000 exact
      assert.equal(computeCanonicalRatio(345600, total), '0.000500');
    });

    it('throws TypeError on invalid negative or fractional arguments', () => {
      assert.throws(() => computeCanonicalRatio(-1, 44100), TypeError);
      assert.throws(() => computeCanonicalRatio(1.5, 44100), TypeError);
      assert.throws(() => computeCanonicalRatio(10, 0), TypeError);
      assert.throws(() => computeCanonicalRatio(10, -44100), TypeError);
    });
  });

  describe('canonicalizeJson - Deterministic Serialization', () => {
    it('produces identical output regardless of object key insertion order', () => {
      const obj1 = { b: 2, a: 1, c: { z: 26, y: 25 } };
      const obj2 = { a: 1, c: { y: 25, z: 26 }, b: 2 };

      const canon1 = canonicalizeJson(obj1);
      const canon2 = canonicalizeJson(obj2);

      assert.equal(canon1, canon2);
      assert.equal(canon1, '{"a":1,"b":2,"c":{"y":25,"z":26}}');
    });
  });

  describe('computeCanonicalPayloadSha256 - Idempotency Hash', () => {
    it('produces identical SHA256 regardless of JSON object key ordering', () => {
      const payload1 = {
        durationSeconds: 1.0,
        sampleRate: 44100,
        numberOfChannels: 1,
        channelAnalyses: [],
        combinedMetrics: { samplePeakDbfs: -0.5 },
        waveformPeaks: [0.944],
      };
      const payload2 = {
        waveformPeaks: [0.944],
        combinedMetrics: { samplePeakDbfs: -0.5 },
        channelAnalyses: [],
        numberOfChannels: 1,
        sampleRate: 44100,
        durationSeconds: 1.0,
      };

      const studioId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const projectId = 'p1111111-1111-1111-1111-111111111111';

      const hash1 = computeCanonicalPayloadSha256(payload1, studioId, projectId);
      const hash2 = computeCanonicalPayloadSha256(payload2, studioId, projectId);

      assert.equal(hash1, hash2);
      assert.match(hash1, /^[0-9a-f]{64}$/);
    });

    it('distinguishes between null project and defined project', () => {
      const payload = { test: 1 };
      const studioId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      const hashNull = computeCanonicalPayloadSha256(payload, studioId, null);
      const hashProj = computeCanonicalPayloadSha256(payload, studioId, 'p1111111-1111-1111-1111-111111111111');

      assert.notEqual(hashNull, hashProj);
    });
  });
});
