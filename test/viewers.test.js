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

  it('does not include a finished tournament', () => {
    const ids = VIEWERS.map((v) => v.id)
    for (const gone of ['worldcup', 'wwc', 'copa']) expect(ids).not.toContain(gone)
  })
})

describe('archived viewers', () => {
  it('holds exactly the three completed tournaments, in a stable order', () => {
    expect(ARCHIVED_VIEWERS.map((v) => v.id)).toEqual(['worldcup', 'wwc', 'copa'])
  })

  it('states the edition covered and when the competition returns', () => {
    for (const v of ARCHIVED_VIEWERS) {
      expect(v.edition, v.id).toMatch(/^\d{4}$/)
      expect(v.nextEdition, v.id).toMatch(/^\d{4}$/)
      expect(Number(v.nextEdition), v.id).toBeGreaterThan(Number(v.edition))
    }
  })

  it('carries NO espnPath, because archived viewers are never fetched', () => {
    for (const v of ARCHIVED_VIEWERS) expect(v.espnPath, v.id).toBeUndefined()
  })

  it('names no champion or result anywhere, so the shelf cannot spoil an archive', () => {
    // Spoiler-free mode is a first-class feature; a label like "Spain won" in the always
    // visible shelf would defeat it before the user even opens the app.
    const blob = JSON.stringify(ARCHIVED_VIEWERS)
    for (const word of ['won', 'champion', 'beat', 'winner']) {
      expect(blob.toLowerCase(), `archived data mentions "${word}"`).not.toContain(word)
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
