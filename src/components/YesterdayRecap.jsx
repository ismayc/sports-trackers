import { useState } from 'react'
import { viewerById } from '../data/viewers.js'
import { useFollow } from '../context/follow.jsx'
import { formatDate } from '../utils/time.js'
import GameRow from './GameRow.jsx'
import { gameHref } from './UpcomingSchedule.jsx'

// A quick "what happened yesterday" across the visible viewers — collapsed by default,
// since the page's job is what's on NOW; this is one press away, not front and center.
// Rows reuse the two-week breakdown's layout and link into each viewer. `feeds` arrives
// filtered by the sports picker; the services filter deliberately does NOT apply here —
// hiding a final score because you lack the channel makes no sense for results.
export default function YesterdayRecap({ feeds, tz, hideScores = false }) {
  const follow = useFollow()
  const [open, setOpen] = useState(false)

  const items = []
  for (const feed of feeds) {
    for (const g of feed.yesterday || []) items.push({ viewerId: feed.id, game: g })
  }
  if (items.length === 0) return null
  items.sort((a, b) => new Date(a.game.tip) - new Date(b.game.tip))

  const n = items.length
  return (
    <section className="recap" aria-label="Yesterday's results">
      <button
        type="button"
        className="recap-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="recap-chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        Yesterday{' '}
        <span className="dim">
          · {n} game{n === 1 ? '' : 's'} · {formatDate(items[0].game.tip, tz)}
        </span>
      </button>
      {open && (
        <div className="up-list">
          {items.map(({ viewerId, game }) => {
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
                  <GameRow viewerId={viewerId} game={game} tz={tz} hideScores={hideScores} />
                </div>
              </a>
            )
          })}
        </div>
      )}
    </section>
  )
}
