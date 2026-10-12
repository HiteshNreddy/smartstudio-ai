-- SmartStudio AI – Supabase Schema Migration
-- Version: 2026-10-11 (security-hardened)
--
-- This migration creates the complete schema for a multi-tenant music studio
-- management platform. Every table is tenant-isolated by studio_id with RLS.

-- ============================================================================
-- 1. CUSTOM TYPES
-- ============================================================================
CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'engineer', 'artist');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.project_status AS ENUM ('in-progress', 'mixing', 'mastering', 'delivered', 'on-hold');

-- ============================================================================
-- 2. STUDIOS (Tenant root)
-- ============================================================================
CREATE TABLE public.studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. PROFILES (extends auth.users)
-- ============================================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. STUDIO MEMBERSHIPS (Tenant isolation & roles)
-- ============================================================================
CREATE TABLE public.studio_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'artist',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(studio_id, user_id)
);

-- ============================================================================
-- 4a. STUDIO ONBOARDING (atomic, secure)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_studio(studio_name text, studio_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_studio_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF studio_slug !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' OR length(studio_slug) < 3 THEN
    RAISE EXCEPTION 'Invalid slug: 3+ chars, lowercase alphanumeric and dashes, no leading/trailing dash.';
  END IF;

  INSERT INTO public.studios (name, slug)
  VALUES (studio_name, studio_slug)
  RETURNING id INTO new_studio_id;

  INSERT INTO public.studio_memberships (studio_id, user_id, role)
  VALUES (new_studio_id, auth.uid(), 'owner'::public.user_role);

  RETURN new_studio_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_studio(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_studio(text, text) TO authenticated;

-- ============================================================================
-- 4b. MEMBERSHIP IMMUTABILITY (prevent cross-tenant moves)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_immutable_membership_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.studio_id IS DISTINCT FROM OLD.studio_id THEN
    RAISE EXCEPTION 'Cannot change studio_id of a membership';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change user_id of a membership';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_immutable_membership_updates() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER prevent_membership_moves
  BEFORE UPDATE ON public.studio_memberships
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_membership_updates();

-- ============================================================================
-- 4c. LAST-OWNER PROTECTION (concurrency-safe with row lock)
--
-- Strategy: A deferred constraint trigger fires at COMMIT time. It acquires
-- a FOR UPDATE lock on the studio row to serialize concurrent owner removals.
-- If two transactions each try to remove the last owner, the first to commit
-- acquires the lock and succeeds; the second blocks on the lock, then
-- re-checks and finds zero owners, raising an exception.
-- When the studio itself is deleted (CASCADE), the studio row is gone so
-- the lock SELECT returns nothing and the check is skipped.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_last_owner_deferred()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  owner_count int;
  locked_studio_id uuid;
BEGIN
  -- Acquire an exclusive row lock on the studio to serialize concurrent
  -- owner-removal transactions. If the studio was cascade-deleted, this
  -- SELECT returns no rows and we skip the check entirely.
  SELECT id INTO locked_studio_id
  FROM public.studios
  WHERE id = OLD.studio_id
  FOR UPDATE;

  IF locked_studio_id IS NOT NULL THEN
    SELECT count(*) INTO owner_count
    FROM public.studio_memberships
    WHERE studio_id = OLD.studio_id AND role = 'owner';

    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove or demote the last owner of a studio';
    END IF;
  END IF;

  RETURN NULL; -- AFTER trigger, return value is ignored
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_last_owner_deferred() FROM PUBLIC, anon, authenticated;

CREATE CONSTRAINT TRIGGER ensure_last_owner
  AFTER UPDATE OR DELETE ON public.studio_memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.role = 'owner')
  EXECUTE FUNCTION public.check_last_owner_deferred();

-- ============================================================================
-- 5. ROOMS
-- ============================================================================
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  hourly_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(studio_id, id)
);

-- ============================================================================
-- 6. ARTISTS (CRM records, optionally linked to a user account)
-- ============================================================================
CREATE TABLE public.artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  genre text,
  email text,
  phone text,
  status text DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(studio_id, id)
);

-- ============================================================================
-- 7. BOOKINGS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  room_id uuid NOT NULL,
  artist_id uuid NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_booking_room FOREIGN KEY (studio_id, room_id)
    REFERENCES public.rooms(studio_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_artist FOREIGN KEY (studio_id, artist_id)
    REFERENCES public.artists(studio_id, id) ON DELETE CASCADE,
  CONSTRAINT valid_time_range CHECK (start_time < end_time),
  CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status != 'cancelled'),
  UNIQUE(studio_id, id)
);

-- ============================================================================
-- 8. PROJECTS
-- ============================================================================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL,
  title text NOT NULL,
  type text,
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  tracks integer DEFAULT 1,
  deadline timestamptz,
  status public.project_status DEFAULT 'in-progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_project_artist FOREIGN KEY (studio_id, artist_id)
    REFERENCES public.artists(studio_id, id) ON DELETE CASCADE
);

