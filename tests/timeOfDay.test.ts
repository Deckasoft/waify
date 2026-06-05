import { describe, it, expect } from 'vitest'
import { partOfDay, describeTimeOfDay } from '../src/core/prompt.ts'

describe('partOfDay', () => {
  it('maps hours to a part of day', () => {
    expect(partOfDay(5)).toBe('morning')
    expect(partOfDay(11)).toBe('morning')
    expect(partOfDay(12)).toBe('afternoon')
    expect(partOfDay(17)).toBe('afternoon')
    expect(partOfDay(18)).toBe('evening')
    expect(partOfDay(21)).toBe('evening')
    expect(partOfDay(22)).toBe('night')
    expect(partOfDay(0)).toBe('night')
    expect(partOfDay(4)).toBe('night')
  })
})

describe('describeTimeOfDay', () => {
  // America/Guayaquil is a fixed UTC-5 (no DST), so these are deterministic.
  const tz = 'America/Guayaquil'

  it('reports local time and part of day for the given timezone', () => {
    expect(describeTimeOfDay(tz, new Date('2026-06-05T14:00:00Z'))).toBe('09:00 (morning)')
    expect(describeTimeOfDay(tz, new Date('2026-06-05T20:00:00Z'))).toBe('15:00 (afternoon)')
    expect(describeTimeOfDay(tz, new Date('2026-06-06T01:00:00Z'))).toBe('20:00 (evening)')
    expect(describeTimeOfDay(tz, new Date('2026-06-06T04:00:00Z'))).toBe('23:00 (night)')
  })

  it('respects the timezone (the original bug: a night send must not read as morning)', () => {
    // 2026-06-05T03:00Z is 22:00 the night before in Guayaquil — must be night.
    expect(describeTimeOfDay(tz, new Date('2026-06-05T03:00:00Z'))).toBe('22:00 (night)')
    // Same instant in UTC is 03:00 — still night, but a different clock time.
    expect(describeTimeOfDay('UTC', new Date('2026-06-05T03:00:00Z'))).toBe('03:00 (night)')
  })

  it('falls back to the host timezone instead of throwing on missing/invalid input', () => {
    const shape = /^\d{2}:\d{2} \((morning|afternoon|evening|night)\)$/
    expect(() => describeTimeOfDay(undefined)).not.toThrow()
    expect(describeTimeOfDay('')).toMatch(shape)
    expect(describeTimeOfDay('Not/AZone')).toMatch(shape)
  })
})
