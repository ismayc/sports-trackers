import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { FollowProvider, useFollow, followKey, readStores, writeStores } from '../src/context/follow.jsx'

function Probe() {
  const f = useFollow()
  return (
    <div>
      <span data-testid="count">{f.count}</span>
      <span data-testid="nba-count">{f.countFor('nba')}</span>
      <span data-testid="nba-mia">{String(f.isFollowed('nba', 'MIA'))}</span>
      <span data-testid="wnba-mia">{String(f.isFollowed('wnba', 'MIA'))}</span>
      <span data-testid="wc-bra">{String(f.isFollowed('worldcup', 'BRA'))}</span>
      <button onClick={() => f.toggle('nba', 'MIA')}>toggle nba MIA</button>
      <button onClick={() => f.toggle('wnba', 'MIA')}>toggle wnba MIA</button>
      <button onClick={() => f.clearFor(['nba', 'wnba'])}>clear</button>
    </div>
  )
}

const setup = () => render(
  <FollowProvider>
    <Probe />
  </FollowProvider>
)

const stored = (key) => JSON.parse(localStorage.getItem(key))

describe('followKey', () => {
  it('namespaces the abbreviation by viewer', () => {
    expect(followKey('nba', 'MIA')).toBe('nba:MIA')
  })
})

describe('FollowProvider', () => {
  it('starts empty', () => {
    setup()
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(screen.getByTestId('nba-mia')).toHaveTextContent('false')
  })

  it('toggles a team on and back off', () => {
    setup()
    fireEvent.click(screen.getByText('toggle nba MIA'))
    expect(screen.getByTestId('nba-mia')).toHaveTextContent('true')
    expect(screen.getByTestId('count')).toHaveTextContent('1')
    fireEvent.click(screen.getByText('toggle nba MIA'))
    expect(screen.getByTestId('nba-mia')).toHaveTextContent('false')
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('keeps the same abbreviation in two sports separate', () => {
    // The reason keys are namespaced at all: both the NBA and the WNBA have a "MIA".
    setup()
    fireEvent.click(screen.getByText('toggle nba MIA'))
    expect(screen.getByTestId('nba-mia')).toHaveTextContent('true')
    expect(screen.getByTestId('wnba-mia')).toHaveTextContent('false')
  })

  it('counts per viewer', () => {
    setup()
    fireEvent.click(screen.getByText('toggle nba MIA'))
    fireEvent.click(screen.getByText('toggle wnba MIA'))
    expect(screen.getByTestId('nba-count')).toHaveTextContent('1')
    expect(screen.getByTestId('count')).toHaveTextContent('2')
  })

  it('clearFor drops the named viewers and leaves the rest alone', () => {
    // The picker only shows the four live sports, so its "Clear all" must not silently
    // unfollow a team someone follows in an archived tournament app.
    localStorage.setItem('wc2026:followed', JSON.stringify(['BRA']))
    setup()
    fireEvent.click(screen.getByText('toggle nba MIA'))
    fireEvent.click(screen.getByText('toggle wnba MIA'))
    expect(screen.getByTestId('count')).toHaveTextContent('3')
    fireEvent.click(screen.getByText('clear'))
    expect(screen.getByTestId('count')).toHaveTextContent('1')
    expect(screen.getByTestId('wc-bra')).toHaveTextContent('true')
    expect(stored('wc2026:followed')).toEqual(['BRA'])
  })
})

// The whole point of the rewrite: the hub does not own a follow list, it edits the ones the
// viewer apps already keep. Every app in the family is served from ismayc.github.io, so
// these keys are literally the same storage.
describe('sharing the viewers’ own stores', () => {
  it('writes each viewer app’s OWN key, in that app’s own shape', () => {
    setup()
    fireEvent.click(screen.getByText('toggle nba MIA'))
    fireEvent.click(screen.getByText('toggle wnba MIA'))
    // A flat array of abbreviations, exactly what the viewer's FollowProvider stores.
    expect(stored('nba:followed')).toEqual(['MIA'])
    expect(stored('wnba:followed')).toEqual(['MIA'])
    // The hub's retired private key is not resurrected.
    expect(localStorage.getItem('st:follow')).toBeNull()
  })

  it('picks up teams followed in a viewer app', () => {
    localStorage.setItem('pl:followed', JSON.stringify(['ARS']))
    localStorage.setItem('nba:followed', JSON.stringify(['MIA']))
    setup()
    expect(screen.getByTestId('nba-mia')).toHaveTextContent('true')
    expect(screen.getByTestId('count')).toHaveTextContent('2')
  })

  it('unfollowing here removes the team from the viewer app', () => {
    localStorage.setItem('nba:followed', JSON.stringify(['MIA', 'BOS']))
    setup()
    fireEvent.click(screen.getByText('toggle nba MIA'))
    expect(stored('nba:followed')).toEqual(['BOS'])
  })

  it('lifts the hub’s legacy st:follow list into the shared keys, once', () => {
    localStorage.setItem('st:follow', JSON.stringify(['nba:MIA']))
    const { unmount } = setup()
    expect(screen.getByTestId('nba-mia')).toHaveTextContent('true')
    expect(stored('nba:followed')).toEqual(['MIA'])
    expect(localStorage.getItem('st:follow')).toBeNull()
    // And it stays migrated: a second mount reads the shared key, not the old one.
    unmount()
    setup()
    expect(screen.getByTestId('nba-mia')).toHaveTextContent('true')
  })

  it('merges a legacy pick with one already followed in the viewer', () => {
    localStorage.setItem('st:follow', JSON.stringify(['nba:MIA']))
    localStorage.setItem('nba:followed', JSON.stringify(['BOS']))
    setup()
    expect(screen.getByTestId('count')).toHaveTextContent('2')
    expect(stored('nba:followed').sort()).toEqual(['BOS', 'MIA'])
  })

  it('ignores a legacy value that is not usable JSON', () => {
    localStorage.setItem('st:follow', 'not json{')
    setup()
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('follows a change made in another tab', () => {
    // A viewer app open beside the hub writes its own key; the hub must not need a reload.
    setup()
    expect(screen.getByTestId('nba-mia')).toHaveTextContent('false')
    localStorage.setItem('nba:followed', JSON.stringify(['MIA']))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'nba:followed' }))
    })
    expect(screen.getByTestId('nba-mia')).toHaveTextContent('true')
  })

  it('reloads on a whole-store clear (a null storage key)', () => {
    localStorage.setItem('nba:followed', JSON.stringify(['MIA']))
    setup()
    expect(screen.getByTestId('nba-mia')).toHaveTextContent('true')
    localStorage.clear()
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
    })
    expect(screen.getByTestId('nba-mia')).toHaveTextContent('false')
  })

  it('ignores another key changing', () => {
    setup()
    localStorage.setItem('nba:followed', JSON.stringify(['MIA']))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'st:tz' }))
    })
    // Not a follow key, so nothing was re-read.
    expect(screen.getByTestId('nba-mia')).toHaveTextContent('false')
  })
})

