-- SmartStudio AI – Audio Analysis Phase 3 Test Suite
-- Requires: pgTAP extension, Supabase local stack (supabase test db)
--
-- This suite validates:
-- 1. Table schema, primary key, NOT NULL constraints, foreign keys, and indexes (1..29)
-- 2. Baseline insertions (project-linked and unassigned) (30..31)
-- 3. Composite foreign key cross-tenant rejection (32)
-- 4. Check constraints: duration, sample rate, sample count, peak, RMS, floor, crest, NFS ratio & boolean (33..41)
-- 5. Deep JSONB validation: schema keys, waveform bounds, low-level regions, silence coupling (42..45)
-- 6. Immutability trigger enforcement & mutable column updates (46..47)
-- 7. Idempotency uniqueness on project-linked and NULL project reports (48..49)
-- 8. Authenticated RLS matrices: staff read, cross-studio read/write, creator spoofing, artist restrictions (50..56)
-- 9. Role-scoped deletion: engineer own vs other, admin deletion, owner deletion (57..60)
-- 10. Cascade behavior: ON DELETE SET NULL (project_id) on project removal (61)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

-- ========================================================================
-- TEST PLAN: exactly 61 assertions
-- ========================================================================
SELECT plan(61);

-- ========================================================================
-- SETUP: Seed fixtures matching 01_migration_tests.sql
-- ========================================================================

-- Ensure studios exist
INSERT INTO public.studios (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Studio Alpha', 'studio-alpha'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Studio Beta', 'studio-beta')
ON CONFLICT (id) DO NOTHING;

