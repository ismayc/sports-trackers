import { useFollow } from '../context/follow.jsx'
import { formatTime } from '../utils/time.js'

// One compact game line: a star to follow either team, "AWAY @ HOME", and a right-aligned
// score (live/final) or tip time (upcoming) with a state pill. Used inside a viewer card
// and inside the "My teams playing today" section.
export default function GameRow({ viewerId, game, tz }) {
  const follow = useFollow()
  const { away, home, awayAbbr, homeAbbr, score, state, statusLabel, tip, broadcast } = game
  const net = broadcast?.[0]

  const pill =
    state === 'in' ? (
      <span className="pill pill-live">{statusLabel || 'Live'}</span>
    ) : state === 'post' ? (
      <span className="pill pill-final">{statusLabel || 'Final'}</span>
    ) : (
      <span className="pill">{formatTime(tip, tz)}</span>
    )

  const line = score
    ? `${awayAbbr || away} ${score[0]} @ ${homeAbbr || home} ${score[1]}`
    : `${awayAbbr || away} @ ${homeAbbr || home}`

  return (
    <div className="row">
      <div className="row-teams">
        <TeamStar viewerId={viewerId} abbr={awayAbbr} label={away} follow={follow} />
        <span className="row-line" title={`${away} at ${home}`}>
          {line}
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
