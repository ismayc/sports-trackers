// The TV / streaming services a viewer can tell the hub they have, so the family page can
// filter to games they can actually watch. This is the CROSS-SPORT union: the hub fronts
// six leagues whose games land on very different networks (NBA/WNBA on ESPN·ABC·NBC·Prime,
// NFL on CBS·Fox·NBC·ESPN·Prime·Netflix, EPL on USA·NBC·Peacock, March Madness on
// CBS·Turner and ESPN·ABC), so the catalog has to span all of them.
//
// A game's `broadcast` (from services/espn.js) is a flat list of national network names.
// A streaming exclusive (Peacock, Paramount+, Max, Prime Video, Netflix, ESPN+) is matched
// by its own name; a live-TV *bundle* (YouTube TV, Hulu + Live TV, Fubo, Sling, cable)
// carries a game whenever it airs on a national linear network the bundle carries. Bundle
// carriage varies by bundle, market, and over time — these are national defaults and are
// deliberately approximate.

// Linear networks these sports use, by the names ESPN emits (with common variants).
const ABC = 'ABC'
const CBS = 'CBS'
const NBC = 'NBC'
const FOX = 'FOX'
const ESPN = 'ESPN'
const ESPN2 = 'ESPN2'
const ESPNU = 'ESPNU'
const ESPNEWS = 'ESPNEWS'
const TNT = 'TNT'
const TBS = 'TBS'
const TRUTV = 'truTV'
const USA = ['USA', 'USA Net']
const ION = 'ION'
const NBATV = 'NBA TV'
const NFLNET = ['NFL Network', 'NFL Net']

const flat = (...xs) => xs.flat()
const BROADCAST_NETS = flat(ABC, CBS, NBC, FOX) // the free over-the-air four
const CABLE_NETS = flat(ESPN, ESPN2, ESPNU, ESPNEWS, TNT, TBS, TRUTV, USA, ION, NBATV, NFLNET)
const ALL_LINEAR = flat(BROADCAST_NETS, CABLE_NETS)

// carries(...names) → matcher true when a game's broadcast list names any of them.
const carries = (...names) => {
  const set = new Set(names.flat())
  return (broadcast) => (broadcast || []).some((n) => set.has(n))
}

export const SERVICE_CATALOG = [
  // Streaming services, matched by their own name (+ the linear net some of them restream).
  { key: 'peacock', label: 'Peacock', kind: 'stream', match: carries('Peacock') },
  { key: 'paramount', label: 'Paramount+', kind: 'stream', match: carries('Paramount+', CBS) },
  { key: 'max', label: 'Max', kind: 'stream', match: carries('Max', 'HBO Max', TNT, TBS, TRUTV) },
  { key: 'prime', label: 'Prime Video', kind: 'stream', match: carries('Prime Video') },
  { key: 'netflix', label: 'Netflix', kind: 'stream', match: carries('Netflix') },
  { key: 'espnplus', label: 'ESPN+', kind: 'stream', match: carries('ESPN+') },
  { key: 'leaguepass', label: 'NBA / WNBA League Pass', kind: 'stream', match: carries('NBA League Pass', 'WNBA League Pass') },
  { key: 'nbatv', label: 'NBA TV', kind: 'stream', match: carries(NBATV) },
  // Live-TV bundles, defined by the linear networks they carry.
  { key: 'youtubetv', label: 'YouTube TV', kind: 'bundle', match: carries(ALL_LINEAR) },
  { key: 'hulu', label: 'Hulu + Live TV', kind: 'bundle', match: carries(BROADCAST_NETS, ESPN, ESPN2, ESPNU, TNT, TBS, TRUTV, USA, NBATV, NFLNET) },
  { key: 'fubo', label: 'Fubo', kind: 'bundle', match: carries(BROADCAST_NETS, ESPN, ESPN2, ESPNU, USA, TNT, TBS, TRUTV, ION, NBATV, NFLNET) },
  { key: 'sling', label: 'Sling TV', kind: 'bundle', match: carries(ESPN, ESPN2, TNT, TBS, TRUTV, USA, NBC, FOX, NBATV, NFLNET) },
  { key: 'cable', label: 'Cable / Satellite', kind: 'bundle', match: carries(ALL_LINEAR) },
]

export const SERVICE_BY_KEY = Object.fromEntries(SERVICE_CATALOG.map((s) => [s.key, s]))

// The viewer's selected services (by key) that carry this game, in catalog order. [] when
// nothing is selected or the broadcast is unknown.
export function watchableServices(broadcast, selectedKeys) {
  if (!broadcast?.length || !selectedKeys?.length) return []
  const selected = new Set(selectedKeys)
  return SERVICE_CATALOG.filter((s) => selected.has(s.key) && s.match(broadcast))
}

export const isWatchable = (broadcast, selectedKeys) =>
  watchableServices(broadcast, selectedKeys).length > 0
