-- Migration: 20261120160000_customer_portal_access_requests_and_rls.sql
-- Description: Security-hardened customer portal registration, access requests, atomic approval RPCs,
--              cross-tenant & customer data isolation, replacement of conflicting broad baseline RLS policies,
--              and strictly scoped project-deliverables storage bucket ownership.

BEGIN;

-- ============================================================================
-- 1. STUDIO ACCESS REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.studio_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  requested_artist_name text NOT NULL,
  genre text,
  phone text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_studio_request UNIQUE (studio_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_access_requests_studio_status ON public.studio_access_requests (studio_id, status);
CREATE INDEX IF NOT EXISTS idx_access_requests_user ON public.studio_access_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_artists_profile_id ON public.artists (profile_id);

-- Enable RLS
ALTER TABLE public.studio_access_requests ENABLE ROW LEVEL SECURITY;

-- Drop and recreate access request policies
DROP POLICY IF EXISTS "Users can view own access requests" ON public.studio_access_requests;
DROP POLICY IF EXISTS "Users can insert own access request" ON public.studio_access_requests;
DROP POLICY IF EXISTS "Staff can view studio access requests" ON public.studio_access_requests;
DROP POLICY IF EXISTS "Staff can update studio access requests" ON public.studio_access_requests;

CREATE POLICY "Users can view own access requests" ON public.studio_access_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own access request" ON public.studio_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can view studio access requests" ON public.studio_access_requests
  FOR SELECT TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]));

CREATE POLICY "Staff can update studio access requests" ON public.studio_access_requests
  FOR UPDATE TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]))
  WITH CHECK (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]));


-- ============================================================================
-- 2. REPLACE CONFLICTING BROAD BASELINE POLICIES (STUDIOS & PROFILES)
-- ============================================================================

-- Studios: Allow staff and approved/pending customers to view their studio metadata
DROP POLICY IF EXISTS "Users can view their studios" ON public.studios;
DROP POLICY IF EXISTS "Authorized users can view studios" ON public.studios;
CREATE POLICY "Authorized users can view studios" ON public.studios
  FOR SELECT TO authenticated
  USING (
    -- Studio staff members
    id IN (SELECT public.get_user_studios())
    OR
    -- Approved linked customers
    id IN (SELECT studio_id FROM public.artists WHERE profile_id = auth.uid())
    OR
    -- Pending applicants
    id IN (SELECT studio_id FROM public.studio_access_requests WHERE user_id = auth.uid() AND status = 'pending')
  );

-- Profiles: Allow staff to view applicant profiles for review
DROP POLICY IF EXISTS "Staff can view access request applicant profiles" ON public.profiles;
CREATE POLICY "Staff can view access request applicant profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT sar.user_id
      FROM public.studio_access_requests sar
      WHERE public.has_role_on_studio(sar.studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role])
    )
  );


-- ============================================================================
-- 3. REPLACE CONFLICTING BROAD BASELINE POLICIES (STUDIO MEMBERSHIPS)
-- ============================================================================

-- Replace broad "Members can view studio memberships" with staff-scoped visibility
DROP POLICY IF EXISTS "Members can view studio memberships" ON public.studio_memberships;
DROP POLICY IF EXISTS "Staff can view studio memberships" ON public.studio_memberships;
CREATE POLICY "Staff can view studio memberships" ON public.studio_memberships
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role])
    OR user_id = auth.uid()
  );


-- ============================================================================
-- 4. REPLACE CONFLICTING BROAD BASELINE POLICIES (ROOMS)
-- ============================================================================

-- Replace broad "Members can view rooms" with staff + approved linked customer + pending applicant
DROP POLICY IF EXISTS "Members can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authorized users can view rooms" ON public.rooms;
CREATE POLICY "Authorized users can view rooms" ON public.rooms
  FOR SELECT TO authenticated
  USING (
    -- Studio staff
    public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role])
    OR
    -- Approved linked customers
    studio_id IN (SELECT studio_id FROM public.artists WHERE profile_id = auth.uid())
    OR
    -- Pending applicants viewing catalog of the studio they applied to
    studio_id IN (SELECT studio_id FROM public.studio_access_requests WHERE user_id = auth.uid() AND status = 'pending')
  );


-- ============================================================================
-- 5. REPLACE CONFLICTING BROAD BASELINE POLICIES (ARTISTS)
-- ============================================================================

-- Fix: Remove the `studio_id IN (SELECT public.get_user_studios())` requirement that blocked customers
DROP POLICY IF EXISTS "Artists can view own record" ON public.artists;
CREATE POLICY "Artists can view own record" ON public.artists
  FOR SELECT TO authenticated
  USING (
    profile_id IS NOT NULL AND profile_id = auth.uid()
  );


