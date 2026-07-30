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

  it('is exactly the four ongoing leagues — every tournament is archived', () => {
    expect(VIEWERS.map((v) => v.id).sort()).toEqual(['epl', 'nba', 'nfl', 'wnba'])
    // The grid is styled as a fixed 4-across row on the strength of this; see index.css.
    expect(VIEWERS).toHaveLength(4)
    for (const v of VIEWERS) expect(v.kind, v.id).toBe('league')
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