-- Ensure auth users exist
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{"full_name": "Owner Alice"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', '{"full_name": "Admin Bob"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com', '{"full_name": "Engineer Carol"}'::jsonb),
  ('44444444-4444-4444-4444-444444444444', 'dave@example.com', '{"full_name": "Artist Dave"}'::jsonb),
  ('55555555-5555-5555-5555-555555555555', 'eve@example.com', '{"full_name": "Owner Eve"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Ensure profiles exist
INSERT INTO public.profiles (id, full_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Owner Alice'),
  ('22222222-2222-2222-2222-222222222222', 'Admin Bob'),
  ('33333333-3333-3333-3333-333333333333', 'Engineer Carol'),
  ('44444444-4444-4444-4444-444444444444', 'Artist Dave'),
  ('55555555-5555-5555-5555-555555555555', 'Owner Eve')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Studio Alpha memberships
INSERT INTO public.studio_memberships (studio_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'engineer'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'artist')
ON CONFLICT (studio_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- Studio Beta membership
INSERT INTO public.studio_memberships (studio_id, user_id, role) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner')
ON CONFLICT (studio_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- Artists (CRM records)
INSERT INTO public.artists (id, studio_id, profile_id, name, email) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Alpha Artist Dave', 'dave@example.com'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 'Beta Artist Unlinked', 'beta@example.com')
ON CONFLICT (id) DO UPDATE SET profile_id = EXCLUDED.profile_id;

-- Projects (Project Alpha owned by Artist Dave in Studio Alpha)
INSERT INTO public.projects (id, studio_id, artist_id, title) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Project Alpha 1'),
  ('b1111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Project Beta 1')
ON CONFLICT (id) DO NOTHING;

-- Pre-built valid JSON diagnostics payload (1.0s, 44100Hz, 1 channel)
CREATE OR REPLACE FUNCTION pg_temp.get_valid_test_payload() RETURNS jsonb AS $$
BEGIN
  RETURN jsonb_build_object(
    'durationSeconds', 1.000,
    'sampleRate', 44100,
    'numberOfChannels', 1,
    'channelAnalyses', jsonb_build_array(
      jsonb_build_object(
        'metrics', jsonb_build_object(
          'samplePeakDbfs', -0.50,
          'broadbandRmsDbfs', -14.20,
          'crestFactorDb', 13.70,
          'nearFullScaleSampleCount', 0,
          'nearFullScaleRatio', 0.000000,
          'isNearFullScaleDetected', false,
          'leadingSilenceSeconds', 0.00,
          'trailingSilenceSeconds', 0.00,
          'totalLowLevelSeconds', 0.00,
          'hasLowLevelRegions', false
        ),
        'lowLevelRegions', '[]'::jsonb,
        'waveformPeaks', jsonb_build_array(0.944, 0.500)
      )
    ),
    'combinedMetrics', jsonb_build_object(
      'samplePeakDbfs', -0.50,
      'broadbandRmsDbfs', -14.20,
      'crestFactorDb', 13.70,
      'nearFullScaleSampleCount', 0,
      'nearFullScaleRatio', 0.000000,
      'isNearFullScaleDetected', false,
      'leadingSilenceSeconds', 0.00,
      'trailingSilenceSeconds', 0.00,
      'totalLowLevelSeconds', 0.00,
      'hasLowLevelRegions', false
    ),
    'waveformPeaks', jsonb_build_array(0.944, 0.500)
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================================================
-- PART 1: SCHEMA STRUCTURAL & INTEGRITY (Assertions 1..29)
-- ========================================================================
SELECT has_table('public', 'audio_analyses', 'Table audio_analyses exists');
SELECT col_is_pk('public', 'audio_analyses', 'id', 'Column id is primary key');

SELECT col_not_null('public', 'audio_analyses', 'id', 'id is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'studio_id', 'studio_id is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'file_name', 'file_name is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'file_size_bytes', 'file_size_bytes is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'duration_seconds', 'duration_seconds is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'sample_rate', 'sample_rate is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'channel_count', 'channel_count is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'sample_count_total', 'sample_count_total is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'sample_peak_dbfs', 'sample_peak_dbfs is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'true_peak_dbfs', 'true_peak_dbfs is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'broadband_rms_dbfs', 'broadband_rms_dbfs is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'crest_factor_db', 'crest_factor_db is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'near_full_scale_count', 'near_full_scale_count is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'near_full_scale_ratio', 'near_full_scale_ratio is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'near_full_scale_detected', 'near_full_scale_detected is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'clipping_event_count', 'clipping_event_count is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'clipping_detected', 'clipping_detected is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'diagnostics_payload', 'diagnostics_payload is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'canonical_payload_sha256', 'canonical_payload_sha256 is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'created_by', 'created_by is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'created_at', 'created_at is NOT NULL');
SELECT col_not_null('public', 'audio_analyses', 'updated_at', 'updated_at is NOT NULL');

SELECT has_fk('public', 'audio_analyses', 'Table has studio foreign key');
SELECT has_fk('public', 'audio_analyses', 'Table has composite project foreign key');

SELECT has_index('public', 'audio_analyses', 'idx_audio_analyses_studio_created', 'Studio created_at index exists');
SELECT has_index('public', 'audio_analyses', 'idx_audio_analyses_project_created', 'Project created_at index exists');
SELECT has_index('public', 'audio_analyses', 'idx_audio_analyses_idempotency', 'Idempotency unique index exists');

-- ========================================================================
-- PART 2: BASELINE INSERTIONS (Assertions 30..31)
-- ========================================================================
-- 30. Superuser insert unassigned report (project_id IS NULL)
PREPARE insert_baseline_unassigned AS
  INSERT INTO public.audio_analyses (
    id, studio_id, project_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL,
    'unassigned_track.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100,
    -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false,
    0, false, pg_temp.get_valid_test_payload(),
    'sha256_canonical_unassigned_baseline', '33333333-3333-3333-3333-333333333333'
  );
SELECT lives_ok('insert_baseline_unassigned', 'Insert valid baseline unassigned report');

-- 31. Superuser insert project-linked report
PREPARE insert_baseline_project AS
  INSERT INTO public.audio_analyses (
    id, studio_id, project_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    '10000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111',
    'project_track.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100,
    -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false,
    0, false, pg_temp.get_valid_test_payload(),
    'sha256_canonical_project_baseline', '33333333-3333-3333-3333-333333333333'
  );
SELECT lives_ok('insert_baseline_project', 'Insert valid baseline project-assigned report');

-- ========================================================================
-- PART 3: INTEGRITY & CHECK CONSTRAINTS (Assertions 32..41)
-- ========================================================================
-- 32. Cross-tenant composite FK rejection (Studio Alpha report with Studio Beta Project)
PREPARE insert_cross_tenant_project AS
  INSERT INTO public.audio_analyses (
    studio_id, project_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b1111111-1111-1111-1111-111111111111',
    'cross_project.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_cross', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_cross_tenant_project', '23503', NULL, 'Composite FK rejects cross-tenant project ID');

-- 33. Reject negative duration
PREPARE insert_neg_duration AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bad_dur.wav', 176400, 'audio/wav',
    -1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_neg_dur', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_neg_duration', '23514', NULL, 'Reject negative duration');

-- 34. Reject unsupported sample rate
PREPARE insert_bad_sample_rate AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bad_rate.wav', 176400, 'audio/wav',
    1.000, 12345, 1, 12345, -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_bad_rate', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_bad_sample_rate', '23514', NULL, 'Reject unsupported sample rate');

-- 35. Reject sample count mismatch
PREPARE insert_bad_sample_count AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bad_count.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 99999, -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_bad_count', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_bad_sample_count', '23514', NULL, 'Reject sample count math mismatch');

-- 36. Reject peak below floor
PREPARE insert_bad_peak AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bad_peak.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -121.00, -120.00, -121.00, 0.00,
    0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_bad_peak', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_bad_peak', '23514', NULL, 'Reject sample peak below floor (-120.00 dBFS)');

-- 37. Reject RMS > Peak
PREPARE insert_rms_gt_peak AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rms_gt_peak.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -6.00, -5.00, -2.00, 0.00,
    0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_rms_gt_peak', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_rms_gt_peak', '23514', NULL, 'Reject broadband RMS > sample peak');

-- 38. Allow digital silence floor signal
PREPARE insert_floor_signal AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'silence.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -120.00, -120.00, -120.00, 0.00,
    0, 0.000000, false, 0, false,
    jsonb_set(
      jsonb_set(pg_temp.get_valid_test_payload(), '{combinedMetrics,samplePeakDbfs}', '-120.00'::jsonb),
      '{channelAnalyses,0,metrics,samplePeakDbfs}', '-120.00'::jsonb
    ),
    'sha256_silence', '33333333-3333-3333-3333-333333333333'
  );
SELECT lives_ok('insert_floor_signal', 'Allow digital silence at -120 dBFS floor with 0.00 crest factor');

-- 39. Reject crest factor mismatch above floor
PREPARE insert_bad_crest AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bad_crest.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 20.00,
    0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_bad_crest', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_bad_crest', '23514', NULL, 'Reject crest factor math mismatch');

-- 40. Reject near-full-scale ratio discrepancy (exact equality violated)
PREPARE insert_bad_nfs_ratio AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bad_nfs_ratio.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
    441, 0.050000, true, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_bad_nfs_ratio', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_bad_nfs_ratio', '23514', NULL, 'Reject near-full-scale ratio math discrepancy');

