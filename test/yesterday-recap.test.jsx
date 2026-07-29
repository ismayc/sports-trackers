import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import YesterdayRecap from '../src/components/YesterdayRecap.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { game, feed } from './helpers/feed.js'

const TZ = 'America/New_York'
const final = (over = {}) =>
  game({ state: 'post', completed: true, score: [99, 101], statusLabel: 'Final', ...over })

const show = (feeds, props = {}) =>
  render(
    <FollowProvider>
      <YesterdayRecap feeds={feeds} tz={TZ} {...props} />
    </FollowProvider>
  )

describe('YesterdayRecap', () => {
  it('renders nothing when nothing happened yesterday', () => {
    const { container } = show([feed({ yesterday: [] })])
    expect(container).toBeEmptyDOMElement()
  })

  it('tolerates a feed with no yesterday key', () => {
    const { container } = show([{ id: 'nba', today: [], live: 0 }])
    expect(container).toBeEmptyDOMElement()
  })

  it('is COLLAPSED by default — the page is about what is on now', () => {
    show([feed({ yesterday: [final({ id: 'a', tip: '2026-07-28T23:00:00Z' })] })])
    const toggle = screen.getByRole('button')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/AWY/)).not.toBeInTheDocument()
  })

  it('summarises the count and the date while collapsed', () => {
    show([
      feed({
        yesterday: [
          final({ id: 'a', tip: '2026-07-28T23:00:00Z' }),
          final({ id: 'b', tip: '2026-07-28T23:30:00Z' }),
        ],
      }),
    ])
    const toggle = screen.getByRole('button')
    expect(toggle).toHaveTextContent('2 games')
    expect(toggle).toHaveTextContent('Tue, Jul 28')
  })

  it('uses the singular for one game', () => {
    show([feed({ yesterday: [final({ id: 'a', tip: '2026-07-28T23:00:00Z' })] })])
    expect(screen.getByRole('button')).toHaveTextContent('1 game')
  })

  it('expands and collapses on click, swapping the chevron', () => {
    show([feed({ id: 'nba', yesterday: [final({ id: 'a', tip: '2026-07-28T23:00:00Z' })] })])
    const toggle = screen.getByRole('button')
    expect(toggle).toHaveTextContent('▸')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveTextContent('▾')
    expect(screen.getByText('AWY 99 @ HME 101')).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(screen.queryByText('AWY 99 @ HME 101')).not.toBeInTheDocument()
  })

  it('sorts across viewers chronologically and links each row into its viewer', () => {
    show([
      feed({ id: 'nba', yesterday: [final({ id: 'late', tip: '2026-07-28T23:30:00Z' })] }),
      feed({ id: 'nfl', yesterday: [final({ id: 'early', tip: '2026-07-28T22:00:00Z' })] }),
    ])
    fireEvent.click(screen.getByRole('button'))
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('nfl-schedule'))
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('?game=early'))
    expect(links[1]).toHaveAttribute('href', expect.stringContaining('nba-schedule'))
  })

  it('honours spoiler-free mode in the expanded rows', () => {
    show([feed({ id: 'nba', yesterday: [final({ id: 'a', tip: '2026-07-28T23:00:00Z' })] })], {
      hideScores: true,
    })
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('AWY @ HME')).toBeInTheDocument()
    expect(screen.queryByText(/101/)).not.toBeInTheDocument()
    expect(screen.getByText('Final')).toBeInTheDocument()
  })
})
