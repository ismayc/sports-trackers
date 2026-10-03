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

import { addDayKey, dayKey, gameDayKey, todayKey } from '../utils/time.js'

const BASE = 'https://site.web.api.espn.com/apis/site/v2/sports'

// ESPN files the scoreboard by the US EASTERN day (verified against the live feed — see
// DAYS_BACK below), and the placeholder instant it ships for a game with no announced tip
// time is midnight in that same zone. So Eastern is the one zone in which a placeholder
// reads back as the date ESPN meant by it.
const ESPN_DAY_TZ = 'America/New_York'

// National broadcast/stream names for a game. `broadcasts[].names` is the flat network
// list; `geoBroadcasts[]` adds streamers and carries a market type — we keep National feeds
// and streaming, and drop home/away RSNs (not universally available). Used by the "what can
// I watch" filter (see utils/watch.js).
function broadcastNames(c) {
  const names = new Set()
  // Each flat entry is stamped with its market; an away-market RSN ("MNMT",
  // "Arizona's Family 3TV") is not watchable in the user's market, so only the
  // national entries belong in the watch filter. Entries with no market stamp are
  // kept — hiding a real national network is the worse failure.
  for (const b of c.broadcasts || []) {
    if ((b.market ?? 'national') !== 'national') continue
    for (const n of b.names || []) names.add(n)
  }
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

// The crest a row shows. The scoreboard's own `team.logo` cannot be used as it arrives: for
// some clubs it is `.../500/sea.png` and for others `.../500/scoreboard/sea.png`, and the two
// are drawn in OPPOSITE inks: the plain file is the dark-on-transparent mark, the
// `/scoreboard/` one is light-on-transparent for ESPN's own dark scoreboard. Mixing them puts
// invisible logos in a row whichever background it has, which is exactly what the first
// attempt did (Seattle, Portland and Phoenix vanished, Chicago and Atlanta did not).
//
// Dropping the `/scoreboard/` segment normalizes every club onto the light-background mark.
// Checked against ESPN's own catalog on 2026-08-17: across all 97 teams in the four live
// leagues, the logo ESPN tags `rel: ["default"]` NEVER contains that segment, and each
// stripped URL resolves.
export function teamLogo(team) {
  const href = team?.logo
  return href ? href.replace('/scoreboard/', '/') : null
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

  // IS THE TIP TIME REAL? `timeValid: false` is ESPN's "not announced yet", and the `date`
  // it ships alongside is a placeholder — midnight US Eastern on the day of the game — not
  // a tip. Rendered like any other instant it invents a precise time that nobody has
  // announced, and west of Eastern it also files the game a day early: the WNBA semifinal
  // of 2026-10-04 arrived as 2026-10-04T04:00Z and read as "9:00 PM" on Oct 3 in Phoenix,
  // for a game whose status line said, in as many words, "10/4 - TBD".
  //
  // Only `=== false` counts. A feed that omits the field is the ordinary case of a real
  // time, and must not be read as TBD.
  const timeTBD = c.timeValid === false

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
    // The nickname on its own: "Wings", not "Dallas Wings". What the full-width rows show,
    // because the full name ellipsized on a phone, which is worse than either. ESPN's
    // shortDisplayName is unique within each of the four live leagues (checked team by team
    // on 2026-08-17), at most 13 characters ("Trail Blazers"), and for soccer it keeps the
    // club rather than the city: "Man United", "Nottm Forest", "Bournemouth".
    homeShort: home.team?.shortDisplayName || home.team?.name || '',
    awayShort: away.team?.shortDisplayName || away.team?.name || '',
    homeAbbr: home.team?.abbreviation || '',
    awayAbbr: away.team?.abbreviation || '',
    // The crest each row shows beside the team. Null when ESPN omits it, which the row
    // renders as no logo rather than a broken image.
    homeLogo: teamLogo(home.team),
    awayLogo: teamLogo(away.team),
    state: st.state || 'pre', // 'pre' | 'in' | 'post'
    timeTBD, // true when `tip` is a placeholder, not a tip time (see above)
    // The day ESPN filed this game on, for a TBD game only: the Eastern day of the
    // placeholder, which IS the date ESPN meant. Null otherwise, because a real instant
    // must keep being bucketed in the user's own zone. See `gameDayKey` in utils/time.
    day: timeTBD ? dayKey(ev.date, ESPN_DAY_TZ) : null,
    // Is this a postseason game? ESPN's season.type: 3 is the postseason, 5 the NBA
    // play-in (which sits outside 3 in ESPN's numbering — see isPreseason). Both make
    // the hub's badge read "Playoffs". This is the only reliable regular-vs-postseason
    // signal: the calendar can't tell them apart where they share a month (the WNBA
    // regular season runs into late September, its playoffs start after).
    postseason: [3, 5].includes(ev.season?.type),
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
// WHY 2 DAYS BACK IS ENOUGH FOR EVERY ZONE ON EARTH. `dates=D` is not a UTC day. Verified
// against the live feed, `dates=20260728` returned instants from 2026-07-28T23:30Z
// through 2026-07-29T02:00Z, i.e. ESPN files by the US EASTERN day. Bounding it in those
// terms: the earliest instant of the user's local yesterday is (tKey-1) 00:00 at UTC+14, which
// is (tKey-2) ~05:00 Eastern, never earlier than bucket tKey-2. So going 2 days back always
// reaches yesterday whatever the zone, without knowing the exact per-league bucketing
// convention. Re-bucketing by `tz` below means a surplus day can only add games we then ignore.
const DAYS_BACK = 2

export async function fetchViewerDay(v, { signal, now = new Date(), tz } = {}) {
  // One SINGLE-day query per day across the whole window: 2 days back (for yesterday, see
  // DAYS_BACK above) through the 14-day look-ahead horizon. ESPN dropped multi-day `dates=A-B`
  // range queries in September 2026 (they now 400 across every league), so the old approach of
  // a couple of forward ranges silently returned nothing past tomorrow and the two-week
  // breakdown collapsed to ~2 days. Single days are also each well under the scoreboard's
  // silent event cap, so a dense league's day is never thinned. Anchored on the user's OWN
  // today, not on UTC now.
  const tKey = todayKey(tz, now)
  const yKey = addDayKey(tKey, -1)

  const compact = (key) => key.replace(/-/g, '')
  const queries = []
  for (let d = -DAYS_BACK; d <= HORIZON_DAYS; d++) queries.push(compact(addDayKey(tKey, d)))

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
  const today = all.filter((g) => gameDayKey(g, tz) === tKey)
  const live = today.filter((g) => g.state === 'in').length
  const yesterday = all.filter((g) => gameDayKey(g, tz) === yKey)
  // Every not-yet-started game in the window, soonest first. `next` is the first of these;
  // the watch filter re-derives its own next from this list after dropping unwatchable games.
  //
  // A TBD game cannot answer "has it started?" with its instant: the placeholder is midnight
  // Eastern, so from the early hours of game day the game would test as already begun and
  // vanish from the look-ahead on the very day it is played. Its day is all the feed gives,
  // so it stays upcoming for the whole of that day.
  const upcoming = all.filter((g) => {
    if (g.state !== 'pre') return false
    return g.timeTBD ? gameDayKey(g, tz) >= tKey : new Date(g.tip).getTime() > now.getTime()
  })
  // "Playoffs" is a fact about the games actually on today, not a calendar guess: a
  // postseason game today (a live one is still in `today`) is the definitive signal.
  // Deliberately today-only — a look-ahead would light up "Playoffs" while the regular
  // season is still running, the very bug this replaces.
  const postseason = today.some((g) => g.postseason)

  return { id: v.id, ok: anyOk, today, live, yesterday, upcoming, next: upcoming[0] || null, postseason }
}

// Load every viewer at once. One slow/failed feed never blocks the rest.
export async function fetchAllViewers(viewers, opts = {}) {
  const settled = await Promise.allSettled(viewers.map((v) => fetchViewerDay(v, opts)))
  return settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { id: viewers[i].id, ok: false, today: [], live: 0, yesterday: [], upcoming: [], next: null, postseason: false }
  )
}
