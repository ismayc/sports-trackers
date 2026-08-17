import { useFollow } from '../context/follow.jsx'
import { formatTime } from '../utils/time.js'
import TeamLogo from './TeamLogo.jsx'

// One compact game line: a star to follow either team, "AWAY @ HOME", and a right-aligned
// score (live/final) or tip time (upcoming) with a state pill. Used inside a viewer card,
// the "My teams playing today" section, and the yesterday/two-week breakdowns.
// hideScores is the family's spoiler-free mode: the matchup and state stay, the numbers
// go (a "Final" pill is not a spoiler; 105–102 is).
//
// `names` names the clubs instead of abbreviating them ("Wings", not "DAL"). Every row that
// lists games passes it: the cards, the My teams list, yesterday's results and the two-week
// breakdown. Nothing turns it off today; it stays a prop because the abbreviation is the
// right answer for anything tighter than a card.
//
// The NICKNAME, not the full name, and that is what makes it fit a card at all. `.row-line`
// is one nowrap line, so on a phone "Portland Fire 88 @ Phoenix Mercury 85" was cut off
// mid-word. "Fire 88 @ Mercury 85" fits, and inside a card the line wraps rather than
// ellipsizing (see `.card .row-line` in index.css). The full name is still the row's title.
export default function GameRow({ viewerId, game, tz, hideScores = false, names = false }) {
  const follow = useFollow()
  const { away, home, awayAbbr, homeAbbr, awayShort, homeShort, score, state, statusLabel, tip, broadcast } =
    game
  const net = broadcast?.[0]
  const showScore = score && !hideScores

  const pill =
    state === 'in' ? (
      <span className="pill pill-live">{hideScores ? 'Live' : statusLabel || 'Live'}</span>
    ) : state === 'post' ? (
      <span className="pill pill-final">{hideScores ? 'Final' : statusLabel || 'Final'}</span>
    ) : (
      <span className="pill">{formatTime(tip, tz)}</span>
    )

  // Each side is one text node so the line still reads "AWY 3 @ HME 4" as a whole; the
  // crests sit between them and add nothing to the text.
  // Falls back through what the feed actually sent, so a team with no nickname still reads.
  const side = (abbr, short, full, points) => {
    const who = (names ? short || full : abbr) || full || abbr
    return `${who}${points === undefined ? '' : ` ${points}`}`
  }
  const awaySide = side(awayAbbr, awayShort, away, showScore ? score[0] : undefined)
  const homeSide = side(homeAbbr, homeShort, home, showScore ? score[1] : undefined)

  return (
    <div className="row">
      <div className="row-teams">
        <TeamStar viewerId={viewerId} abbr={awayAbbr} label={away} follow={follow} />
        <span className="row-line" title={`${away} at ${home}`}>
          <TeamLogo logo={game.awayLogo} />
          {awaySide}
          {' @ '}
          <TeamLogo logo={game.homeLogo} />
          {homeSide}
        </span>
        <TeamStar viewerId={viewerId} abbr={homeAbbr} label={home} follow={follow} />
      </div>
      <span className="row-right">
        {net && <span className="row-net" title={broadcast.join(', ')}>{net}</span>}
        {pill}
      </span>
    </div>
  )
}

function TeamStar({ viewerId, abbr, label, follow }) {
  if (!abbr) return null
  const on = follow.isFollowed(viewerId, abbr)
  return (
    <button
      className={`star ${on ? 'star-on' : ''}`}
      onClick={(e) => {
        // Card is a link; don't navigate when the intent is to star.
        e.preventDefault()
        e.stopPropagation()
        follow.toggle(viewerId, abbr)
      }}
      aria-pressed={on}
      title={`${on ? 'Unfollow' : 'Follow'} ${label} (${abbr})`}
    >
      {on ? '★' : '☆'}
    </button>
  )
}
