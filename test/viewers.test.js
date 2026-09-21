import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_VIEWERS, liveViewers, archivedViewers, isArchived, viewerById } from '../src/data/viewers.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ALL = ALL_VIEWERS

// Two reference days that straddle the FIBA Women's World Cup Final (2026-09-13): during the
// tournament it is live, the day after it has auto-archived. Local noon so the day never
// flips across a timezone.
const DURING = new Date('2026-09-10T12:00:00')
const AFTER = new Date('2026-09-14T12:00:00')

describe('viewer registry', () => {
  it('has ids unique across the whole list', () => {
    // The per-viewer icon is looked up as icons/<id>.png and viewerById is keyed by id, so a
    // collision would silently shadow one viewer.
    const ids = ALL.map((v) => v.id)
    expect(new Set(ids).size).toBe(ids.length)
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
      'fiba-mwc': 'fmwc:followed',
    })
    const keys = ALL.map((v) => v.followKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('viewerById resolves every viewer, live or archived', () => {
    expect(viewerById.nba.name).toBe('NBA')
    expect(viewerById.wwc.name).toBe("Women's World Cup")
    expect(Object.keys(viewerById)).toHaveLength(ALL.length)
  })
})

describe('viewer shape', () => {
  it('all declare an espnPath and a shape the phase badge can read', () => {
    for (const v of ALL) {
      expect(v.espnPath, v.id).toBeTruthy()
      expect(['league', 'tournament']).toContain(v.kind)
      if (v.kind === 'league') {
        expect(v.season, v.id).toBeTruthy()
        expect(typeof v.season.startMonth).toBe('number')
        expect(typeof v.season.endMonth).toBe('number')
      } else {
        // A tournament carries the real start/end dates of the edition it covers, as ISO
        // 'YYYY-MM-DD' strings with start on or before end.
        expect(v.runs, v.id).toBeTruthy()
        expect(v.runs.start, v.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(v.runs.end, v.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(v.runs.start <= v.runs.end, v.id).toBe(true)
      }
    }
  })

  it('only college viewers carry the March-Madness headline filter', () => {
    for (const v of ALL) {
      if (v.mmHeadline) expect(v.college, v.id).toBe(true)
      // A college viewer without the headline filter would show NIT/WBIT games as if they
      // were the tournament.
      if (v.college) expect(v.mmHeadline, v.id).toBeTruthy()
    }
  })

  it('states the edition covered and when the competition returns', () => {
    for (const v of ALL.filter((x) => x.kind === 'tournament')) {
      expect(v.edition, v.id).toMatch(/^\d{4}$/)
      expect(v.nextEdition, v.id).toMatch(/^\d{4}$/)
      expect(Number(v.nextEdition), v.id).toBeGreaterThan(Number(v.edition))
    }
  })
})

describe('auto-archive by end date', () => {
  it('leaves a tournament live through its Final and archives it the day after', () => {
    const fiba = viewerById['fiba-wwc'] // runs 2026-09-04 .. 2026-09-13
    expect(isArchived(fiba, new Date('2026-09-13T12:00:00'))).toBe(false) // the Final, still live
    expect(isArchived(fiba, new Date('2026-09-14T00:00:00'))).toBe(true) // the day after
  })

  it('never archives a league, whatever the date', () => {
    for (const v of ALL.filter((x) => x.kind === 'league')) {
      for (const d of [DURING, AFTER, new Date('2026-01-01T12:00:00')]) {
        expect(isArchived(v, d), `${v.id} @ ${d.toISOString()}`).toBe(false)
      }
    }
  })

  it('the live set is the four leagues plus a tournament being played', () => {
    // On 2026-09-10 the FIBA Women's World Cup is on; every other tournament has ended.
    expect(liveViewers(DURING).map((v) => v.id).sort()).toEqual(
      ['epl', 'fiba-wwc', 'nba', 'nfl', 'wnba'].sort()
    )
    // The day after its Final, the live set falls back to the four ongoing leagues.
    expect(liveViewers(AFTER).map((v) => v.id).sort()).toEqual(['epl', 'nba', 'nfl', 'wnba'].sort())
  })

  it('the archived shelf holds every completed tournament, soonest-returning first', () => {
    // After the FIBA Women's Final, all eight tournaments are archived; ordered by nextEdition.
    // Ties keep array order, so within the 2027 group FIBA Men's (listed first) leads.
    expect(archivedViewers(AFTER).map((v) => v.id)).toEqual([
      'fiba-mwc', // 2027
      'mens-mm', // 2027
      'womens-mm', // 2027
      'wwc', // 2027
      'euros', // 2028
      'copa', // 2028
      'fiba-wwc', // 2030
      'worldcup', // 2030
    ])
    const years = archivedViewers(AFTER).map((v) => Number(v.nextEdition))
    expect(years).toEqual([...years].sort((a, b) => a - b))
  })

  it('the two lists are always complementary and cover everything', () => {
    for (const now of [DURING, AFTER]) {
      const live = new Set(liveViewers(now).map((v) => v.id))
      const arch = new Set(archivedViewers(now).map((v) => v.id))
      for (const id of live) expect(arch.has(id), `${id} in both @ ${now.toISOString()}`).toBe(false)
      expect(live.size + arch.size).toBe(ALL.length)
    }
  })

  // Both March Madness viewers are ANNUAL, not quadrennial: they return the very next year,
  // so once archived the hub will not surface their games again until their runs/edition are
  // advanced. This is the trade-off recorded in data/viewers.js, pinned so it is not forgotten.
  it('flags the annual March Madness viewers, which can miss a window', () => {
    const annual = ALL.filter((v) => v.id.endsWith('-mm'))
    expect(annual).toHaveLength(2)
    for (const v of annual) expect(Number(v.nextEdition) - Number(v.edition)).toBe(1)
  })

  it('keeps the fetch config so a revived tournament just needs new dates', () => {
    // The subtle one: without mmHeadline the college seasontype=3 window serves NIT/WBIT
    // games as though they were the tournament.
    expect(viewerById['mens-mm'].mmHeadline).toBe("NCAA Men's Basketball Championship")
    expect(viewerById['womens-mm'].mmHeadline).toBe("NCAA Women's Basketball Championship")
    expect(viewerById['mens-mm'].college).toBe(true)
    expect(viewerById['womens-mm'].college).toBe(true)
    for (const v of ALL.filter((x) => x.kind === 'tournament')) {
      expect(v.espnPath, `${v.id} lost its espnPath`).toBeTruthy()
      expect(v.runs, `${v.id} lost its runs`).toBeTruthy()
    }
  })

  it('names no champion or result anywhere, so the shelf cannot spoil an archive', () => {
    // Spoiler-free mode is a first-class feature; a label like "Spain won" in the always
    // visible shelf would defeat it before the user even opens the app. Scoped to the fields
    // the shelf actually RENDERS. `mmHeadline` legitimately contains "Championship" (the
    // competition's name in ESPN's feed, not a result) and is never displayed.
    const shown = ALL.map((v) => [v.name, v.edition, v.nextEdition].join(' '))
    for (const word of ['won', 'champion', 'beat', 'winner']) {
      for (const line of shown) {
        expect(line.toLowerCase(), `visible label "${line}" mentions "${word}"`).not.toContain(word)
      }
    }
  })
})

describe('international break windows', () => {
  const withBreaks = ALL.filter((v) => v.breaks)
  const ISO = /^\d{4}-\d{2}-\d{2}$/
  const nextDay = (iso) => {
    const d = new Date(`${iso}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  }

  it('belong to leagues only', () => {
    // A tournament that stops mid-edition does not exist; `runs` already bounds it.
    for (const v of withBreaks) expect(v.kind, `${v.id}`).toBe('league')
  })

  it('are well-formed ISO spans that do not run backwards', () => {
    // The windows are compared as strings (see utils/phase currentBreak), so a stray format
    // would not throw — it would silently never match, and the note would never appear.
    for (const v of withBreaks) {
      for (const b of v.breaks) {
        expect(b.start, `${v.id} ${b.start}`).toMatch(ISO)
        expect(b.end, `${v.id} ${b.end}`).toMatch(ISO)
        expect(b.end >= b.start, `${v.id}: ${b.start}..${b.end} ends before it starts`).toBe(true)
        if (b.resumes) {
          expect(b.resumes).toMatch(ISO)
          // The note reads "no fixtures until <resumes>", so it must be the day play is
          // back — the day after the window, not some later date in the same week.
          expect(b.resumes, `${v.id}: ${b.end} resumes ${b.resumes}`).toBe(nextDay(b.end))
        }
      }
    }
  })

  it('are in order and never overlap', () => {
    // currentBreak returns the FIRST match; overlapping windows would make which one you
    // get depend on array order, and the note's return date with it.
    for (const v of withBreaks) {
      const sorted = [...v.breaks].sort((a, b) => a.start.localeCompare(b.start))
      expect(v.breaks.map((b) => b.start), `${v.id} is out of order`).toEqual(sorted.map((b) => b.start))
      for (let i = 1; i < v.breaks.length; i++) {
        expect(v.breaks[i].start > v.breaks[i - 1].end, `${v.id}: window ${i} overlaps the one before`).toBe(true)
      }
    }
  })

  it('fall inside the season they interrupt', () => {
    // A break outside the season months would be dead config: the badge only consults it
    // once the season window is open.
    for (const v of withBreaks) {
      const { startMonth, endMonth } = v.season
      const inSeason = (m) => (startMonth <= endMonth ? m >= startMonth && m <= endMonth : m >= startMonth || m <= endMonth)
      for (const b of v.breaks) {
        expect(inSeason(Number(b.start.slice(5, 7))), `${v.id}: ${b.start} is out of season`).toBe(true)
        expect(inSeason(Number(b.end.slice(5, 7))), `${v.id}: ${b.end} is out of season`).toBe(true)
      }
    }
  })

  it('covers the Premier League and nothing else, for this season', () => {
    // The hub's other three leagues have no international calendar to stop for. If one
    // ever gains breaks, this test is the reminder to check the note's wording reads right
    // for it ("international break" is a football phrase).
    expect(withBreaks.map((v) => v.id)).toEqual(['epl'])
    expect(viewerById.epl.breaks.length).toBe(3)
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
