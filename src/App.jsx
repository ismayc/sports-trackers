import { useEffect, useMemo, useState } from 'react'
import { VIEWERS } from './data/viewers.js'
import { fetchAllViewers } from './services/espn.js'
import { seasonPhase } from './utils/phase.js'
import { detectTimezone, isValidZone, timezoneOptions } from './utils/time.js'
import { isWatchable } from './utils/watch.js'
import ViewerCard from './components/ViewerCard.jsx'
import MyTeams from './components/MyTeams.jsx'
import InstallShelf from './components/InstallShelf.jsx'
import ServicesPicker from './components/ServicesPicker.jsx'
import SportsPicker from './components/SportsPicker.jsx'
import UpcomingSchedule from './components/UpcomingSchedule.jsx'
import YesterdayRecap from './components/YesterdayRecap.jsx'

const EMPTY_FEED = (id) => ({ id, ok: false, today: [], live: 0, yesterday: [], upcoming: [], next: null })

const loadJson = (key, fallback) => {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}

// Drop every game a viewer can't watch on the chosen services, and re-derive the counts and
// the "next up" from what's left. Returns the feed unchanged when the filter is off.
function applyWatchFilter(feed, services, on) {
  if (!on || !services.length) return feed
  const keep = (g) => isWatchable(g.broadcast, services)
  const today = feed.today.filter(keep)
  const upcoming = (feed.upcoming || []).filter(keep)
  return {
    ...feed,
    today,
    upcoming,
    live: today.filter((g) => g.state === 'in').length,
    next: upcoming[0] || null,
    watchFiltered: true,
  }
}

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
  const detectedTz = useMemo(detectTimezone, [])
  // Like the viewers: a shared link's ?tz= wins on load, then a saved choice, then the
  // device zone. The hub writes no URL state, so the param is read-only here.
  const [tz, setTz] = useState(() => {
    const linked = new URLSearchParams(window.location.search).get('tz')
    if (isValidZone(linked)) return linked
    const saved = loadJson('st:tz', null)
    return isValidZone(saved) ? saved : detectedTz
  })
  useEffect(() => {
    try {
      localStorage.setItem('st:tz', JSON.stringify(tz))
    } catch {
      /* private mode */
    }
  }, [tz])
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark')
  const [feeds, setFeeds] = useState(() => VIEWERS.map((v) => EMPTY_FEED(v.id)))
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const now = useMemo(() => new Date(), [])

  // Which viewers to show (null = all), and the "what can I watch" filter (chosen services
  // + whether it's engaged).
  const [sports, setSports] = useState(() => loadJson('st:sports', null))
  const [services, setServices] = useState(() => loadJson('st:services', []))
  const [watchOnly, setWatchOnly] = useState(() => loadJson('st:watchOnly', false))
  // Spoiler-free mode, same idea as the viewers': matchups and states stay, numbers go.
  const [hideScores, setHideScores] = useState(() => loadJson('st:hideScores', false))
  const [showPicker, setShowPicker] = useState(false)
  const [showSports, setShowSports] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('st:sports', JSON.stringify(sports))
    } catch {
      /* private mode */
    }
  }, [sports])

  useEffect(() => {
    try {
      localStorage.setItem('st:services', JSON.stringify(services))
    } catch {
      /* private mode */
    }
  }, [services])
  useEffect(() => {
    try {
      localStorage.setItem('st:watchOnly', JSON.stringify(watchOnly))
    } catch {
      /* private mode */
    }
  }, [watchOnly])
  useEffect(() => {
    try {
      localStorage.setItem('st:hideScores', JSON.stringify(hideScores))
    } catch {
      /* private mode */
    }
  }, [hideScores])

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

  // The filter is engaged only when it's on AND at least one service is chosen.
  const filterActive = watchOnly && services.length > 0
  const displayFeeds = useMemo(
    () => feeds.map((f) => applyWatchFilter(f, services, filterActive)),
    [feeds, services, filterActive]
  )

  const feedById = useMemo(
    () => Object.fromEntries(displayFeeds.map((f) => [f.id, f])),
    [displayFeeds]
  )

  // The viewers the user has chosen to show (null = all).
  const visibleViewers = useMemo(
    () => (sports && sports.length ? VIEWERS.filter((v) => sports.includes(v.id)) : VIEWERS),
    [sports]
  )
  const visibleFeeds = useMemo(() => {
    const ids = new Set(visibleViewers.map((v) => v.id))
    return displayFeeds.filter((f) => ids.has(f.id))
  }, [displayFeeds, visibleViewers])

  const cards = useMemo(() => {
    return visibleViewers.map((v) => {
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
  }, [visibleViewers, feedById, now])

  const totalToday = visibleFeeds.reduce((n, f) => n + f.today.length, 0)
  const totalLive = visibleFeeds.reduce((n, f) => n + f.live, 0)
  const totalUpcoming = visibleFeeds.reduce((n, f) => n + (f.upcoming?.length || 0), 0)
  const g = (n) => `${n} game${n === 1 ? '' : 's'}`

  let summaryText
  if (status === 'loading') summaryText = 'Checking every viewer…'
  else if (status === 'error')
    summaryText = 'Could not reach the scoreboard — showing season badges only.'
  else if (filterActive) {
    // Filtered to what the chosen services can watch.
    if (totalLive > 0) summaryText = `${g(totalLive)} live now you can watch · ${totalToday} today on your services.`
    else if (totalToday > 0) summaryText = `${g(totalToday)} today you can watch on your services.`
    else if (totalUpcoming > 0)
      summaryText = `Nothing on your services today — ${totalUpcoming} coming up in the next two weeks.`
    else summaryText = 'Nothing on your services in the next two weeks.'
  } else if (totalLive > 0) summaryText = `${g(totalLive)} live now · ${totalToday} today across the family.`
  else if (totalToday > 0) summaryText = `${g(totalToday)} today across the family.`
  else summaryText = 'No games today across the family — here is where each season stands.'

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
        {summaryText} <span className="dim">Times in {tz.replace(/_/g, ' ')}.</span>
      </p>

      <div className="controls">
        <label className="chip chip-select">
          <span aria-hidden="true">🕑</span>
          <span className="sr-only">Timezone</span>
          <select value={tz} onChange={(e) => setTz(e.target.value)}>
            {timezoneOptions(tz).map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        </label>
        <button className="chip" onClick={() => setShowSports(true)}>
          🏅 {sports && sports.length ? `Sports (${visibleViewers.length})` : 'All sports'}
        </button>
        <button className="chip" onClick={() => setShowPicker(true)}>
          📺 {services.length ? `My services (${services.length})` : 'Choose my services'}
        </button>
        {services.length > 0 && (
          <button
            className={`chip ${filterActive ? 'on' : ''}`}
            onClick={() => setWatchOnly((v) => !v)}
            aria-pressed={filterActive}
            title="Show only games on the services you have"
          >
            {filterActive ? '✓ ' : ''}On my services
          </button>
        )}
        <button
          className={`chip ${hideScores ? 'on' : ''}`}
          onClick={() => setHideScores((v) => !v)}
          aria-pressed={hideScores}
          title="Spoiler-free mode — hide all scores"
        >
          {hideScores ? '🙈 Scores hidden' : '👁 Hide scores'}
        </button>
      </div>

      <MyTeams feeds={visibleFeeds} tz={tz} hideScores={hideScores} />

      <section className="grid">
        {cards.map(({ v, feed, phase }) => (
          <ViewerCard
            key={v.id}
            viewer={v}
            feed={feed}
            phase={phase}
            tz={tz}
            filtered={filterActive}
            hideScores={hideScores}
          />
        ))}
      </section>

      <YesterdayRecap feeds={visibleFeeds} tz={tz} hideScores={hideScores} />

      <UpcomingSchedule feeds={visibleFeeds} tz={tz} filtered={filterActive} />

      <InstallShelf viewers={visibleViewers} />

      {showSports && (
        <SportsPicker
          selected={sports}
          onChange={setSports}
          onClose={() => setShowSports(false)}
        />
      )}
      {showPicker && (
        <ServicesPicker
          selected={services}
          onChange={setServices}
          onClose={() => setShowPicker(false)}
        />
      )}

      <footer className="foot">
        <span className="dim">
          Unofficial. Data from ESPN's public scoreboard, fetched in your browser — no backend, no
          tracking. Part of the{' '}
          <a href="https://github.com/ismayc">ismayc</a> sports viewer family.
        </span>
        <span className="dim">
          Created by{' '}
          <a href="https://chester.rbind.io" target="_blank" rel="noopener noreferrer">
            Chester Ismay
          </a>
          .
        </span>
      </footer>
    </div>
  )
}
