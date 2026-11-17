import { createHash } from 'node:crypto';
import type { MultiChannelAudioAnalysis } from './analysis';

/**
 * Computes exact canonical six-decimal near-full-scale ratio using BigInt scaled integer division.
 * This guarantees mathematical identity with PostgreSQL round(count::numeric / total::numeric, 6)
 * without IEEE 754 floating-point midpoint representation shortfalls.
 */
export function computeCanonicalRatio(count: number, total: number): string {
  if (!Number.isInteger(count) || count < 0) throw new TypeError('Count must be a non-negative integer.');
  if (!Number.isInteger(total) || total <= 0) throw new TypeError('Total must be a positive integer.');
  if (count === 0) return '0.000000';
  if (count >= total) return '1.000000';

  const c = BigInt(count);
  const totalBig = BigInt(total);
  const scaled = (c * 2_000_000n + totalBig) / (totalBig * 2n);
  const intPart = scaled / 1_000_000n;
  const fracPart = scaled % 1_000_000n;
  return `${intPart}.${fracPart.toString().padStart(6, '0')}`;
}

/**
 * Deterministically sorts object keys and serializes to JSON string.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  return '{' + sortedKeys.map(k => JSON.stringify(k) + ':' + canonicalizeJson(record[k])).join(',') + '}';
}

/**
 * Computes deterministic SHA256 digest of studio, project, and analysis payload for idempotency.
 */
export function computeCanonicalPayloadSha256(
  diagnosticsPayload: MultiChannelAudioAnalysis,
  studioId: string,
  projectId: string | null
): string {
  const payloadStr = canonicalizeJson(diagnosticsPayload);
  const normalizedProjectId = projectId || '00000000-0000-0000-0000-000000000000';
  const rawCanonical = `${studioId}|${normalizedProjectId}|${payloadStr}`;
  return createHash('sha256').update(rawCanonical).digest('hex');
}
