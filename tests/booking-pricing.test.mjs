import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateEstimatedBookingCost,
  formatCurrencyINR,
} from '../src/app/bookings/pricing.ts'

describe('Dynamic Booking Price Estimation Tests', () => {
  // Verified studio room rates loaded from Supabase
  const ROOMS = {
    STUDIO_A: { id: '5e1c46a9-d16b-47f2-b44a-9a5ede50a5f1', name: 'Studio A (Main Live Room)', hourly_rate: 150 },
    STUDIO_B: { id: '11222510-f14a-4745-9744-0e053f94c8bc', name: 'Studio B (Mix Suite)', hourly_rate: 100 },
    VOCAL_BOOTH: { id: 'c1fcfed4-9d9f-4ec4-81c6-0c11417df46e', name: 'Vocal Booth', hourly_rate: 65 },
  }

  test('Combination 1: Studio A (150) + 1 hour = ₹150', () => {
    const cost = calculateEstimatedBookingCost(ROOMS.STUDIO_A.hourly_rate, 1)
    assert.equal(cost, 150)
    assert.equal(formatCurrencyINR(cost), '₹150')
  })

  test('Combination 2: Studio A (150) + 2 hours = ₹300', () => {
    const cost = calculateEstimatedBookingCost(ROOMS.STUDIO_A.hourly_rate, 2)
    assert.equal(cost, 300)
    assert.equal(formatCurrencyINR(cost), '₹300')
  })

  test('Combination 3: Studio B (100) + 3 hours = ₹300', () => {
    const cost = calculateEstimatedBookingCost(ROOMS.STUDIO_B.hourly_rate, 3)
    assert.equal(cost, 300)
    assert.equal(formatCurrencyINR(cost), '₹300')
  })

  test('Combination 4: Vocal Booth (65) + 4 hours = ₹260', () => {
    const cost = calculateEstimatedBookingCost(ROOMS.VOCAL_BOOTH.hourly_rate, 4)
    assert.equal(cost, 260)
    assert.equal(formatCurrencyINR(cost), '₹260')
  })

  test('Combination 5: Change room after selecting duration', () => {
    let duration = 3
    // Initially Studio A (150 * 3 = 450)
    let cost = calculateEstimatedBookingCost(ROOMS.STUDIO_A.hourly_rate, duration)
    assert.equal(cost, 450)
    assert.equal(formatCurrencyINR(cost), '₹450')

    // Switch to Studio B (100 * 3 = 300)
    cost = calculateEstimatedBookingCost(ROOMS.STUDIO_B.hourly_rate, duration)
    assert.equal(cost, 300)
    assert.equal(formatCurrencyINR(cost), '₹300')

    // Switch to Vocal Booth (65 * 3 = 195)
    cost = calculateEstimatedBookingCost(ROOMS.VOCAL_BOOTH.hourly_rate, duration)
    assert.equal(cost, 195)
    assert.equal(formatCurrencyINR(cost), '₹195')
  })

  test('Combination 6: Change duration after selecting room', () => {
    const room = ROOMS.STUDIO_A
    // Duration 1 hour -> 150
    assert.equal(calculateEstimatedBookingCost(room.hourly_rate, 1), 150)
    // Change to 2 hours -> 300
    assert.equal(calculateEstimatedBookingCost(room.hourly_rate, 2), 300)
    // Change to 4 hours -> 600
    assert.equal(calculateEstimatedBookingCost(room.hourly_rate, 4), 600)
    // Change to 8 hours (full day) -> 1200
    assert.equal(calculateEstimatedBookingCost(room.hourly_rate, 8), 1200)
  })

  test('Combination 7: No room selected returns null', () => {
    assert.equal(calculateEstimatedBookingCost(null, 2), null)
    assert.equal(calculateEstimatedBookingCost(undefined, 2), null)
    assert.equal(calculateEstimatedBookingCost('', 2), null)
  })

  test('Combination 8: Invalid, zero, or missing hourly rate returns null', () => {
    assert.equal(calculateEstimatedBookingCost(0, 2), null)
    assert.equal(calculateEstimatedBookingCost(-50, 2), null)
    assert.equal(calculateEstimatedBookingCost('not-a-number', 2), null)
    assert.equal(calculateEstimatedBookingCost(NaN, 2), null)
    assert.equal(calculateEstimatedBookingCost(150, null), null)
    assert.equal(calculateEstimatedBookingCost(150, 0), null)
    assert.equal(calculateEstimatedBookingCost(150, -2), null)
  })

  test('Accepts string-formatted numeric rates from PostgreSQL decimal/numeric types', () => {
    // Supabase PostgREST returns decimal columns as strings, e.g. "150"
    const cost = calculateEstimatedBookingCost('150', '2')
    assert.equal(cost, 300)
    assert.equal(formatCurrencyINR(cost), '₹300')
  })
})
