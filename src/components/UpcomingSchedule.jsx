import { viewerById } from '../data/viewers.js'
import { useFollow } from '../context/follow.jsx'
import { dayKey, todayKey, formatDate } from '../utils/time.js'
import GameRow from './GameRow.jsx'

// Deep link for one game. Every viewer reads ?game=<espn event id> and opens straight
// onto that game's detail — the hub and the apps share ESPN's id space, so the row's id
// is the app's id. ?team= rides along as the graceful fallback: if the app's committed
// season doesn't hold the game (a snapshot older than the fixture), it still lands
// pre-filtered to the matchup's team — the followed one if either side is starred,
// else the home side.
export function gameHref(v, viewerId, game, follow) {
  const pick =
    (game.homeAbbr && follow.isFollowed(viewerId, game.homeAbbr) && game.homeAbbr) ||
    (game.awayAbbr && follow.isFollowed(viewerId, game.awayAbbr) && game.awayAbbr) ||
    game.homeAbbr ||
    game.awayAbbr
  const team = pick ? `&team=${encodeURIComponent(pick)}` : ''
  return `${v.url}?game=${encodeURIComponent(game.id)}${team}`
}

// The two-week breakdown: every upcoming game across the visible viewers, bucketed by the
// user's calendar day, tagged with the sport it comes from. Each row links into its
// deployed viewer (the star buttons inside stop propagation, same as on the cards).
// `feeds` arrives already filtered by the sports picker and the "on my services" toggle,
// so this section always agrees with the cards above it.
export default function UpcomingSchedule({ feeds, tz, filtered = false }) {
  const follow = useFollow()
  const items = []
  for (const feed of feeds) {
    for (const g of feed.upcoming || []) items.push({ viewerId: feed.id, game: g })
  }
  if (items.length === 0) return null

  // Bucket by the day the game falls on in the user's zone, chronologically.
  const tKey = todayKey(tz)
  const byDay = new Map()
  for (const it of items) {
    const key = dayKey(it.game.tip, tz)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(it)
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, games]) => ({
      key,
      label: formatDate(games[0].game.tip, tz),
      isToday: key === tKey,
      games: games.sort((a, b) => new Date(a.game.tip) - new Date(b.game.tip)),
    }))

  const n = items.length
  return (
    <section className="upcoming" aria-label="Upcoming games, next two weeks">
      <h2>
        Next two weeks{' '}
        <span className="dim">
          · {n} game{n === 1 ? '' : 's'}
          {filtered ? ' on your services' : ''}
        </span>
      </h2>
      {days.map(({ key, label, isToday, games }) => (
        <div className="up-day" key={key}>
          <h3 className="up-date">
            {isToday ? 'Today · ' : ''}
            {label}
            <span className="dim"> · {games.length}</span>
          </h3>
          <div className="up-list">
            {games.map(({ viewerId, game }) => {
              const v = viewerById[viewerId]
              return (
                <a
                  className="up-item"
                  key={`${viewerId}:${game.id}`}
                  href={gameHref(v, viewerId, game, follow)}
                  title={`Open this matchup in ${v.name}`}
                >
                  <span className="up-sport">
                    <img
                      src={`${import.meta.env.BASE_URL}icons/${v.id}.png`}
                      alt=""
                      width="18"
                      height="18"
                      loading="lazy"
                    />
                    {v.name}
                  </span>
                  <div className="up-row">
                    <GameRow viewerId={viewerId} game={game} tz={tz} />
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}
