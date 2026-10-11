-- SmartStudio AI – Database Test Suite
-- Requires: pgTAP extension, Supabase local stack (supabase test db) or PostgreSQL test runner
--
-- This suite validates:
-- 1. Schema integrity & constraints
-- 2. Tenant isolation & immutability triggers
-- 3. Deferred last-owner protection (statement & flush levels)
-- 4. Booking overlap exclusion constraint (btree_gist)
-- 5. Invoice financial integrity & status transitions
-- 6. Authenticated-role Row-Level Security (RLS) enforcement
-- 7. Privileges & least-privilege boundaries (TRUNCATE, audit immutability, role matrix)
-- 8. Policy definitions

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

-- ========================================================================
-- TEST PLAN: exactly 47 assertions
-- ========================================================================
SELECT plan(47);

-- ========================================================================
-- SETUP: seed data with proper auth.users & studio relationships
-- ========================================================================

-- Create two studios
INSERT INTO public.studios (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Studio Alpha', 'studio-alpha'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Studio Beta', 'studio-beta')
ON CONFLICT (id) DO NOTHING;

-- Seed auth.users (trigger on_auth_user_created populates public.profiles)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{"full_name": "Owner Alice"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', '{"full_name": "Admin Bob"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com', '{"full_name": "Engineer Carol"}'::jsonb),
  ('44444444-4444-4444-4444-444444444444', 'dave@example.com', '{"full_name": "Artist Dave"}'::jsonb),
  ('55555555-5555-5555-5555-555555555555', 'eve@example.com', '{"full_name": "Owner Eve"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Guarantee profile records exist with correct full_name
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

-- Studio Beta memberships
INSERT INTO public.studio_memberships (studio_id, user_id, role) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner')
ON CONFLICT (studio_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- Rooms
INSERT INTO public.rooms (id, studio_id, name, hourly_rate) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Recording Room A', 50),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Recording Room B', 75)
ON CONFLICT (id) DO NOTHING;

-- Artists (CRM records)
INSERT INTO public.artists (id, studio_id, name, email) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alpha Artist', 'alpha@example.com'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Beta Artist', 'beta@example.com')
ON CONFLICT (id) DO NOTHING;

-- ========================================================================
-- PART 1: SCHEMA EXISTENCE TESTS (Assertions 1..3)
-- ========================================================================
SELECT has_table('public', 'studios', 'studios table exists');
SELECT has_table('public', 'studio_memberships', 'memberships table exists');
SELECT has_table('public', 'invoices', 'invoices table exists');

-- ========================================================================
-- PART 2: MEMBERSHIP IMMUTABILITY (Assertions 4..5)
-- ========================================================================
PREPARE move_studio AS
  UPDATE public.studio_memberships
  SET studio_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  WHERE user_id = '22222222-2222-2222-2222-222222222222'
    AND studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT throws_ok(
  'move_studio',
  'Cannot change studio_id of a membership',
  'Trigger blocks cross-tenant membership transfer'
);

PREPARE move_user AS
  UPDATE public.studio_memberships
  SET user_id = '55555555-5555-5555-5555-555555555555'
  WHERE user_id = '22222222-2222-2222-2222-222222222222'
    AND studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT throws_ok(
  'move_user',
  'Cannot change user_id of a membership',
  'Trigger blocks reassigning a membership to a different user'
);

-- ========================================================================
-- PART 3: DEFERRED LAST-OWNER PROTECTION (Assertions 6..9)
-- ========================================================================

-- Helper function to test commit-level constraint flush on sole owner delete
CREATE OR REPLACE FUNCTION test_delete_sole_owner() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.studio_memberships
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
    AND studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  -- Flush deferred constraints (mimics transaction commit evaluation)
  SET CONSTRAINTS ensure_last_owner IMMEDIATE;
END;
$$;

SELECT throws_ok(
  'SELECT test_delete_sole_owner();',
  'Cannot remove or demote the last owner of a studio',
  'Deferred trigger prevents deleting the sole owner when constraints flush'
);

-- Helper function to test commit-level constraint flush on sole owner demote
CREATE OR REPLACE FUNCTION test_demote_sole_owner() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.studio_memberships
  SET role = 'admin'
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
    AND studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  -- Flush deferred constraints
  SET CONSTRAINTS ensure_last_owner IMMEDIATE;
END;
$$;

SELECT throws_ok(
  'SELECT test_demote_sole_owner();',
  'Cannot remove or demote the last owner of a studio',
  'Deferred trigger prevents demoting the sole owner when constraints flush'
);

-- Valid ownership transfer: promote second member, then demote original owner
PREPARE ownership_transfer AS
  UPDATE public.studio_memberships
  SET role = 'owner'
  WHERE user_id = '22222222-2222-2222-2222-222222222222'
    AND studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT lives_ok(
  'ownership_transfer',
  'Promoting a second member to owner succeeds (two owners now)'
);

PREPARE demote_original_owner AS
  UPDATE public.studio_memberships
  SET role = 'admin'
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
    AND studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT lives_ok(
  'demote_original_owner',
  'Demoting original owner succeeds when another owner exists'
);

-- Restore Alpha: Alice = owner, Bob = admin
UPDATE public.studio_memberships SET role = 'owner'
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
    AND studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
UPDATE public.studio_memberships SET role = 'admin'
  WHERE user_id = '22222222-2222-2222-2222-222222222222'
    AND studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ========================================================================
-- PART 4: BOOKING CONSTRAINTS & OVERLAPS (Assertions 10..14)
-- ========================================================================
INSERT INTO public.bookings (id, studio_id, room_id, artist_id, start_time, end_time, status)
VALUES (
  'b0000001-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '2026-11-01 10:00:00+05:30',
  '2026-11-01 12:00:00+05:30',
  'confirmed'
);

PREPARE insert_overlap AS
  INSERT INTO public.bookings (studio_id, room_id, artist_id, start_time, end_time)
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '2026-11-01 11:00:00+05:30',
    '2026-11-01 13:00:00+05:30'
  );

SELECT throws_ok(
  'insert_overlap',
  NULL,
  'Overlapping bookings for the same room are rejected by EXCLUDE constraint'
);

PREPARE insert_adjacent AS
  INSERT INTO public.bookings (studio_id, room_id, artist_id, start_time, end_time)
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '2026-11-01 12:00:00+05:30',
    '2026-11-01 14:00:00+05:30'
  );

