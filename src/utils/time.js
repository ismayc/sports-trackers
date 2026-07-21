// Timezone + formatting core, lifted from the family (the-nba-schedule/src/utils/time.js)
// and trimmed to what the hub needs. Every game's `tip` is an absolute instant (UTC ISO),
// so rendering into any IANA zone is a pure formatting concern — no date math here.

export const detectTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
  } catch {
    return 'America/New_York'
  }
}

/** Validate against Intl rather than a hard-coded list, so any zone in a link works. */
export function isValidZone(tz) {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// The zones worth one tap — same list the viewers offer. Cross-sport, so it leans US
// (that's where six of the seven leagues play) with the family's international picks.
export const TIMEZONES = [
  { id: 'America/New_York', label: 'Eastern' },
  { id: 'America/Chicago', label: 'Central' },
  { id: 'America/Denver', label: 'Mountain' },
  { id: 'America/Phoenix', label: 'Arizona' },
  { id: 'America/Los_Angeles', label: 'Pacific' },
  { id: 'America/Toronto', label: 'Toronto' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Europe/Paris', label: 'Central Europe' },
  { id: 'Australia/Sydney', label: 'Sydney' },
  { id: 'UTC', label: 'UTC' },
]

export function timezoneOptions(current) {
  const known = TIMEZONES.some((t) => t.id === current)
  return known
    ? TIMEZONES
    : [{ id: current, label: current.split('/').pop().replace(/_/g, ' ') }, ...TIMEZONES]
}

const fmt = (tz, opts) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts })

export function formatTime(iso, tz) {
  return fmt(tz, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function formatDate(iso, tz, opts = {}) {
  return fmt(tz, { weekday: 'short', month: 'short', day: 'numeric', ...opts }).format(new Date(iso))
}

// Stable YYYY-MM-DD key for the calendar day a game falls on *in the viewer's zone*.
// A 10pm Pacific tip is "today" out west and "tomorrow" on the east coast; the hub must
// bucket "today" by what the user actually sees, not by UTC. Uses Intl parts, not date
// arithmetic, so DST never bites.
export function dayKey(iso, tz) {
  const p = fmt(tz, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso))
  const get = (t) => p.find((x) => x.type === t).value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export const todayKey = (tz, now = new Date()) => dayKey(now.toISOString(), tz)

// "Fri 7:00pm" — one compact string for a next-up game.
export function formatDayTime(iso, tz) {
  // Weekday + date, since "next up" can be up to two weeks out and a bare weekday would be
  // ambiguous (which Wednesday?).
  const day = fmt(tz, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso))
  return `${day} · ${formatTime(iso, tz).toLowerCase()}`
}

// Coarse days-until for a month/day this year (or next year if it already passed). Used
// only for the "Starts in Nd" badge, so approximate-to-the-day is fine.
export function daysUntilMonthDay(now, month, day) {
  const y = now.getFullYear()
  const startThisYear = new Date(y, month - 1, day)
  const target = startThisYear >= startOfDay(now) ? startThisYear : new Date(y + 1, month - 1, day)
  return Math.round((startOfDay(target) - startOfDay(now)) / 86_400_000)
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