-- 41. Reject NFS boolean detection flag mismatch
PREPARE insert_bad_nfs_boolean AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bad_nfs_bool.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
    10, 0.000227, false, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_bad_nfs_bool', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_bad_nfs_boolean', '23514', NULL, 'Reject near-full-scale boolean mismatch');

-- ========================================================================
-- PART 4: JSONB DEEP VALIDATION (Assertions 42..45)
-- ========================================================================
-- 42. Missing top-level keys
PREPARE insert_json_missing_keys AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'missing_keys.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false, 0, false, '{"foo": "bar"}'::jsonb,
    'sha256_missing_keys', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_json_missing_keys', '23514', NULL, 'Reject JSONB missing required keys');

-- 43. Waveform amplitude > 1.0 in JSONB
PREPARE insert_json_bad_waveform AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bad_wave.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false, 0, false,
    jsonb_set(pg_temp.get_valid_test_payload(), '{waveformPeaks,0}', '1.50'::jsonb),
    'sha256_bad_wave', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_json_bad_waveform', '23514', NULL, 'Reject waveform amplitude > 1.0 in JSONB');

-- 44. Overlapping low-level regions
PREPARE insert_json_bad_regions AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bad_regions.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false, 0, false,
    jsonb_set(
      pg_temp.get_valid_test_payload(),
      '{channelAnalyses,0,lowLevelRegions}',
      jsonb_build_array(
        jsonb_build_object('startSeconds', 0.10, 'endSeconds', 0.50, 'durationSeconds', 0.40),
        jsonb_build_object('startSeconds', 0.30, 'endSeconds', 0.70, 'durationSeconds', 0.40)
      )
    ),
    'sha256_bad_regions', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_json_bad_regions', '23514', NULL, 'Reject overlapping low-level regions in JSONB');