-- ============================================================================
-- 6. REPLACE CONFLICTING BROAD BASELINE POLICIES (BOOKINGS)
-- ============================================================================

-- Drop broad "Members can view bookings"
DROP POLICY IF EXISTS "Members can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can view bookings" ON public.bookings;
CREATE POLICY "Staff can view bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role])
  );

-- Artists can view ONLY their own bookings
DROP POLICY IF EXISTS "Artists can view own bookings" ON public.bookings;
CREATE POLICY "Artists can view own bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    artist_id IN (SELECT id FROM public.artists WHERE profile_id = auth.uid())
  );

-- Artists can insert pending session requests for their own artist record
DROP POLICY IF EXISTS "Artists can insert own session requests" ON public.bookings;
CREATE POLICY "Artists can insert own session requests" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending' AND 
    artist_id IN (SELECT id FROM public.artists WHERE profile_id = auth.uid())
  );


-- ============================================================================
-- 7. REPLACE CONFLICTING BROAD BASELINE POLICIES (PROJECTS)
-- ============================================================================

-- Drop broad "Members can view projects"
DROP POLICY IF EXISTS "Members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Staff can view projects" ON public.projects;
CREATE POLICY "Staff can view projects" ON public.projects
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role])
  );

-- Artists can view ONLY their own projects
DROP POLICY IF EXISTS "Artists can view own projects" ON public.projects;
CREATE POLICY "Artists can view own projects" ON public.projects
  FOR SELECT TO authenticated
  USING (
    artist_id IN (SELECT id FROM public.artists WHERE profile_id = auth.uid())
  );


-- ============================================================================
-- 8. REPLACE CONFLICTING BROAD BASELINE POLICIES (INVOICES)
-- ============================================================================

-- Drop broad "Members can view invoices"
DROP POLICY IF EXISTS "Members can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Billing staff can view invoices" ON public.invoices;
CREATE POLICY "Billing staff can view invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role])
  );

-- Artists can view ONLY their own invoices
DROP POLICY IF EXISTS "Artists can view own invoices" ON public.invoices;
CREATE POLICY "Artists can view own invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    artist_id IN (SELECT id FROM public.artists WHERE profile_id = auth.uid())
  );


