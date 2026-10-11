"""
SmartStudio AI – Row-Level Security (RLS) Verification Script

This CI security check scans all base tables in the 'public' schema to verify
that Row-Level Security (RLS) is explicitly enabled on every table. If any table
lacks RLS, the script prints the offending table names and exits with code 1,
failing the CI build before deployment.
"""

import os
import sys
import psycopg2

PGHOST = os.environ.get("PGHOST", "127.0.0.1")
PGPORT = int(os.environ.get("PGPORT", "54322"))
PGUSER = os.environ.get("PGUSER", "postgres")
PGPASSWORD = os.environ.get("PGPASSWORD", "postgres")
PGDATABASE = os.environ.get("PGDATABASE", "postgres")

def main():
    print(f"Connecting to PostgreSQL at {PGHOST}:{PGPORT}/{PGDATABASE} for RLS audit...")
    try:
        conn = psycopg2.connect(
            host=PGHOST,
            port=PGPORT,
            user=PGUSER,
            password=PGPASSWORD,
            dbname=PGDATABASE
        )
    except Exception as e:
        # Fallback to local test port 54332 if 54322 is unavailable
        fallback_port = 54332
        print(f"Connection on port {PGPORT} failed, trying fallback {fallback_port}: {e}")
        conn = psycopg2.connect(
            host=PGHOST,
            port=fallback_port,
            user=PGUSER,
            dbname="smartstudio_test"
        )

    cur = conn.cursor()

    # Query all base tables (relkind = 'r') in the 'public' schema
    cur.execute("""
        SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
        ORDER BY c.relname;
    """)

    tables = cur.fetchall()
    if not tables:
        print("ERROR: No tables found in public schema. Was the migration applied?")
        sys.exit(1)

    print(f"Found {len(tables)} base table(s) in 'public' schema:")
    unprotected = []
    for tablename, rls_enabled, rls_forced in tables:
        status = "ENABLED" if rls_enabled else "DISABLED"
        print(f"  - {tablename:<25} RLS: {status}")
        if not rls_enabled:
            unprotected.append(tablename)

    conn.close()

    if unprotected:
        print(f"\nCRITICAL SECURITY FAILURE: Found {len(unprotected)} table(s) with RLS DISABLED:")
        for t in unprotected:
            print(f"  --> {t}")
        print("All tables in the public schema MUST have RLS enabled!")
        sys.exit(1)
    else:
        print(f"\n>>> RLS AUDIT PASSED: All {len(tables)} public tables have Row-Level Security enabled.")
        sys.exit(0)

if __name__ == "__main__":
    main()
