import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import crypto from 'node:crypto';

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/**
 * 64-bit BigInt signed integer derived from MD5 prefix, matching PostgreSQL:
 * ('x' || substr(md5('artist:' || studio_id::text || ':' || artist_id::text), 1, 16))::bit(64)::bigint
 */
function getArtistAdvisoryKey(studioId, artistId) {
  const hash = crypto.createHash('md5').update(`artist:${studioId}:${artistId}`).digest('hex');
  return BigInt.asIntN(64, BigInt('0x' + hash.slice(0, 16))).toString();
}

/**
 * Splits 64-bit integer into two 32-bit unsigned integers (classid, objid) as stored in pg_locks:
 * pg_locks stores 64-bit advisory lock keys as two unsigned 32-bit integers (OIDs):
 * classid = (key >> 32) & 0xFFFFFFFF
 * objid   = key & 0xFFFFFFFF
 */
function getAdvisoryLockIds(bigintKeyStr) {
  const b = BigInt(bigintKeyStr);
  const classid = Number(BigInt.asUintN(32, b >> 32n));
  const objid = Number(BigInt.asUintN(32, b & 0xFFFFFFFFn));
  return { classid, objid };
}

/**
 * Hardened connection cleanup:
 * - If a client has an in-flight query or cannot complete ROLLBACK within bounded time,
 *   destroys the socket/connection using client.release(true) to avoid releasing poisoned
 *   connections back to the pool.
 * - If the client is idle, safely executes ROLLBACK with immediate rejection handling and
 *   cleared timeout before releasing back to the pool via client.release().
 */
async function disposeClient(client, hasInFlightQuery = false) {
  if (!client) return;

  if (hasInFlightQuery) {
    // A query is still running or blocked. Calling query('ROLLBACK') would queue behind it.
    // client.release(true) closes and destroys the underlying connection immediately.
    try {
      client.release(true);
    } catch {
      // Ignore cleanup error during forced socket destruction
    }
    return;
  }

  // Attempt bounded ROLLBACK on an idle connection
  let timerId = null;
  try {
    const rollbackPromise = client.query('ROLLBACK;').catch(err => {
      // Immediate rejection attachment prevents unhandled promise rejections
      throw err;
    });

    const timeoutPromise = new Promise((_, reject) => {
      timerId = setTimeout(() => reject(new Error('Rollback timeout')), 1000);
    });

    await Promise.race([rollbackPromise, timeoutPromise]);
    if (timerId !== null) clearTimeout(timerId);
    client.release();
  } catch {
    if (timerId !== null) clearTimeout(timerId);
    // If ROLLBACK times out or fails, destroy the connection
    try {
      client.release(true);
    } catch {
      // Ignore release error
    }
  }
}

/**
 * Polls pg_locks until the specified backend PID is actively waiting (granted = false)
 * for the specified advisory lock.
 * If getEarlyError() returns a non-null error, immediately aborts polling and throws
 * that error so early RPC failures propagate without reporting a misleading lock timeout.
 */
async function waitForAdvisoryLockWait(monitorClient, targetPid, classid, objid, getEarlyError = () => null, timeoutMs = 3000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const earlyError = getEarlyError();
    if (earlyError) {
      throw earlyError;
    }

    const res = await monitorClient.query(
      `SELECT 1 FROM pg_locks 
       WHERE pid = $1 
         AND locktype = 'advisory' 
         AND classid = $2 
         AND objid = $3 
         AND granted = false;`,
      [targetPid, classid, objid]
    );
    if (res.rowCount > 0) return true;
    await new Promise(r => setTimeout(r, 20));
  }

  const finalCheckError = getEarlyError();
  if (finalCheckError) {
    throw finalCheckError;
  }

  throw new Error(`Timeout waiting for backend PID ${targetPid} to wait on advisory lock (${classid}, ${objid})`);
}

