import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MyTeams from '../src/components/MyTeams.jsx'
import GameRow from '../src/components/GameRow.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { game, feed } from './helpers/feed.js'

// Star a team through the real UI, then render MyTeams inside the SAME provider, so the
// follow state is genuine rather than a stub.
function withFollows(follows, ui) {
  const seed = (
    <FollowProvider>
      <div>
        {follows.map(([viewerId, abbr]) => (
          <GameRow
            key={`${viewerId}:${abbr}`}
            viewerId={viewerId}
            game={game({ id: `seed-${viewerId}-${abbr}`, homeAbbr: abbr, home: abbr })}
            tz="UTC"
          />
        ))}
        {ui}
      </div>
    </FollowProvider>
  )
  const r = render(seed)
  for (const [, abbr] of follows) fireEvent.click(screen.getByTitle(`Follow ${abbr} (${abbr})`))
  return r
}

describe('MyTeams', () => {
  it('renders nothing until at least one team is starred', () => {
    const { container } = render(
      <FollowProvider>
        <MyTeams feeds={[feed({ today: [game()] })]} tz="UTC" />
      </FollowProvider>
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('says so when starred teams have no game today', () => {
    withFollows([['nba', 'MIA']], <MyTeams feeds={[feed({ today: [] })]} tz="UTC" />)
    expect(screen.getByText('None of your starred teams play today.')).toBeInTheDocument()
  })

  it('lists a starred team\'s game and deep-links with ?team= SINGULAR', () => {
    // ?team= is what each viewer's urlState actually reads; a ?teams= list is ignored.
    withFollows(
      [['nba', 'MIA']],
      <MyTeams feeds={[feed({ id: 'nba', today: [game({ id: 'g9', homeAbbr: 'MIA', home: 'Miami Heat' })] })]} tz="UTC" />
    )
    const link = screen.getByTitle('Open in NBA')
    expect(link).toHaveAttribute('href', 'https://ismayc.github.io/nba-schedule/?team=MIA')
    expect(link.getAttribute('href')).not.toContain('?teams=')
  })

  it('matches a starred team on either side of the matchup', () => {
    withFollows(
      [['nba', 'AWY']],
      <MyTeams feeds={[feed({ id: 'nba', today: [game({ id: 'g1' })] })]} tz="UTC" />
    )
    expect(screen.getByTitle('Open in NBA')).toHaveAttribute(
      'href',
      'https://ismayc.github.io/nba-schedule/?team=AWY'
    )
  })

  it('does not match a starred team from a DIFFERENT sport', () => {
    // The same abbreviation exists in more than one league, so the viewer id must be part
    // of the match.
    withFollows(
      [['wnba', 'MIA']],
      <MyTeams feeds={[feed({ id: 'nba', today: [game({ id: 'g1', homeAbbr: 'MIA' })] })]} tz="UTC" />
    )
    expect(screen.getByText('None of your starred teams play today.')).toBeInTheDocument()
  })

  it('joins both abbreviations when the starred teams play each other', () => {
    withFollows(
      [['nba', 'AWY'], ['nba', 'HME']],
      <MyTeams feeds={[feed({ id: 'nba', today: [game({ id: 'g1' })] })]} tz="UTC" />
    )
    const link = screen.getByTitle('Open in NBA')
    expect(link).toHaveTextContent('AWY, HME')
    // The deep link can only carry one, so it takes the first.
    expect(link).toHaveAttribute('href', 'https://ismayc.github.io/nba-schedule/?team=AWY')
  })

  it('collects hits across several viewers', () => {
    withFollows(
      [['nba', 'AWY'], ['nfl', 'HME']],
      <MyTeams
        feeds={[
          feed({ id: 'nba', today: [game({ id: 'n1' })] }),
          feed({ id: 'nfl', today: [game({ id: 'f1' })] }),
        ]}
        tz="UTC"
      />
    )
    expect(screen.getByTitle('Open in NBA')).toBeInTheDocument()
    expect(screen.getByTitle('Open in NFL')).toBeInTheDocument()
  })

  it('url-encodes an abbreviation that needs it', () => {
    withFollows(
      [['nba', 'A B']],
      <MyTeams feeds={[feed({ id: 'nba', today: [game({ id: 'g1', homeAbbr: 'A B' })] })]} tz="UTC" />
    )
    expect(screen.getByTitle('Open in NBA').getAttribute('href')).toContain('?team=A%20B')
  })

  it('passes spoiler-free mode into the row', () => {
    withFollows(
      [['nba', 'HME']],
      <MyTeams
        feeds={[feed({ id: 'nba', today: [game({ id: 'g1', state: 'post', score: [3, 4], statusLabel: 'Final' })] })]}
        tz="UTC"
        hideScores
      />
    )
    expect(screen.queryByText(/AWY 3 @ HME 4/)).not.toBeInTheDocument()
  })
})
