import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VIEWERS, ARCHIVED_VIEWERS, viewerById } from '../src/data/viewers.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ALL = [...VIEWERS, ...ARCHIVED_VIEWERS]

describe('viewer registry', () => {
  it('has ids unique ACROSS both lists', () => {
    // The two lists share an id space: viewerById merges them, and the per-viewer icon is
    // looked up as icons/<id>.png, so a collision would silently shadow one viewer.
    const ids = ALL.map((v) => v.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never lists the same viewer as both live and archived', () => {
    const live = new Set(VIEWERS.map((v) => v.id))
    for (const a of ARCHIVED_VIEWERS) expect(live.has(a.id), `${a.id} is in both lists`).toBe(false)
  })

  it('gives every viewer a name, an https url and an emoji', () => {
    for (const v of ALL) {
      expect(v.name, v.id).toBeTruthy()
      expect(v.emoji, v.id).toBeTruthy()
      expect(v.url, v.id).toMatch(/^https:\/\//)
      // Trailing slash matters: these are GitHub Pages project sites, and the hub appends
      // "?game=…" directly.
      expect(v.url, v.id).toMatch(/\/$/)
    }
  })

  it('puts every viewer on the hub’s own origin', () => {
    // Not cosmetic: one origin is exactly why the hub can share each app's follow list
    // instead of keeping a private copy (see context/follow.jsx). A viewer moved to its own
    // domain would silently stop syncing.
    for (const v of ALL) expect(new URL(v.url).origin, v.id).toBe('https://ismayc.github.io')
  })

  it('maps every viewer to its app’s OWN follow key, uniquely', () => {
    // These are the literal KEY constants in each app's src/context/follow.jsx, pinned here
    // because nothing else can catch a typo: a wrong key does not error, it just orphans
    // that sport's picks in a store no app reads.
    expect(Object.fromEntries(ALL.map((v) => [v.id, v.followKey]))).toEqual({
      nba: 'nba:followed',
      nfl: 'nfl:followed',
      wnba: 'wnba:followed',
      epl: 'pl:followed', // note: NOT epl:followed, since the app's own prefix is `pl`
      'mens-mm': 'mmm:followed',
      'womens-mm': 'mmw:followed',
      wwc: 'wwc:followed',
      euros: 'euros:followed',
      copa: 'copa:followed',
      worldcup: 'wc2026:followed',
      'fiba-wwc': 'fwwc:followed',
    })
    const keys = ALL.map((v) => v.followKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('viewerById resolves live AND archived viewers', () => {
    expect(viewerById.nba.name).toBe('NBA')
    expect(viewerById.wwc.name).toBe("Women's World Cup")
    expect(Object.keys(viewerById)).toHaveLength(ALL.length)
  })
})

describe('live viewers', () => {
  it('all declare an espnPath and a season shape the phase badge can read', () => {
    for (const v of VIEWERS) {
      expect(v.espnPath, v.id).toBeTruthy()
      expect(['league', 'tournament']).toContain(v.kind)
      if (v.kind === 'league') {
        expect(v.season, v.id).toBeTruthy()
        expect(typeof v.season.startMonth).toBe('number')
        expect(typeof v.season.endMonth).toBe('number')
      } else {
        expect(v.window, v.id).toBeTruthy()
      }
    }
  })

  it('only college viewers carry the March-Madness headline filter', () => {
    for (const v of VIEWERS) {
      if (v.mmHeadline) expect(v.college, v.id).toBe(true)
      // A college viewer without the headline filter would show NIT/WBIT games as if they
      // were the tournament.
      if (v.college) expect(v.mmHeadline, v.id).toBeTruthy()
    }
  })

  it('is the four ongoing leagues plus any tournament being played right now', () => {
    expect(VIEWERS.map((v) => v.id).sort()).toEqual(['epl', 'fiba-wwc', 'nba', 'nfl', 'wnba'])
    // The grid auto-fits rather than assuming a fixed count; see index.css. It stopped
    // assuming exactly four when the FIBA Women's World Cup went live on 2026-08-29.
    for (const v of VIEWERS) expect(['league', 'tournament'], v.id).toContain(v.kind)
  })

  // A live tournament is the exception, not the rule: it earns a grid tile only while it
  // is actually on. Anything whose window has passed belongs in ARCHIVED_VIEWERS, or the
  // hub spends a fetch per page load to render a permanent "Offseason" tile.
  it('only carries a tournament whose window has not closed', () => {
    for (const v of VIEWERS.filter((x) => x.kind === 'tournament')) {
      expect(v.window, v.id).toBeTruthy()
      expect(Number(v.edition), v.id).toBeGreaterThanOrEqual(2026)
    }
  })
})

describe('archived viewers', () => {
  it('holds every completed tournament', () => {
    expect(ARCHIVED_VIEWERS.map((v) => v.id).sort()).toEqual(
      ['copa', 'euros', 'mens-mm', 'womens-mm', 'worldcup', 'wwc'].sort()
    )
  })

  it('is ordered by when the competition returns, soonest first', () => {
    // Asserted as an invariant rather than a literal list, so adding one keeps the meaning.
    const years = ARCHIVED_VIEWERS.map((v) => Number(v.nextEdition))
    expect(years).toEqual([...years].sort((a, b) => a - b))
  })

  it('states the edition covered and when the competition returns', () => {
    for (const v of ARCHIVED_VIEWERS) {
      expect(v.edition, v.id).toMatch(/^\d{4}$/)
      expect(v.nextEdition, v.id).toMatch(/^\d{4}$/)
      expect(Number(v.nextEdition), v.id).toBeGreaterThan(Number(v.edition))
    }
  })

  // Archived viewers DO keep their fetch config — see the note in data/viewers.js. What makes
  // them "archived" is that App never passes them to the feed loader, which app.test.jsx
  // asserts directly. Here we check the config is intact enough to revive.
  it('keeps the fetch config so reviving one is a straight move back into VIEWERS', () => {
    const byId = Object.fromEntries(ARCHIVED_VIEWERS.map((v) => [v.id, v]))
    for (const v of ARCHIVED_VIEWERS) {
      expect(v.espnPath, `${v.id} lost its espnPath`).toBeTruthy()
      expect(v.window, `${v.id} lost its window`).toBeTruthy()
    }
    // The subtle one: without mmHeadline the college seasontype=3 window serves NIT/WBIT
    // games as though they were the tournament.
    expect(byId['mens-mm'].mmHeadline).toBe("NCAA Men's Basketball Championship")
    expect(byId['womens-mm'].mmHeadline).toBe("NCAA Women's Basketball Championship")
    expect(byId['mens-mm'].college).toBe(true)
    expect(byId['womens-mm'].college).toBe(true)
  })

  it('flags the annual ones, which are the entries that can actually miss a window', () => {
    // Both March Madness viewers return in 2027, a year out — unlike the quadrennial four.
    // This is the trade-off recorded in data/viewers.js, pinned so it is not forgotten.
    const annual = ARCHIVED_VIEWERS.filter((v) => v.id.endsWith('-mm'))
    expect(annual).toHaveLength(2)
    for (const v of annual) expect(Number(v.nextEdition) - Number(v.edition)).toBe(1)
  })

  it('names no champion or result anywhere, so the shelf cannot spoil an archive', () => {
    // Spoiler-free mode is a first-class feature; a label like "Spain won" in the always
    // visible shelf would defeat it before the user even opens the app.
    // Scoped to the fields the shelf actually RENDERS. `mmHeadline` legitimately contains
    // "Championship" — it is the competition's name in ESPN's feed, not a result — and it is
    // never displayed; archived-shelf.test.jsx checks the rendered text as well.
    const shown = ARCHIVED_VIEWERS.map((v) => [v.name, v.edition, v.nextEdition].join(' '))
    for (const word of ['won', 'champion', 'beat', 'winner']) {
      for (const line of shown) {
        expect(line.toLowerCase(), `visible label "${line}" mentions "${word}"`).not.toContain(word)
      }
    }
  })
})

describe('per-viewer icons exist on disk', () => {
  // The tiles render <img src="icons/<id>.png">; a missing file is a broken image in the UI
  // and nothing in the build catches it.
  const files = new Set(readdirSync(resolve(ROOT, 'public/icons')))

  it.each(ALL.map((v) => [v.id]))('icons/%s.png is present', (id) => {
    expect(files.has(`${id}.png`)).toBe(true)
  })
})
