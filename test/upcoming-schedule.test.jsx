import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UpcomingSchedule, { gameHref } from '../src/components/UpcomingSchedule.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { game, feed } from './helpers/feed.js'

const TZ = 'America/New_York'
// Fixed clock: the day-grouped list and the calendar grid are both anchored on "today".
const NOW = new Date('2026-07-29T18:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

const show = (feeds, props = {}) =>
  render(
    <FollowProvider>
      <UpcomingSchedule feeds={feeds} tz={TZ} {...props} />
    </FollowProvider>
  )

describe('gameHref', () => {
  const v = { url: 'https://ex.example/' }
  const noFollow = { isFollowed: () => false }

  it('deep-links by ESPN event id, with the home side as the team fallback', () => {
    expect(gameHref(v, 'nba', game({ id: '4017' }), noFollow)).toBe(
      'https://ex.example/?game=4017&team=HME'
    )
  })

  it('prefers a followed team over the home side', () => {
    const follow = { isFollowed: (_id, abbr) => abbr === 'AWY' }
    expect(gameHref(v, 'nba', game({ id: '1' }), follow)).toContain('&team=AWY')
  })

  it('prefers the home side when BOTH are followed', () => {
    const follow = { isFollowed: () => true }
    expect(gameHref(v, 'nba', game({ id: '1' }), follow)).toContain('&team=HME')
  })

  it('falls back to the away side when there is no home abbreviation', () => {
    expect(gameHref(v, 'nba', game({ id: '1', homeAbbr: '' }), noFollow)).toContain('&team=AWY')
  })

  it('omits the team param entirely when neither side has an abbreviation', () => {
    const href = gameHref(v, 'nba', game({ id: '1', homeAbbr: '', awayAbbr: '' }), noFollow)
    expect(href).toBe('https://ex.example/?game=1')
  })

  it('encodes both params', () => {
    const href = gameHref(v, 'nba', game({ id: 'a b', homeAbbr: 'C D' }), noFollow)
    expect(href).toBe('https://ex.example/?game=a%20b&team=C%20D')
  })
})

describe('UpcomingSchedule', () => {
  it('renders nothing when no viewer has an upcoming game', () => {
    const { container } = show([feed({ upcoming: [] })])
    expect(container).toBeEmptyDOMElement()
  })

  it('counts the games and groups them by day', () => {
    show([
      feed({
        id: 'nba',
        upcoming: [
          game({ id: 'a', tip: '2026-07-29T23:00:00Z' }),
          game({ id: 'b', tip: '2026-07-31T23:00:00Z' }),
        ],
      }),
    ])
    expect(screen.getByRole('heading', { name: /Next two weeks/ })).toHaveTextContent('2 games')
    expect(screen.getByText(/Today · Wed, Jul 29/)).toBeInTheDocument()
    expect(screen.getByText(/Fri, Jul 31/)).toBeInTheDocument()
  })

  it('uses the singular for one game and notes the services filter', () => {
    show([feed({ upcoming: [game({ id: 'a' })] })], { filtered: true })
    expect(screen.getByRole('heading', { name: /Next two weeks/ })).toHaveTextContent(
      '1 game on your services'
    )
  })

  it('sorts games within a day and tags each with its sport', () => {
    show([
      feed({ id: 'nba', upcoming: [game({ id: 'late', tip: '2026-07-29T23:30:00Z' })] }),
      feed({ id: 'nfl', upcoming: [game({ id: 'early', tip: '2026-07-29T22:00:00Z' })] }),
    ])
    const sports = screen.getAllByText(/NBA|NFL/).map((n) => n.textContent.trim())
    expect(sports[0]).toBe('NFL') // 22:00 before 23:30
    expect(sports[1]).toBe('NBA')
  })

  it('orders the day groups chronologically even when the feeds arrive out of order', () => {
    // Day buckets are created in feed-iteration order, so a viewer whose game is LATER
    // being listed first is what forces the day sort to actually reorder.
    show([
      feed({ id: 'nba', upcoming: [game({ id: 'later', tip: '2026-08-03T23:00:00Z' })] }),
      feed({ id: 'nfl', upcoming: [game({ id: 'sooner', tip: '2026-07-30T23:00:00Z' })] }),
    ])
    const dates = [...document.querySelectorAll('.up-date')].map((n) => n.textContent)
    expect(dates[0]).toMatch(/Thu, Jul 30/)
    expect(dates[1]).toMatch(/Mon, Aug 3/)
  })

  it('links each row into its viewer with the game deep link', () => {
    show([feed({ id: 'nba', upcoming: [game({ id: '777' })] })])
    const link = screen.getByTitle('Open this matchup in NBA')
    expect(link).toHaveAttribute('href', 'https://ismayc.github.io/nba-schedule/?game=777&team=HME')
  })

  describe('layout toggle', () => {
    it('starts on the day-grouped list', () => {
      show([feed({ upcoming: [game({ id: 'a' })] })])
      expect(screen.getByRole('tab', { name: 'Schedule' })).toHaveAttribute('aria-selected', 'true')
    })

    it('switches to the week grid and remembers the choice', () => {
      show([feed({ upcoming: [game({ id: 'a' })] })])
      fireEvent.click(screen.getByRole('tab', { name: 'Week' }))
      expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('grid')).toBeInTheDocument()
      expect(localStorage.getItem('st:upcomingMode')).toBe('week')
    })

    it('restores the saved week layout on mount', () => {
      localStorage.setItem('st:upcomingMode', 'week')
      show([feed({ upcoming: [game({ id: 'a' })] })])
      expect(screen.getByRole('grid')).toBeInTheDocument()
    })

    it('ignores a junk saved value', () => {
      localStorage.setItem('st:upcomingMode', 'nonsense')
      show([feed({ upcoming: [game({ id: 'a' })] })])
      expect(screen.getByRole('tab', { name: 'Schedule' })).toHaveAttribute('aria-selected', 'true')
    })

    it('survives localStorage throwing in both directions', () => {
      const get = Storage.prototype.getItem
      const set = Storage.prototype.setItem
      Storage.prototype.getItem = () => {
        throw new Error('denied')
      }
      Storage.prototype.setItem = () => {
        throw new Error('denied')
      }
      try {
        show([feed({ upcoming: [game({ id: 'a' })] })])
        fireEvent.click(screen.getByRole('tab', { name: 'Week' }))
        expect(screen.getByRole('grid')).toBeInTheDocument()
      } finally {
        Storage.prototype.getItem = get
        Storage.prototype.setItem = set
      }
    })
  })

  describe('week grid', () => {
    const showWeek = (feeds) => {
      localStorage.setItem('st:upcomingMode', 'week')
      return show(feeds)
    }

    it('lays out Sunday-start weekday headers', () => {
      showWeek([feed({ upcoming: [game({ id: 'a' })] })])
      const heads = [...document.querySelectorAll('.up-cal-head')].map((n) => n.textContent)
      expect(heads).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    })

    it('marks today, and marks days outside the horizon as out of range', () => {
      showWeek([feed({ upcoming: [game({ id: 'a' })] })])
      expect(document.querySelectorAll('.up-cal-cell.is-today')).toHaveLength(1)
      expect(document.querySelectorAll('.up-cal-cell.is-out').length).toBeGreaterThan(0)
    })

    it('places a game in its day cell with time and matchup', () => {
      showWeek([feed({ id: 'nba', upcoming: [game({ id: 'a', tip: '2026-07-31T23:00:00Z' })] })])
      const cell = screen.getByTitle('Away Team at Home Team — open in NBA')
      expect(cell).toHaveAttribute('href', 'https://ismayc.github.io/nba-schedule/?game=a&team=HME')
      expect(cell).toHaveTextContent('AWY @ HME')
      expect(cell).toHaveTextContent('7:00 PM')
    })

    it('names the month on the 1st as well as on today', () => {
      showWeek([feed({ upcoming: [game({ id: 'a', tip: '2026-08-01T20:00:00Z' })] })])
      expect(screen.getByText('Aug 1')).toBeInTheDocument()
      expect(screen.getByText('Today 29')).toBeInTheDocument()
    })

    it('falls back to full names in a cell when abbreviations are missing', () => {
      showWeek([
        feed({ id: 'nba', upcoming: [game({ id: 'a', tip: '2026-07-31T23:00:00Z', homeAbbr: '', awayAbbr: '' })] }),
      ])
      expect(screen.getByText('Away Team @ Home Team')).toBeInTheDocument()
    })
  })

  it('tolerates a feed with no upcoming key at all', () => {
    const { container } = show([{ id: 'nba', today: [], live: 0 }])
    expect(container).toBeEmptyDOMElement()
  })
})