-- ============================================================================
-- 9. INVOICES
--
-- Financial records use RESTRICT on studio deletion to prevent silent data loss.
-- booking_id uses ON DELETE SET NULL to preserve invoice history when bookings
-- are removed. MATCH FULL ensures both booking columns are null or both non-null.
-- ============================================================================
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  booking_id uuid,
  booking_studio_id uuid,
  artist_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'unpaid',
  due_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_invoice_booking FOREIGN KEY (booking_studio_id, booking_id)
    REFERENCES public.bookings(studio_id, id)
    MATCH FULL ON DELETE SET NULL,
  CONSTRAINT check_invoice_booking_tenant CHECK (
    booking_studio_id IS NULL OR booking_studio_id = studio_id
  ),
  CONSTRAINT fk_invoice_artist FOREIGN KEY (studio_id, artist_id)
    REFERENCES public.artists(studio_id, id) ON DELETE RESTRICT
);

-- Protect paid invoices from amount/status changes
CREATE OR REPLACE FUNCTION public.protect_paid_invoices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'paid' THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      RAISE EXCEPTION 'Cannot change the amount of a paid invoice';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status != 'refunded' THEN
      RAISE EXCEPTION 'A paid invoice can only transition to refunded status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_paid_invoices() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER protect_paid_invoices_trigger
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.protect_paid_invoices();

-- Prevent deletion of paid/refunded invoices
CREATE OR REPLACE FUNCTION public.prevent_paid_invoice_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('paid', 'refunded') THEN
    RAISE EXCEPTION 'Cannot delete a paid or refunded invoice; void it instead';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_paid_invoice_deletion() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER prevent_paid_invoice_deletion_trigger
  BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_invoice_deletion();

-- ============================================================================
-- 10. AUDIT LOGS
--
-- Uses RESTRICT on studio deletion so audit history is never silently discarded.
-- user_id is server-enforced via trigger.
-- ============================================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.enforce_audit_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_audit_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER before_insert_audit_logs
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_user();

-- ============================================================================
-- 11. INDEXES
-- ============================================================================
CREATE INDEX idx_memberships_user ON public.studio_memberships(user_id);
CREATE INDEX idx_memberships_studio ON public.studio_memberships(studio_id);
CREATE INDEX idx_rooms_studio ON public.rooms(studio_id);
CREATE INDEX idx_artists_studio ON public.artists(studio_id);
CREATE INDEX idx_artists_profile ON public.artists(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_bookings_studio ON public.bookings(studio_id);
CREATE INDEX idx_bookings_room_time ON public.bookings(room_id, start_time, end_time);
CREATE INDEX idx_projects_studio ON public.projects(studio_id);
CREATE INDEX idx_invoices_studio ON public.invoices(studio_id);
CREATE INDEX idx_audit_logs_studio ON public.audit_logs(studio_id);

-- ============================================================================
-- 12. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 13. RLS HELPER FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_studios()
RETURNS SETOF uuid
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT studio_id FROM public.studio_memberships WHERE user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_user_studios() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_studios() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_role_on_studio(
  check_studio_id uuid,
  required_roles public.user_role[]
)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_memberships
    WHERE user_id = auth.uid()
      AND studio_id = check_studio_id
      AND role = ANY(required_roles)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_role_on_studio(uuid, public.user_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role_on_studio(uuid, public.user_role[]) TO authenticated;

-- ============================================================================
-- 14. RLS POLICIES
-- ============================================================================

-- Studios ---------------------------------------------------------------
CREATE POLICY "Users can view their studios" ON public.studios
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_studios()));

-- No direct INSERT/UPDATE/DELETE; studios are created via create_studio(),
-- and studio settings updates can be added later with owner-only policies.

-- Profiles --------------------------------------------------------------
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can view co-member profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT sm.user_id FROM public.studio_memberships sm
      WHERE sm.studio_id IN (SELECT public.get_user_studios())
    )
  );

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Memberships -----------------------------------------------------------
-- SELECT: any member can see memberships within their studios.
CREATE POLICY "Members can view studio memberships" ON public.studio_memberships
  FOR SELECT TO authenticated
  USING (studio_id IN (SELECT public.get_user_studios()));

-- INSERT: owners and admins can invite. Only owners can assign owner role.
-- Users cannot insert a membership for themselves (prevents self-invitation).
CREATE POLICY "Staff can invite members" ON public.studio_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id != auth.uid()
    AND public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role])
    AND (
      role != 'owner'
      OR public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role])
    )
  );

-- UPDATE: owners can change any role. Admins can change non-owner roles to
-- non-owner roles. Nobody can promote to owner except an existing owner.
-- Nobody can change their own role (prevents self-promotion).
CREATE POLICY "Staff can update member roles" ON public.studio_memberships
  FOR UPDATE TO authenticated
  USING (
    user_id != auth.uid()
    AND (
      public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role])
      OR (
        public.has_role_on_studio(studio_id, ARRAY['admin'::public.user_role])
        AND role != 'owner'
      )
    )
  )
  WITH CHECK (
    user_id != auth.uid()
    AND (
      public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role])
      OR (
        public.has_role_on_studio(studio_id, ARRAY['admin'::public.user_role])
        AND role != 'owner'
      )
    )
  );

