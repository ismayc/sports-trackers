import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ViewerCard from '../src/components/ViewerCard.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { game, feed } from './helpers/feed.js'

const NBA = { id: 'nba', name: 'NBA', emoji: '🏀', url: 'https://example.com/nba/' }
const PHASE = { label: 'In season', tone: 'on' }

const show = (f = feed(), props = {}) =>
  render(
    <FollowProvider>
      <ViewerCard viewer={NBA} feed={f} phase={PHASE} tz="America/New_York" {...props} />
    </FollowProvider>
  )

describe('ViewerCard', () => {
  it('links the whole card into the viewer and shows its name, badge and icon', () => {
    const { container } = show()
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.com/nba/')
    expect(screen.getByRole('heading', { name: 'NBA' })).toBeInTheDocument()
    expect(screen.getByText('In season')).toHaveClass('badge', 'badge-on')
    expect(container.querySelector('img')).toHaveAttribute('src', '/icons/nba.png')
  })

  it('lists today\'s games with a count', () => {
    show(feed({ today: [game({ id: 'a' }), game({ id: 'b', awayAbbr: 'XXX' })] }))
    expect(screen.getByText('2 games today')).toBeInTheDocument()
    expect(screen.getByText('AWY @ HME')).toBeInTheDocument()
    expect(screen.getByText('XXX @ HME')).toBeInTheDocument()
  })

  it('uses the singular for one game', () => {
    show(feed({ today: [game()] }))
    expect(screen.getByText('1 game today')).toBeInTheDocument()
  })

  it('shows a live counter when something is in progress', () => {
    show(feed({ today: [game({ state: 'in' })] }))
    expect(screen.getByTitle('1 live now')).toHaveTextContent('1 live')
  })

  it('shows no live counter when nothing is live', () => {
    const { container } = show(feed({ today: [game()] }))
    expect(container.querySelector('.live-dot')).toBeNull()
  })

  it('falls back to the next game when nothing is on today', () => {
    show(feed({ next: game({ tip: '2026-08-04T23:00:00Z', broadcast: ['TNT'] }) }))
    expect(screen.getByText(/^Next: /)).toBeInTheDocument()
    expect(screen.getByText(/AWY @ HME/)).toBeInTheDocument()
    expect(screen.getByText('TNT')).toBeInTheDocument()
  })

  it('omits the network when the next game has no broadcast', () => {
    const { container } = show(feed({ next: game() }))
    expect(container.querySelector('.card-net')).toBeNull()
  })

  it('says nothing is coming up when the two-week window is empty', () => {
    show(feed())
    expect(screen.getByText('No games in the next two weeks')).toBeInTheDocument()
  })

  describe('when the services filter is engaged', () => {
    it('labels the next game as one you can watch', () => {
      show(feed({ next: game() }), { filtered: true })
      expect(screen.getByText(/^Next you can watch: /)).toBeInTheDocument()
    })

    it('says so when nothing is watchable, rather than implying no games exist', () => {
      show(feed(), { filtered: true })
      expect(screen.getByText('Nothing on your services in the next two weeks')).toBeInTheDocument()
    })
  })

  it('passes spoiler-free mode down to the rows', () => {
    show(feed({ today: [game({ state: 'post', score: [99, 101], statusLabel: 'Final' })] }), { hideScores: true })
    expect(screen.getByText('AWY @ HME')).toBeInTheDocument()
    expect(screen.queryByText(/101/)).not.toBeInTheDocument()
  })
})