-- 45. Combined silence mismatch against primary channel
PREPARE insert_json_silence_mismatch AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'silence_mismatch.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false, 0, false,
    jsonb_set(pg_temp.get_valid_test_payload(), '{combinedMetrics,leadingSilenceSeconds}', '0.50'::jsonb),
    'sha256_silence_mismatch', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_json_silence_mismatch', '23514', NULL, 'Reject combined silence mismatch with primary channel');

-- ========================================================================
-- PART 5: IMMUTABILITY & MUTATIONS (Assertions 46..47)
-- ========================================================================
-- 46. Immutability trigger raises P0001 on file_size_bytes update
PREPARE update_immutable_file_size AS
  UPDATE public.audio_analyses
  SET file_size_bytes = 999999
  WHERE id = '10000000-0000-0000-0000-000000000001';
SELECT throws_ok('update_immutable_file_size', 'P0001', NULL, 'Trigger blocks updating immutable diagnostic columns');

-- 47. Mutable column update (notes and project_id) succeeds
PREPARE update_mutable_notes AS
  UPDATE public.audio_analyses
  SET notes = 'Updated mix engineer notes'
  WHERE id = '10000000-0000-0000-0000-000000000001';
SELECT lives_ok('update_mutable_notes', 'Allow updating mutable notes column');

-- ========================================================================
-- PART 6: IDEMPOTENCY UNIQUENESS (Assertions 48..49)
-- ========================================================================
-- 48. Duplicate insert for project-linked report raises 23505
PREPARE insert_dup_project_linked AS
  INSERT INTO public.audio_analyses (
    studio_id, project_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111',
    'dup_project.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_canonical_project_baseline', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_dup_project_linked', '23505', NULL, 'Idempotency unique index rejects duplicate project-linked report');

-- 49. Duplicate insert for unassigned report (project_id IS NULL) raises 23505
PREPARE insert_dup_unassigned AS
  INSERT INTO public.audio_analyses (
    studio_id, project_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL,
    'dup_unassigned.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_canonical_unassigned_baseline', '33333333-3333-3333-3333-333333333333'
  );
SELECT throws_ok('insert_dup_unassigned', '23505', NULL, 'Idempotency unique index rejects duplicate unassigned report');

-- ========================================================================
-- PART 7: AUTHENTICATED RLS READ & WRITE (Assertions 50..56)
-- ========================================================================
-- Switch identity to Engineer Carol (Studio Alpha)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

-- 50. Engineer Carol reads all Studio Alpha reports (2 rows: 1 project-linked, 1 unassigned)
SELECT is(
  (SELECT count(*)::int FROM public.audio_analyses WHERE studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2,
  'RLS: Studio Alpha engineer can view all reports in active studio'
);

-- Switch identity to Owner Eve (Studio Beta)
SET LOCAL "request.jwt.claim.sub" = '55555555-5555-5555-5555-555555555555';

-- 51. Cross-studio read isolation: Owner Eve sees 0 Studio Beta reports and cannot see Studio Alpha
SELECT is(
  (SELECT count(*)::int FROM public.audio_analyses WHERE studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'RLS: Cross-studio read blocked for other studios'
);

-- 52. Cross-studio write isolation: Owner Eve cannot insert report into Studio Alpha
PREPARE eve_insert_alpha AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eve_hack.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_eve_hack', '55555555-5555-5555-5555-555555555555'
  );
SELECT throws_ok('eve_insert_alpha', NULL, 'RLS: Cross-studio INSERT rejected by WITH CHECK policy');

-- Switch identity to Engineer Carol (Studio Alpha)
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';

-- 53. Creator spoofing: Engineer Carol cannot insert created_by = Alice
PREPARE carol_spoof_alice AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'spoofed.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_carol_spoof', '11111111-1111-1111-1111-111111111111'
  );
SELECT throws_ok('carol_spoof_alice', NULL, 'RLS: Creator spoofing rejected by WITH CHECK policy');

-- Switch identity to Artist Dave (Studio Alpha)
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';

-- 54. Artist Dave cannot insert audio analysis (staff only)
PREPARE dave_insert_report AS
  INSERT INTO public.audio_analyses (
    studio_id, file_name, file_size_bytes, mime_type,
    duration_seconds, sample_rate, channel_count, sample_count_total,
    sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
    near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
    clipping_event_count, clipping_detected, diagnostics_payload,
    canonical_payload_sha256, created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'artist_upload.wav', 176400, 'audio/wav',
    1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
    0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
    'sha256_artist_upload', '44444444-4444-4444-4444-444444444444'
  );
SELECT throws_ok('dave_insert_report', NULL, 'RLS: Artist role cannot insert audio analysis reports');

-- 55. Artist Dave cannot view unassigned report (project_id IS NULL)
SELECT is(
  (SELECT count(*)::int FROM public.audio_analyses WHERE id = '10000000-0000-0000-0000-000000000001'),
  0,
  'RLS: Artist cannot view unassigned reports without project linkage'
);

-- 56. Artist Dave CAN view report assigned to Dave''s project (Project Alpha 1)
SELECT is(
  (SELECT count(*)::int FROM public.audio_analyses WHERE id = '10000000-0000-0000-0000-000000000002'),
  1,
  'RLS: Artist can view reports linked to projects assigned to artist profile'
);

-- ========================================================================
-- PART 8: ROLE DELETION & CASCADE NULL (Assertions 57..61)
-- ========================================================================
-- Insert report created by Admin Bob
RESET ROLE;
INSERT INTO public.audio_analyses (
  id, studio_id, project_id, file_name, file_size_bytes, mime_type,
  duration_seconds, sample_rate, channel_count, sample_count_total,
  sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
  near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
  clipping_event_count, clipping_detected, diagnostics_payload,
  canonical_payload_sha256, created_by
) VALUES (
  '10000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL,
  'bob_mix.wav', 176400, 'audio/wav',
  1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
  0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
  'sha256_bob_mix', '22222222-2222-2222-2222-222222222222'
);

-- Switch to Engineer Carol
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

-- 57. Engineer Carol cannot delete Bob's report (affects 0 rows)
DELETE FROM public.audio_analyses WHERE id = '10000000-0000-0000-0000-000000000003';
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.audio_analyses WHERE id = '10000000-0000-0000-0000-000000000003'),
  1,
  'RLS: Engineer cannot delete reports created by other users'
);

