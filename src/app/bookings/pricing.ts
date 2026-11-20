/**
 * Pricing utilities for SmartStudio AI booking cost estimations.
 */

/**
 * Calculates the estimated session cost for a studio room booking.
 *
 * Formula:
 * Estimated Cost = Selected Room Hourly Rate × Selected Duration (in hours)
 *
 * Safely handles missing room, non-numeric rate, zero/negative rates, or missing duration.
 * Returns null if rate or duration is missing, non-positive, or invalid.
 */
export function calculateEstimatedBookingCost(
  hourlyRate: number | string | null | undefined,
  durationHours: number | string | null | undefined
): number | null {
  if (hourlyRate === null || hourlyRate === undefined || hourlyRate === '') {
    return null
  }
  if (durationHours === null || durationHours === undefined || durationHours === '') {
    return null
  }

  const rate = typeof hourlyRate === 'string' ? parseFloat(hourlyRate) : hourlyRate
  const duration = typeof durationHours === 'string' ? parseFloat(durationHours) : durationHours

  if (isNaN(rate) || isNaN(duration)) {
    return null
  }

  if (rate <= 0 || duration <= 0) {
    return null
  }

  return Math.round(rate * duration * 100) / 100
}

/**
 * Formats a monetary amount using Indian Rupee (INR) currency convention.
 * Example: 300 -> "₹300"
 */
export function formatCurrencyINR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₹0'
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}