describe('store resilience', () => {
  it('survives corrupt stored JSON in a viewer key', () => {
    localStorage.setItem('nba:followed', 'not json{')
    setup()
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('ignores a viewer key holding something that is not an array', () => {
    localStorage.setItem('nba:followed', JSON.stringify({ MIA: true }))
    expect(readStores().size).toBe(0)
  })

  it('survives localStorage throwing on write (private mode)', () => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('denied')
    }
    try {
      setup()
      // Starring still works in memory; it just will not persist.
      fireEvent.click(screen.getByText('toggle nba MIA'))
      expect(screen.getByTestId('nba-mia')).toHaveTextContent('true')
    } finally {
      Storage.prototype.setItem = setItem
    }
  })

  it('survives localStorage throwing on read', () => {
    const getItem = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('denied')
    }
    try {
      setup()
      expect(screen.getByTestId('count')).toHaveTextContent('0')
    } finally {
      Storage.prototype.getItem = getItem
    }
  })

  it('exposes the read/write pair for direct use', () => {
    // Note the namespace is the VIEWER ID (`epl`), while the store it lands in is the
    // Premier League app's own key (`pl:followed`). The two are not the same string.
    writeStores(new Set(['nba:MIA', 'epl:ARS']))
    expect(stored('nba:followed')).toEqual(['MIA'])
    expect(stored('pl:followed')).toEqual(['ARS'])
    expect(readStores()).toEqual(new Set(['nba:MIA', 'epl:ARS']))
  })
})
