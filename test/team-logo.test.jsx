import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TeamLogo from '../src/components/TeamLogo.jsx'
import GameRow from '../src/components/GameRow.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { game } from './helpers/feed.js'

const CREST = 'https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/bos.png'

const imgs = (container) => [...container.querySelectorAll('img.team-logo')]

describe('TeamLogo', () => {
  it('renders the crest once, decoratively', () => {
    // ONE image on purpose. Swapping in ESPN's dark variant was tried and abandoned: see the
    // note in TeamLogo.jsx, where four WNBA clubs have no dark asset and the derived URL for
    // the rest loads an invisible mark. Dark mode puts a chip behind this one instead.
    const { container } = render(<TeamLogo logo={CREST} />)
    expect(imgs(container)).toHaveLength(1)
    expect(imgs(container)[0]).toHaveAttribute('src', CREST)
    // The name beside it already says which team this is.
    expect(imgs(container)[0]).toHaveAttribute('alt', '')
  })

  it('renders nothing when the feed has no crest', () => {
    const { container } = render(<TeamLogo logo={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('takes a size', () => {
    const { container } = render(<TeamLogo logo={CREST} size={14} />)
    expect(imgs(container)[0]).toHaveAttribute('width', '14')
  })
})

describe('crests in a game row', () => {
  const show = (over, props = {}) =>
    render(
      <FollowProvider>
        <GameRow viewerId="nba" game={game(over)} tz="UTC" {...props} />
      </FollowProvider>
    )

  it('puts a crest beside each team without disturbing the line', () => {
    const { container } = show({ awayLogo: CREST, homeLogo: CREST, state: 'post', score: [99, 101] })
    expect(imgs(container)).toHaveLength(2)
    // The crests are decorative, so the row still reads as one string.
    expect(screen.getByText('AWY 99 @ HME 101')).toBeInTheDocument()
  })

  it('shows no crest for a team the feed gave none', () => {
    const { container } = show({ awayLogo: CREST })
    expect(imgs(container)).toHaveLength(1)
    expect(screen.getByText('AWY @ HME')).toBeInTheDocument()
  })
})

describe('team names instead of abbreviations', () => {
  const show = (props = {}) =>
    render(
      <FollowProvider>
        <GameRow viewerId="nba" game={game({ state: 'post', score: [99, 101] })} tz="UTC" {...props} />
      </FollowProvider>
    )

  it('abbreviates by default, for the narrow viewer cards', () => {
    show()
    expect(screen.getByText('AWY 99 @ HME 101')).toBeInTheDocument()
  })

  it('spells the clubs out when asked, for a full-width row', () => {
    show({ names: true })
    expect(screen.getByText('Away Team 99 @ Home Team 101')).toBeInTheDocument()
  })

  it('falls back to whichever the feed actually has', () => {
    render(
      <FollowProvider>
        <GameRow viewerId="nba" game={game({ away: '', home: '' })} tz="UTC" names />
      </FollowProvider>
    )
    // No display name in the feed, so the abbreviation stands in even in names mode.
    expect(screen.getByText('AWY @ HME')).toBeInTheDocument()
  })
})
