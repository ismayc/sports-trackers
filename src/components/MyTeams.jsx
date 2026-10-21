import { viewerById } from '../data/viewers.js'
import { useFollow } from '../context/follow.jsx'
import { gameDayTime } from '../utils/time.js'
import GameRow from './GameRow.jsx'

// "My teams": today's games for the follow set (which is the viewers' own, shared through
// localStorage; see context/follow.jsx), then the NEXT game of every followed team that does
// not play today. Each match deep-links into its viewer with ?team=ABBR, SINGULAR:
// that is the param every viewer's urlState actually reads (a ?teams= list is silently
// ignored). Only renders when the user has starred at least one team.
//
// The next-up list exists because a today-only section left a followed NFL team invisible
// six days a week: on 2026-10-21 the Rams were starred, their next game (Sun, Oct 25) was in
// the feed, and the section said only "None of your starred teams play today". The game sat
// in the two-week breakdown at the foot of the page among every other league's games.
export default function MyTeams({ feeds, tz, hideScores = false }) {
  const follow = useFollow()
  if (follow.count === 0) return null

  const followedIn = (viewerId, g) =>
    [g.awayAbbr, g.homeAbbr].filter((a) => a && follow.isFollowed(viewerId, a))

  // feeds: [{ id, today, upcoming, ... }]. Collect followed games with their viewer id.
  const hits = []
  const next = []
  for (const feed of feeds) {
    const playingToday = new Set()
    for (const g of feed.today) {
      const picks = followedIn(feed.id, g)
      if (picks.length) hits.push({ viewerId: feed.id, game: g, picks })
      picks.forEach((a) => playingToday.add(a))
    }
    // `upcoming` is soonest first and already narrowed by the watch filter, so the first game
    // a followed team appears in is its next one. Two followed teams meeting share one row.
    const seen = new Set(playingToday)
    for (const g of feed.upcoming || []) {
      const picks = followedIn(feed.id, g).filter((a) => !seen.has(a))
      if (!picks.length) continue
      picks.forEach((a) => seen.add(a))
      next.push({ viewerId: feed.id, game: g, picks })
    }
  }
  next.sort((a, b) => new Date(a.game.tip) - new Date(b.game.tip))

  const item = ({ viewerId, game, picks }, when) => {
    const v = viewerById[viewerId]
    // Deep link into the viewer, pre-filtered to the (first) followed team.
    const href = `${v.url}?team=${encodeURIComponent(picks[0])}`
    return (
      <div className="myteams-item" key={`${viewerId}:${game.id}`}>
        <a className="myteams-tag" href={href} title={`Open in ${v.name}`}>
          <span aria-hidden="true">{v.emoji}</span> {picks.join(', ')} →
          {when && <span className="myteams-when"> {when}</span>}
        </a>
        <div className="myteams-row">
          <GameRow viewerId={viewerId} game={game} tz={tz} hideScores={hideScores} names />
        </div>
      </div>
    )
  }

  return (
    <section className="myteams">
      <h2>My teams playing today</h2>
      {hits.length === 0 ? (
        <p className="dim">None of your starred teams play today.</p>
      ) : (
        <div className="myteams-list">{hits.map((h) => item(h))}</div>
      )}
      {next.length > 0 && (
        <>
          <h3 className="myteams-sub">Next up</h3>
          <div className="myteams-list">{next.map((n) => item(n, gameDayTime(n.game, tz)))}</div>
        </>
      )}
    </section>
  )
}
