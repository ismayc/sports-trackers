import { viewerById } from '../data/viewers.js'
import { useFollow } from '../context/follow.jsx'
import GameRow from './GameRow.jsx'

// "My teams playing today." Filters every viewer's today games down to the hub's own
// follow set, then deep-links each match into its viewer with ?teams=ABBR (which all the
// viewers understand). Only renders when the user has starred at least one team.
export default function MyTeams({ feeds, tz }) {
  const follow = useFollow()
  if (follow.count === 0) return null

  // feeds: [{ id, today, ... }]. Collect followed games with their viewer id.
  const hits = []
  for (const feed of feeds) {
    for (const g of feed.today) {
      const picks = [g.awayAbbr, g.homeAbbr].filter((a) => a && follow.isFollowed(feed.id, a))
      if (picks.length) hits.push({ viewerId: feed.id, game: g, picks })
    }
  }

  return (
    <section className="myteams">
      <h2>My teams playing today</h2>
      {hits.length === 0 ? (
        <p className="dim">None of your starred teams play today.</p>
      ) : (
        <div className="myteams-list">
          {hits.map(({ viewerId, game, picks }) => {
            const v = viewerById[viewerId]
            // Deep link into the viewer, pre-filtered to the followed team(s).
            const href = `${v.url}?teams=${encodeURIComponent(picks.join(','))}`
            return (
              <div className="myteams-item" key={`${viewerId}:${game.id}`}>
                <a className="myteams-tag" href={href} title={`Open in ${v.name}`}>
                  <span aria-hidden="true">{v.emoji}</span> {picks.join(', ')} →
                </a>
                <div className="myteams-row">
                  <GameRow viewerId={viewerId} game={game} tz={tz} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
