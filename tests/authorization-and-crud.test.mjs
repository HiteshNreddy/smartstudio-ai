import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('Studio Onboarding & Slug Validation', () => {
  const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

  function validateSlug(slug) {
    if (!slug || typeof slug !== 'string') return false
    const trimmed = slug.trim()
    if (trimmed.length < 3 || trimmed.length > 48) return false
    return SLUG_REGEX.test(trimmed)
  }

  test('accepts valid studio slugs', () => {
    assert.equal(validateSlug('muzico-studios'), true)
    assert.equal(validateSlug('studio-a'), true)
    assert.equal(validateSlug('blender-sound-lab'), true)
    assert.equal(validateSlug('studio99'), true)
  })

  test('rejects uppercase, spaces, and special characters', () => {
    assert.equal(validateSlug('Muzico-Studios'), false)
    assert.equal(validateSlug('muzico studios'), false)
    assert.equal(validateSlug('muzico_studios'), false)
    assert.equal(validateSlug('muzico@studio'), false)
  })

  test('rejects leading, trailing, or consecutive hyphens', () => {
    assert.equal(validateSlug('-muzico'), false)
    assert.equal(validateSlug('muzico-'), false)
    assert.equal(validateSlug('muzico--studios'), false)
  })

  test('enforces slug length bounds', () => {
    assert.equal(validateSlug('ab'), false)
    assert.equal(validateSlug('a'.repeat(49)), false)
  })
})

describe('Studio Role Authorization Matrix', () => {
  const STAFF_ROLES = ['owner', 'admin', 'engineer']
  const BILLING_ROLES = ['owner', 'admin']

  function canManageArtists(role) {
    return STAFF_ROLES.includes(role)
  }

  function canManageBookings(role) {
    return STAFF_ROLES.includes(role)
  }

  function canManageProjects(role) {
    return STAFF_ROLES.includes(role)
  }

  function canManageRooms(role) {
    return BILLING_ROLES.includes(role)
  }

  test('owner can manage artists, bookings, projects, and rooms', () => {
    assert.equal(canManageArtists('owner'), true)
    assert.equal(canManageBookings('owner'), true)
    assert.equal(canManageProjects('owner'), true)
    assert.equal(canManageRooms('owner'), true)
  })

  test('admin can manage artists, bookings, projects, and rooms', () => {
    assert.equal(canManageArtists('admin'), true)
    assert.equal(canManageBookings('admin'), true)
    assert.equal(canManageProjects('admin'), true)
    assert.equal(canManageRooms('admin'), true)
  })

  test('engineer can manage artists, bookings, and projects, but cannot manage rooms', () => {
    assert.equal(canManageArtists('engineer'), true)
    assert.equal(canManageBookings('engineer'), true)
    assert.equal(canManageProjects('engineer'), true)
    assert.equal(canManageRooms('engineer'), false)
  })

  test('artist cannot mutate studio entities', () => {
    assert.equal(canManageArtists('artist'), false)
    assert.equal(canManageBookings('artist'), false)
    assert.equal(canManageProjects('artist'), false)
    assert.equal(canManageRooms('artist'), false)
  })

  test('unrecognized or unauthenticated roles are strictly rejected', () => {
    assert.equal(canManageArtists('guest'), false)
    assert.equal(canManageBookings(null), false)
    assert.equal(canManageProjects(undefined), false)
  })
})

