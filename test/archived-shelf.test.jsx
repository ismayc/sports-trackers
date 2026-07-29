import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ArchivedShelf from '../src/components/ArchivedShelf.jsx'
import { ARCHIVED_VIEWERS } from '../src/data/viewers.js'

describe('ArchivedShelf', () => {
  it('is CLOSED by default — the whole point of the section', () => {
    const { container } = render(<ArchivedShelf />)
    const details = container.querySelector('details')
    expect(details).toBeInTheDocument()
    expect(details.open).toBe(false)
  })

  it('shows the heading and the archived count while collapsed', () => {
    render(<ArchivedShelf />)
    expect(screen.getByText(/Completed tournaments/)).toBeVisible()
    expect(screen.getByText(`${ARCHIVED_VIEWERS.length} archived viewers`)).toBeInTheDocument()
  })

  it('renders a chevron, because a flex <summary> loses Chrome\'s native marker', () => {
    // Found in the browser: with `display: flex` the row had no expand affordance at all.
    const { container } = render(<ArchivedShelf />)
    const chevron = container.querySelector('.archived-chevron')
    expect(chevron).toBeInTheDocument()
    expect(chevron).toHaveAttribute('aria-hidden', 'true') // decorative; <summary> is the control
  })

  it('lists every archived viewer with a link to its app', () => {
    render(<ArchivedShelf />)
    // Matched by href, not by name: "World Cup" is a substring of "Women's World Cup", so a
    // name regex is ambiguous by construction here.
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(ARCHIVED_VIEWERS.map((v) => v.url))
  })

  it('shows each edition year and when the competition returns', () => {
    render(<ArchivedShelf />)
    for (const v of ARCHIVED_VIEWERS) {
      expect(screen.getByText(v.edition)).toBeInTheDocument()
      expect(screen.getByText(`Next in ${v.nextEdition}`)).toBeInTheDocument()
    }
  })

  it('renders the three requested tournaments, each with its own edition', () => {
    render(<ArchivedShelf />)
    const labels = screen.getAllByRole('link').map((a) => a.textContent.replace(/\s+/g, ' ').trim())
    expect(labels).toEqual(['World Cup 2026', "Women's World Cup 2023", 'Copa América 2024'])
  })

  it('points each tile at its own icon', () => {
    const { container } = render(<ArchivedShelf />)
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'))
    expect(srcs).toEqual(ARCHIVED_VIEWERS.map((v) => `/icons/${v.id}.png`))
  })

  it('renders nothing at all when there is nothing archived', () => {
    // Guards the empty state: an open-able but empty disclosure would be a dead control.
    const { container } = render(<ArchivedShelf viewers={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('accepts an injected list and uses the singular for one entry', () => {
    render(<ArchivedShelf viewers={[{ id: 'copa', name: 'Solo Cup', url: 'https://example.com/', edition: '2020', nextEdition: '2024' }]} />)
    expect(screen.getByText('1 archived viewer')).toBeInTheDocument()
  })

  it('omits the "next in" note when a viewer has no next edition', () => {
    render(<ArchivedShelf viewers={[{ id: 'copa', name: 'Retired Cup', url: 'https://example.com/', edition: '2020' }]} />)
    expect(screen.queryByText(/Next in/)).not.toBeInTheDocument()
  })

  it('names no champion or result — the shelf must not spoil an archive', () => {
    const { container } = render(<ArchivedShelf />)
    const text = container.textContent.toLowerCase()
    for (const word of ['won', 'champion', 'beat ', 'winner']) {
      expect(text, `shelf text contains "${word}"`).not.toContain(word)
    }
  })
})
