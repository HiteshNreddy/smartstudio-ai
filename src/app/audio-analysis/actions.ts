'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { MultiChannelAudioAnalysis } from '@/lib/audio/analysis';
import {
  computeCanonicalRatio,
  canonicalizeJson,
  computeCanonicalPayloadSha256,
} from '@/lib/audio/canonical';

export {
  computeCanonicalRatio,
  canonicalizeJson,
  computeCanonicalPayloadSha256,
};

export type AudioAnalysisRow = Database['public']['Tables']['audio_analyses']['Row'];

export interface SaveAudioAnalysisInput {
  studioId: string;
  projectId?: string | null;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  durationSeconds: number;
  sampleRate: number;
  channelCount: number;
  diagnosticsPayload: MultiChannelAudioAnalysis;
  notes?: string | null;
}

export async function saveAudioAnalysisAction(
  input: SaveAudioAnalysisInput
): Promise<{ success: boolean; data?: AudioAnalysisRow; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required to save audio analyses.' };
    }

    const projectId = input.projectId || null;
    const sampleCountTotal = Math.round(input.durationSeconds * input.sampleRate) * input.channelCount;
    const combined = input.diagnosticsPayload.combinedMetrics;

    const nearFullScaleCount = combined.nearFullScaleSampleCount;
    const nearFullScaleRatioStr = computeCanonicalRatio(nearFullScaleCount, sampleCountTotal);
    const nearFullScaleRatio = parseFloat(nearFullScaleRatioStr);

    const canonicalSha256 = computeCanonicalPayloadSha256(input.diagnosticsPayload, input.studioId, projectId);

    const { data, error } = await supabase
      .from('audio_analyses')
      .insert({
        studio_id: input.studioId,
        project_id: projectId,
        file_name: input.fileName,
        file_size_bytes: input.fileSizeBytes,
        mime_type: input.mimeType,
        duration_seconds: input.durationSeconds,
        sample_rate: input.sampleRate,
        channel_count: input.channelCount,
        sample_count_total: sampleCountTotal,
        sample_peak_dbfs: combined.samplePeakDbfs,
        true_peak_dbfs: combined.samplePeakDbfs, // Default discrete peak as true_peak placeholder
        broadband_rms_dbfs: combined.broadbandRmsDbfs,
        crest_factor_db: combined.crestFactorDb,
        near_full_scale_count: nearFullScaleCount,
        near_full_scale_ratio: nearFullScaleRatio,
        near_full_scale_detected: combined.isNearFullScaleDetected,
        clipping_event_count: combined.nearFullScaleSampleCount,
        clipping_detected: combined.isNearFullScaleDetected,
        diagnostics_payload: input.diagnosticsPayload as unknown as Database['public']['Tables']['audio_analyses']['Insert']['diagnostics_payload'],
        canonical_payload_sha256: canonicalSha256,
        notes: input.notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'This audio analysis report has already been saved for this studio and project.' };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save audio analysis report.';
    return { success: false, error: message };
  }
}

export async function deleteAudioAnalysisAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required to delete audio analyses.' };
    }

    const { error } = await supabase
      .from('audio_analyses')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete audio analysis report.';
    return { success: false, error: message };
  }
}

export async function listStudioAudioAnalysesAction(
  studioId: string
): Promise<{ success: boolean; data?: AudioAnalysisRow[]; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('audio_analyses')
      .select('*')
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list audio analyses.';
    return { success: false, error: message };
  }
}
