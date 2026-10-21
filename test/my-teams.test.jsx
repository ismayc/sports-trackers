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

  // The Rams case of 2026-10-21: starred, no game today, next game Sunday. The section used
  // to say only "None of your starred teams play today" and show nothing else.
  it('shows the next game of a starred team that does not play today', () => {
    withFollows(
      [['nfl', 'LAR']],
      <MyTeams
        feeds={[
          feed({
            id: 'nfl',
            today: [],
            upcoming: [
              game({ id: 'other', awayAbbr: 'DAL', homeAbbr: 'NYG', tip: '2026-10-25T17:00:00.000Z' }),
              game({ id: 'rams1', awayAbbr: 'LAR', away: 'Los Angeles Rams', homeAbbr: 'LV', tip: '2026-10-25T20:25:00.000Z' }),
              game({ id: 'rams2', awayAbbr: 'LAC', homeAbbr: 'LAR', home: 'Los Angeles Rams', tip: '2026-11-01T21:05:00.000Z' }),
            ],
          }),
        ]}
        tz="UTC"
      />
    )
    expect(screen.getByText('None of your starred teams play today.')).toBeInTheDocument()
    expect(screen.getByText('Next up')).toBeInTheDocument()
    // Only the NEXT game, not every game in the window, and not the unfollowed one.
    const links = screen.getAllByTitle('Open in NFL')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://ismayc.github.io/nfl-schedule/?team=LAR')
    expect(links[0]).toHaveTextContent('Sun, Oct 25')
    expect(screen.getByTitle('Los Angeles Rams at Home Team')).toBeInTheDocument()
  })

  it('does not repeat a team in Next up when it plays today', () => {
    withFollows(
      [['nba', 'HME']],
      <MyTeams
        feeds={[
          feed({
            id: 'nba',
            today: [game({ id: 'g1' })],
            upcoming: [game({ id: 'g1' }), game({ id: 'g2', tip: '2026-07-31T23:00:00.000Z' })],
          }),
        ]}
        tz="UTC"
      />
    )
    expect(screen.queryByText('Next up')).not.toBeInTheDocument()
    expect(screen.getAllByTitle('Open in NBA')).toHaveLength(1)
  })

  it('shows one Next up row when two starred teams meet next', () => {
    withFollows(
      [['nba', 'AWY'], ['nba', 'HME']],
      <MyTeams feeds={[feed({ id: 'nba', upcoming: [game({ id: 'g5' })] })]} tz="UTC" />
    )
    const links = screen.getAllByTitle('Open in NBA')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveTextContent('AWY, HME')
  })

  it('orders Next up by date across sports, not by viewer', () => {
    withFollows(
      [['nba', 'HME'], ['nfl', 'AWY']],
      <MyTeams
        feeds={[
          feed({ id: 'nba', upcoming: [game({ id: 'late', tip: '2026-08-05T23:00:00.000Z' })] }),
          feed({ id: 'nfl', upcoming: [game({ id: 'soon', tip: '2026-08-01T23:00:00.000Z' })] }),
        ]}
        tz="UTC"
      />
    )
    const tags = screen.getAllByTitle(/^Open in /).map((a) => a.getAttribute('title'))
    expect(tags).toEqual(['Open in NFL', 'Open in NBA'])
  })

  it('tolerates a feed with no upcoming list', () => {
    withFollows([['nba', 'HME']], <MyTeams feeds={[{ id: 'nba', today: [] }]} tz="UTC" />)
    expect(screen.getByText('None of your starred teams play today.')).toBeInTheDocument()
    expect(screen.queryByText('Next up')).not.toBeInTheDocument()
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
