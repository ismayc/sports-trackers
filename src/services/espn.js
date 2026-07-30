// The hub's one and only network dependency: ESPN's keyless, CORS-open scoreboard.
// No backend, no API key, no .env — a hard family rule. Called client-side at page load.
//
// For each viewer we ask for the days that can hold the user's own yesterday and today,
// because the scoreboard is a roughly-UTC-bucketed feed: last night's late game and
// tonight's game can land on either side of a UTC midnight, so a single day query would
// miss games the user still thinks of as "today" in their own zone. We then re-bucket by
// the *user's* calendar day with Intl parts (see utils/time dayKey).
//
// Those days are derived FROM the local buckets (see utcDaysForLocalDays), not by shifting
// UTC `now` — the family's older ±1-around-UTC-now shape silently dropped the whole
// "Yesterday" section for anyone west of UTC late in their day. Details on the function.

import { addDayKey, dayKey, todayKey } from '../utils/time.js'

const BASE = 'https://site.api.espn.com/apis/site/v2/sports'

// National broadcast/stream names for a game. `broadcasts[].names` is the flat network
// list; `geoBroadcasts[]` adds streamers and carries a market type — we keep National feeds
// and streaming, and drop home/away RSNs (not universally available). Used by the "what can
// I watch" filter (see utils/watch.js).
function broadcastNames(c) {
  const names = new Set()
  for (const b of c.broadcasts || []) for (const n of b.names || []) names.add(n)
  for (const gb of c.geoBroadcasts || []) {
    const n = gb.media?.shortName
    const nat = gb.market?.type === 'National' || gb.type?.shortName === 'Streaming'
    if (n && nat) names.add(n)
  }
  return [...names]
}

// Normalize one ESPN event into the hub's flat game shape. Returns null for anything the
// hub can't or shouldn't show (missing competitors, or — for college — a non-tournament
// game that shares the seasontype=3 window).
// PRESEASON IS IGNORED BY CHOICE. ESPN stamps each event with its season type, and a plain
// date query (every non-college viewer) happily returns exhibition games: on 2026-07-29 the
// hub's two-week look-ahead surfaced the NFL Hall of Fame Game as "next up", which is not a
// game that counts. `season.type` is 1 / slug 'preseason' for those.
//
// Drop ONLY type 1. Do not generalise this to "anything that isn't 2": 3 is the postseason
// and 5 is the NBA play-in, both of which absolutely must show. And drop only when ESPN says
// so explicitly — an event with no `season` block is kept, because hiding a real game is a
// worse failure than showing an exhibition one.
export function isPreseason(ev) {
  const s = ev.season || {}
  return s.type === 1 || s.slug === 'preseason'
}

