import GameRow from './GameRow.jsx'
import TeamLogo from './TeamLogo.jsx'
import { formatDayTime } from '../utils/time.js'

// One viewer's card. The whole card is a link into the deployed viewer (same tab, per
// spec). Inside: the phase badge, a live indicator, and either today's games or the next
// upcoming one. `feed` is the normalized { ok, today, live, next } from services/espn.
export default function ViewerCard({
  viewer,
  feed,
  phase,
  tz,
  filtered = false,
  teamFiltered = false,
  hideScores = false,
}) {
  const { today, live, next } = feed
  const hasToday = today.length > 0
  const net = next?.broadcast?.[0]
  // Names whichever filters are narrowing this card, so an empty body says WHY it is empty.
  const scope = `${teamFiltered ? ' for your teams' : ''}${filtered ? ' on your services' : ''}`

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
                <GameRow
                  key={g.id}
                  viewerId={viewer.id}
                  game={g}
                  tz={tz}
                  hideScores={hideScores}
                  names
                />
              ))}
            </div>
          </>
        ) : next ? (
          <div className="card-next">
            {filtered ? 'Next you can watch: ' : teamFiltered ? 'Next for your teams: ' : 'Next: '}
            <TeamLogo logo={next.awayLogo} size={14} />
            {next.awayShort || next.away} @ <TeamLogo logo={next.homeLogo} size={14} />
            {next.homeShort || next.home}, {formatDayTime(next.tip, tz)}
            {net && <span className="card-net">{net}</span>}
          </div>
        ) : !feed.ok ? (
          // A failed feed is not the same as an empty one — "no games" here would be
          // indistinguishable from a real offseason lull.
          <div className="card-next dim">Couldn’t reach the scoreboard — open the viewer</div>
        ) : (
          <div className="card-next dim">
            {scope ? `Nothing${scope} in the next two weeks` : 'No games in the next two weeks'}
          </div>
        )}
      </div>
    </a>
  )
}
