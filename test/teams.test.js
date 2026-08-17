import { describe, it, expect, vi } from 'vitest'
import { parseTeams, fetchTeams } from '../src/services/teams.js'

// A standings payload, nested the way ESPN nests it: a league whose children (conferences)
// each carry a standings.entries list.
const payload = (...groups) => ({
  children: groups.map((teams) => ({
    standings: { entries: teams.map((team) => ({ team })) },
  })),
})

const logos = (light, dark) => [
  ...(light ? [{ href: light, rel: ['full', 'default'] }] : []),
  ...(dark ? [{ href: dark, rel: ['full', 'scoreboard', 'dark'] }] : []),
]

const NBA = { id: 'nba', espnPath: 'basketball/nba' }
const NFL = { id: 'nfl', espnPath: 'football/nfl' }

// Answer every standings request with `byPath[espnPath]`, or fail it when the entry is
// missing.
const stub = (byPath) => {
  global.fetch = vi.fn(async (url) => {
    const hit = Object.entries(byPath).find(([p]) => String(url).includes(p))
    if (!hit) return { ok: false, status: 500 }
    return { ok: true, json: async () => hit[1] }
  })
  return global.fetch
}

const DAY = 24 * 60 * 60 * 1000

describe('parseTeams', () => {
  it('flattens the nested standings into abbr / name / logo, in name order', () => {
    const out = parseTeams(
      payload(
        [{ abbreviation: 'MIA', displayName: 'Miami Heat', logos: logos('heat.png', 'heat-dark.png') }],
        [{ abbreviation: 'ATL', displayName: 'Atlanta Hawks', logos: logos('hawks.png', 'hawks-dark.png') }]
      )
    )
    // The rel-default crest only. ESPN's dark variants are missing for several clubs, so
    // dark mode puts a chip behind the light one instead of swapping the file.
    expect(out).toEqual([
      { abbr: 'ATL', name: 'Atlanta Hawks', logo: 'hawks.png' },
      { abbr: 'MIA', name: 'Miami Heat', logo: 'heat.png' },
    ])
  })

  it('reports no logo at all rather than an undefined src', () => {
    expect(parseTeams(payload([{ abbreviation: 'MIA', displayName: 'Heat' }]))[0]).toEqual({
      abbr: 'MIA',
      name: 'Heat',
      logo: null,
    })
  })

  it('lists a team once however deeply the walk finds it', () => {
    const team = { abbreviation: 'MIA', displayName: 'Miami Heat' }
    expect(parseTeams(payload([team], [team]))).toHaveLength(1)
  })

  it('skips an entry with no abbreviation, and falls back to it for a missing name', () => {
    const out = parseTeams(payload([{ displayName: 'Nameless' }, { abbreviation: 'MIA' }]))
    expect(out).toEqual([{ abbr: 'MIA', name: 'MIA', logo: null }])
  })

  it('returns nothing for a payload with no standings anywhere', () => {
    expect(parseTeams(undefined)).toEqual([])
    expect(parseTeams({ children: [{ note: 'no standings here' }] })).toEqual([])
    expect(parseTeams({ children: [{ standings: { entries: [{}] } }] })).toEqual([])
  })
})

