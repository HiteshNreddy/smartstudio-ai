-- Migration: 20261015000000_create_audio_analyses.sql
-- Description: Multi-tenant audio analysis diagnostics table with composite FK,
--              fail-closed JSONB validation, immutability trigger, and role-scoped RLS.

BEGIN;

-- 1. Ensure composite unique key on projects for cross-tenant composite FK
ALTER TABLE public.projects 
  ADD CONSTRAINT projects_studio_id_id_key UNIQUE (studio_id, id);

-- 2. Fail-Closed JSONB Validation Function
CREATE OR REPLACE FUNCTION public.validate_audio_analysis_jsonb_payload(
  p_duration numeric,
  p_sample_count bigint,
  p_channel_count int,
  p_payload jsonb
) RETURNS boolean AS $$
DECLARE
  v_channels jsonb;
  v_ch jsonb;
  v_metrics jsonb;
  v_ch0_metrics jsonb;
  v_regions jsonb;
  v_region jsonb;
  v_peaks jsonb;
  v_ch_peaks jsonb;
  v_combined_metrics jsonb;
  v_len int;
  v_i int;
  v_k int;
  v_peak_val numeric;
  v_prev_end numeric;
  v_r_start numeric;
  v_r_end numeric;
  v_r_dur numeric;
  v_sum_dur numeric;
  v_max_ch_peak numeric;
  v_sum_ch_nfs numeric;
  v_ch_peak_val numeric;
  v_ch_nfs_val numeric;
