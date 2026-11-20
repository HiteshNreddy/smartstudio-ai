import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

// Relational Mock Database matching PostgreSQL Hosted Schema
function createDatabase() {
  return {
    studios: [
      { id: 'std-1', name: 'Muzico Studios', slug: 'muzico-studios' },
      { id: 'std-2', name: 'SoundWave Labs', slug: 'soundwave-labs' },
    ],
    studio_memberships: [
      { id: 'sm-1', studio_id: 'std-1', user_id: 'usr-owner-1', role: 'owner' },
      { id: 'sm-2', studio_id: 'std-1', user_id: 'usr-admin-1', role: 'admin' },
      { id: 'sm-3', studio_id: 'std-1', user_id: 'usr-eng-1', role: 'engineer' },
      { id: 'sm-4', studio_id: 'std-2', user_id: 'usr-owner-2', role: 'owner' },
    ],
    artists: [
      { id: 'art-1a', studio_id: 'std-1', name: 'Artist 1A', profile_id: 'usr-cust-a', status: 'active' },
      { id: 'art-1b', studio_id: 'std-1', name: 'Artist 1B', profile_id: 'usr-cust-b', status: 'active' },
      { id: 'art-2c', studio_id: 'std-2', name: 'Artist 2C', profile_id: 'usr-cust-c', status: 'active' },
    ],
    rooms: [
      { id: 'rm-1a', studio_id: 'std-1', name: 'Studio A (Main Live Room)', hourly_rate: 2500 },
      { id: 'rm-1b', studio_id: 'std-1', name: 'Studio B (Mixing Suite)', hourly_rate: 1800 },
      { id: 'rm-2a', studio_id: 'std-2', name: 'SoundWave Chamber', hourly_rate: 3000 },
    ],
    bookings: [
      { id: 'bk-1a', studio_id: 'std-1', artist_id: 'art-1a', room_id: 'rm-1a', status: 'confirmed' },
      { id: 'bk-1b', studio_id: 'std-1', artist_id: 'art-1b', room_id: 'rm-1b', status: 'pending' },
      { id: 'bk-2c', studio_id: 'std-2', artist_id: 'art-2c', room_id: 'rm-2a', status: 'confirmed' },
    ],
    projects: [
      { id: 'prj-1a', studio_id: 'std-1', artist_id: 'art-1a', title: 'Customer A Album', status: 'in-progress' },
      { id: 'prj-1b', studio_id: 'std-1', artist_id: 'art-1b', title: 'Customer B EP', status: 'mixing' },
      { id: 'prj-2c', studio_id: 'std-2', artist_id: 'art-2c', title: 'Customer C Single', status: 'mastering' },
    ],
    invoices: [
      { id: 'inv-1a', studio_id: 'std-1', artist_id: 'art-1a', amount: 15000, status: 'paid' },
      { id: 'inv-1b', studio_id: 'std-1', artist_id: 'art-1b', amount: 8000, status: 'unpaid' },
      { id: 'inv-2c', studio_id: 'std-2', artist_id: 'art-2c', amount: 12000, status: 'unpaid' },
    ],
    studio_access_requests: [
      { id: 'sar-1', studio_id: 'std-1', user_id: 'usr-applicant-d', requested_artist_name: 'Applicant Band', status: 'pending' },
    ],
    storage_objects: [
      { bucket_id: 'project-deliverables', name: 'std-1/prj-1a/master.wav' },
      { bucket_id: 'project-deliverables', name: 'std-1/prj-1b/stems.zip' },
      { bucket_id: 'project-deliverables', name: 'std-2/prj-2c/audio.flac' },
    ],
  }
}

// PostgreSQL Helper Functions as defined in Migration
function getUserStudios(db, userId) {
  return db.studio_memberships
    .filter((sm) => sm.user_id === userId)
    .map((sm) => sm.studio_id)
}

function hasRoleOnStudio(db, userId, studioId, roles) {
  return db.studio_memberships.some(
    (sm) => sm.user_id === userId && sm.studio_id === studioId && roles.includes(sm.role)
  )
}