-- DELETE: owners can remove anyone. Admins can remove non-owners.
-- Nobody can remove themselves (use a dedicated leave function if needed).
CREATE POLICY "Staff can remove members" ON public.studio_memberships
  FOR DELETE TO authenticated
  USING (
    user_id != auth.uid()
    AND (
      public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role])
      OR (
        public.has_role_on_studio(studio_id, ARRAY['admin'::public.user_role])
        AND role != 'owner'
      )
    )
  );

-- Rooms -----------------------------------------------------------------
CREATE POLICY "Members can view rooms" ON public.rooms
  FOR SELECT TO authenticated
  USING (studio_id IN (SELECT public.get_user_studios()));

CREATE POLICY "Admins can insert rooms" ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]));

CREATE POLICY "Admins can update rooms" ON public.rooms
  FOR UPDATE TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]))
  WITH CHECK (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]));

CREATE POLICY "Admins can delete rooms" ON public.rooms
  FOR DELETE TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]));

-- Artists ---------------------------------------------------------------
CREATE POLICY "Staff can view artists" ON public.artists
  FOR SELECT TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]));

CREATE POLICY "Artists can view own record" ON public.artists
  FOR SELECT TO authenticated
  USING (
    profile_id IS NOT NULL
    AND profile_id = auth.uid()
    AND studio_id IN (SELECT public.get_user_studios())
  );

CREATE POLICY "Staff can insert artists" ON public.artists
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]));

CREATE POLICY "Staff can update artists" ON public.artists
  FOR UPDATE TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]))
  WITH CHECK (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]));

CREATE POLICY "Staff can delete artists" ON public.artists
  FOR DELETE TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]));

-- Bookings --------------------------------------------------------------
CREATE POLICY "Members can view bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (studio_id IN (SELECT public.get_user_studios()));

CREATE POLICY "Staff can insert bookings" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]));

CREATE POLICY "Staff can update bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]))
  WITH CHECK (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]));

CREATE POLICY "Staff can delete bookings" ON public.bookings
  FOR DELETE TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]));

-- Projects --------------------------------------------------------------
CREATE POLICY "Members can view projects" ON public.projects
  FOR SELECT TO authenticated
  USING (studio_id IN (SELECT public.get_user_studios()));

CREATE POLICY "Staff can insert projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]));

CREATE POLICY "Staff can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]))
  WITH CHECK (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]));

CREATE POLICY "Staff can delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'engineer'::public.user_role]));

-- Invoices (owner/admin only for mutations) -----------------------------
CREATE POLICY "Members can view invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (studio_id IN (SELECT public.get_user_studios()));

CREATE POLICY "Billing staff can insert invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]));

CREATE POLICY "Billing staff can update invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]))
  WITH CHECK (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]));

CREATE POLICY "Billing staff can delete invoices" ON public.invoices
  FOR DELETE TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]));

-- Audit logs (read: owner/admin; insert: all members; no update/delete) --
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role_on_studio(studio_id, ARRAY['owner'::public.user_role, 'admin'::public.user_role]));

CREATE POLICY "Members can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (studio_id IN (SELECT public.get_user_studios()));
-- No UPDATE or DELETE policies: audit logs are append-only.

-- ============================================================================
-- 15. ROLE PERMISSIONS (Least Privilege)
-- ============================================================================
-- Grant schema and table access following the principle of least privilege.
-- Authenticated users receive only SELECT, INSERT, UPDATE, DELETE where needed.
-- TRUNCATE, TRIGGER, and REFERENCES are explicitly withheld from application roles.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    -- Revoke pre-existing broad privileges (e.g. Supabase default ALL on public schema)
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

    -- Revoke blanket default privileges on future public objects from unprivileged roles
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;

    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;
    END IF;

    -- Schema usage
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

    -- Service role retains full administrative privileges for trusted backend tasks
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

    -- Authenticated: granular DML privileges only (NO TRUNCATE, NO TRIGGER, NO REFERENCES)
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public.studios,
      public.profiles,
      public.studio_memberships,
      public.rooms,
      public.artists,
      public.bookings,
      public.projects,
      public.invoices
    TO authenticated;

    -- Audit logs: strictly append-only for authenticated users (NO UPDATE, NO DELETE, NO TRUNCATE)
    GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;

    -- Sequences: usage and read-only for authenticated (e.g. for default nextval)
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

    -- Public helper functions: explicit EXECUTE for authenticated
    GRANT EXECUTE ON FUNCTION public.create_studio(text, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.get_user_studios() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.has_role_on_studio(uuid, public.user_role[]) TO authenticated;

    -- Default privileges for future schema additions:
    -- Blanket default grants to `authenticated` are intentionally omitted.
    -- Future tables require explicit, audited grants and RLS policies.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;
  END IF;
END $$;