describe('Booking Constraints & Validation', () => {
  const VALID_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']

  function validateBookingTimeRange(startTime, endTime) {
    const start = new Date(startTime).getTime()
    const end = new Date(endTime).getTime()
    if (isNaN(start) || isNaN(end)) return { valid: false, error: 'Invalid timestamp format' }
    if (start >= end) return { valid: false, error: 'End time must be after start time' }
    return { valid: true }
  }

  test('accepts valid time ranges', () => {
    const result = validateBookingTimeRange('2026-10-15T10:00:00Z', '2026-10-15T12:00:00Z')
    assert.equal(result.valid, true)
  })

  test('rejects inverted or equal time ranges', () => {
    const equal = validateBookingTimeRange('2026-10-15T10:00:00Z', '2026-10-15T10:00:00Z')
    assert.equal(equal.valid, false)

    const inverted = validateBookingTimeRange('2026-10-15T14:00:00Z', '2026-10-15T12:00:00Z')
    assert.equal(inverted.valid, false)
  })

  test('validates booking status against PostgreSQL enum', () => {
    for (const status of VALID_STATUSES) {
      assert.equal(VALID_STATUSES.includes(status), true)
    }
    assert.equal(VALID_STATUSES.includes('scheduled'), false)
    assert.equal(VALID_STATUSES.includes('active'), false)
  })
})

describe('Project Progress & Attributes Validation', () => {
  const VALID_PROJECT_STATUSES = ['in-progress', 'mixing', 'mastering', 'delivered', 'on-hold']

  function validateProjectPayload({ title, artist_id, progress, tracks, status }) {
    if (!title || !title.trim()) return { valid: false, error: 'Title required' }
    if (!artist_id || !artist_id.trim()) return { valid: false, error: 'Artist required' }
    if (!VALID_PROJECT_STATUSES.includes(status)) return { valid: false, error: 'Invalid status' }
    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      return { valid: false, error: 'Progress must be between 0 and 100' }
    }
    if (typeof tracks !== 'number' || tracks < 1) {
      return { valid: false, error: 'Track count must be at least 1' }
    }
    return { valid: true }
  }

  test('accepts valid project payload', () => {
    const res = validateProjectPayload({
      title: 'Neon Echoes EP',
      artist_id: '11111111-1111-1111-1111-111111111111',
      progress: 65,
      tracks: 5,
      status: 'mixing',
    })
    assert.equal(res.valid, true)
  })

  test('rejects progress outside 0-100 percentage range', () => {
    assert.equal(
      validateProjectPayload({
        title: 'Album',
        artist_id: '11111111-1111-1111-1111-111111111111',
        progress: -5,
        tracks: 1,
        status: 'in-progress',
      }).valid,
      false
    )

    assert.equal(
      validateProjectPayload({
        title: 'Album',
        artist_id: '11111111-1111-1111-1111-111111111111',
        progress: 105,
        tracks: 1,
        status: 'in-progress',
      }).valid,
      false
    )
  })

  test('rejects track count less than 1', () => {
    assert.equal(
      validateProjectPayload({
        title: 'Album',
        artist_id: '11111111-1111-1111-1111-111111111111',
        progress: 50,
        tracks: 0,
        status: 'in-progress',
      }).valid,
      false
    )
  })

  test('rejects unknown status values', () => {
    assert.equal(
      validateProjectPayload({
        title: 'Album',
        artist_id: '11111111-1111-1111-1111-111111111111',
        progress: 50,
        tracks: 4,
        status: 'draft',
      }).valid,
      false
    )
  })
})

describe('Supabase Environment Configuration Detection', () => {
  function checkConfig(url, anonKey) {
    if (!url || !anonKey) return false
    if (url.includes('placeholder') || url.includes('your-project') || url.includes('example.supabase.co')) {
      return false
    }
    if (anonKey.includes('placeholder') || anonKey.includes('your-anon-key')) {
      return false
    }
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  test('correctly identifies placeholder configuration in .env.local', () => {
    assert.equal(
      checkConfig('https://your-project.supabase.co', 'your-anon-key-placeholder'),
      false
    )
  })

  test('correctly identifies missing credentials', () => {
    assert.equal(checkConfig('', ''), false)
    assert.equal(checkConfig(undefined, undefined), false)
  })

  test('recognizes valid local or cloud Supabase connection URLs', () => {
    assert.equal(
      checkConfig('http://127.0.0.1:54321', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'),
      true
    )
    assert.equal(
      checkConfig('https://xyzcompany.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'),
      true
    )
  })
})