BEGIN
  -- 1. Input parameter guard
  IF p_channel_count <= 0 OR p_channel_count > 32 OR p_duration <= 0.0 OR p_sample_count <= 0 THEN
    RETURN false;
  END IF;

  -- 2. Fail-closed on NULL or non-object payload
  IF p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RETURN false;
  END IF;

  -- 3. Top-level key existence
  IF NOT (p_payload ?& ARRAY['durationSeconds', 'sampleRate', 'numberOfChannels', 'channelAnalyses', 'combinedMetrics', 'waveformPeaks']::text[]) THEN
    RETURN false;
  END IF;

  -- 4. Scalar types and integer bounds (numeric comparisons prevent integer overflow)
  IF jsonb_typeof(p_payload->'durationSeconds') IS DISTINCT FROM 'number' OR
     jsonb_typeof(p_payload->'sampleRate') IS DISTINCT FROM 'number' OR
     jsonb_typeof(p_payload->'numberOfChannels') IS DISTINCT FROM 'number' THEN
    RETURN false;
  END IF;

  -- Validate duration match and non-fractional channel count
  IF abs((p_payload->>'durationSeconds')::numeric - p_duration) > 0.05 OR
     (p_payload->>'numberOfChannels')::numeric != round((p_payload->>'numberOfChannels')::numeric) OR
     (p_payload->>'numberOfChannels')::numeric != p_channel_count THEN
    RETURN false;
  END IF;

  -- 5. Validate combinedMetrics
  v_combined_metrics := p_payload->'combinedMetrics';
  IF jsonb_typeof(v_combined_metrics) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF NOT (v_combined_metrics ?& ARRAY['samplePeakDbfs', 'broadbandRmsDbfs', 'crestFactorDb', 'nearFullScaleSampleCount', 'nearFullScaleRatio', 'isNearFullScaleDetected', 'leadingSilenceSeconds', 'trailingSilenceSeconds', 'totalLowLevelSeconds', 'hasLowLevelRegions']::text[]) THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(v_combined_metrics->'samplePeakDbfs') IS DISTINCT FROM 'number' OR
     jsonb_typeof(v_combined_metrics->'broadbandRmsDbfs') IS DISTINCT FROM 'number' OR
     jsonb_typeof(v_combined_metrics->'crestFactorDb') IS DISTINCT FROM 'number' OR
     jsonb_typeof(v_combined_metrics->'nearFullScaleSampleCount') IS DISTINCT FROM 'number' OR
     jsonb_typeof(v_combined_metrics->'nearFullScaleRatio') IS DISTINCT FROM 'number' OR
     jsonb_typeof(v_combined_metrics->'isNearFullScaleDetected') IS DISTINCT FROM 'boolean' OR
     jsonb_typeof(v_combined_metrics->'leadingSilenceSeconds') IS DISTINCT FROM 'number' OR
     jsonb_typeof(v_combined_metrics->'trailingSilenceSeconds') IS DISTINCT FROM 'number' OR
     jsonb_typeof(v_combined_metrics->'totalLowLevelSeconds') IS DISTINCT FROM 'number' OR
     jsonb_typeof(v_combined_metrics->'hasLowLevelRegions') IS DISTINCT FROM 'boolean' THEN
    RETURN false;
  END IF;

  -- Combined metrics invariant coherence
  IF (v_combined_metrics->>'samplePeakDbfs')::numeric < -120.00 OR (v_combined_metrics->>'samplePeakDbfs')::numeric > 6.00 OR
     (v_combined_metrics->>'broadbandRmsDbfs')::numeric < -120.00 OR (v_combined_metrics->>'broadbandRmsDbfs')::numeric > (v_combined_metrics->>'samplePeakDbfs')::numeric OR
     (v_combined_metrics->>'nearFullScaleSampleCount')::numeric != round((v_combined_metrics->>'nearFullScaleSampleCount')::numeric) OR
     (v_combined_metrics->>'nearFullScaleSampleCount')::numeric < 0 OR
     (v_combined_metrics->>'isNearFullScaleDetected')::boolean != ((v_combined_metrics->>'nearFullScaleSampleCount')::numeric > 0) THEN
    RETURN false;
  END IF;

  -- 6. Validate combined waveformPeaks
  v_peaks := p_payload->'waveformPeaks';
  IF jsonb_typeof(v_peaks) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  v_len := jsonb_array_length(v_peaks);
  IF v_len = 0 THEN RETURN false; END IF;
  FOR v_k IN 0..(v_len - 1) LOOP
    IF jsonb_typeof(v_peaks->v_k) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    v_peak_val := (v_peaks->>v_k)::numeric;
    IF v_peak_val < 0.0 OR v_peak_val > 1.0 THEN RETURN false; END IF;
  END LOOP;

  -- 7. Validate channelAnalyses array
  v_channels := p_payload->'channelAnalyses';
  IF jsonb_typeof(v_channels) IS DISTINCT FROM 'array' OR jsonb_array_length(v_channels) != p_channel_count THEN
    RETURN false;
  END IF;

  v_max_ch_peak := -120.00;
  v_sum_ch_nfs := 0;

  -- 8. Validate each channel
  FOR v_i IN 0..(p_channel_count - 1) LOOP
    v_ch := v_channels->v_i;
    IF jsonb_typeof(v_ch) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF NOT (v_ch ?& ARRAY['metrics', 'lowLevelRegions', 'waveformPeaks']::text[]) THEN RETURN false; END IF;

    -- Channel metrics
    v_metrics := v_ch->'metrics';
    IF jsonb_typeof(v_metrics) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF NOT (v_metrics ?& ARRAY['samplePeakDbfs', 'broadbandRmsDbfs', 'crestFactorDb', 'nearFullScaleSampleCount', 'nearFullScaleRatio', 'isNearFullScaleDetected', 'leadingSilenceSeconds', 'trailingSilenceSeconds', 'totalLowLevelSeconds', 'hasLowLevelRegions']::text[]) THEN
      RETURN false;
    END IF;

    IF jsonb_typeof(v_metrics->'samplePeakDbfs') IS DISTINCT FROM 'number' OR
       jsonb_typeof(v_metrics->'broadbandRmsDbfs') IS DISTINCT FROM 'number' OR
       jsonb_typeof(v_metrics->'crestFactorDb') IS DISTINCT FROM 'number' OR
       jsonb_typeof(v_metrics->'nearFullScaleSampleCount') IS DISTINCT FROM 'number' OR
       jsonb_typeof(v_metrics->'nearFullScaleRatio') IS DISTINCT FROM 'number' OR
       jsonb_typeof(v_metrics->'isNearFullScaleDetected') IS DISTINCT FROM 'boolean' OR
       jsonb_typeof(v_metrics->'leadingSilenceSeconds') IS DISTINCT FROM 'number' OR
       jsonb_typeof(v_metrics->'trailingSilenceSeconds') IS DISTINCT FROM 'number' OR
       jsonb_typeof(v_metrics->'totalLowLevelSeconds') IS DISTINCT FROM 'number' OR
       jsonb_typeof(v_metrics->'hasLowLevelRegions') IS DISTINCT FROM 'boolean' THEN
      RETURN false;
    END IF;

    v_ch_peak_val := (v_metrics->>'samplePeakDbfs')::numeric;
    v_ch_nfs_val := (v_metrics->>'nearFullScaleSampleCount')::numeric;

    -- Channel metric bounds
    IF v_ch_peak_val < -120.00 OR v_ch_peak_val > 6.00 OR
       (v_metrics->>'broadbandRmsDbfs')::numeric < -120.00 OR (v_metrics->>'broadbandRmsDbfs')::numeric > v_ch_peak_val OR
       v_ch_nfs_val != round(v_ch_nfs_val) OR v_ch_nfs_val < 0 OR
       (v_metrics->>'isNearFullScaleDetected')::boolean != (v_ch_nfs_val > 0) THEN
      RETURN false;
    END IF;

    -- Track primary channel for silence coupling
    IF v_i = 0 THEN
      v_ch0_metrics := v_metrics;
    END IF;

    -- Track aggregates
    IF v_ch_peak_val > v_max_ch_peak THEN
      v_max_ch_peak := v_ch_peak_val;
    END IF;
    v_sum_ch_nfs := v_sum_ch_nfs + v_ch_nfs_val;

    -- Channel waveformPeaks array
    v_ch_peaks := v_ch->'waveformPeaks';
    IF jsonb_typeof(v_ch_peaks) IS DISTINCT FROM 'array' OR jsonb_array_length(v_ch_peaks) != v_len THEN
      RETURN false;
    END IF;
    FOR v_k IN 0..(v_len - 1) LOOP
      IF jsonb_typeof(v_ch_peaks->v_k) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
      v_peak_val := (v_ch_peaks->>v_k)::numeric;
      IF v_peak_val < 0.0 OR v_peak_val > 1.0 THEN RETURN false; END IF;
    END LOOP;

    -- Low-level regions
    v_regions := v_ch->'lowLevelRegions';
    IF jsonb_typeof(v_regions) IS DISTINCT FROM 'array' THEN RETURN false; END IF;

    v_prev_end := 0.0;
    v_sum_dur := 0.0;
    v_len := jsonb_array_length(v_regions);

    IF v_len > 0 THEN
      FOR v_k IN 0..(v_len - 1) LOOP
        v_region := v_regions->v_k;
        IF jsonb_typeof(v_region) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
        IF NOT (v_region ?& ARRAY['startSeconds', 'endSeconds', 'durationSeconds']::text[]) THEN RETURN false; END IF;

        IF jsonb_typeof(v_region->'startSeconds') IS DISTINCT FROM 'number' OR
           jsonb_typeof(v_region->'endSeconds') IS DISTINCT FROM 'number' OR
           jsonb_typeof(v_region->'durationSeconds') IS DISTINCT FROM 'number' THEN
          RETURN false;
        END IF;

        v_r_start := (v_region->>'startSeconds')::numeric;
        v_r_end := (v_region->>'endSeconds')::numeric;
        v_r_dur := (v_region->>'durationSeconds')::numeric;

        IF v_r_start < 0.0 OR v_r_end <= v_r_start OR v_r_end > (p_duration + 0.05) THEN
          RETURN false;
        END IF;
        IF abs(v_r_dur - (v_r_end - v_r_start)) > 0.02 THEN
          RETURN false;
        END IF;
        IF v_r_start < (v_prev_end - 0.01) THEN
          RETURN false;
        END IF;

        v_prev_end := v_r_end;
        v_sum_dur := v_sum_dur + v_r_dur;
      END LOOP;
    END IF;

    -- Silence region totals
    IF v_len = 0 THEN
      IF (v_metrics->>'totalLowLevelSeconds')::numeric != 0.0 THEN RETURN false; END IF;
      IF (v_metrics->>'hasLowLevelRegions')::boolean IS NOT FALSE THEN RETURN false; END IF;
    ELSE
      IF abs((v_metrics->>'totalLowLevelSeconds')::numeric - v_sum_dur) > 0.05 THEN RETURN false; END IF;
      IF (v_metrics->>'hasLowLevelRegions')::boolean IS NOT TRUE THEN RETURN false; END IF;
    END IF;
  END LOOP;

  -- 9. Cross-channel aggregation checks
  IF abs((v_combined_metrics->>'samplePeakDbfs')::numeric - v_max_ch_peak) > 0.01 OR
     (v_combined_metrics->>'nearFullScaleSampleCount')::numeric != v_sum_ch_nfs THEN
    RETURN false;
  END IF;

  -- 10. Strict coupling: Combined silence must match primary channel silence
  IF abs((v_combined_metrics->>'leadingSilenceSeconds')::numeric - (v_ch0_metrics->>'leadingSilenceSeconds')::numeric) > 0.01 OR
     abs((v_combined_metrics->>'trailingSilenceSeconds')::numeric - (v_ch0_metrics->>'trailingSilenceSeconds')::numeric) > 0.01 OR
     abs((v_combined_metrics->>'totalLowLevelSeconds')::numeric - (v_ch0_metrics->>'totalLowLevelSeconds')::numeric) > 0.01 OR
     (v_combined_metrics->>'hasLowLevelRegions')::boolean != (v_ch0_metrics->>'hasLowLevelRegions')::boolean THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Table Creation