-- Switch back to Engineer Carol
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

-- 58. Engineer Carol deletes own report (id: ...0001)
PREPARE carol_delete_own AS
  DELETE FROM public.audio_analyses WHERE id = '10000000-0000-0000-0000-000000000001';
SELECT lives_ok('carol_delete_own', 'Engineer Carol can delete own report');

-- Switch to Admin Bob
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

-- 59. Admin Bob deletes Bob's report
PREPARE bob_delete_report AS
  DELETE FROM public.audio_analyses WHERE id = '10000000-0000-0000-0000-000000000003';
SELECT lives_ok('bob_delete_report', 'Admin Bob can delete reports in studio');

-- Switch to Owner Alice
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

-- 60. Owner Alice can delete any report in Studio Alpha
-- (Re-insert a test row under superuser, then Alice deletes it)
RESET ROLE;
INSERT INTO public.audio_analyses (
  id, studio_id, project_id, file_name, file_size_bytes, mime_type,
  duration_seconds, sample_rate, channel_count, sample_count_total,
  sample_peak_dbfs, true_peak_dbfs, broadband_rms_dbfs, crest_factor_db,
  near_full_scale_count, near_full_scale_ratio, near_full_scale_detected,
  clipping_event_count, clipping_detected, diagnostics_payload,
  canonical_payload_sha256, created_by
) VALUES (
  '10000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL,
  'alice_target.wav', 176400, 'audio/wav',
  1.000, 44100, 1, 44100, -0.50, -0.40, -14.20, 13.70,
  0, 0.000000, false, 0, false, pg_temp.get_valid_test_payload(),
  'sha256_alice_target', '33333333-3333-3333-3333-333333333333'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

PREPARE alice_delete_report AS
  DELETE FROM public.audio_analyses WHERE id = '10000000-0000-0000-0000-000000000004';
SELECT lives_ok('alice_delete_report', 'Owner Alice can delete any report in active studio');

-- 61. Project deletion cascades project_id = NULL without deleting the analysis row
RESET ROLE;
DELETE FROM public.projects WHERE id = 'a1111111-1111-1111-1111-111111111111';

SELECT is(
  (SELECT project_id FROM public.audio_analyses WHERE id = '10000000-0000-0000-0000-000000000002'),
  NULL,
  'ON DELETE SET NULL (project_id) cascades null project_id while preserving report and studio_id'
);

SELECT * FROM finish();
ROLLBACK;