function normalize(ev, v) {
  const c = ev.competitions?.[0]
  if (!c) return null
  if (isPreseason(ev)) return null

  // March-Madness filter. The men's/women's college seasontype=3 window ALSO carries NIT,
  // College Basketball Crown, and WBIT games. The only reliable tell that a row belongs to
  // the actual tournament is its competition headline. Drop everything else.
  if (v.mmHeadline) {
    const headline = c.notes?.[0]?.headline || ''
    if (!headline.startsWith(v.mmHeadline)) return null
  }

  const home = c.competitors?.find((t) => t.homeAway === 'home')
  const away = c.competitors?.find((t) => t.homeAway === 'away')
  if (!home || !away) return null

  const st = c.status?.type || {}
  const num = (s) => {
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  const as = num(away.score)
  const hs = num(home.score)
  // A score is only meaningful once the game is live or done; ignore the 0–0 the feed
  // shows for a game that hasn't tipped.
  const hasScore = as !== null && hs !== null && (st.state === 'in' || st.completed)

  return {
    id: ev.id,
    tip: ev.date, // absolute ISO instant
    home: home.team?.displayName || home.team?.shortDisplayName || home.team?.name || '',
    away: away.team?.displayName || away.team?.shortDisplayName || away.team?.name || '',
    homeAbbr: home.team?.abbreviation || '',
    awayAbbr: away.team?.abbreviation || '',
    state: st.state || 'pre', // 'pre' | 'in' | 'post'
    score: hasScore ? [as, hs] : null, // [away, home] so it reads left-to-right as AWAY @ HOME
    statusLabel: st.shortDetail || st.detail || null, // "Q3 4:21", "Final", "7:00 PM"
    broadcast: broadcastNames(c), // national networks/streamers, for the watch filter
  }
}

// Fetch one viewer's today window. Tolerant of per-day failures (allSettled): if one of
// the day-queries 404s or the feed is empty (an offseason viewer), the others still
// resolve and we simply return fewer games. Never throws for a viewer being out of season.
// Look-ahead horizon for "next up" / the watch filter: two weeks out.
const HORIZON_DAYS = 14

// How many single days behind / ahead of the user's own "today" to request, so that the
// yesterday and today buckets are always complete.
//
// THIS IS THE FIX for a bug where the "Yesterday" section silently emptied. The window used
// to be built by shifting UTC `now` by ±1 day, while the buckets are computed in the USER'S
// zone — so once UTC's date ran ahead of the local date (any negative-offset zone, late in
// the local day), local "yesterday" began two days back and was never requested. At
// 2026-07-29 17:10 in Phoenix the code asked for Jul 29/30/31 while yesterday's 1pm and 4pm
// games sat in the Jul 28 bucket. Evening games survived, being already filed on the next
// day, which is why the section emptied on a day of afternoon games rather than shrinking.
//
// WHY 2 BACK AND 1 FORWARD IS ENOUGH FOR EVERY ZONE ON EARTH. `dates=D` is not a UTC day —
// verified against the live feed, `dates=20260728` returned instants from 2026-07-28T23:30Z
// through 2026-07-29T02:00Z, i.e. ESPN files by the US EASTERN day. Bounding it in those
// terms: the earliest instant of the user's local yesterday is (tKey-1) 00:00 at UTC+14, which
// is (tKey-2) ~05:00 Eastern — never earlier than bucket tKey-2. The latest instant of the
// user's local today is tKey 23:59 at UTC-12, which is (tKey+1) ~07:00 Eastern — never later
// than bucket tKey+1. So [tKey-2, tKey+1] always contains both buckets, whatever the zone, and
// it is wide enough that the exact per-league bucketing convention does not have to be known.
// Re-bucketing by `tz` below means a surplus day can only add games we then ignore.
const DAYS_BACK = 2
const DAYS_FORWARD = 1

export async function fetchViewerDay(v, { signal, now = new Date(), tz } = {}) {
  // Two kinds of query: SINGLE days covering yesterday + today in the user's own zone (each
  // day is well under the scoreboard's silent event cap, so nothing is thinned), plus forward
  // RANGES out to the horizon for the look-ahead. A range never drops its earliest games but
  // thins the middle days of a dense league's window, so the horizon is split into two ~week
  // ranges: each half's early days are exact, which keeps the two-week breakdown honest for
  // NBA-density schedules at the cost of one extra request per viewer.
  // Anchored on the user's OWN today, not on UTC now — see DAYS_BACK above.
  const tKey = todayKey(tz, now)
  const yKey = addDayKey(tKey, -1)

  const singles = []
  for (let d = -DAYS_BACK; d <= DAYS_FORWARD; d++) singles.push(addDayKey(tKey, d))

  // Forward coverage starts the day after the last single day, so the span stays contiguous
  // out to the horizon with no gap and no double-counting.
  const forwardFrom = addDayKey(tKey, DAYS_FORWARD + 1)
  const horizonEnd = addDayKey(tKey, HORIZON_DAYS)
  const splitAt = addDayKey(forwardFrom, Math.ceil(HORIZON_DAYS / 2) - 1)

  const compact = (key) => key.replace(/-/g, '')
  const queries = [
    ...singles.map(compact),
    `${compact(forwardFrom)}-${compact(splitAt)}`,
    `${compact(addDayKey(splitAt, 1))}-${compact(horizonEnd)}`,
  ]

  // College viewers need the tournament bracket group + postseason type. Harmless for a
  // non-tournament date (the feed just returns whatever seasontype=3 it has, then the
  // headline filter empties it).
  const suffix = v.college ? '&groups=50&seasontype=3' : ''

  const results = await Promise.allSettled(
    queries.map(async (d) => {
      const res = await fetch(`${BASE}/${v.espnPath}/scoreboard?dates=${d}${suffix}`, { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
  )

  const byId = new Map()
  let anyOk = false
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    anyOk = true
    for (const ev of r.value.events || []) {
      const g = normalize(ev, v)
      if (g) byId.set(g.id, g)
    }
  }

  const all = [...byId.values()].sort((a, b) => new Date(a.tip) - new Date(b.tip))
  // `tKey` / `yKey` are the SAME keys the query window above was built from — that is the
  // whole point of the fix, so the days we ask for and the days we bucket into cannot drift.
  const today = all.filter((g) => dayKey(g.tip, tz) === tKey)
  const live = today.filter((g) => g.state === 'in').length
  const yesterday = all.filter((g) => dayKey(g.tip, tz) === yKey)
  // Every not-yet-started game in the window, soonest first. `next` is the first of these;
  // the watch filter re-derives its own next from this list after dropping unwatchable games.
  const upcoming = all.filter((g) => g.state === 'pre' && new Date(g.tip).getTime() > now.getTime())

  return { id: v.id, ok: anyOk, today, live, yesterday, upcoming, next: upcoming[0] || null }
}

// Load every viewer at once. One slow/failed feed never blocks the rest.
export async function fetchAllViewers(viewers, opts = {}) {
  const settled = await Promise.allSettled(viewers.map((v) => fetchViewerDay(v, opts)))
  return settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { id: viewers[i].id, ok: false, today: [], live: 0, yesterday: [], upcoming: [], next: null }
  )
}
