import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('Customer Registration & Approval Architecture', () => {
  // Simulates registration payload processing
  function processRegistration({ email, password, artistName, genre, phone }) {
    if (!email || !password || !artistName) {
      return { error: 'Required fields missing' }
    }

    const userId = `usr-${Math.random().toString(36).substring(2, 9)}`

    // MUST NOT create studio_memberships
    const createdMemberships = []

    // MUST create studio_access_requests
    const accessRequest = {
      id: `req-${Math.random().toString(36).substring(2, 9)}`,
      user_id: userId,
      requested_artist_name: artistName.trim(),
      genre: genre?.trim() || null,
      phone: phone?.trim() || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    return {
      success: true,
      user: { id: userId, email },
      accessRequest,
      memberships: createdMemberships,
    }
  }

  test('public registration creates user and pending access request with ZERO studio memberships', () => {
    const result = processRegistration({
      email: 'arjit@singer.in',
      password: 'SecurePassword2026!',
      artistName: 'Arijit Vocal Lab',
      genre: 'Bollywood / Classical',
      phone: '+91 98765 43210',
    })

    assert.equal(result.success, true)
    assert.equal(result.accessRequest.status, 'pending')
    assert.equal(result.accessRequest.requested_artist_name, 'Arijit Vocal Lab')
    // CRITICAL: Ensure zero studio_memberships are created
    assert.equal(result.memberships.length, 0, 'Customer registration must NOT create studio_memberships')
  })

  test('registration fails if artist name or credentials are missing', () => {
    const noName = processRegistration({
      email: 'artist@test.in',
      password: 'password123',
      artistName: '',
    })
    assert.match(noName.error, /Required fields missing/)

    const noEmail = processRegistration({
      email: '',
      password: 'password123',
      artistName: 'Test Band',
    })
    assert.match(noEmail.error, /Required fields missing/)
  })
})

describe('Customer Portal Access State Machine', () => {
  function computePortalAccessState({ artistRecord, accessRequest, membership }) {
    const isStaff = membership?.role === 'owner' || membership?.role === 'admin' || membership?.role === 'engineer'

    if (artistRecord || isStaff) {
      return { accessState: 'approved', canAccessPortalData: true }
    }

    if (accessRequest) {
      if (accessRequest.status === 'pending') {
        return { accessState: 'pending', canAccessPortalData: false }
      }
      if (accessRequest.status === 'rejected') {
        return { accessState: 'rejected', canAccessPortalData: false }
      }
      if (accessRequest.status === 'approved') {
        return { accessState: 'approved', canAccessPortalData: true }
      }
    }

    return { accessState: 'none', canAccessPortalData: false }
  }

  test('unapproved user with pending request cannot access portal data', () => {
    const state = computePortalAccessState({
      user: { id: 'usr-123' },
      artistRecord: null,
      accessRequest: { status: 'pending' },
      membership: null,
    })

    assert.equal(state.accessState, 'pending')
    assert.equal(state.canAccessPortalData, false)
  })

  test('rejected user cannot access portal data', () => {
    const state = computePortalAccessState({
      user: { id: 'usr-456' },
      artistRecord: null,
      accessRequest: { status: 'rejected' },
      membership: null,
    })

    assert.equal(state.accessState, 'rejected')
    assert.equal(state.canAccessPortalData, false)
  })

  test('user without any request has accessState none and cannot access data', () => {
    const state = computePortalAccessState({
      user: { id: 'usr-789' },
      artistRecord: null,
      accessRequest: null,
      membership: null,
    })

    assert.equal(state.accessState, 'none')
    assert.equal(state.canAccessPortalData, false)
  })

  test('approved customer linked to artist record has full client portal data access', () => {
    const state = computePortalAccessState({
      user: { id: 'usr-client' },
      artistRecord: { id: 'art-client', profile_id: 'usr-client', name: 'Indie Band' },
      accessRequest: { status: 'approved' },
      membership: null,
    })

    assert.equal(state.accessState, 'approved')
    assert.equal(state.canAccessPortalData, true)
  })

  test('studio staff can access customer view for monitoring', () => {
    const state = computePortalAccessState({
      user: { id: 'usr-owner' },
      artistRecord: null,
      accessRequest: null,
      membership: { role: 'owner' },
    })

    assert.equal(state.accessState, 'approved')
    assert.equal(state.canAccessPortalData, true)
  })
})

describe('Owner/Admin Approval & Linking Workflow', () => {
  // Simulates approval action
  function approveRequest({ request, targetArtist, allArtists, callerRole }) {
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      return { error: 'Unauthorized: insufficient permissions to approve access requests.' }
    }

    if (request.status !== 'pending') {
      return { error: 'Request is already resolved.' }
    }

    if (targetArtist) {
      if (targetArtist.profile_id) {
        return { error: 'Target artist is already linked to another client account.' }
      }
      targetArtist.profile_id = request.user_id
      request.status = 'approved'
      request.artist_id = targetArtist.id
      request.reviewed_at = new Date().toISOString()
      return { success: true, linkedArtist: targetArtist }
    } else {
      const newArtist = {
        id: `art-${Math.random().toString(36).substring(2, 9)}`,
        name: request.requested_artist_name,
        genre: request.genre,
        phone: request.phone,
        status: 'active',
        profile_id: request.user_id,
      }
      allArtists.push(newArtist)
      request.status = 'approved'
      request.artist_id = newArtist.id
      request.reviewed_at = new Date().toISOString()
      return { success: true, linkedArtist: newArtist }
    }
  }

  function unlinkArtistProfile({ artist, callerRole }) {
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      return { error: 'Unauthorized: insufficient permissions to unlink client accounts.' }
    }
    artist.profile_id = null
    return { success: true }
  }

  test('owner can approve and create new linked artist', () => {
    const artists = []
    const req = {
      id: 'req-1',
      user_id: 'usr-new',
      requested_artist_name: 'Bangalore Beats',
      genre: 'Electronic',
      phone: '+91 99999 11111',
      status: 'pending',
    }

    const res = approveRequest({
      request: req,
      targetArtist: null,
      allArtists: artists,
      callerRole: 'owner',
    })

    assert.equal(res.success, true)
    assert.equal(req.status, 'approved')
    assert.equal(artists.length, 1)
    assert.equal(artists[0].profile_id, 'usr-new')
    assert.equal(artists[0].name, 'Bangalore Beats')
  })

  test('admin can approve by linking to existing unlinked artist record', () => {
    const existing = {
      id: 'art-existing',
      name: 'Existing Duo',
      genre: 'Acoustic',
      profile_id: null,
    }
    const req = {
      id: 'req-2',
      user_id: 'usr-duo',
      requested_artist_name: 'Duo Singer',
      status: 'pending',
    }

    const res = approveRequest({
      request: req,
      targetArtist: existing,
      allArtists: [existing],
      callerRole: 'admin',
    })

    assert.equal(res.success, true)
    assert.equal(existing.profile_id, 'usr-duo')
    assert.equal(req.status, 'approved')
  })

  test('rejects linking if target artist is already linked to another client', () => {
    const alreadyLinked = {
      id: 'art-linked',
      name: 'Already Linked Band',
      profile_id: 'usr-first-client',
    }
    const req = {
      id: 'req-3',
      user_id: 'usr-second-client',
      status: 'pending',
    }

    const res = approveRequest({
      request: req,
      targetArtist: alreadyLinked,
      allArtists: [alreadyLinked],
      callerRole: 'owner',
    })

    assert.equal(res.error, 'Target artist is already linked to another client account.')
    assert.equal(alreadyLinked.profile_id, 'usr-first-client')
  })

  test('engineers or clients cannot approve access requests', () => {
    const req = { id: 'req-4', user_id: 'usr-4', status: 'pending' }
    const resEng = approveRequest({ request: req, targetArtist: null, allArtists: [], callerRole: 'engineer' })
    assert.match(resEng.error, /Unauthorized/)

    const resClient = approveRequest({ request: req, targetArtist: null, allArtists: [], callerRole: 'artist' })
    assert.match(resClient.error, /Unauthorized/)
  })

  test('unlinking profile immediately revokes client portal linkage', () => {
    const artist = { id: 'art-5', name: 'To Be Unlinked', profile_id: 'usr-5' }
    const res = unlinkArtistProfile({ artist, callerRole: 'owner' })
    assert.equal(res.success, true)
    assert.equal(artist.profile_id, null)
  })
})

