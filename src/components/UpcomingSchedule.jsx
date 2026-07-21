import { useState } from 'react'
import { viewerById } from '../data/viewers.js'
import { useFollow } from '../context/follow.jsx'
import { dayKey, todayKey, formatDate, formatTime } from '../utils/time.js'
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

// Day-key arithmetic on YYYY-MM-DD strings. Noon UTC anchors the date so a ± day step
// can never cross a day boundary via DST — the same trick the viewers' time utils use.
const addDays = (key, n) => {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const weekdayOf = (key) => new Date(`${key}T12:00:00Z`).getUTCDay() // 0 = Sunday

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// The two-week breakdown: every upcoming game across the visible viewers, tagged with
// the sport it comes from, in the family's two presentations — the day-grouped list
// ("Schedule") and a calendar week grid ("Week"), like the viewers' own tabs. The
// choice is remembered per device. `feeds` arrives already filtered by the sports
// picker and the "on my services" toggle, so this section always agrees with the cards.
export default function UpcomingSchedule({ feeds, tz, filtered = false }) {
  const follow = useFollow()
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem('st:upcomingMode') === 'week' ? 'week' : 'schedule'
    } catch {
      return 'schedule'
    }
  })
  const pick = (m) => {
    setMode(m)
    try {
      localStorage.setItem('st:upcomingMode', m)
    } catch {
      /* private mode */
    }
  }

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
  for (const games of byDay.values())
    games.sort((a, b) => new Date(a.game.tip) - new Date(b.game.tip))

  const days = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, games]) => ({
      key,
      label: formatDate(games[0].game.tip, tz),
      isToday: key === tKey,
      games,
    }))

  // Calendar rows: full Sunday-start weeks covering today through the 14-day horizon.
  const horizonEnd = addDays(tKey, 14)
  const rows = []
  let cursor = addDays(tKey, -weekdayOf(tKey))
  while (cursor <= horizonEnd) {
    const row = []
    for (let i = 0; i < 7; i++) {
      const key = addDays(cursor, i)
      row.push({
        key,
        inRange: key >= tKey && key <= horizonEnd,
        isToday: key === tKey,
        games: byDay.get(key) || [],
      })
    }
    rows.push(row)
    cursor = addDays(cursor, 7)
  }

  const n = items.length
  return (
    <section className="upcoming" aria-label="Upcoming games, next two weeks">
      <div className="up-head">
        <h2>
          Next two weeks{' '}
          <span className="dim">
            · {n} game{n === 1 ? '' : 's'}
            {filtered ? ' on your services' : ''}
          </span>
        </h2>
        <div className="up-tabs" role="tablist" aria-label="Layout">
          {['schedule', 'week'].map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={`up-tab ${mode === m ? 'on' : ''}`}
              onClick={() => pick(m)}
            >
              {m === 'schedule' ? 'Schedule' : 'Week'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'schedule' ? (
        days.map(({ key, label, isToday, games }) => (
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
        ))
      ) : (
        <div className="up-cal-scroll">
          <div className="up-cal" role="grid">
            {WEEKDAYS.map((w) => (
              <div className="up-cal-head" key={w}>
                {w}
              </div>
            ))}
            {rows.flat().map(({ key, inRange, isToday, games }) => {
              const dayNum = Number(key.slice(8))
              // Name the month on the 1st and on the grid's first in-range cell.
              const label =
                dayNum === 1 || key === tKey
                  ? `${MONTHS[Number(key.slice(5, 7)) - 1]} ${dayNum}`
                  : String(dayNum)
              return (
                <div
                  className={`up-cal-cell ${inRange ? '' : 'is-out'} ${isToday ? 'is-today' : ''}`}
                  key={key}
                  role="gridcell"
                >
                  <span className="up-cal-date">{isToday ? `Today ${dayNum}` : label}</span>
                  {games.map(({ viewerId, game }) => {
                    const v = viewerById[viewerId]
                    return (
                      <a
                        className="up-cal-game"
                        key={`${viewerId}:${game.id}`}
                        href={gameHref(v, viewerId, game, follow)}
                        title={`${game.away} at ${game.home} — open in ${v.name}`}
                      >
                        <img
                          src={`${import.meta.env.BASE_URL}icons/${v.id}.png`}
                          alt={v.name}
                          width="14"
                          height="14"
                          loading="lazy"
                        />
                        <span className="up-cal-line">
                          {game.awayAbbr || game.away} @ {game.homeAbbr || game.home}
                        </span>
                        <span className="up-cal-time">{formatTime(game.tip, tz)}</span>
                      </a>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