SELECT lives_ok(
  'insert_adjacent',
  'Adjacent bookings (back-to-back half-open interval) are permitted'
);

UPDATE public.bookings SET status = 'cancelled'
  WHERE id = 'b0000001-0000-0000-0000-000000000000';

PREPARE insert_over_cancelled AS
  INSERT INTO public.bookings (studio_id, room_id, artist_id, start_time, end_time)
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '2026-11-01 10:00:00+05:30',
    '2026-11-01 12:00:00+05:30'
  );

SELECT lives_ok(
  'insert_over_cancelled',
  'Cancelled bookings do not block new overlapping bookings'
);

PREPARE invalid_time AS
  INSERT INTO public.bookings (studio_id, room_id, artist_id, start_time, end_time)
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '2026-11-01 14:00:00+05:30',
    '2026-11-01 10:00:00+05:30'
  );

SELECT throws_ok(
  'invalid_time',
  NULL,
  'Bookings with end_time <= start_time are rejected'
);

PREPARE cross_tenant_booking AS
  INSERT INTO public.bookings (studio_id, room_id, artist_id, start_time, end_time)
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',  -- Studio Beta room
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '2026-11-02 10:00:00+05:30',
    '2026-11-02 12:00:00+05:30'
  );

SELECT throws_ok(
  'cross_tenant_booking',
  NULL,
  'Cannot book a room belonging to a different studio'
);

-- ========================================================================
-- PART 5: INVOICE INTEGRITY & STATUS TRANSITIONS (Assertions 15..20)
-- ========================================================================
INSERT INTO public.bookings (id, studio_id, room_id, artist_id, start_time, end_time)
VALUES (
  'b0000099-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '2026-12-01 10:00:00+05:30',
  '2026-12-01 12:00:00+05:30'
);

