import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// The hub's OWN cross-sport follow set. It CANNOT read another origin's localStorage, so
// it can't import a viewer's follow list — instead the user stars teams that show up in
// the hub's own game listings, and the hub keys each pick by "{viewerId}:{abbr}" so the
// same abbreviation in two sports (e.g. two "MIA"s) never collide.
//
// Deliberately a separate key (`st:follow`) from any viewer's follow key.

const KEY = 'st:follow'
const FollowCtx = createContext(null)

export const followKey = (viewerId, abbr) => `${viewerId}:${abbr}`

export function FollowProvider({ children }) {
  const [followed, setFollowed] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'))
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...followed]))
    } catch {
      /* private mode — starring just won't persist */
    }
  }, [followed])

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
      toggle,
      count: followed.size,
      clear: () => setFollowed(new Set()),
    }),
    [followed, toggle]
  )

  return <FollowCtx.Provider value={value}>{children}</FollowCtx.Provider>
}

export const useFollow = () => useContext(FollowCtx)