-- ============================================================================
-- 9. RPC FUNCTIONS FOR CONCURRENCY & ATOMIC REVIEW
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_studio_access_request(
  p_studio_id uuid,
  p_artist_id uuid,
  p_requested_artist_name text DEFAULT NULL,
  p_genre text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_req_id uuid;
  v_artist_name text;
  v_lock_key bigint;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit studio access request';
  END IF;

  -- Acquire advisory lock on target artist if linking requested
  IF p_artist_id IS NOT NULL THEN
    v_lock_key := ('x' || substr(md5('artist:' || p_studio_id::text || ':' || p_artist_id::text), 1, 16))::bit(64)::bigint;
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT name INTO v_artist_name FROM public.artists WHERE id = p_artist_id AND studio_id = p_studio_id;
  END IF;

  IF v_artist_name IS NULL THEN
    v_artist_name := COALESCE(NULLIF(trim(p_requested_artist_name), ''), 'Self-Registered Artist');
  END IF;

  INSERT INTO public.studio_access_requests (
    studio_id,
    user_id,
    artist_id,
    requested_artist_name,
    genre,
    phone,
    notes,
    status
  ) VALUES (
    p_studio_id,
    v_user_id,
    p_artist_id,
    v_artist_name,
    p_genre,
    p_phone,
    p_notes,
    'pending'
  )
  ON CONFLICT (studio_id, user_id) DO UPDATE SET
    artist_id = EXCLUDED.artist_id,
    requested_artist_name = EXCLUDED.requested_artist_name,
    genre = COALESCE(EXCLUDED.genre, studio_access_requests.genre),
    phone = COALESCE(EXCLUDED.phone, studio_access_requests.phone),
    notes = EXCLUDED.notes,
    status = 'pending',
    updated_at = now()
  RETURNING id INTO v_req_id;

  RETURN v_req_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_studio_access_request(
  p_request_id uuid,
  p_target_artist_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reviewer_id uuid;
  v_studio_id uuid;
  v_applicant_user_id uuid;
  v_lock_key bigint;
BEGIN
  v_reviewer_id := auth.uid();
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT studio_id, user_id INTO v_studio_id, v_applicant_user_id
  FROM public.studio_access_requests
  WHERE id = p_request_id;

  IF v_studio_id IS NULL THEN
    RAISE EXCEPTION 'Access request not found';
  END IF;

  -- Verify reviewer has owner or admin role on the studio
  IF NOT public.has_role_on_studio(v_studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]) THEN
    RAISE EXCEPTION 'Forbidden: Only owners and admins can approve studio access requests';
  END IF;

  -- Advisory lock on artist row
  v_lock_key := ('x' || substr(md5('artist:' || v_studio_id::text || ':' || p_target_artist_id::text), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Link artist to the applicant user profile
  UPDATE public.artists
  SET profile_id = v_applicant_user_id,
      status = 'active',
      updated_at = now()
  WHERE id = p_target_artist_id AND studio_id = v_studio_id;

  -- Mark access request as approved
  UPDATE public.studio_access_requests
  SET status = 'approved',
      artist_id = p_target_artist_id,
      reviewed_by = v_reviewer_id,
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_request_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_customer_studio_access(
  p_studio_id uuid,
  p_artist_id uuid,
  p_notes text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reviewer_id uuid;
  v_lock_key bigint;
BEGIN
  v_reviewer_id := auth.uid();
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.has_role_on_studio(p_studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]) THEN
    RAISE EXCEPTION 'Forbidden: Only owners and admins can revoke access';
  END IF;

  v_lock_key := ('x' || substr(md5('artist:' || p_studio_id::text || ':' || p_artist_id::text), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Unlink profile_id from artist
  UPDATE public.artists
  SET profile_id = NULL,
      updated_at = now()
  WHERE id = p_artist_id AND studio_id = p_studio_id;

  -- Mark any linked requests as revoked
  UPDATE public.studio_access_requests
  SET status = 'revoked',
      reviewed_by = v_reviewer_id,
      reviewed_at = now(),
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE studio_id = p_studio_id AND artist_id = p_artist_id;

  RETURN true;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON TABLE public.studio_access_requests TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_studio_access_request(uuid, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_studio_access_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_customer_studio_access(uuid, uuid, text) TO authenticated;


-- ============================================================================
-- 10. HARDENED STORAGE BUCKET & PATH-BASED OWNERSHIP RLS
-- ============================================================================
-- Path Convention: studio_id/project_id/file_name

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-deliverables',
  'project-deliverables',
  false,
  104857600, -- 100 MB max per file
  ARRAY['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/flac', 'audio/aac', 'application/zip', 'application/x-zip-compressed']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Staff can upload project deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update project deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete project deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can read project deliverables" ON storage.objects;

-- Storage RLS: Staff can upload project deliverables (studio_id & project_id verified)
CREATE POLICY "Staff can upload project deliverables" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-deliverables'
    AND array_length(storage.foldername(name), 1) >= 2
    AND public.has_role_on_studio(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]
    )
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = ((storage.foldername(name))[2])::uuid
        AND p.studio_id = ((storage.foldername(name))[1])::uuid
    )
  );

-- Storage RLS: Staff can update/replace project deliverables
CREATE POLICY "Staff can update project deliverables" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-deliverables'
    AND array_length(storage.foldername(name), 1) >= 2
    AND public.has_role_on_studio(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]
    )
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = ((storage.foldername(name))[2])::uuid
        AND p.studio_id = ((storage.foldername(name))[1])::uuid
    )
  )
  WITH CHECK (
    bucket_id = 'project-deliverables'
    AND array_length(storage.foldername(name), 1) >= 2
    AND public.has_role_on_studio(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]
    )
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = ((storage.foldername(name))[2])::uuid
        AND p.studio_id = ((storage.foldername(name))[1])::uuid
    )
  );

-- Storage RLS: Staff can delete project deliverables
CREATE POLICY "Staff can delete project deliverables" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-deliverables'
    AND array_length(storage.foldername(name), 1) >= 2
    AND public.has_role_on_studio(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]
    )
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = ((storage.foldername(name))[2])::uuid
        AND p.studio_id = ((storage.foldername(name))[1])::uuid
    )
  );

-- Storage RLS: Authorized staff and linked project artist can read deliverables
CREATE POLICY "Authorized users can read project deliverables" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-deliverables'
    AND array_length(storage.foldername(name), 1) >= 2
    AND (
      -- Studio Staff (Owner, Admin, Engineer)
      public.has_role_on_studio(
        ((storage.foldername(name))[1])::uuid,
        ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]
      )
      OR
      -- Approved linked artist for this specific project
      EXISTS (
        SELECT 1
        FROM public.projects p
        JOIN public.artists a ON a.id = p.artist_id
        WHERE p.id = ((storage.foldername(name))[2])::uuid
          AND p.studio_id = ((storage.foldername(name))[1])::uuid
          AND a.profile_id = auth.uid()
      )
    )
  );

COMMIT;