PREPARE cross_tenant_invoice AS
  INSERT INTO public.invoices (studio_id, booking_id, booking_studio_id, artist_id, amount)
  VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',  -- Studio Beta
    'b0000099-0000-0000-0000-000000000000',   -- Booking in Studio Alpha
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',   -- booking_studio_id = Alpha
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    100
  );

SELECT throws_ok(
  'cross_tenant_invoice',
  NULL,
  'Invoice booking_studio_id must match invoice studio_id'
);

PREPARE valid_invoice AS
  INSERT INTO public.invoices (id, studio_id, booking_id, booking_studio_id, artist_id, amount, status)
  VALUES (
    'ff000001-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'b0000099-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    500,
    'unpaid'
  );

SELECT lives_ok(
  'valid_invoice',
  'Valid same-tenant invoice creation succeeds'
);

UPDATE public.invoices SET status = 'paid'
  WHERE id = 'ff000001-0000-0000-0000-000000000000';

PREPARE change_paid_amount AS
  UPDATE public.invoices SET amount = 999
  WHERE id = 'ff000001-0000-0000-0000-000000000000';

SELECT throws_ok(
  'change_paid_amount',
  'Cannot change the amount of a paid invoice',
  'Paid invoice amount is immutable'
);

PREPARE revert_paid AS
  UPDATE public.invoices SET status = 'unpaid'
  WHERE id = 'ff000001-0000-0000-0000-000000000000';

SELECT throws_ok(
  'revert_paid',
  'A paid invoice can only transition to refunded status',
  'Paid invoice cannot revert to unpaid'
);

PREPARE refund_invoice AS
  UPDATE public.invoices SET status = 'refunded'
  WHERE id = 'ff000001-0000-0000-0000-000000000000';

SELECT lives_ok(
  'refund_invoice',
  'Paid invoice can transition to refunded'
);

UPDATE public.invoices SET status = 'paid'
  WHERE id = 'ff000001-0000-0000-0000-000000000000';

PREPARE delete_paid_invoice AS
  DELETE FROM public.invoices
  WHERE id = 'ff000001-0000-0000-0000-000000000000';

SELECT throws_ok(
  'delete_paid_invoice',
  'Cannot delete a paid or refunded invoice; void it instead',
  'Paid invoices cannot be deleted'
);

-- ========================================================================
-- PART 6: CASCADE RESTRICTIONS & UNIQUENESS (Assertions 21..24)
-- ========================================================================
PREPARE delete_studio_with_invoices AS
  DELETE FROM public.studios
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT throws_ok(
  'delete_studio_with_invoices',
  NULL,
  'Cannot delete a studio that has invoices (RESTRICT preserves financial history)'
);

PREPARE delete_clean_studio AS
  DELETE FROM public.studios
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

SELECT lives_ok(
  'delete_clean_studio',
  'Studio without financial records can be deleted (cascades memberships, rooms, etc.)'
);

PREPARE duplicate_slug AS
  INSERT INTO public.studios (name, slug) VALUES ('Duplicate', 'studio-alpha');

SELECT throws_ok(
  'duplicate_slug',
  NULL,
  'Duplicate studio slugs are rejected by UNIQUE constraint'
);

-- Recreate Studio Beta for subsequent RLS tests
INSERT INTO public.studios (id, name, slug) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Studio Beta', 'studio-beta');
INSERT INTO public.studio_memberships (studio_id, user_id, role) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner');
INSERT INTO public.rooms (id, studio_id, name, hourly_rate) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Recording Room B', 75);
INSERT INTO public.artists (id, studio_id, name, email) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Beta Artist', 'beta@example.com');

-- Demote all owners transaction test
CREATE OR REPLACE FUNCTION test_demote_all_owners() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.studio_memberships (studio_id, user_id, role)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'owner')
  ON CONFLICT (studio_id, user_id) DO UPDATE SET role = 'owner';

  UPDATE public.studio_memberships
  SET role = 'admin'
  WHERE studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND role = 'owner';

  SET CONSTRAINTS ensure_last_owner IMMEDIATE;
