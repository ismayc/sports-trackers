import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GameRow from '../src/components/GameRow.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { game } from './helpers/feed.js'

const show = (over = {}, props = {}) =>
  render(
    <FollowProvider>
      <GameRow viewerId="nba" game={game(over)} tz="America/New_York" {...props} />
    </FollowProvider>
  )

describe('GameRow', () => {
  it('renders an upcoming game as a matchup with its tip time', () => {
    show({ tip: '2026-07-29T23:00:00Z' })
    expect(screen.getByText('AWY @ HME')).toBeInTheDocument()
    expect(screen.getByText('7:00 PM')).toBeInTheDocument()
  })

  it('renders a live game with the score and the status pill', () => {
    show({ state: 'in', score: [55, 60], statusLabel: 'Q3 4:21' })
    expect(screen.getByText('AWY 55 @ HME 60')).toBeInTheDocument()
    expect(screen.getByText('Q3 4:21')).toBeInTheDocument()
  })

  it('renders a final game', () => {
    show({ state: 'post', score: [99, 101], statusLabel: 'Final' })
    expect(screen.getByText('AWY 99 @ HME 101')).toBeInTheDocument()
    expect(screen.getByText('Final')).toBeInTheDocument()
  })

  it('falls back to generic pill text when the feed sends no status label', () => {
    show({ state: 'in', statusLabel: null })
    expect(screen.getByText('Live')).toBeInTheDocument()
    show({ state: 'post', statusLabel: null })
    expect(screen.getByText('Final')).toBeInTheDocument()
  })

  it('falls back to full team names when abbreviations are missing', () => {
    show({ awayAbbr: '', homeAbbr: '' })
    expect(screen.getByText('Away Team @ Home Team')).toBeInTheDocument()
  })

  describe('spoiler-free mode', () => {
    it('drops the numbers but keeps the matchup and the state', () => {
      show({ state: 'post', score: [99, 101], statusLabel: 'Final' }, { hideScores: true })
      expect(screen.getByText('AWY @ HME')).toBeInTheDocument()
      expect(screen.queryByText(/99/)).not.toBeInTheDocument()
      // "Final" is not a spoiler; 99-101 is.
      expect(screen.getByText('Final')).toBeInTheDocument()
    })

    it('replaces a live clock with a bare "Live", since the clock hints at the state', () => {
      show({ state: 'in', score: [55, 60], statusLabel: 'Q3 4:21' }, { hideScores: true })
      expect(screen.getByText('Live')).toBeInTheDocument()
      expect(screen.queryByText('Q3 4:21')).not.toBeInTheDocument()
    })
  })

  describe('broadcast', () => {
    it('shows the first network, with the full list as a tooltip', () => {
      show({ broadcast: ['ESPN', 'ESPN2'] })
      const net = screen.getByText('ESPN')
      expect(net).toHaveAttribute('title', 'ESPN, ESPN2')
    })

    it('shows nothing when the broadcast is unknown', () => {
      const { container } = show({ broadcast: [] })
      expect(container.querySelector('.row-net')).toBeNull()
    })
  })

  describe('follow stars', () => {
    it('offers a star per side and toggles it', () => {
      show()
      const away = screen.getByTitle('Follow Away Team (AWY)')
      expect(away).toHaveAttribute('aria-pressed', 'false')
      fireEvent.click(away)
      expect(screen.getByTitle('Unfollow Away Team (AWY)')).toHaveAttribute('aria-pressed', 'true')
    })

    it('does not navigate when starring, because the row sits inside a link', () => {
      // The card wrapping this row is an <a>; without preventDefault a star click would
      // leave the page instead of following the team.
      let navigated = false
      render(
        <FollowProvider>
          <a href="https://example.com/" onClick={() => (navigated = true)}>
            <GameRow viewerId="nba" game={game()} tz="UTC" />
          </a>
        </FollowProvider>
      )
      fireEvent.click(screen.getByTitle('Follow Home Team (HME)'))
      expect(navigated).toBe(false)
      expect(screen.getByTitle('Unfollow Home Team (HME)')).toBeInTheDocument()
    })

    it('renders no star for a side with no abbreviation', () => {
      const { container } = show({ awayAbbr: '', homeAbbr: 'HME' })
      expect(container.querySelectorAll('.star')).toHaveLength(1)
    })
  })
})
