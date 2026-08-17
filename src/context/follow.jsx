import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { VIEWERS, ARCHIVED_VIEWERS } from '../data/viewers.js'

// The hub's cross-sport follow set, and it is NOT the hub's own store.
//
// Every app in the family is deployed under https://ismayc.github.io/<app>/, so the hub and
// all ten viewers share ONE origin, and therefore one localStorage. That means the hub can
// use each viewer's own key (`nba:followed`, `pl:followed`, …, see data/viewers.js
// followKey) as the single source of truth instead of keeping a private copy: a team starred
// here is followed in that viewer on its next load, and a club followed in the Premier League
// app is already starred when you come back here. No sync protocol, no export/import, no
// backend, just the same key.
//
// Each viewer stores a flat array of abbreviations. The hub flattens all ten into one set of
// "{viewerId}:{abbr}" keys so the same abbreviation in two sports (both leagues have a "MIA")
// can never collide, and splits it back out on every write.
//
// TWO CAVEATS, both by design:
//   * The Netlify mirrors are a different origin each, so a hub served from Netlify keeps
//     these keys to itself. Everything still works; only the cross-app sharing is lost.
//   * `writeStores` rewrites EVERY viewer's key, archived ones included. That is why the
//     archived entries carry a followKey too: otherwise a first visit here would wipe the
//     teams someone follows in the World Cup archive.

const ALL = [...VIEWERS, ...ARCHIVED_VIEWERS]
const STORE_KEYS = new Set(ALL.map((v) => v.followKey))

// The hub's retired private key, kept only long enough to lift existing picks across.
const LEGACY_KEY = 'st:follow'

export const followKey = (viewerId, abbr) => `${viewerId}:${abbr}`

// Every viewer's stored list, flattened into one namespaced set.
export function readStores() {
  const set = new Set()
  for (const v of ALL) {
    let list = []
    try {
      const raw = JSON.parse(localStorage.getItem(v.followKey) || '[]')
      // The viewers write an array; anything else is a store we don't understand and must
      // not crash on (the Premier League app guards its own read the same way).
      if (Array.isArray(raw)) list = raw
    } catch {
      /* unreadable or not JSON, so that viewer simply contributes nothing */
    }
    for (const abbr of list) set.add(followKey(v.id, abbr))
  }
  return set
}

// Split the namespaced set back into one array per viewer, in the exact shape that viewer
// wrote it, so the app on the other side reads its own format back.
export function writeStores(followed) {
  for (const v of ALL) {
    const prefix = `${v.id}:`
    const abbrs = [...followed]
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length))
    try {
      localStorage.setItem(v.followKey, JSON.stringify(abbrs))
    } catch {
      /* private mode, so following just won't persist */
    }
  }
}

// One-time lift of the hub's old private list into the shared keys. Before the viewers'
// stores were shared, the hub kept `st:follow`; someone with picks in it would otherwise
// see them all vanish on the deploy that changed this. Removing the key completes the
// migration, and the mount write below is what lands the merged set in the real stores.
function migrateLegacy(set) {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (raw === null) return set
    for (const k of JSON.parse(raw)) set.add(k)
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* nothing usable to migrate */
  }
  return set
}

const FollowCtx = createContext(null)

export function FollowProvider({ children }) {
  const [followed, setFollowed] = useState(() => migrateLegacy(readStores()))

  useEffect(() => {
    writeStores(followed)
  }, [followed])

  // A viewer open in another tab is writing to the same keys. `storage` fires only in OTHER
  // documents, so this listens without ever echoing the write above back at itself.
  // A null key means the whole store was cleared.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== null && !STORE_KEYS.has(e.key)) return
      setFollowed(readStores())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = useCallback((viewerId, abbr) => {
    const k = followKey(viewerId, abbr)
    setFollowed((prev) => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      followed,
      isFollowed: (viewerId, abbr) => followed.has(followKey(viewerId, abbr)),
      countFor: (viewerId) => {
        const prefix = `${viewerId}:`
        return [...followed].filter((k) => k.startsWith(prefix)).length
      },
      toggle,
      count: followed.size,
      // Scoped on purpose: "clear" in the picker means the four sports it shows, not the
      // teams someone follows in an archived tournament app that the hub never displays.
      clearFor: (viewerIds) =>
        setFollowed(
          (prev) => new Set([...prev].filter((k) => !viewerIds.includes(k.slice(0, k.indexOf(':')))))
        ),
    }),
    [followed, toggle]
  )

  return <FollowCtx.Provider value={value}>{children}</FollowCtx.Provider>
}

export const useFollow = () => useContext(FollowCtx)
