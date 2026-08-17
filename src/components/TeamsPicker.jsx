import { useEffect, useMemo, useState } from 'react'
import { VIEWERS } from '../data/viewers.js'
import { useFollow } from '../context/follow.jsx'
import { fetchTeams } from '../services/teams.js'

// Pick the teams you follow, one section per sport. The same set the stars on a game row
// write (see context/follow.jsx), which on ismayc.github.io is the same set each viewer app
// keeps, so a team checked here is followed in that viewer too.
//
// The catalog is fetched when this opens rather than at page load (services/teams.js), so a
// visitor who never opens the picker pays nothing for it. Four leagues is about 97 teams, so
// there is a search box; it matches on name and abbreviation across every sport at once.
export default function TeamsPicker({ onClose }) {
  const follow = useFollow()
  const [catalog, setCatalog] = useState(null) // null while loading
  const [q, setQ] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    // fetchTeams never rejects: a league that fails comes back as an empty list, which is
    // reported per-section below rather than blanking the whole dialog.
    fetchTeams(VIEWERS, { signal: ctrl.signal }).then(setCatalog)
    return () => ctrl.abort()
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const needle = q.trim().toLowerCase()
  const groups = useMemo(
    () =>
      VIEWERS.map((v) => {
        const teams = catalog?.[v.id] || []
        return {
          v,
          teams,
          shown: needle
            ? teams.filter((t) => `${t.name} ${t.abbr}`.toLowerCase().includes(needle))
            : teams,
        }
      }),
    [catalog, needle]
  )

  const picked = VIEWERS.reduce((n, v) => n + follow.countFor(v.id), 0)
  const noMatches = catalog !== null && needle !== '' && groups.every((g) => g.shown.length === 0)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="My teams"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>My teams</h2>
        <p className="dim modal-note">
          Star the teams you care about, by sport. The family page can then show only their
          games, and each viewer picks the same teams up when you open it.
        </p>

        <input
          className="tp-search"
          type="search"
          value={q}
          placeholder="Search teams"
          aria-label="Search teams"
          onChange={(e) => setQ(e.target.value)}
        />

        {catalog === null && <p className="dim tp-status">Loading teams…</p>}
        {noMatches && <p className="dim tp-status">No team matches “{q.trim()}”.</p>}

        {groups.map(({ v, teams, shown }) =>
          // With a search running, a sport with no match drops out entirely rather than
          // leaving an empty heading behind.
          needle && shown.length === 0 ? null : (
            <fieldset className="svc-group" key={v.id}>
              <legend>
                <img
                  className="tp-legend-icon"
                  src={`${import.meta.env.BASE_URL}icons/${v.id}.png`}
                  alt=""
                  width="16"
                  height="16"
                />
                {v.name}
                {follow.countFor(v.id) > 0 && ` · ${follow.countFor(v.id)} followed`}
              </legend>
              {catalog !== null && teams.length === 0 ? (
                // One league's request failed. The other three are still usable, and the
                // stars on this sport's game rows still work.
                <p className="dim tp-status">
                  Couldn’t load {v.name} teams. Star them from a game row instead.
                </p>
              ) : (
                <div className="svc-grid">
                  {shown.map((t) => {
                    const on = follow.isFollowed(v.id, t.abbr)
                    return (
                      <label key={t.abbr} className={`svc ${on ? 'on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => follow.toggle(v.id, t.abbr)}
                        />
                        {t.logo && (
                          <img
                            className="tp-logo"
                            src={t.logo}
                            alt=""
                            width="18"
                            height="18"
                            loading="lazy"
                          />
                        )}
                        <span className="tp-name">{t.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </fieldset>
          )
        )}

        <div className="modal-actions">
          {picked > 0 && (
            <button className="btn-link" onClick={() => follow.clearFor(VIEWERS.map((v) => v.id))}>
              Clear all
            </button>
          )}
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
