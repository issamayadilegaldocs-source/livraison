import { describe, expect, it } from '@jest/globals'

import { calculateAmount, calculateServiceFee, formatTimeSlot, isOpen, timeToMinutes } from '../customFunctions'

// Regression guards for the delivery-fee math introduced/extended in
// "Add configurable base delivery fee and distance". This is money math wired
// into Cart and Checkout, so each cost type and the rounding/clamping rules are
// pinned here.
describe('calculateAmount', () => {
  describe("costType 'fixed'", () => {
    it('returns the flat delivery rate regardless of distance', () => {
      expect(calculateAmount('fixed', 50, 9.9, 10, 2)).toBe(50)
      expect(calculateAmount('fixed', 50, 0, 10, 2)).toBe(50)
    })
  })

  describe('default per-kilometre costType', () => {
    it('charges the rate per kilometre, rounding distance up', () => {
      // 3.2 km -> 4 billed km * 5 = 20
      expect(calculateAmount('perKm', 5, 3.2)).toBe(20)
    })

    it('rounds any fractional kilometre up to the next whole unit', () => {
      expect(calculateAmount('perKm', 2, 0.1)).toBe(2)
    })
  })

  describe("costType 'tiered'", () => {
    it('charges only the base fee while within the included distance', () => {
      // ceil(1.5)=2 included by baseDistance 3 -> no extra km
      expect(calculateAmount('tiered', 5, 1.5, 10, 3)).toBe(10)
    })

    it('adds the per-kilometre rate for distance beyond the included band', () => {
      // 10 + max(0, ceil(6.1)=7 - 3) * 5 = 10 + 20 = 30
      expect(calculateAmount('tiered', 5, 6.1, 10, 3)).toBe(30)
    })

    it('never charges negative extra distance (clamped at zero)', () => {
      expect(calculateAmount('tiered', 5, 0, 10, 3)).toBe(10)
    })

    it('rounds distance up before applying the per-kilometre rate', () => {
      // 0 + max(0, ceil(3.01)=4 - 0) * 2 = 8
      expect(calculateAmount('tiered', 2, 3.01, 0, 0)).toBe(8)
    })

    it('defaults baseFee/baseDistance to 0 when omitted (no NaN)', () => {
      const amount = calculateAmount('tiered', 5, 2)
      expect(amount).toBe(10)
      expect(Number.isNaN(amount)).toBe(false)
    })
  })

  describe("costType 'linear' + shaping (mirrors the API)", () => {
    it('is continuous (no ceil): base + rate × distance', () => {
      // 1.75 + 0.326 × 3.8 = 2.9888
      expect(calculateAmount('linear', 0.326, 3.8, 1.75)).toBeCloseTo(2.9888, 4)
    })

    it('reproduces the reconstructed TND tariff: round to 0.5, floor 2, cap 6', () => {
      const shaping = { min: 2, max: 6, round: 0.5 }
      expect(calculateAmount('linear', 0.326, 3.8, 1.75, 0, shaping)).toBe(3) // 2.989→3.0
      expect(calculateAmount('linear', 0.326, 8.6, 1.75, 0, shaping)).toBe(4.5) // 4.544→4.5
      expect(calculateAmount('linear', 0.326, 13, 1.75, 0, shaping)).toBe(6) // 5.988→6.0
      expect(calculateAmount('linear', 0.326, 0.2, 1.75, 0, shaping)).toBe(2) // ~1.75→1.5, floored to 2
      expect(calculateAmount('linear', 0.326, 40, 1.75, 0, shaping)).toBe(6) // capped
    })

    it('shaping is a no-op when omitted', () => {
      expect(calculateAmount('perKm', 2, 2.5)).toBe(6) // ceil(2.5)=3 × 2
    })
  })
})

