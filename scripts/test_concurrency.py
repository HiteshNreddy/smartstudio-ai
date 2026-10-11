"""
SmartStudio AI – Two-Session Concurrency Test for Last-Owner Protection

This script demonstrates and verifies that two concurrent client sessions
cannot both demote/remove the last owners of a studio simultaneously.
The PostgreSQL FOR UPDATE lock on the parent studio row serializes the deferred
trigger check, ensuring the second session sees 0 owners in the committed state
and is aborted with an exception.
"""

import os
import sys
import time
import threading
import psycopg2

PGHOST = os.environ.get("PGHOST", "127.0.0.1")
PGPORT = int(os.environ.get("PGPORT", "54322"))
PGUSER = os.environ.get("PGUSER", "postgres")
PGPASSWORD = os.environ.get("PGPASSWORD", "postgres")
PGDATABASE = os.environ.get("PGDATABASE", "postgres")

def main():
    print(f"Connecting to PostgreSQL at {PGHOST}:{PGPORT}/{PGDATABASE}...")
    try:
        conn = psycopg2.connect(
            host=PGHOST,
            port=PGPORT,
            user=PGUSER,
            password=PGPASSWORD,
            dbname=PGDATABASE
        )
    except Exception as e:
        # Fallback to local test port 54332 if 54322 fails
        fallback_port = 54332
        print(f"Connection failed on {PGPORT}, falling back to {fallback_port}: {e}")
        conn = psycopg2.connect(
            host=PGHOST,
            port=fallback_port,
            user=PGUSER,
            dbname="smartstudio_test"
        )
        port_used = fallback_port
        db_used = "smartstudio_test"
    else:
        port_used = PGPORT
        db_used = PGDATABASE

    conn.autocommit = True
    cur = conn.cursor()

    studio_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    owner1_id = "11111111-1111-1111-1111-111111111111"
    owner2_id = "55555555-5555-5555-5555-555555555555"

    print("Setting up test data: 1 studio, 2 owners...")
    cur.execute(f"""
    INSERT INTO public.studios (id, name, slug) VALUES
      ('{studio_id}', 'Concurrency Studio', 'concurrency-studio')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
      ('{owner1_id}', 'alice@concurrency.local', '{{"full_name": "Alice"}}'::jsonb),
      ('{owner2_id}', 'eve@concurrency.local', '{{"full_name": "Eve"}}'::jsonb)
    ON CONFLICT (id) DO NOTHING;

    DELETE FROM public.studio_memberships WHERE studio_id = '{studio_id}';

    INSERT INTO public.studio_memberships (studio_id, user_id, role) VALUES
      ('{studio_id}', '{owner1_id}', 'owner'),
      ('{studio_id}', '{owner2_id}', 'owner');
    """)

    cur.execute(f"SELECT count(*) FROM public.studio_memberships WHERE studio_id = '{studio_id}' AND role = 'owner';")
    initial_count = cur.fetchone()[0]
    print(f"Initial owner count: {initial_count}")
    if initial_count != 2:
        print(f"Error: expected 2 owners, got {initial_count}")
        sys.exit(1)

    results = {}
    barrier = threading.Event()

    def run_session(session_num, target_user_id):
        try:
            s_conn = psycopg2.connect(
                host=PGHOST,
                port=port_used,
                user=PGUSER,
                password=PGPASSWORD,
                dbname=db_used
            )
            s_cur = s_conn.cursor()
            s_cur.execute("BEGIN;")
            s_cur.execute(f"""
            UPDATE public.studio_memberships
            SET role = 'admin'
            WHERE studio_id = '{studio_id}' AND user_id = '{target_user_id}';
            """)
            # Wait for both sessions to complete UPDATE before either commits
            barrier.wait()
            s_cur.execute("COMMIT;")
            results[session_num] = "COMMIT_OK"
            s_conn.close()
        except Exception as err:
            results[session_num] = f"ERROR: {err}"
            try:
                s_conn.rollback()
                s_conn.close()
            except:
                pass

    t1 = threading.Thread(target=run_session, args=(1, owner1_id))
    t2 = threading.Thread(target=run_session, args=(2, owner2_id))

    t1.start()
    t2.start()
    time.sleep(0.5)
    barrier.set()

    t1.join()
    t2.join()

    print("\n--- Concurrency Execution Results ---")
    for s_num, res in sorted(results.items()):
        print(f"Session {s_num}: {res}")

    cur.execute(f"SELECT count(*) FROM public.studio_memberships WHERE studio_id = '{studio_id}' AND role = 'owner';")
    final_count = cur.fetchone()[0]
    print(f"\nFinal owner count: {final_count}")

    # Validation criteria:
    # 1. Exactly 1 session succeeded and 1 session failed
    # 2. The failing session caught "Cannot remove or demote the last owner of a studio"
    # 3. Final owner count is strictly 1 (studio is never left with 0 owners)
    success_count = sum(1 for r in results.values() if r == "COMMIT_OK")
    has_owner_rejection = any("Cannot remove or demote the last owner of a studio" in str(r) for r in results.values())

    if final_count == 1 and success_count == 1 and has_owner_rejection:
        print("\n>>> TEST PASSED: Concurrency serialized correctly by studio row lock. Sole owner preserved.")
        sys.exit(0)
    else:
        print("\n>>> TEST FAILED: Race condition allowed or unexpected state.")
        sys.exit(1)

if __name__ == "__main__":
    main()