describe('Customer Data Isolation (Customer A vs Customer B)', () => {
  const customerA = { userId: 'usr-A', artistId: 'art-A', name: 'Artist A' }
  const customerB = { userId: 'usr-B', artistId: 'art-B', name: 'Artist B' }

  const bookingsDB = [
    { id: 'b-1', artist_id: 'art-A', room_id: 'room-1', status: 'confirmed' },
    { id: 'b-2', artist_id: 'art-A', room_id: 'room-2', status: 'pending' },
    { id: 'b-3', artist_id: 'art-B', room_id: 'room-1', status: 'confirmed' },
    { id: 'b-4', artist_id: 'art-B', room_id: 'room-3', status: 'in_progress' },
  ]

  const projectsDB = [
    { id: 'p-1', artist_id: 'art-A', title: 'Album A', status: 'in-progress' },
    { id: 'p-2', artist_id: 'art-B', title: 'Album B', status: 'mixing' },
  ]

  const invoicesDB = [
    { id: 'inv-1', artist_id: 'art-A', amount: 15000, status: 'paid' },
    { id: 'inv-2', artist_id: 'art-A', amount: 8000, status: 'unpaid' },
    { id: 'inv-3', artist_id: 'art-B', amount: 22000, status: 'unpaid' },
  ]

  // Server Action: Request Session (Strict server-side artist_id resolution)
  function serverActionRequestSession({ authenticatedUser, artistProfileMap, payload }) {
    // 1. Authenticate
    if (!authenticatedUser) return { error: 'Not authenticated' }

    // 2. Resolve artist from authenticated user's profile_id
    const userArtistId = artistProfileMap[authenticatedUser.id]
    if (!userArtistId) {
      return { error: 'Your account is not linked to any artist profile. Please contact the studio.' }
    }

    // 3. Even if attacker injected payload.artist_id = 'art-B', enforce userArtistId
    const sanitizedBooking = {
      id: `b-${Date.now()}`,
      artist_id: userArtistId, // STRICT SERVER-SIDE ENFORCEMENT
      room_id: payload.room_id,
      status: 'pending',
    }

    return { success: true, booking: sanitizedBooking }
  }

  // Server Query: Customer Bookings Query (RLS simulation)
  function queryCustomerBookings(authenticatedUserId, artistProfileMap) {
    const userArtistId = artistProfileMap[authenticatedUserId]
    if (!userArtistId) return []
    return bookingsDB.filter((b) => b.artist_id === userArtistId)
  }

  // Server Query: Customer Projects Query
  function queryCustomerProjects(authenticatedUserId, artistProfileMap) {
    const userArtistId = artistProfileMap[authenticatedUserId]
    if (!userArtistId) return []
    return projectsDB.filter((p) => p.artist_id === userArtistId)
  }

  // Server Query: Customer Invoices Query
  function queryCustomerInvoices(authenticatedUserId, artistProfileMap) {
    const userArtistId = artistProfileMap[authenticatedUserId]
    if (!userArtistId) return []
    return invoicesDB.filter((inv) => inv.artist_id === userArtistId)
  }

  // Deliverables Download Authorization
  function authorizeDeliverableDownload({ authenticatedUserId, filePath, artistProfileMap, memberships }) {
    const parts = filePath.split('/')
    if (parts.length < 3) return { error: 'Invalid file path' }
    const [studioId, projectId] = parts

    const isStaff = memberships?.some((m) => m.studio_id === studioId && ['owner', 'admin', 'engineer'].includes(m.role))
    if (isStaff) return { allowed: true }

    const targetProject = projectsDB.find((p) => p.id === projectId)
    if (!targetProject) return { error: 'Project not found' }

    const userArtistId = artistProfileMap[authenticatedUserId]
    if (targetProject.artist_id !== userArtistId) {
      return { error: 'Unauthorized: You do not have access to download this project deliverable.' }
    }

    return { allowed: true }
  }

  const profileMap = {
    'usr-A': 'art-A',
    'usr-B': 'art-B',
  }

  test('Customer A querying bookings receives ONLY Customer A records and never Customer B records', () => {
    const bookingsA = queryCustomerBookings(customerA.userId, profileMap)
    assert.equal(bookingsA.length, 2)
    assert.ok(bookingsA.every((b) => b.artist_id === 'art-A'))
    assert.ok(!bookingsA.some((b) => b.artist_id === 'art-B'))
  })

  test('Customer B querying projects receives ONLY Customer B projects', () => {
    const projectsB = queryCustomerProjects(customerB.userId, profileMap)
    assert.equal(projectsB.length, 1)
    assert.equal(projectsB[0].title, 'Album B')
    assert.ok(!projectsB.some((p) => p.artist_id === 'art-A'))
  })

  test('Customer A querying invoices never sees Customer B billing statements', () => {
    const invoicesA = queryCustomerInvoices(customerA.userId, profileMap)
    assert.equal(invoicesA.length, 2)
    assert.ok(invoicesA.every((inv) => inv.artist_id === 'art-A'))
    assert.ok(!invoicesA.some((inv) => inv.id === 'inv-3'))
  })

  test('malicious booking request by Customer A attempting to assign to Customer B is sanitized to Customer A', () => {
    const maliciousPayload = {
      room_id: 'room-1',
      artist_id: 'art-B', // Malicious attempt to book on behalf of Artist B
    }

    const res = serverActionRequestSession({
      authenticatedUser: { id: customerA.userId },
      artistProfileMap: profileMap,
      payload: maliciousPayload,
    })

    assert.equal(res.success, true)
    // Server overrides injected artist_id with authenticated user's own artist_id
    assert.equal(res.booking.artist_id, 'art-A')
    assert.notEqual(res.booking.artist_id, 'art-B')
  })

  test('Customer A cannot download Customer B project deliverables', () => {
    // Project p-2 belongs to Customer B
    const res = authorizeDeliverableDownload({
      authenticatedUserId: customerA.userId,
      filePath: 'studio-1/p-2/final-master.wav',
      artistProfileMap: profileMap,
      memberships: [],
    })

    assert.equal(res.error, 'Unauthorized: You do not have access to download this project deliverable.')
  })

  test('Customer B can download their own project deliverable', () => {
    const res = authorizeDeliverableDownload({
      authenticatedUserId: customerB.userId,
      filePath: 'studio-1/p-2/final-master.wav',
      artistProfileMap: profileMap,
      memberships: [],
    })

    assert.equal(res.allowed, true)
  })

  test('Studio engineer can download deliverables for any project in their studio', () => {
    const res = authorizeDeliverableDownload({
      authenticatedUserId: 'usr-engineer',
      filePath: 'studio-1/p-2/final-master.wav',
      artistProfileMap: {},
      memberships: [{ studio_id: 'studio-1', role: 'engineer' }],
    })

    assert.equal(res.allowed, true)
  })
})
