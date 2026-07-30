import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import App from '../src/App.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { VIEWERS, ARCHIVED_VIEWERS } from '../src/data/viewers.js'
import { game, feed } from './helpers/feed.js'

// App owns the fetch loop, so the service is mocked here and exercised directly in
// espn.test.js instead. That keeps these tests about what the PAGE does with a feed.
const { fetchAllViewers } = vi.hoisted(() => ({ fetchAllViewers: vi.fn() }))
vi.mock('../src/services/espn.js', () => ({
  fetchAllViewers,
  fetchViewerDay: vi.fn(),
  isPreseason: vi.fn(),
}))

const EMPTY = (id) => feed({ id, today: [], upcoming: [], yesterday: [], next: null })
const allEmpty = () => VIEWERS.map((v) => EMPTY(v.id))

const feedsFor = (over = {}) => VIEWERS.map((v) => ({ ...EMPTY(v.id), ...(over[v.id] || {}) }))

const NOW = new Date('2026-07-29T18:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  fetchAllViewers.mockReset()
  fetchAllViewers.mockResolvedValue(allEmpty())
})
afterEach(() => vi.useRealTimers())

const show = () =>
  render(
    <FollowProvider>
      <App />
    </FollowProvider>
  )

// The fetch resolves in a microtask; flush it inside act so React commits the state.
const settle = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('App shell', () => {
  it('renders the title and tagline', async () => {
    show()
    await settle()
    expect(screen.getByRole('heading', { level: 1, name: 'Sports Trackers' })).toBeInTheDocument()
    expect(screen.getByText('Which of your sports have games today.')).toBeInTheDocument()
  })

  it('shows a loading summary before the feeds land', () => {
    fetchAllViewers.mockReturnValue(new Promise(() => {})) // never resolves
    show()
    expect(screen.getByText(/Checking every viewer/)).toBeInTheDocument()
  })

  it('reports a feed failure without hiding the page', async () => {
    fetchAllViewers.mockRejectedValue(new Error('espn down'))
    show()
    await settle()
    expect(screen.getByText(/Could not reach the scoreboard/)).toBeInTheDocument()
    // The cards still render, on season badges alone.
    expect(screen.getByRole('heading', { name: 'NBA' })).toBeInTheDocument()
  })

  it('renders one card per live viewer and none for the archived ones', async () => {
    show()
    await settle()
    for (const v of VIEWERS) expect(screen.getByRole('heading', { name: v.name })).toBeInTheDocument()
    for (const v of ARCHIVED_VIEWERS) {
      expect(screen.queryByRole('heading', { name: v.name })).not.toBeInTheDocument()
    }
  })

  // THE invariant that makes a viewer "archived". Archived entries deliberately keep their
  // espnPath and window so reviving them is a straight move between arrays, which means the
  // data alone can no longer tell you they are not fetched — only this can. Six wasted
  // round-trips per page load is exactly what the shelf exists to avoid.
  it('fetches the live viewers ONLY — never an archived one', async () => {
    show()
    await settle()
    expect(fetchAllViewers).toHaveBeenCalledTimes(1)
    const requested = fetchAllViewers.mock.calls[0][0]
    expect(requested.map((v) => v.id)).toEqual(VIEWERS.map((v) => v.id))
    const archived = new Set(ARCHIVED_VIEWERS.map((v) => v.id))
    for (const v of requested) expect(archived.has(v.id), `${v.id} was fetched`).toBe(false)
  })
})

