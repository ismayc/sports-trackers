import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DormantStrip from '../src/components/DormantStrip.jsx'

const item = (id, name, phase) => ({
  v: { id, name, url: `https://example.com/${id}/` },
  phase,
})

describe('DormantStrip', () => {
  it('renders one linked row per viewer, name as a heading', () => {
    render(
      <DormantStrip
        items={[
          item('nba', 'NBA', { label: 'Starts in 34d', tone: 'soon' }),
          item('nfl', 'NFL', { label: 'In season', tone: 'on' }),
        ]}
      />
    )
    expect(screen.getByRole('heading', { name: 'NBA' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /NBA/ })).toHaveAttribute(
      'href',
      'https://example.com/nba/'
    )
  })

  it('gives a counting-down or offseason viewer its phase label as the reason', () => {
    render(<DormantStrip items={[item('nba', 'NBA', { label: 'Starts in 34d', tone: 'soon' })]} />)
    expect(screen.getByText('Starts in 34d')).toBeInTheDocument()
  })

  it('says "nothing in the next two weeks" for an in-season viewer that is simply quiet', () => {
    // A bye or an international break: in season, but nothing on. The phase label
    // ("In season") would read oddly on a recessed row, so the reason is the absence.
    render(<DormantStrip items={[item('nfl', 'NFL', { label: 'In season', tone: 'on' })]} />)
    expect(screen.getByText('nothing in the next two weeks')).toBeInTheDocument()
    expect(screen.queryByText('In season')).not.toBeInTheDocument()
  })

  it('treats a playoffs-toned viewer with nothing on the same way', () => {
    render(<DormantStrip items={[item('nba', 'NBA', { label: 'Playoffs', tone: 'hot' })]} />)
    expect(screen.getByText('nothing in the next two weeks')).toBeInTheDocument()
  })

  it('renders nothing when there are no dormant viewers', () => {
    const { container } = render(<DormantStrip items={[]} />)
    expect(container.querySelector('.dormant-strip')).toBeNull()
  })
})