// Evaluates RLS SELECT on a table by combining policies with logical OR
function evaluateTableSelectRLS(tableName, db, authUid) {
  const table = db[tableName]

  return table.filter((row) => {
    switch (tableName) {
      case 'studios': {
        // Policy: "Authorized users can view studios"
        const p1 = getUserStudios(db, authUid).includes(row.id)
        const p2 = db.artists.some((a) => a.profile_id === authUid && a.studio_id === row.id)
        const p3 = db.studio_access_requests.some((sar) => sar.user_id === authUid && sar.studio_id === row.id && sar.status === 'pending')
        return p1 || p2 || p3
      }

      case 'rooms': {
        // Policy: "Authorized users can view rooms"
        const pStaff = hasRoleOnStudio(db, authUid, row.studio_id, ['owner', 'admin', 'engineer'])
        const pApprovedArtist = db.artists.some((a) => a.profile_id === authUid && a.studio_id === row.studio_id)
        const pPendingApplicant = db.studio_access_requests.some((sar) => sar.user_id === authUid && sar.studio_id === row.studio_id && sar.status === 'pending')
        return pStaff || pApprovedArtist || pPendingApplicant
      }

      case 'artists': {
        // Policy 1: "Staff can view artists"
        const pStaff = hasRoleOnStudio(db, authUid, row.studio_id, ['owner', 'admin', 'engineer'])
        // Policy 2: "Artists can view own record"
        const pArtistOwn = row.profile_id !== null && row.profile_id === authUid
        return pStaff || pArtistOwn
      }

      case 'bookings': {
        // Policy 1: "Staff can view bookings"
        const pStaff = hasRoleOnStudio(db, authUid, row.studio_id, ['owner', 'admin', 'engineer'])
        // Policy 2: "Artists can view own bookings"
        const pArtistOwn = db.artists.some((a) => a.profile_id === authUid && a.id === row.artist_id)
        return pStaff || pArtistOwn
      }

      case 'projects': {
        // Policy 1: "Staff can view projects"
        const pStaff = hasRoleOnStudio(db, authUid, row.studio_id, ['owner', 'admin', 'engineer'])
        // Policy 2: "Artists can view own projects"
        const pArtistOwn = db.artists.some((a) => a.profile_id === authUid && a.id === row.artist_id)
        return pStaff || pArtistOwn
      }

      case 'invoices': {
        // Policy 1: "Billing staff can view invoices" (Owner, Admin only)
        const pBillingStaff = hasRoleOnStudio(db, authUid, row.studio_id, ['owner', 'admin'])
        // Policy 2: "Artists can view own invoices"
        const pArtistOwn = db.artists.some((a) => a.profile_id === authUid && a.id === row.artist_id)
        return pBillingStaff || pArtistOwn
      }

      case 'studio_memberships': {
        // Policy: "Staff can view studio memberships"
        const pStaff = hasRoleOnStudio(db, authUid, row.studio_id, ['owner', 'admin', 'engineer'])
        const pSelf = row.user_id === authUid
        return pStaff || pSelf
      }

      case 'storage_objects': {
        // Policy: "Authorized users can read project deliverables"
        if (row.bucket_id !== 'project-deliverables') return false
        const segments = row.name.split('/')
        if (segments.length < 3) return false
        const [studioId, projectId] = segments

        // Clause 1: Studio Staff
        const pStaff = hasRoleOnStudio(db, authUid, studioId, ['owner', 'admin', 'engineer'])

        // Clause 2: Linked artist for this specific project
        const pArtist = db.projects.some(
          (p) =>
            p.id === projectId &&
            p.studio_id === studioId &&
            db.artists.some((a) => a.id === p.artist_id && a.profile_id === authUid)
        )

        return pStaff || pArtist
      }

      default:
        return false
    }
  })
}