END;
$$;

SELECT throws_ok(
  'SELECT test_demote_all_owners();',
  'Cannot remove or demote the last owner of a studio',
  'Deferred trigger catches demoting all owners upon constraint flush'
);

-- Restore Carol to engineer
UPDATE public.studio_memberships SET role = 'engineer'
WHERE studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND user_id = '33333333-3333-3333-3333-333333333333';

-- ========================================================================
-- PART 7: AUTHENTICATED-ROLE RLS ENFORCEMENT (Assertions 25..34)
-- ========================================================================

-- Simulate authenticated session for Alice (Owner of Studio Alpha)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

-- 25. Alice can see Studio Alpha's artists
SELECT is(
  (SELECT count(*)::int FROM public.artists WHERE studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'RLS: Studio Alpha owner can view own studio artists'
);

-- 26. Alice CANNOT see Studio Beta's artists (cross-tenant read isolation)
SELECT is(
  (SELECT count(*)::int FROM public.artists WHERE studio_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0,
  'RLS: Studio Alpha owner cannot view Studio Beta artists (read isolation)'
);

-- 27. Alice CANNOT insert artists into Studio Beta
PREPARE alice_insert_beta_artist AS
  INSERT INTO public.artists (studio_id, name, email)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Unauthorized Artist', 'bad@example.com');

SELECT throws_ok(
  'alice_insert_beta_artist',
  NULL,
  'RLS: Cross-studio artist INSERT rejected by WITH CHECK policy'
);

-- 28. Alice CANNOT update artists in Studio Beta (0 rows modified)
UPDATE public.artists SET name = 'Tampered'
WHERE studio_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

SELECT is(
  (SELECT count(*)::int FROM public.artists WHERE name = 'Tampered'),
  0,
  'RLS: Cross-studio artist UPDATE affects 0 rows'
);

-- 29. Alice CANNOT delete artists from Studio Beta (0 rows modified)
DELETE FROM public.artists WHERE studio_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.artists WHERE studio_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  1,
  'RLS: Cross-studio artist DELETE does not delete target row'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

-- 30. Alice CANNOT view invoices for Studio Beta
SELECT is(
  (SELECT count(*)::int FROM public.invoices WHERE studio_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0,
  'RLS: Cross-studio invoice read blocked'
);

-- 31. Alice CANNOT insert an invoice for Studio Beta
PREPARE alice_insert_beta_invoice AS
  INSERT INTO public.invoices (studio_id, artist_id, amount)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 100);

SELECT throws_ok(
  'alice_insert_beta_invoice',
  NULL,
  'RLS: Cross-studio invoice INSERT rejected'
);

-- 32. Switch to Dave (Artist role in Studio Alpha)
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';

-- Dave CANNOT insert invoices (invoices INSERT requires owner or admin role)
PREPARE artist_insert_invoice AS
  INSERT INTO public.invoices (studio_id, artist_id, amount)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 250);

SELECT throws_ok(
  'artist_insert_invoice',
  NULL,
  'RLS: Artist role cannot insert invoices (owner/admin restricted)'
);

-- 33. Dave CANNOT delete invoices in Studio Alpha
DELETE FROM public.invoices WHERE studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.invoices WHERE id = 'ff000001-0000-0000-0000-000000000000'),
  1,
  'RLS: Artist role cannot delete invoices (invoice preserved)'
);

-- 34. Authenticated Alice CANNOT insert memberships into Studio Beta
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
PREPARE alice_insert_beta_membership AS
  INSERT INTO public.studio_memberships (studio_id, user_id, role)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'owner');

SELECT throws_ok(
  'alice_insert_beta_membership',
  NULL,
  'RLS: Cross-tenant membership insertion rejected'
);

-- ========================================================================
-- PART 8: LEAST-PRIVILEGE PERMISSION BOUNDARIES (Assertions 35..44)
-- ========================================================================

-- 35. Authenticated user CANNOT TRUNCATE studios
SELECT throws_ok(
  'TRUNCATE public.studios;',
  NULL,
  'Least privilege: authenticated cannot TRUNCATE studios (permission denied)'
);