describe('the preseason note', () => {
  it('is stated at the top of the page', async () => {
    show()
    await settle()
    expect(
      screen.getByText(/Preseason games are ignored by choice/)
    ).toBeInTheDocument()
  })

  it('says only games that count are shown', async () => {
    show()
    await settle()
    expect(screen.getByText(/only games\s+that count are shown here/)).toBeInTheDocument()
  })

  it('sits above the card grid, so it is read before the empty NFL card', async () => {
    const { container } = show()
    await settle()
    const note = container.querySelector('.note-preseason')
    const grid = container.querySelector('.grid')
    expect(note).toBeTruthy()
    expect(grid).toBeTruthy()
    // compareDocumentPosition: 4 === note precedes grid.
    expect(note.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('the archived tournaments shelf', () => {
  it('is present and collapsed', async () => {
    const { container } = show()
    await settle()
    const details = container.querySelector('details.archived')
    expect(details).toBeTruthy()
    expect(details.open).toBe(false)
  })

  it('sits directly above the two-week breakdown, not at the foot of the page', async () => {
    // Position is a requirement, not an accident: below the breakdown it was past a long
    // scroll and effectively invisible. Asserted on real DOM order so it cannot drift back.
    fetchAllViewers.mockResolvedValue(
      feedsFor({ nba: { upcoming: [game({ id: 'u' })], yesterday: [game({ id: 'y', state: 'post' })] } })
    )
    const { container } = show()
    await settle()

    const order = [...container.querySelectorAll('.recap, .archived, .upcoming, .shelf')].map(
      (el) => el.className.split(' ')[0]
    )
    expect(order).toEqual(['recap', 'archived', 'upcoming', 'shelf'])
  })

  it('holds the three completed tournaments once opened', async () => {
    const { container } = show()
    await settle()
    const details = container.querySelector('details.archived')
    // jsdom does not implement the toggle behaviour, so set it directly.
    act(() => {
      details.open = true
    })
    const hrefs = [...details.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(ARCHIVED_VIEWERS.map((v) => v.url))
  })
})

describe('summary line', () => {
  it('counts live games across the family', async () => {
    fetchAllViewers.mockResolvedValue(
      feedsFor({ nba: { today: [game({ state: 'in' }), game({ id: 'g2' })], live: 1 } })
    )
    show()
    await settle()
    expect(screen.getByText(/1 game live now · 2 today across the family/)).toBeInTheDocument()
  })

  it('counts today\'s games when nothing is live', async () => {
    fetchAllViewers.mockResolvedValue(feedsFor({ nba: { today: [game()], live: 0 } }))
    show()
    await settle()
    expect(screen.getByText(/1 game today across the family/)).toBeInTheDocument()
  })

  it('falls back to season standing when there is nothing on', async () => {
    show()
    await settle()
    expect(screen.getByText(/No games today across the family/)).toBeInTheDocument()
  })

  it('names the timezone in use', async () => {
    show()
    await settle()
    expect(screen.getByText(/Times in America\/New York/)).toBeInTheDocument()
  })
})

describe('timezone control', () => {
  it('reads ?tz= from the link on load', async () => {
    window.history.replaceState({}, '', '/?tz=Europe%2FLondon')
    show()
    await settle()
    expect(screen.getByText(/Times in Europe\/London/)).toBeInTheDocument()
    window.history.replaceState({}, '', '/')
  })

  it('ignores an invalid ?tz=', async () => {
    window.history.replaceState({}, '', '/?tz=Not%2FAZone')
    show()
    await settle()
    expect(screen.getByText(/Times in America\/New York/)).toBeInTheDocument()
    window.history.replaceState({}, '', '/')
  })

  it('restores a saved zone, and persists a change', async () => {
    localStorage.setItem('st:tz', JSON.stringify('America/Chicago'))
    show()
    await settle()
    expect(screen.getByText(/Times in America\/Chicago/)).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'America/Denver' } })
    await settle()
    expect(JSON.parse(localStorage.getItem('st:tz'))).toBe('America/Denver')
  })

  it('ignores a junk saved zone', async () => {
    localStorage.setItem('st:tz', 'not json{')
    show()
    await settle()
    expect(screen.getByText(/Times in America\/New York/)).toBeInTheDocument()
  })
})

describe('sports picker wiring', () => {
  it('opens, narrows the grid, and reports the count on the chip', async () => {
    show()
    await settle()
    fireEvent.click(screen.getByText(/All sports/))
    const dialog = screen.getByRole('dialog', { name: 'Choose sports' })
    expect(dialog).toBeInTheDocument()

    // Scoped to the dialog: "NBA" is also a card heading on the page behind it.
    fireEvent.click(within(dialog).getByText('NBA'))
    await settle()
    fireEvent.click(screen.getByText('Done'))
    await settle()

    expect(screen.queryByRole('heading', { name: 'NBA' })).not.toBeInTheDocument()
    // Regex, not an exact string: the chip's emoji makes this two text nodes.
    expect(screen.getByText(new RegExp(`Sports \\(${VIEWERS.length - 1}\\)`))).toBeInTheDocument()
  })
})

describe('services + watch filter', () => {
  const withGames = () =>
    feedsFor({
      nba: {
        today: [game({ id: 'espn', broadcast: ['ESPN'] }), game({ id: 'rsn', broadcast: ['MSG'] })],
        upcoming: [game({ id: 'espn', broadcast: ['ESPN'] })],
        next: game({ id: 'espn', broadcast: ['ESPN'] }),
      },
    })

  it('offers the filter only once a service is chosen', async () => {
    show()
    await settle()
    expect(screen.queryByText(/On my services/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(/Choose my services/))
    fireEvent.click(screen.getByText('Sling TV'))
    await settle()
    fireEvent.click(screen.getByText('Done'))
    await settle()

    expect(screen.getByText(/My services \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/On my services/)).toBeInTheDocument()
  })

  it('drops unwatchable games once engaged, and restores them when turned off', async () => {
    fetchAllViewers.mockResolvedValue(withGames())
    localStorage.setItem('st:services', JSON.stringify(['sling']))
    show()
    await settle()

    expect(screen.getByText('2 games today')).toBeInTheDocument()

    fireEvent.click(screen.getByText(/On my services/))
    await settle()
    // Sling carries ESPN but not MSG.
    expect(screen.getByText('1 game today')).toBeInTheDocument()
    expect(screen.getByText(/1 game today you can watch on your services/)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/On my services/))
    await settle()
    expect(screen.getByText('2 games today')).toBeInTheDocument()
  })

  it('explains an empty result rather than implying no games exist', async () => {
    fetchAllViewers.mockResolvedValue(
      feedsFor({ nba: { today: [game({ id: 'rsn', broadcast: ['MSG'] })] } })
    )
    localStorage.setItem('st:services', JSON.stringify(['sling']))
    localStorage.setItem('st:watchOnly', 'true')
    const { container } = show()
    await settle()
    // Scoped: the empty ViewerCard carries the same sentence.
    expect(container.querySelector('.summary').textContent).toMatch(
      /Nothing on your services in the next two weeks/
    )
  })

  it('mentions upcoming games when today is empty but the fortnight is not', async () => {
    fetchAllViewers.mockResolvedValue(
      feedsFor({ nba: { today: [], upcoming: [game({ id: 'u', broadcast: ['ESPN'] })] } })
    )
    localStorage.setItem('st:services', JSON.stringify(['sling']))
    localStorage.setItem('st:watchOnly', 'true')
    show()
    await settle()
    expect(
      screen.getByText(/Nothing on your services today — 1 coming up in the next two weeks/)
    ).toBeInTheDocument()
  })

  it('counts live watchable games', async () => {
    fetchAllViewers.mockResolvedValue(
      feedsFor({ nba: { today: [game({ id: 'l', state: 'in', broadcast: ['ESPN'] })], live: 1 } })
    )
    localStorage.setItem('st:services', JSON.stringify(['sling']))
    localStorage.setItem('st:watchOnly', 'true')
    show()
    await settle()
    expect(screen.getByText(/1 game live now you can watch/)).toBeInTheDocument()
  })

  it('leaves the feed alone when the toggle is on but no service is chosen', async () => {
    fetchAllViewers.mockResolvedValue(withGames())
    localStorage.setItem('st:watchOnly', 'true')
    localStorage.setItem('st:services', JSON.stringify([]))
    show()
    await settle()
    expect(screen.getByText('2 games today')).toBeInTheDocument()
  })
})

describe('spoiler-free mode', () => {
  it('toggles, persists, and hides scores in the cards', async () => {
    fetchAllViewers.mockResolvedValue(
      feedsFor({
        nba: { today: [game({ state: 'post', score: [99, 101], statusLabel: 'Final' })] },
      })
    )
    show()
    await settle()
    expect(screen.getByText('AWY 99 @ HME 101')).toBeInTheDocument()

    fireEvent.click(screen.getByText(/Hide scores/))
    await settle()
    expect(screen.getByText('AWY @ HME')).toBeInTheDocument()
    expect(screen.queryByText(/101/)).not.toBeInTheDocument()
    expect(screen.getByText(/Scores hidden/)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('st:hideScores'))).toBe(true)
  })

  it('restores the saved preference', async () => {
    localStorage.setItem('st:hideScores', 'true')
    fetchAllViewers.mockResolvedValue(
      feedsFor({ nba: { today: [game({ state: 'post', score: [1, 2], statusLabel: 'Final' })] } })
    )
    show()
    await settle()
    expect(screen.getByText(/Scores hidden/)).toBeInTheDocument()
  })
})

describe('theme toggle', () => {
  it('flips the document theme and persists it', async () => {
    document.documentElement.dataset.theme = 'dark'
    show()
    await settle()
    fireEvent.click(screen.getByLabelText(/Toggle light or dark theme/))
    await settle()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('st:theme')).toBe('light')
    fireEvent.click(screen.getByLabelText(/Toggle light or dark theme/))
    await settle()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('card ordering', () => {
  it('puts live first, then games today, then in-season, then offseason', async () => {
    // NBA offseason in July, WNBA in season, NFL "starts soon".
    fetchAllViewers.mockResolvedValue(
      feedsFor({
        nba: { today: [game({ id: 'x', state: 'in' })], live: 1 }, // live beats its cold badge
        epl: { today: [game({ id: 'y' })] },
      })
    )
    const { container } = show()
    await settle()
    const names = [...container.querySelectorAll('.card-title h3')].map((n) => n.textContent)
    expect(names[0]).toBe('NBA') // live
    expect(names[1]).toBe('Premier League') // games today
    expect(names.indexOf('WNBA')).toBeGreaterThan(1) // in season, no games
  })

  it('orders the "starts soon" tier by how soon', async () => {
    const { container } = show()
    await settle()
    const names = [...container.querySelectorAll('.card-title h3')].map((n) => n.textContent)
    // On 29 Jul 2026: WNBA is the only one in season, so it leads. Then the "starts soon"
    // tier, sorted by how soon: Premier League opens 15 Aug (17d) before the NFL's 4 Sep
    // (37d). Everything else is cold.
    expect(names[0]).toBe('WNBA')
    expect(names[1]).toBe('Premier League')
    expect(names[2]).toBe('NFL')
  })
})

describe('localStorage resilience', () => {
  it('renders even when every write throws', async () => {
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('denied')
    }
    try {
      show()
      await settle()
      expect(screen.getByRole('heading', { level: 1, name: 'Sports Trackers' })).toBeInTheDocument()
    } finally {
      Storage.prototype.setItem = set
    }
  })
})

describe('App defensive fallbacks', () => {
  it('substitutes an empty feed for a viewer the service did not answer for', async () => {
    // fetchAllViewers is contracted to return one feed per viewer, but a short array must
    // not blank the grid — every card still renders, on its season badge alone.
    fetchAllViewers.mockResolvedValue([{ ...EMPTY('nba'), today: [game()] }])
    show()
    await settle()
    for (const v of VIEWERS) expect(screen.getByRole('heading', { name: v.name })).toBeInTheDocument()
    expect(screen.getByText('1 game today')).toBeInTheDocument()
  })

  it('filters a feed that has no upcoming key at all', async () => {
    const feeds = VIEWERS.map((v) => {
      const f = { ...EMPTY(v.id), today: [game({ broadcast: ['ESPN'] })] }
      delete f.upcoming
      return f
    })
    fetchAllViewers.mockResolvedValue(feeds)
    localStorage.setItem('st:services', JSON.stringify(['sling']))
    localStorage.setItem('st:watchOnly', 'true')
    show()
    await settle()
    // The filter ran over a missing list without throwing, and kept the watchable game.
    expect(screen.getAllByText('1 game today').length).toBeGreaterThan(0)
  })
})

describe('footer', () => {
  it('credits the family and the author', async () => {
    show()
    await settle()
    expect(screen.getByRole('link', { name: 'ismayc' })).toHaveAttribute('href', 'https://github.com/ismayc')
    expect(screen.getByRole('link', { name: 'Chester Ismay' })).toHaveAttribute('href', 'https://chester.rbind.io')
  })
})