describe('Customer Portal - Deterministic Concurrency & Lock Verification', () => {
  let pool;
  let testStudioId, testArtistId, applicantUserId, ownerUserId;
  const createdUserIds = new Set();
  const createdStudioIds = new Set();

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DB_URL });
    let client;
    try {
      client = await pool.connect();
      const runTag = crypto.randomUUID();

      // 1. Create Studio (Tracked immediately)
      const studioRes = await client.query(
        `INSERT INTO public.studios (name) VALUES ($1) RETURNING id;`,
        [`Det Test Studio ${runTag}`]
      );
      testStudioId = studioRes.rows[0].id;
      createdStudioIds.add(testStudioId);

      // 2. Create Target Artist with profile_id = NULL
      const artistRes = await client.query(
        `INSERT INTO public.artists (studio_id, name) VALUES ($1, 'Target Concurrency Artist') RETURNING id;`,
        [testStudioId]
      );
      testArtistId = artistRes.rows[0].id;

      // 3. Create Authenticated User Identifiers (Tracked immediately)
      const appUserRes = await client.query(
        `INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id;`,
        [`app_${runTag}@test.com`]
      );
      applicantUserId = appUserRes.rows[0].id;
      createdUserIds.add(applicantUserId);

      const ownUserRes = await client.query(
        `INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id;`,
        [`own_${runTag}@test.com`]
      );
      ownerUserId = ownUserRes.rows[0].id;
      createdUserIds.add(ownerUserId);

      // 4. Create Studio Membership for Owner
      await client.query(
        `INSERT INTO public.studio_memberships (studio_id, profile_id, role) VALUES ($1, $2, 'owner');`,
        [testStudioId, ownerUserId]
      );
    } finally {
      if (client) client.release();
    }
  });

  afterAll(async () => {
    if (!pool) return;
    let client = null;
    let cleanupError = null;
    try {
      client = await pool.connect();
      await client.query('BEGIN;');

      // Strict Reverse-Dependency Deletion Order
      if (createdStudioIds.size > 0) {
        const studioList = Array.from(createdStudioIds);
        await client.query(`DELETE FROM public.studio_access_requests WHERE studio_id = ANY($1);`, [studioList]);
        await client.query(`DELETE FROM public.studio_memberships WHERE studio_id = ANY($1);`, [studioList]);
        await client.query(`DELETE FROM public.artists WHERE studio_id = ANY($1);`, [studioList]);
        await client.query(`DELETE FROM public.studios WHERE id = ANY($1);`, [studioList]);
      }

      if (createdUserIds.size > 0) {
        const userList = Array.from(createdUserIds);
        await client.query(`DELETE FROM public.studio_access_requests WHERE user_id = ANY($1);`, [userList]);
        await client.query(`DELETE FROM auth.users WHERE id = ANY($1);`, [userList]);
      }

      await client.query('COMMIT;');
      client.release();
      client = null;
    } catch (err) {
      cleanupError = err;
      if (client) {
        await disposeClient(client, false);
        client = null;
      }
    } finally {
      await pool.end();
      if (cleanupError) {
        throw new Error(`afterAll fixture cleanup failed: ${cleanupError.message}`);
      }
    }
  });

  test('Sanity: JavaScript advisory key derivation matches PostgreSQL 64-bit and 32-bit unsigned OIDs', async () => {
    let client;
    try {
      client = await pool.connect();
      const jsKey = getArtistAdvisoryKey(testStudioId, testArtistId);
      const pgRes = await client.query(
        `SELECT ('x' || substr(md5('artist:' || $1::text || ':' || $2::text), 1, 16))::bit(64)::bigint AS pg_key;`,
        [testStudioId, testArtistId]
      );
      const pgKey = pgRes.rows[0].pg_key;
      expect(jsKey).toBe(pgKey);

      // Verify unsigned 32-bit OID representation in PostgreSQL
      const { classid, objid } = getAdvisoryLockIds(jsKey);
      expect(classid).toBeGreaterThanOrEqual(0);
      expect(classid).toBeLessThanOrEqual(4294967295);
      expect(objid).toBeGreaterThanOrEqual(0);
      expect(objid).toBeLessThanOrEqual(4294967295);
    } finally {
      if (client) client.release();
    }
  });

  test('Ordering 1 (Revocation First): Tx A revokes under lock -> Tx B submit blocks (verified via pg_locks) -> Tx A commits -> Tx B completes', async () => {
    let txA = null;
    let txB = null;
    let txMonitor = null;
    let txBHasInFlightQuery = false;

    const artistKey = getArtistAdvisoryKey(testStudioId, testArtistId);
    const { classid, objid } = getAdvisoryLockIds(artistKey);

    try {
      txA = await pool.connect();
      txB = await pool.connect();
      txMonitor = await pool.connect();

      // Step 1: Tx A begins and acquires Artist Advisory Lock
      await txA.query('BEGIN;');
      await txA.query(`SELECT pg_advisory_xact_lock($1::bigint);`, [artistKey]);

      // Step 2: Tx A calls the actual revocation RPC while holding the lock
      await txA.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [ownerUserId]);
      const revA = await txA.query(
        `SELECT public.revoke_customer_studio_access($1, $2, 'Order 1 Revoke');`,
        [testStudioId, testArtistId]
      );
      expect(revA.rows[0].revoke_customer_studio_access).toBe(true);

      // Step 3: Get Tx B's backend PID so txMonitor can inspect pg_locks
      const pidRes = await txB.query(`SELECT pg_backend_pid() AS pid;`);
      const txBPid = pidRes.rows[0].pid;

      // Step 4: Tx B starts and invokes submit_studio_access_request (which must wait for Tx A's lock)
      await txB.query('BEGIN;');
      await txB.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [applicantUserId]);

      let txBEarlyError = null;
      txBHasInFlightQuery = true;
      const txBPromise = txB.query(
        `SELECT public.submit_studio_access_request($1, $2, 'Order 1 Submit competing');`,
        [testStudioId, testArtistId]
      ).then(
        res => {
          txBHasInFlightQuery = false;
          return res;
        },
        err => {
          txBHasInFlightQuery = false;
          txBEarlyError = err;
          throw err;
        }
      );

      // Attach immediate listener to prevent Node/Vitest unhandledRejection if txB fails before Promise.race
      txBPromise.catch(() => {});

      // Step 5: Bounded lock-wait verification via pg_locks using txMonitor, propagating any early error immediately
      const isWaiting = await waitForAdvisoryLockWait(txMonitor, txBPid, classid, objid, () => txBEarlyError, 3000);
      expect(isWaiting).toBe(true);

      // Step 6: Tx A commits, releasing the advisory lock
      await txA.query('COMMIT;');

      // Step 7: Tx B unblocks and finishes execution
      const bResult = await Promise.race([
        txBPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Tx B unblock timeout')), 2000))
      ]);
      await txB.query('COMMIT;');

      const submittedRequestId = bResult.rows[0].submit_studio_access_request;
      expect(submittedRequestId).toBeDefined();

      // Step 8: Assert final state
      const verifyRes = await pool.query(
        `SELECT r.status AS req_status, a.profile_id AS artist_profile
         FROM public.studio_access_requests r, public.artists a
         WHERE r.id = $1 AND a.id = $2;`,
        [submittedRequestId, testArtistId]
      );
      expect(verifyRes.rows[0].req_status).toBe('pending');
      expect(verifyRes.rows[0].artist_profile).toBeNull();
    } finally {
      await disposeClient(txA, false);
      await disposeClient(txB, txBHasInFlightQuery);
      if (txMonitor) txMonitor.release();
    }
  });

  test('Ordering 2 (Submission First): Tx A submits under lock -> Tx B revoke blocks (verified via pg_locks) -> Tx A commits -> Tx B completes & revokes', async () => {
    let txA = null;
    let txB = null;
    let txMonitor = null;
    let setupClient = null;
    let txBHasInFlightQuery = false;
    let applicant2Id = null;

    const artistKey = getArtistAdvisoryKey(testStudioId, testArtistId);
    const { classid, objid } = getAdvisoryLockIds(artistKey);

    try {
      // Robust Fixture Creation for Applicant 2
      setupClient = await pool.connect();
      const uRes = await setupClient.query(
        `INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id;`,
        [`app2_${crypto.randomUUID()}@test.com`]
      );
      applicant2Id = uRes.rows[0].id;
      createdUserIds.add(applicant2Id);
      setupClient.release();
      setupClient = null;

      txA = await pool.connect();
      txB = await pool.connect();
      txMonitor = await pool.connect();

      // Step 1: Tx A begins and holds Artist Advisory Lock
      await txA.query('BEGIN;');
      await txA.query(`SELECT pg_advisory_xact_lock($1::bigint);`, [artistKey]);

      // Step 2: Tx A calls the actual submission RPC while holding the lock
      await txA.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [applicant2Id]);
      const subA = await txA.query(
        `SELECT public.submit_studio_access_request($1, $2, 'Order 2 Submit holding');`,
        [testStudioId, testArtistId]
      );
      const newRequestId = subA.rows[0].submit_studio_access_request;
      expect(newRequestId).toBeDefined();

      // Step 3: Get Tx B's backend PID
      const pidRes = await txB.query(`SELECT pg_backend_pid() AS pid;`);
      const txBPid = pidRes.rows[0].pid;

      // Step 4: Tx B starts and invokes revoke_customer_studio_access (must wait for Tx A's lock)
      await txB.query('BEGIN;');
      await txB.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [ownerUserId]);

      let txBEarlyError = null;
      txBHasInFlightQuery = true;
      const txBPromise = txB.query(
        `SELECT public.revoke_customer_studio_access($1, $2, 'Order 2 Revoke competing');`,
        [testStudioId, testArtistId]
      ).then(
        res => {
          txBHasInFlightQuery = false;
          return res;
        },
        err => {
          txBHasInFlightQuery = false;
          txBEarlyError = err;
          throw err;
        }
      );

      // Attach immediate listener to prevent Node/Vitest unhandledRejection if txB fails before Promise.race
      txBPromise.catch(() => {});

      // Step 5: Bounded lock-wait verification via pg_locks using txMonitor, propagating any early error immediately
      const isWaiting = await waitForAdvisoryLockWait(txMonitor, txBPid, classid, objid, () => txBEarlyError, 3000);
      expect(isWaiting).toBe(true);

      // Step 6: Tx A commits, releasing the lock and persisting the pending request
      await txA.query('COMMIT;');

      // Step 7: Tx B unblocks and finishes execution
      const revResult = await Promise.race([
        txBPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Tx B unblock timeout')), 2000))
      ]);
      await txB.query('COMMIT;');

      expect(revResult.rows[0].revoke_customer_studio_access).toBe(true);

      // Step 8: Assert final state: Tx B caught the submitted request and marked it 'revoked'
      const verifyRes = await pool.query(
        `SELECT r.status AS req_status, a.profile_id AS artist_profile
         FROM public.studio_access_requests r, public.artists a
         WHERE r.id = $1 AND a.id = $2;`,
        [newRequestId, testArtistId]
      );
      expect(verifyRes.rows[0].req_status).toBe('revoked');
      expect(verifyRes.rows[0].artist_profile).toBeNull();
    } finally {
      if (setupClient) setupClient.release();
      await disposeClient(txA, false);
      await disposeClient(txB, txBHasInFlightQuery);
      if (txMonitor) txMonitor.release();
    }
  });
});
