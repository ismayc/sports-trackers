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
  const day = fmt(tz, { weekday: 'short' }).format(new Date(iso))
  return `${day} ${formatTime(iso, tz).toLowerCase()}`
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
