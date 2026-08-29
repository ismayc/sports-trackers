// The team catalog behind "My teams", read from ESPN's standings feed.
//
// NOT the obvious route. `site.web.api.espn.com/.../{league}/teams` is the natural place to ask
// for a league's clubs and it works from curl, but it answers a browser with NO
// `access-control-allow-origin` header at all, so every request from the page fails as an
// opaque "Failed to fetch". Verified 2026-08-17 against both site.api and site.web.api: the
// scoreboard sends `access-control-allow-origin: *`, /teams sends nothing.
//
// `site.web.api.espn.com/apis/v2/sports/{espnPath}/standings?level=3` IS CORS-open, and its
// entries carry the same team objects. Verified the same day, in Chrome, for all four live
// viewers: the standings list the full current-season field (NBA 30, NFL 32, WNBA 15,
// Premier League 20) and every abbreviation appearing on the scoreboard is in it, which is
// what lets a team picked here and a team starred on a game row share one follow key.
// Standings are current-season, so a promoted Premier League club is there the season it
// comes up, which a committed list would not be.
//
// IT IS NOT FETCHED AT PAGE LOAD. The hub already makes six scoreboard requests per viewer
// on mount; the catalog is only needed once the picker is open, so it is fetched then and
// cached in localStorage for a week. A field changes about once a season, and the cache also
// means the picker still opens with a usable list when ESPN is unreachable.

const BASE = 'https://site.web.api.espn.com/apis/v2/sports'
const CACHE_KEY = 'st:teams'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

const logoFor = (team, tag) => (team.logos || []).find((l) => l.rel?.includes(tag))?.href || null

// One league's standings payload into the flat rows the picker renders, in name order.
// The entries are nested by conference/division (and by group for soccer), and the exact
// depth differs per sport, so this walks the tree rather than assuming a shape. A Map keyed
// by abbreviation collapses the duplicates a walk necessarily finds.
export function parseTeams(payload) {
  const seen = new Map()
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    for (const entry of node.standings?.entries || []) {
      const team = entry.team || {}
      if (!team.abbreviation || seen.has(team.abbreviation)) continue
      seen.set(team.abbreviation, {
        abbr: team.abbreviation,
        name: team.displayName || team.abbreviation,
        // The light mark only. ESPN's dark variants are inconsistent and four WNBA clubs
        // have none, so the picker puts every crest on a pale chip in dark mode instead
        // (see components/TeamLogo.jsx for the full finding).
        logo: logoFor(team, 'default'),
      })
    }
    Object.values(node).forEach(walk)
  }
  walk(payload)
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

const writeCache = (next) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  } catch {
    /* private mode, so the catalog just gets refetched next time */
  }
}

// Load every viewer's catalog at once, cache-first. Returns { [viewerId]: [{abbr,name,…}] }
// and NEVER rejects: a league whose request fails comes back as its cached list if there is
// one, else an empty array, which the picker renders as its own small "couldn't load" note
// rather than blanking the whole dialog.
export async function fetchTeams(viewers, { signal, now = Date.now() } = {}) {
  const cache = readCache()
  const out = {}
  const fresh = {}

  await Promise.all(
    viewers.map(async (v) => {
      const hit = cache[v.id]
      if (hit && now - hit.at < TTL_MS) {
        out[v.id] = hit.teams
        return
      }
      try {
        const res = await fetch(`${BASE}/${v.espnPath}/standings?level=3`, { signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const teams = parseTeams(await res.json())
        // An empty list is a bad answer, not a real one: no live league has zero teams.
        // Treat it like a failure so a stale-but-real cache is preferred over nothing.
        if (teams.length === 0) throw new Error('empty catalog')
        out[v.id] = teams
        fresh[v.id] = { at: now, teams }
      } catch {
        out[v.id] = hit ? hit.teams : []
      }
    })
  )

  if (Object.keys(fresh).length > 0) writeCache({ ...cache, ...fresh })
  return out
}