// Storage Mutation RLS evaluation
function evaluateStorageMutationRLS(operation, db, authUid, { bucket_id, name }) {
  if (bucket_id !== 'project-deliverables') return false
  const segments = name.split('/')
  if (segments.length < 3) return false
  const [studioId, projectId] = segments

  const projectExists = db.projects.some((p) => p.id === projectId && p.studio_id === studioId)
  if (!projectExists) return false

  // Staff roles can insert, update, delete
  return hasRoleOnStudio(db, authUid, studioId, ['owner', 'admin', 'engineer'])
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('PostgreSQL RLS Migration Evaluation Engine', () => {
  const db = createDatabase()

  const ID_OWNER_1 = 'usr-owner-1'
  const ID_ADMIN_1 = 'usr-admin-1'
  const ID_ENG_1 = 'usr-eng-1'
  const ID_CUST_A = 'usr-cust-a'
  const ID_CUST_B = 'usr-cust-b'
  const ID_CUST_C = 'usr-cust-c'
  const ID_APPLICANT_D = 'usr-applicant-d'

  test('1. Studios Table Visibility: Customers see only their linked/requested studio; staff see their studio', () => {
    const custAStudios = evaluateTableSelectRLS('studios', db, ID_CUST_A)
    assert.equal(custAStudios.length, 1)
    assert.equal(custAStudios[0].id, 'std-1')

    const custCStudios = evaluateTableSelectRLS('studios', db, ID_CUST_C)
    assert.equal(custCStudios.length, 1)
    assert.equal(custCStudios[0].id, 'std-2')

    const applicantStudios = evaluateTableSelectRLS('studios', db, ID_APPLICANT_D)
    assert.equal(applicantStudios.length, 1)
    assert.equal(applicantStudios[0].id, 'std-1')

    const owner1Studios = evaluateTableSelectRLS('studios', db, ID_OWNER_1)
    assert.equal(owner1Studios.length, 1)
    assert.equal(owner1Studios[0].id, 'std-1')
  })

  test('2. Rooms Table Visibility: Narrowly scoped to staff, linked customers, and applicants without broad leak', () => {
    // Customer A (linked to Studio 1) can see Studio 1 rooms only
    const custARooms = evaluateTableSelectRLS('rooms', db, ID_CUST_A)
    assert.equal(custARooms.length, 2)
    assert.ok(custARooms.every((r) => r.studio_id === 'std-1'))
    assert.ok(!custARooms.some((r) => r.id === 'rm-2a')) // Cannot see Studio 2 rooms

    // Customer C (linked to Studio 2) can see Studio 2 rooms only
    const custCRooms = evaluateTableSelectRLS('rooms', db, ID_CUST_C)
    assert.equal(custCRooms.length, 1)
    assert.equal(custCRooms[0].id, 'rm-2a')

    // Pending Applicant D (requested Studio 1) can see Studio 1 rooms to view booking options
    const applicantRooms = evaluateTableSelectRLS('rooms', db, ID_APPLICANT_D)
    assert.equal(applicantRooms.length, 2)
    assert.ok(applicantRooms.every((r) => r.studio_id === 'std-1'))

    // Studio 1 Staff see Studio 1 rooms
    const engRooms = evaluateTableSelectRLS('rooms', db, ID_ENG_1)
    assert.equal(engRooms.length, 2)
  })

  test('3. Artists Table Isolation: Customer A sees ONLY Artist 1A; Customer B sees ONLY Artist 1B; Applicant sees none', () => {
    const custAArtists = evaluateTableSelectRLS('artists', db, ID_CUST_A)
    assert.equal(custAArtists.length, 1)
    assert.equal(custAArtists[0].id, 'art-1a')

    const custBArtists = evaluateTableSelectRLS('artists', db, ID_CUST_B)
    assert.equal(custBArtists.length, 1)
    assert.equal(custBArtists[0].id, 'art-1b')

    const applicantArtists = evaluateTableSelectRLS('artists', db, ID_APPLICANT_D)
    assert.equal(applicantArtists.length, 0, 'Pending applicant cannot see any registered artists')

    // Staff see all artists in their studio
    const staffArtists = evaluateTableSelectRLS('artists', db, ID_OWNER_1)
    assert.equal(staffArtists.length, 2)
    assert.ok(staffArtists.every((a) => a.studio_id === 'std-1'))
  })

  test('4. Bookings Table Isolation: Customer A cannot see Customer B bookings; Applicant sees none', () => {
    const custABookings = evaluateTableSelectRLS('bookings', db, ID_CUST_A)
    assert.equal(custABookings.length, 1)
    assert.equal(custABookings[0].id, 'bk-1a')

    const custBBookings = evaluateTableSelectRLS('bookings', db, ID_CUST_B)
    assert.equal(custBBookings.length, 1)
    assert.equal(custBBookings[0].id, 'bk-1b')

    const applicantBookings = evaluateTableSelectRLS('bookings', db, ID_APPLICANT_D)
    assert.equal(applicantBookings.length, 0)

    // Staff sees all studio bookings
    const staffBookings = evaluateTableSelectRLS('bookings', db, ID_ADMIN_1)
    assert.equal(staffBookings.length, 2)
  })

  test('5. Projects Table Isolation: Customer A cannot see Customer B projects; Applicant sees none', () => {
    const custAProjects = evaluateTableSelectRLS('projects', db, ID_CUST_A)
    assert.equal(custAProjects.length, 1)
    assert.equal(custAProjects[0].id, 'prj-1a')

    const custBProjects = evaluateTableSelectRLS('projects', db, ID_CUST_B)
    assert.equal(custBProjects.length, 1)
    assert.equal(custBProjects[0].id, 'prj-1b')

    const applicantProjects = evaluateTableSelectRLS('projects', db, ID_APPLICANT_D)
    assert.equal(applicantProjects.length, 0)

    const staffProjects = evaluateTableSelectRLS('projects', db, ID_ENG_1)
    assert.equal(staffProjects.length, 2)
  })

  test('6. Invoices Table & Billing Permissions: Customer sees own; Billing staff see studio; Engineers blocked', () => {
    const custAInvoices = evaluateTableSelectRLS('invoices', db, ID_CUST_A)
    assert.equal(custAInvoices.length, 1)
    assert.equal(custAInvoices[0].id, 'inv-1a')

    const custBInvoices = evaluateTableSelectRLS('invoices', db, ID_CUST_B)
    assert.equal(custBInvoices.length, 1)
    assert.equal(custBInvoices[0].id, 'inv-1b')

    // Billing Staff (Owner, Admin) see all studio invoices
    const ownerInvoices = evaluateTableSelectRLS('invoices', db, ID_OWNER_1)
    assert.equal(ownerInvoices.length, 2)

    const adminInvoices = evaluateTableSelectRLS('invoices', db, ID_ADMIN_1)
    assert.equal(adminInvoices.length, 2)

    // Engineer is NOT billing staff: CANNOT view invoices
    const engInvoices = evaluateTableSelectRLS('invoices', db, ID_ENG_1)
    assert.equal(engInvoices.length, 0, 'Studio engineers cannot view billing invoices')

    // Applicant sees none
    assert.equal(evaluateTableSelectRLS('invoices', db, ID_APPLICANT_D).length, 0)
  })

  test('7. Studio Memberships Isolation: Customers cannot view studio staff roster', () => {
    assert.equal(evaluateTableSelectRLS('studio_memberships', db, ID_CUST_A).length, 0)
    assert.equal(evaluateTableSelectRLS('studio_memberships', db, ID_APPLICANT_D).length, 0)

    // Staff see studio memberships
    const staffMemberships = evaluateTableSelectRLS('studio_memberships', db, ID_OWNER_1)
    assert.equal(staffMemberships.length, 3)
  })

  test('8. Storage Read RLS: Customer A can download only Customer A deliverables; Customer B cannot', () => {
    const custAStorage = evaluateTableSelectRLS('storage_objects', db, ID_CUST_A)
    assert.equal(custAStorage.length, 1)
    assert.equal(custAStorage[0].name, 'std-1/prj-1a/master.wav')

    const custBStorage = evaluateTableSelectRLS('storage_objects', db, ID_CUST_B)
    assert.equal(custBStorage.length, 1)
    assert.equal(custBStorage[0].name, 'std-1/prj-1b/stems.zip')

    const applicantStorage = evaluateTableSelectRLS('storage_objects', db, ID_APPLICANT_D)
    assert.equal(applicantStorage.length, 0)

    // Staff can download all deliverables for their studio
    const staffStorage = evaluateTableSelectRLS('storage_objects', db, ID_ENG_1)
    assert.equal(staffStorage.length, 2)
    assert.ok(staffStorage.every((f) => f.name.startsWith('std-1/')))
  })

  test('9. Storage Mutations: Staff can upload/update/delete; Customers and Applicants are strictly denied', () => {
    const validFile = { bucket_id: 'project-deliverables', name: 'std-1/prj-1a/new-mix.wav' }

    // Owner, Admin, Engineer can upload
    assert.equal(evaluateStorageMutationRLS('INSERT', db, ID_OWNER_1, validFile), true)
    assert.equal(evaluateStorageMutationRLS('INSERT', db, ID_ADMIN_1, validFile), true)
    assert.equal(evaluateStorageMutationRLS('INSERT', db, ID_ENG_1, validFile), true)

    // Customer A cannot upload
    assert.equal(evaluateStorageMutationRLS('INSERT', db, ID_CUST_A, validFile), false)

    // Customer B cannot upload
    assert.equal(evaluateStorageMutationRLS('INSERT', db, ID_CUST_B, validFile), false)

    // Applicant cannot upload
    assert.equal(evaluateStorageMutationRLS('INSERT', db, ID_APPLICANT_D, validFile), false)

    // File with mismatched studio/project path is rejected even for staff
    const mismatchedFile = { bucket_id: 'project-deliverables', name: 'std-1/prj-2c/audio.wav' } // prj-2c belongs to std-2
    assert.equal(evaluateStorageMutationRLS('INSERT', db, ID_OWNER_1, mismatchedFile), false)
  })

  test('10. Bucket Configuration: project-deliverables is forced private with 100MB ceiling on upsert', () => {
    function upsertBucket(buckets, newBucket) {
      const idx = buckets.findIndex((b) => b.id === newBucket.id)
      if (idx === -1) {
        buckets.push(newBucket)
      } else {
        // ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = ..., allowed_mime_types = ...
        buckets[idx].public = false
        buckets[idx].file_size_limit = newBucket.file_size_limit
        buckets[idx].allowed_mime_types = newBucket.allowed_mime_types
      }
      return buckets
    }

    // Case: Pre-existing conflicting bucket that was public=true and limit=5MB
    const buckets = [
      { id: 'project-deliverables', name: 'project-deliverables', public: true, file_size_limit: 5242880, allowed_mime_types: ['image/png'] },
      { id: 'unrelated-bucket', name: 'unrelated-bucket', public: true, file_size_limit: 1048576 },
    ]

    upsertBucket(buckets, {
      id: 'project-deliverables',
      name: 'project-deliverables',
      public: false,
      file_size_limit: 104857600,
      allowed_mime_types: ['audio/wav'],
    })

    const target = buckets.find((b) => b.id === 'project-deliverables')
    assert.equal(target.public, false, 'project-deliverables bucket must be strictly private')
    assert.equal(target.file_size_limit, 104857600, 'file size ceiling must be 100MB')
    assert.deepEqual(target.allowed_mime_types, ['audio/wav'])

    // Unrelated bucket remains unchanged
    const unrelated = buckets.find((b) => b.id === 'unrelated-bucket')
    assert.equal(unrelated.public, true, 'unrelated buckets must not be modified')
  })
})