CREATE TABLE public.audio_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL,
  project_id uuid,
  file_name text NOT NULL,
  file_size_bytes bigint NOT NULL,
  file_hash_sha256 text,
  mime_type text NOT NULL,
  duration_seconds numeric(10, 3) NOT NULL,
  sample_rate integer NOT NULL,
  channel_count integer NOT NULL,
  sample_count_total bigint NOT NULL,
  sample_peak_dbfs numeric(6, 2) NOT NULL,
  true_peak_dbfs numeric(6, 2) NOT NULL,
  broadband_rms_dbfs numeric(6, 2) NOT NULL,
  crest_factor_db numeric(6, 2) NOT NULL,
  near_full_scale_count bigint NOT NULL,
  near_full_scale_ratio numeric(8, 6) NOT NULL,
  near_full_scale_detected boolean NOT NULL,
  clipping_event_count integer NOT NULL,
  clipping_detected boolean NOT NULL,
  diagnostics_payload jsonb NOT NULL,
  canonical_payload_sha256 text NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Foreign Keys
  CONSTRAINT fk_audio_analyses_studio 
    FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE,
  -- PostgreSQL 17 Column-Specific SET NULL preserves studio_id
  CONSTRAINT fk_audio_analyses_project 
    FOREIGN KEY (studio_id, project_id) 
    REFERENCES public.projects(studio_id, id) 
    ON DELETE SET NULL (project_id),
  CONSTRAINT fk_audio_analyses_creator 
    FOREIGN KEY (created_by) REFERENCES auth.users(id),

  -- Check Constraints
  CONSTRAINT ck_audio_analyses_duration_positive 
    CHECK (duration_seconds > 0.000),
  CONSTRAINT ck_audio_analyses_file_size_positive 
    CHECK (file_size_bytes > 0),
  CONSTRAINT ck_audio_analyses_sample_rate_valid 
    CHECK (sample_rate IN (44100, 48000, 88200, 96000, 176400, 192000)),
  CONSTRAINT ck_audio_analyses_channel_count_valid 
    CHECK (channel_count BETWEEN 1 AND 32),
  CONSTRAINT ck_audio_analyses_sample_count_math 
    CHECK (sample_count_total = round(duration_seconds * sample_rate::numeric)::bigint * channel_count),
  CONSTRAINT ck_audio_analyses_sample_peak_range 
    CHECK (sample_peak_dbfs BETWEEN -120.00 AND 6.00),
  CONSTRAINT ck_audio_analyses_true_peak_range 
    CHECK (true_peak_dbfs BETWEEN -120.00 AND 12.00),
  CONSTRAINT ck_audio_analyses_rms_range 
    CHECK (broadband_rms_dbfs BETWEEN -120.00 AND 6.00),
  CONSTRAINT ck_audio_analyses_rms_le_peak 
    CHECK (broadband_rms_dbfs <= sample_peak_dbfs),
  CONSTRAINT ck_audio_analyses_crest_factor_math 
    CHECK (
      (sample_peak_dbfs <= -120.00 AND crest_factor_db = 0.00) OR
      (sample_peak_dbfs > -120.00 AND crest_factor_db = (sample_peak_dbfs - broadband_rms_dbfs))
    ),
  CONSTRAINT ck_audio_analyses_nfs_ratio_math 
    CHECK (
      near_full_scale_count >= 0 AND
      near_full_scale_count <= sample_count_total AND
      near_full_scale_ratio = round(near_full_scale_count::numeric / sample_count_total::numeric, 6)
    ),
  CONSTRAINT ck_audio_analyses_nfs_detected_match 
    CHECK (near_full_scale_detected = (near_full_scale_count > 0)),
  CONSTRAINT ck_audio_analyses_clipping_detected_match 
    CHECK (clipping_detected = (clipping_event_count > 0)),
  CONSTRAINT ck_audio_analyses_jsonb_valid 
    CHECK (validate_audio_analysis_jsonb_payload(duration_seconds, (sample_count_total / channel_count), channel_count, diagnostics_payload))
);

