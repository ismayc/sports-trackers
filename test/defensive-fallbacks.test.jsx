import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import GameRow from '../src/components/GameRow.jsx'
import ViewerCard from '../src/components/ViewerCard.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { fetchViewerDay, fetchAllViewers } from '../src/services/espn.js'
import { SERVICE_CATALOG } from '../src/utils/watch.js'
import { game, feed, espnEvent, stubFetch } from './helpers/feed.js'

// The `|| []` / `|| ''` / `?? 0` fallbacks scattered through the hub, each exercised with
// input that actually triggers it. They exist because ESPN's payload is not a contract —
// fields come and go — so an untested fallback is a guess about what happens when one does.

const NBA = { id: 'nba', espnPath: 'basketball/nba', kind: 'league' }
const NOW = new Date('2026-07-29T18:00:00Z')

describe('espn.js fallbacks', () => {
  it('handles an event with no broadcasts key and a broadcast with no names', async () => {
    const ev = espnEvent({ id: 'a', date: '2026-07-29T23:00Z' })
    delete ev.competitions[0].broadcasts
    delete ev.competitions[0].geoBroadcasts
    const ev2 = espnEvent({ id: 'b', date: '2026-07-29T23:30Z', broadcasts: [{}] })
    stubFetch([ev, ev2])
    const f = await fetchViewerDay(NBA, { now: NOW, tz: 'America/New_York' })
    expect(f.today.map((g) => g.broadcast)).toEqual([[], []])
  })

  it('falls back to an empty team name when ESPN sends no team object at all', async () => {
    stubFetch([
      espnEvent({
        id: 'nameless',
        date: '2026-07-29T23:00Z',
        competitors: [{ homeAway: 'home', team: {} }, { homeAway: 'away' }],
      }),
    ])
    const f = await fetchViewerDay(NBA, { now: NOW, tz: 'America/New_York' })
    expect(f.today[0]).toMatchObject({ home: '', away: '', homeAbbr: '', awayAbbr: '' })
  })

  it('fetchAllViewers substitutes an empty feed when fetchViewerDay itself rejects', async () => {
    // Distinct from "a day query failed": that is swallowed inside fetchViewerDay. This is
    // the outer guard, reached when the whole call throws — here via an invalid timezone,
    // which makes the day-bucketing blow up after the fetches resolve.
    stubFetch([espnEvent({ id: 'a', date: '2026-07-29T23:00Z' })])
    const feeds = await fetchAllViewers([NBA], { now: NOW, tz: 'Not/AZone' })
    expect(feeds[0]).toEqual({
      id: 'nba',
      ok: false,
      today: [],
      live: 0,
      yesterday: [],
      upcoming: [],
      next: null,
    })
  })
})

describe('watch.js fallback', () => {
  it('every catalog matcher tolerates an undefined broadcast list', () => {
    // watchableServices guards this already; the matchers are also called directly by the
    // catalog's own consumers, so each must be safe on its own.
    for (const s of SERVICE_CATALOG) {
      expect(s.match(undefined), s.key).toBe(false)
      expect(s.match(null), s.key).toBe(false)
    }
  })
})

describe('component name fallbacks', () => {
  it('GameRow uses full names in the SCORE line when abbreviations are missing', () => {
    render(
      <FollowProvider>
        <GameRow
          viewerId="nba"
          game={game({ awayAbbr: '', homeAbbr: '', state: 'post', score: [3, 4], statusLabel: 'Final' })}
          tz="UTC"
        />
      </FollowProvider>
    )
    expect(screen.getByText('Away Team 3 @ Home Team 4')).toBeInTheDocument()
  })

  it('ViewerCard uses full names for the next game when abbreviations are missing', () => {
    render(
      <FollowProvider>
        <ViewerCard
          viewer={{ id: 'nba', name: 'NBA', emoji: '🏀', url: 'https://x.example/' }}
          feed={feed({ next: game({ awayAbbr: '', homeAbbr: '' }) })}
          phase={{ label: 'In season', tone: 'on' }}
          tz="UTC"
        />
      </FollowProvider>
    )
    expect(screen.getByText(/Away Team @ Home Team/)).toBeInTheDocument()
  })
})