describe('calculateServiceFee', () => {
  const cfg = {
    serviceFeeEnabled: true,
    serviceFeeRate: 0.07,
    serviceFeeMinimum: 0.7,
    serviceFeeMaximum: 5,
  }

  it('returns 0 when disabled or rate is 0', () => {
    expect(calculateServiceFee({ ...cfg, serviceFeeEnabled: false }, 100)).toBe(0)
    expect(calculateServiceFee({ ...cfg, serviceFeeRate: 0 }, 100)).toBe(0)
    expect(calculateServiceFee(undefined, 100)).toBe(0)
  })

  it('is 7% of the food amount within the band', () => {
    // 24.3 × 0.07 = 1.701
    expect(calculateServiceFee(cfg, 24.3)).toBeCloseTo(1.701, 3)
  })

  it('applies the minimum floor', () => {
    // 7 × 0.07 = 0.49 → floored to 0.7
    expect(calculateServiceFee(cfg, 7)).toBeCloseTo(0.7, 3)
  })

  it('applies the maximum cap (0 = uncapped)', () => {
    // 81 × 0.07 = 5.67 → capped at 5
    expect(calculateServiceFee(cfg, 81)).toBe(5)
    expect(calculateServiceFee({ ...cfg, serviceFeeMaximum: 0 }, 81)).toBeCloseTo(5.67, 3)
  })
})

// The API's TimeValue scalar serializes opening times as canonical "HH:MM"
// strings, while legacy documents carried ["HH","MM"] arrays. Indexing a
// string ("09:00"[0] === "0") rendered opening hours as "0:9 – 2:3" on the
// About/Restaurant screens and broke open/closed checks in sibling apps.
// These pin the shape-tolerant behavior for both shapes.
describe('formatTimeSlot', () => {
  it('formats the canonical "HH:MM" string shape as-is (zero-padded)', () => {
    expect(formatTimeSlot('09:00')).toBe('09:00')
    expect(formatTimeSlot('23:59')).toBe('23:59')
    expect(formatTimeSlot('9:5')).toBe('09:05')
  })

  it('formats the legacy ["HH","MM"] array shape', () => {
    expect(formatTimeSlot(['09', '00'])).toBe('09:00')
    expect(formatTimeSlot(['23', '59'])).toBe('23:59')
  })

  it('never renders single characters from string indexing (the regression)', () => {
    expect(formatTimeSlot('23:59')).not.toBe('2:3')
  })
})

describe('timeToMinutes', () => {
  it('parses both time shapes to minutes since midnight', () => {
    expect(timeToMinutes('08:30')).toBe(510)
    expect(timeToMinutes(['08', '30'])).toBe(510)
  })

  it('returns null for unparseable values instead of NaN', () => {
    expect(timeToMinutes(undefined)).toBeNull()
    expect(timeToMinutes('bogus')).toBeNull()
  })
})

describe('isOpen', () => {
  const day = new Date().toLocaleString('en-US', { weekday: 'short' }).toUpperCase()

  it('prefers the server-computed isOpen flag when present', () => {
    expect(isOpen({ isOpen: true, isAvailable: false, openingTimes: [] })).toBe(true)
    expect(isOpen({ isOpen: false, isAvailable: true, openingTimes: [] })).toBe(false)
  })

  it('falls back to local evaluation with canonical "HH:MM" slots', () => {
    const restaurant = {
      isAvailable: true,
      openingTimes: [{ day, times: [{ startTime: '00:00', endTime: '23:59' }] }]
    }
    expect(isOpen(restaurant)).toBe(true)
  })

  it('falls back to local evaluation with legacy ["HH","MM"] slots', () => {
    const restaurant = {
      isAvailable: true,
      openingTimes: [{ day, times: [{ startTime: ['00', '00'], endTime: ['23', '59'] }] }]
    }
    expect(isOpen(restaurant)).toBe(true)
  })

  it('reports closed for a day with no configured slots', () => {
    const restaurant = { isAvailable: true, openingTimes: [{ day, times: [] }] }
    expect(isOpen(restaurant)).toBe(false)
  })
})