-- 4. Indexes (Including Null-Safe Idempotency Index)
CREATE INDEX idx_audio_analyses_studio_created ON public.audio_analyses (studio_id, created_at DESC);
CREATE INDEX idx_audio_analyses_project_created ON public.audio_analyses (project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX idx_audio_analyses_idempotency ON public.audio_analyses (studio_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), canonical_payload_sha256);

-- 5. Immutability Trigger
CREATE OR REPLACE FUNCTION public.prevent_immutable_audio_analysis_updates()
RETURNS trigger AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR
     NEW.studio_id IS DISTINCT FROM OLD.studio_id OR
     NEW.file_name IS DISTINCT FROM OLD.file_name OR
     NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes OR
     NEW.file_hash_sha256 IS DISTINCT FROM OLD.file_hash_sha256 OR
     NEW.mime_type IS DISTINCT FROM OLD.mime_type OR
     NEW.duration_seconds IS DISTINCT FROM OLD.duration_seconds OR
     NEW.sample_rate IS DISTINCT FROM OLD.sample_rate OR
     NEW.channel_count IS DISTINCT FROM OLD.channel_count OR
     NEW.sample_count_total IS DISTINCT FROM OLD.sample_count_total OR
     NEW.sample_peak_dbfs IS DISTINCT FROM OLD.sample_peak_dbfs OR
     NEW.true_peak_dbfs IS DISTINCT FROM OLD.true_peak_dbfs OR
     NEW.broadband_rms_dbfs IS DISTINCT FROM OLD.broadband_rms_dbfs OR
     NEW.crest_factor_db IS DISTINCT FROM OLD.crest_factor_db OR
     NEW.near_full_scale_count IS DISTINCT FROM OLD.near_full_scale_count OR
     NEW.near_full_scale_ratio IS DISTINCT FROM OLD.near_full_scale_ratio OR
     NEW.near_full_scale_detected IS DISTINCT FROM OLD.near_full_scale_detected OR
     NEW.clipping_event_count IS DISTINCT FROM OLD.clipping_event_count OR
     NEW.clipping_detected IS DISTINCT FROM OLD.clipping_detected OR
     NEW.diagnostics_payload IS DISTINCT FROM OLD.diagnostics_payload OR
     NEW.canonical_payload_sha256 IS DISTINCT FROM OLD.canonical_payload_sha256 OR
     NEW.created_by IS DISTINCT FROM OLD.created_by OR
     NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'audio_analyses diagnostic fields are immutable' USING ERRCODE = 'P0001';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prevent_immutable_audio_analysis_updates
