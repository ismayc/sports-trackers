import GameRow from './GameRow.jsx'
import { formatDayTime } from '../utils/time.js'

// One viewer's card. The whole card is a link into the deployed viewer (same tab, per
// spec). Inside: the phase badge, a live indicator, and either today's games or the next
// upcoming one. `feed` is the normalized { ok, today, live, next } from services/espn.
export default function ViewerCard({ viewer, feed, phase, tz }) {
  const { today, live, next } = feed
  const hasToday = today.length > 0

  return (
    <a className="card" href={viewer.url}>
      <div className="card-head">
        <img
          className="card-icon"
          src={`${import.meta.env.BASE_URL}icons/${viewer.id}.png`}
          alt=""
          width="40"
          height="40"
          loading="lazy"
        />
        <div className="card-title">
          <h3>{viewer.name}</h3>
          <span className={`badge badge-${phase.tone}`}>{phase.label}</span>
        </div>
        {live > 0 && (
          <span className="live-dot" title={`${live} live now`}>
            ● {live} live
          </span>
        )}
      </div>

      <div className="card-body">
        {hasToday ? (
          <>
            <div className="card-count">
              {today.length} game{today.length === 1 ? '' : 's'} today
            </div>
            <div className="rows">
              {today.map((g) => (
                <GameRow key={g.id} viewerId={viewer.id} game={g} tz={tz} />
              ))}
            </div>
          </>
        ) : next ? (
          <div className="card-next">
            Next: {next.awayAbbr || next.away} @ {next.homeAbbr || next.home}, {formatDayTime(next.tip, tz)}
          </div>
        ) : (
          <div className="card-next dim">No games in the next day</div>
        )}
      </div>
    </a>
  )
}
