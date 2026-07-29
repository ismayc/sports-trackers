import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { FollowProvider, useFollow, followKey } from '../src/context/follow.jsx'

function Probe() {
  const f = useFollow()
  return (
    <div>
      <span data-testid="count">{f.count}</span>
      <span data-testid="nba-mia">{String(f.isFollowed('nba', 'MIA'))}</span>
      <span data-testid="wnba-mia">{String(f.isFollowed('wnba', 'MIA'))}</span>
      <button onClick={() => f.toggle('nba', 'MIA')}>toggle nba MIA</button>
      <button onClick={() => f.toggle('wnba', 'MIA')}>toggle wnba MIA</button>
      <button onClick={f.clear}>clear</button>
    </div>
  )
}

const setup = () => render(
  <FollowProvider>
    <Probe />
  </FollowProvider>
)

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

  it('clear drops everything', () => {
    setup()
    fireEvent.click(screen.getByText('toggle nba MIA'))
    fireEvent.click(screen.getByText('toggle wnba MIA'))
    expect(screen.getByTestId('count')).toHaveTextContent('2')
    fireEvent.click(screen.getByText('clear'))
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('persists to its own localStorage key and rehydrates', () => {
    const { unmount } = setup()
    fireEvent.click(screen.getByText('toggle nba MIA'))
    expect(JSON.parse(localStorage.getItem('st:follow'))).toEqual(['nba:MIA'])
    unmount()
    setup()
    expect(screen.getByTestId('nba-mia')).toHaveTextContent('true')
  })

  it('survives corrupt stored JSON', () => {
    localStorage.setItem('st:follow', 'not json{')
    setup()
    expect(screen.getByTestId('count')).toHaveTextContent('0')
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
})