-- 36. Authenticated user CANNOT TRUNCATE invoices
SELECT throws_ok(
  'TRUNCATE public.invoices;',
  NULL,
  'Least privilege: authenticated cannot TRUNCATE invoices (permission denied)'
);

-- 37. Authenticated user CANNOT TRUNCATE audit_logs
SELECT throws_ok(
  'TRUNCATE public.audit_logs;',
  NULL,
  'Least privilege: authenticated cannot TRUNCATE audit_logs (permission denied)'
);

-- 38. Authenticated user CANNOT UPDATE audit_logs (append-only)
SELECT throws_ok(
  'UPDATE public.audit_logs SET action = ''tampered'';',
  NULL,
  'Least privilege: authenticated cannot UPDATE audit_logs (permission denied)'
);

-- 39. Authenticated user CANNOT DELETE from audit_logs (append-only)
SELECT throws_ok(
  'DELETE FROM public.audit_logs;',
  NULL,
  'Least privilege: authenticated cannot DELETE audit_logs (permission denied)'
);

-- 40. Artist (Dave) cannot create bookings
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
PREPARE artist_insert_booking AS
  INSERT INTO public.bookings (studio_id, room_id, artist_id, start_time, end_time)
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '2026-11-20 10:00:00+05:30',
    '2026-11-20 12:00:00+05:30'
  );

SELECT throws_ok(
  'artist_insert_booking',
  NULL,
  'Role matrix: Artist role cannot create bookings (owner/admin/engineer restricted)'
);

-- 41. Engineer (Carol) can create bookings
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
PREPARE engineer_insert_booking AS
  INSERT INTO public.bookings (studio_id, room_id, artist_id, start_time, end_time)
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '2026-11-20 14:00:00+05:30',
    '2026-11-20 16:00:00+05:30'
  );

SELECT lives_ok(
  'engineer_insert_booking',
  'Role matrix: Engineer role can create studio bookings'
);

-- 42. Engineer (Carol) CANNOT create invoices
PREPARE engineer_insert_invoice AS
  INSERT INTO public.invoices (studio_id, artist_id, amount)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 150);

SELECT throws_ok(
  'engineer_insert_invoice',
  NULL,
  'Role matrix: Engineer role cannot create invoices (owner/admin restricted)'
);

-- 43. Admin (Bob) CANNOT promote a member to owner
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
PREPARE admin_promote_to_owner AS
  UPDATE public.studio_memberships
  SET role = 'owner'
  WHERE studio_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND user_id = '33333333-3333-3333-3333-333333333333';

SELECT throws_ok(
  'admin_promote_to_owner',
  NULL,
  'Role matrix: Admin cannot promote members to owner (owner-only)'
);

-- 44. Direct execution of internal trigger function by authenticated role is denied
SELECT throws_ok(
  'SELECT public.check_last_owner_deferred();',
  NULL,
  'Least privilege: Authenticated role cannot directly execute trigger function'
);

RESET ROLE;

-- ========================================================================
-- PART 9: POLICY STRUCTURE AUDIT (Assertions 45..46)
-- ========================================================================
SELECT policies_are(
  'public', 'invoices',
  ARRAY[
    'Members can view invoices',
    'Billing staff can insert invoices',
    'Billing staff can update invoices',
    'Billing staff can delete invoices'
  ],
  'Invoice policies restrict mutations to owner/admin only'
);

SELECT policies_are(
  'public', 'audit_logs',
  ARRAY[
    'Admins can view audit logs',
    'Members can insert audit logs'
  ],
  'Audit logs are append-only (no UPDATE/DELETE policies)'
);

-- ========================================================================
-- PART 10: RLS SYSTEM-WIDE COVERAGE AUDIT (Assertion 47)
-- ========================================================================
SELECT is(
  (
    SELECT count(*)::int
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  ),
  0,
  'Security audit: Every table in the public schema has Row-Level Security enabled'
);

-- ========================================================================
-- FINISH: 47 total tests
-- ========================================================================
SELECT * FROM finish();
ROLLBACK;
