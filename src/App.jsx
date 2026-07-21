import { useEffect, useMemo, useState } from 'react'
import { VIEWERS } from './data/viewers.js'
import { fetchAllViewers } from './services/espn.js'
import { seasonPhase } from './utils/phase.js'
import { detectTimezone } from './utils/time.js'
import ViewerCard from './components/ViewerCard.jsx'
import MyTeams from './components/MyTeams.jsx'
import InstallShelf from './components/InstallShelf.jsx'

const EMPTY_FEED = (id) => ({ id, ok: false, today: [], live: 0, next: null })

// Card ordering: live first, then anything on today, then in-season/tournament, then
// "starts soon", then offseason. Within a tier, name order keeps it stable.
function rankOf(feed, phase) {
  if (feed.live > 0) return 0
  if (feed.today.length > 0) return 1
  if (phase.tone === 'hot' || phase.tone === 'on') return 2
  if (phase.tone === 'soon') return 3
  return 4
}

export default function App() {
  const tz = useMemo(detectTimezone, [])
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark')
  const [feeds, setFeeds] = useState(() => VIEWERS.map((v) => EMPTY_FEED(v.id)))
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const now = useMemo(() => new Date(), [])

  // Persist + apply the theme.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('st:theme', theme)
    } catch {
      /* private mode */
    }
  }, [theme])

  // One client-side load of all seven feeds. No backend, no key.
  useEffect(() => {
    const ctrl = new AbortController()
    fetchAllViewers(VIEWERS, { signal: ctrl.signal, now, tz })
      .then((res) => {
        setFeeds(res)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
    return () => ctrl.abort()
  }, [now, tz])

  const feedById = useMemo(() => Object.fromEntries(feeds.map((f) => [f.id, f])), [feeds])

  const cards = useMemo(() => {
    return VIEWERS.map((v) => {
      const feed = feedById[v.id] || EMPTY_FEED(v.id)
      const phase = seasonPhase(v, { now, hasGames: feed.today.length > 0 || feed.live > 0 })
      return { v, feed, phase, rank: rankOf(feed, phase) }
    }).sort(
      (a, b) =>
        a.rank - b.rank ||
        // Within "starts soon", the sooner season leads.
        (a.rank === 3 ? (a.phase.days ?? 0) - (b.phase.days ?? 0) : 0) ||
        a.v.name.localeCompare(b.v.name)
    )
  }, [feedById, now])

  const totalToday = feeds.reduce((n, f) => n + f.today.length, 0)
  const totalLive = feeds.reduce((n, f) => n + f.live, 0)

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Sports Trackers</h1>
          <p className="tagline">Which of your sports have games today.</p>
        </div>
        <button
          className="theme-toggle"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          title="Toggle light / dark"
          aria-label="Toggle light or dark theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      <p className="summary">
        {status === 'loading'
          ? 'Checking every viewer…'
          : status === 'error'
            ? 'Could not reach the scoreboard — showing season badges only.'
            : totalLive > 0
              ? `${totalLive} game${totalLive === 1 ? '' : 's'} live now · ${totalToday} today across the family.`
              : totalToday > 0
                ? `${totalToday} game${totalToday === 1 ? '' : 's'} today across the family.`
                : 'No games today across the family — here is where each season stands.'}{' '}
        <span className="dim">Times in {tz.replace(/_/g, ' ')}.</span>
      </p>

      <MyTeams feeds={feeds} tz={tz} />

      <section className="grid">
        {cards.map(({ v, feed, phase }) => (
          <ViewerCard key={v.id} viewer={v} feed={feed} phase={phase} tz={tz} />
        ))}
      </section>

      <InstallShelf />

      <footer className="foot">
        <span className="dim">
          Unofficial. Data from ESPN's public scoreboard, fetched in your browser — no backend, no
          tracking. Part of the{' '}
          <a href="https://github.com/ismayc">ismayc</a> sports viewer family.
        </span>
      </footer>
    </div>
  )
}