describe('fetchTeams', () => {
  it('asks the CORS-open standings route, not /teams', async () => {
    // /teams answers a browser with no access-control-allow-origin at all, so every request
    // from the page fails. This is the whole reason the route is what it is.
    const f = stub({ 'basketball/nba': payload([{ abbreviation: 'MIA', displayName: 'Heat' }]) })
    await fetchTeams([NBA], { now: 1 })
    const url = String(f.mock.calls[0][0])
    expect(url).toBe(
      'https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings?level=3'
    )
  })

  it('fetches each viewer’s catalog and caches it', async () => {
    const f = stub({
      'basketball/nba': payload([{ abbreviation: 'MIA', displayName: 'Miami Heat' }]),
      'football/nfl': payload([{ abbreviation: 'SEA', displayName: 'Seattle Seahawks' }]),
    })
    const out = await fetchTeams([NBA, NFL], { now: 1000 })
    expect(out.nba.map((t) => t.abbr)).toEqual(['MIA'])
    expect(out.nfl.map((t) => t.abbr)).toEqual(['SEA'])
    expect(f).toHaveBeenCalledTimes(2)
    expect(JSON.parse(localStorage.getItem('st:teams')).nba.at).toBe(1000)
  })

  it('serves a fresh cache without touching the network', async () => {
    localStorage.setItem(
      'st:teams',
      JSON.stringify({ nba: { at: 1000, teams: [{ abbr: 'MIA', name: 'Miami Heat' }] } })
    )
    const f = stub({})
    const out = await fetchTeams([NBA], { now: 1000 + DAY })
    expect(out.nba.map((t) => t.abbr)).toEqual(['MIA'])
    expect(f).not.toHaveBeenCalled()
  })

  it('refetches once the cache is more than a week old', async () => {
    localStorage.setItem(
      'st:teams',
      JSON.stringify({ nba: { at: 1000, teams: [{ abbr: 'OLD', name: 'Old' }] } })
    )
    stub({ 'basketball/nba': payload([{ abbreviation: 'MIA', displayName: 'Miami Heat' }]) })
    const out = await fetchTeams([NBA], { now: 1000 + 8 * DAY })
    expect(out.nba.map((t) => t.abbr)).toEqual(['MIA'])
  })

  it('falls back to a stale cache when the request fails', async () => {
    localStorage.setItem(
      'st:teams',
      JSON.stringify({ nba: { at: 1000, teams: [{ abbr: 'OLD', name: 'Old' }] } })
    )
    stub({}) // every request 500s
    const out = await fetchTeams([NBA], { now: 1000 + 8 * DAY })
    // Stale beats nothing: last week's catalog still lets the picker open.
    expect(out.nba.map((t) => t.abbr)).toEqual(['OLD'])
  })

  it('returns an empty list when the request fails and nothing is cached', async () => {
    stub({})
    expect(await fetchTeams([NBA], { now: 1 })).toEqual({ nba: [] })
  })

  it('treats an empty catalog as a failure, not an answer', async () => {
    // No live league has zero teams, so an empty payload is a bad response; caching it
    // would blank the picker for a week.
    stub({ 'basketball/nba': payload([]) })
    await fetchTeams([NBA], { now: 1 })
    expect(localStorage.getItem('st:teams')).toBeNull()
  })

  it('one failed league does not take the others down', async () => {
    stub({ 'basketball/nba': payload([{ abbreviation: 'MIA', displayName: 'Miami Heat' }]) })
    const out = await fetchTeams([NBA, NFL], { now: 1 })
    expect(out.nba).toHaveLength(1)
    expect(out.nfl).toEqual([])
  })

  it('survives an unreadable cache', async () => {
    localStorage.setItem('st:teams', 'not json{')
    stub({ 'basketball/nba': payload([{ abbreviation: 'MIA', displayName: 'Miami Heat' }]) })
    expect((await fetchTeams([NBA], { now: 1 })).nba).toHaveLength(1)
  })

  it('survives localStorage refusing the write (private mode)', async () => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('denied')
    }
    try {
      stub({ 'basketball/nba': payload([{ abbreviation: 'MIA', displayName: 'Miami Heat' }]) })
      expect((await fetchTeams([NBA], { now: 1 })).nba).toHaveLength(1)
    } finally {
      Storage.prototype.setItem = setItem
    }
  })

  it('defaults `now` to the clock', async () => {
    stub({ 'basketball/nba': payload([{ abbreviation: 'MIA', displayName: 'Miami Heat' }]) })
    await fetchTeams([NBA])
    expect(JSON.parse(localStorage.getItem('st:teams')).nba.at).toBeGreaterThan(0)
  })
})
