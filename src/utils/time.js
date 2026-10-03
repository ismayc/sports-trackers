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

// Step a YYYY-MM-DD key by whole days. Anchored at NOON UTC so a ±1 step can never land on
// the wrong date via a DST jump — the same trick the two-week grid uses, now shared with
// services/espn.js, which builds its query window out of these keys.
export function addDayKey(key, n) {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── A GAME'S DAY AND TIME ───────────────────────────────────────────────────────────
// Three helpers that every surface showing a game must go through, because a game whose
// tip time ESPN has not announced carries a PLACEHOLDER instant (midnight US Eastern on
// the game's date — see `timeTBD` in services/espn). Formatting that instant invents a
// time, and bucketing it in the user's zone files the game a day early anywhere west of
// Eastern. These three are where that is handled once instead of at five call sites.

// The calendar day a game belongs to. For an ordinary game that is the day the user sees
// it in their own zone; for a TBD game the instant cannot answer, so the feed's own filed
// day stands in.
export const gameDayKey = (game, tz) => game.day || dayKey(game.tip, tz)

// The right-hand label on a game that has not tipped: its local time, or that no time has
// been announced. `short` is for the calendar grid's narrow column.
export const gameTime = (game, tz, { short = false } = {}) =>
  game.timeTBD ? (short ? 'TBD' : 'Time TBD') : formatTime(game.tip, tz)

// "Sun, Oct 4 · 7:00pm", or "Sun, Oct 4 · time TBD" — the one-line "next up". The day is
// still exact for a TBD game; only the clock is unknown, and the line says which.
export const gameDayTime = (game, tz) =>
  game.timeTBD ? `${formatDayISO(gameDayKey(game, tz))} · time TBD` : formatDayTime(game.tip, tz)

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

// Days-until for a concrete 'YYYY-MM-DD' date, parsed in the LOCAL zone. Negative once the
// date has passed. Used for a tournament's "Starts in Nd" countdown, where the exact edition
// date is known (unlike the recurring month/day above).
export function daysUntilDate(now, iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  return Math.round((startOfDay(target) - startOfDay(now)) / 86_400_000)
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// The local calendar day as 'YYYY-MM-DD'. ISO dates sort lexically, so a plain string
// comparison answers "is today inside this window?" — which is how a tournament's archive
// boundary (data/viewers) and a league's international break (utils/phase) are both read.
export const localDayISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// "Sat, Oct 10" for a plain 'YYYY-MM-DD' calendar date — a date with no time and therefore
// no zone, unlike every other formatter here, which take an absolute instant. Anchored at
// noon UTC and read back in UTC so the day can never slide either side of a midnight: the
// date a fixture list prints is the same date everywhere on earth.
export function formatDayISO(iso) {
  return fmt('UTC', { weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(`${iso}T12:00:00Z`)
  )
}