BEFORE UPDATE ON public.audio_analyses
FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_audio_analysis_updates();

-- 6. Row-Level Security Policies
ALTER TABLE public.audio_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view studio analyses with role scoping"
ON public.audio_analyses FOR SELECT TO authenticated
USING (
  public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role])
  OR (
    project_id IS NOT NULL
    AND public.has_role_on_studio(studio_id, ARRAY['artist'::public.user_role])
    AND EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.artists a ON a.studio_id = p.studio_id AND a.id = p.artist_id
      WHERE p.studio_id = audio_analyses.studio_id
        AND p.id = audio_analyses.project_id
        AND a.profile_id = auth.uid()
    )
  )
);

CREATE POLICY "Staff can insert audio analyses"
ON public.audio_analyses FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND
  public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role])
);

CREATE POLICY "Staff can update analysis notes and project"
ON public.audio_analyses FOR UPDATE TO authenticated
USING (
  public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role])
)
WITH CHECK (
  public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role])
);

CREATE POLICY "Staff can delete audio analyses"
ON public.audio_analyses FOR DELETE TO authenticated
USING (
  public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role])
  OR (
    created_by = auth.uid()
    AND public.has_role_on_studio(studio_id, ARRAY['engineer'::public.user_role])
  )
);

-- 7. Principle of Least Privilege Grants
GRANT SELECT, INSERT, DELETE ON public.audio_analyses TO authenticated;
GRANT UPDATE (notes, project_id) ON public.audio_analyses TO authenticated;

-- Revoke direct execution on internal trigger function
REVOKE ALL ON FUNCTION public.prevent_immutable_audio_analysis_updates() FROM PUBLIC, anon, authenticated;

-- Validator function grant strictly to authenticated
REVOKE ALL ON FUNCTION public.validate_audio_analysis_jsonb_payload(numeric, bigint, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_audio_analysis_jsonb_payload(numeric, bigint, integer, jsonb) TO authenticated;

COMMIT;
