import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  detectTimezone,
  isValidZone,
  timezoneOptions,
  TIMEZONES,
  formatTime,
  formatDate,
  dayKey,
  todayKey,
  formatDayTime,
  daysUntilMonthDay,
} from '../src/utils/time.js'

afterEach(() => vi.restoreAllMocks())

describe('isValidZone', () => {
  it('accepts a real IANA zone and rejects junk', () => {
    expect(isValidZone('America/Chicago')).toBe(true)
    expect(isValidZone('UTC')).toBe(true)
    expect(isValidZone('Not/AZone')).toBe(false)
  })

  it('rejects empty input without throwing', () => {
    expect(isValidZone('')).toBe(false)
    expect(isValidZone(null)).toBe(false)
    expect(isValidZone(undefined)).toBe(false)
  })
})

describe('detectTimezone', () => {
  it('returns the environment zone', () => {
    // vite.config pins the suite to New York; see timezone-pinned.test.js.
    expect(detectTimezone()).toBe('America/New_York')
  })

  it('falls back to Eastern when Intl throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no Intl')
    })
    expect(detectTimezone()).toBe('America/New_York')
  })

  it('falls back to Eastern when Intl reports no zone', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({
      resolvedOptions: () => ({ timeZone: undefined }),
    }))
    expect(detectTimezone()).toBe('America/New_York')
  })
})

describe('timezoneOptions', () => {
  it('returns the catalog untouched for a known zone', () => {
    expect(timezoneOptions('America/Denver')).toBe(TIMEZONES)
  })

  it('prepends an unknown zone so a shared ?tz= link stays selectable', () => {
    const opts = timezoneOptions('Pacific/Auckland')
    expect(opts).toHaveLength(TIMEZONES.length + 1)
    expect(opts[0]).toEqual({ id: 'Pacific/Auckland', label: 'Auckland' })
  })

  it('humanises an underscored city name', () => {
    expect(timezoneOptions('America/Mexico_City')[0].label).toBe('Mexico City')
  })
})

describe('formatting', () => {
  const iso = '2026-07-29T23:30:00Z' // 7:30pm Eastern

  it('formats the time in the requested zone', () => {
    expect(formatTime(iso, 'America/New_York')).toBe('7:30 PM')
    expect(formatTime(iso, 'America/Los_Angeles')).toBe('4:30 PM')
  })

  it('formats a date, and honours extra Intl options', () => {
    expect(formatDate(iso, 'America/New_York')).toBe('Wed, Jul 29')
    expect(formatDate(iso, 'America/New_York', { weekday: undefined })).toBe('Jul 29')
  })

  it('formatDayTime gives a compact lowercase day + time', () => {
    expect(formatDayTime(iso, 'America/New_York')).toBe('Wed, Jul 29 · 7:30 pm')
  })
})

describe('dayKey — the hub\'s whole reason for existing', () => {
  // A late Pacific tip is one calendar day out west and the NEXT one back east. Bucketing
  // by UTC would put it on the wrong day for at least one of them.
  const lateTip = '2026-07-30T02:00:00Z' // 10pm Jul 29 Eastern, 7pm Jul 29 Pacific, Jul 30 UTC

  it('buckets by the viewer\'s calendar day, not UTC', () => {
    expect(dayKey(lateTip, 'America/New_York')).toBe('2026-07-29')
    expect(dayKey(lateTip, 'America/Los_Angeles')).toBe('2026-07-29')
    expect(dayKey(lateTip, 'UTC')).toBe('2026-07-30')
  })

  it('pads month and day to a sortable key', () => {
    expect(dayKey('2026-01-05T17:00:00Z', 'UTC')).toBe('2026-01-05')
  })

  it('is DST-safe across a spring-forward boundary', () => {
    // 2026-03-08 is the US spring-forward. Both sides land on the day the viewer saw.
    expect(dayKey('2026-03-08T06:30:00Z', 'America/New_York')).toBe('2026-03-08')
    expect(dayKey('2026-03-08T04:30:00Z', 'America/New_York')).toBe('2026-03-07')
  })

  it('todayKey uses now in the given zone', () => {
    const now = new Date('2026-07-30T02:00:00Z')
    expect(todayKey('America/New_York', now)).toBe('2026-07-29')
    expect(todayKey('UTC', now)).toBe('2026-07-30')
  })

  it('todayKey defaults to the real clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-05T16:00:00Z'))
    expect(todayKey('UTC')).toBe('2026-05-05')
    vi.useRealTimers()
  })
})

describe('daysUntilMonthDay', () => {
  it('counts forward within the same year', () => {
    expect(daysUntilMonthDay(new Date(2026, 6, 29), 8, 5)).toBe(7)
  })

  it('returns 0 for today', () => {
    expect(daysUntilMonthDay(new Date(2026, 6, 29), 7, 29)).toBe(0)
  })

  it('rolls into next year once the date has passed', () => {
    // From 29 Jul 2026 to 1 Mar: must be next March, not a negative count.
    const d = daysUntilMonthDay(new Date(2026, 6, 29), 3, 1)
    expect(d).toBeGreaterThan(200)
    expect(d).toBeLessThan(260)
  })

  it('is unaffected by the time of day', () => {
    const early = daysUntilMonthDay(new Date(2026, 6, 29, 0, 1), 8, 5)
    const late = daysUntilMonthDay(new Date(2026, 6, 29, 23, 59), 8, 5)
    expect(early).toBe(late)
  })
})
