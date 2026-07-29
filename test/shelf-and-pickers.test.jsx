import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InstallShelf from '../src/components/InstallShelf.jsx'
import SportsPicker from '../src/components/SportsPicker.jsx'
import ServicesPicker from '../src/components/ServicesPicker.jsx'
import { VIEWERS, ARCHIVED_VIEWERS } from '../src/data/viewers.js'
import { SERVICE_CATALOG } from '../src/utils/watch.js'

describe('InstallShelf', () => {
  it('defaults to every live viewer', () => {
    render(<InstallShelf />)
    for (const v of VIEWERS) expect(screen.getByText(v.name)).toBeInTheDocument()
  })

  it('does NOT list archived tournaments — they have their own shelf', () => {
    render(<InstallShelf />)
    for (const v of ARCHIVED_VIEWERS) expect(screen.queryByText(v.name)).not.toBeInTheDocument()
  })

  it('renders an Open link, and a Subscribe link only where a calendar host exists', () => {
    render(
      <InstallShelf
        viewers={[
          { id: 'nba', name: 'With Feed', url: 'https://a.example/', calendarHost: 'a.netlify.app' },
          { id: 'nfl', name: 'No Feed', url: 'https://b.example/' },
        ]}
      />
    )
    // Both viewers get an Open link; only the one with a calendarHost gets Subscribe.
    const opens = screen.getAllByRole('link', { name: 'Open' })
    expect(opens.map((a) => a.getAttribute('href'))).toEqual(['https://a.example/', 'https://b.example/'])
    const sub = screen.getByTitle('Subscribe to With Feed in your calendar')
    expect(sub).toHaveAttribute('href', 'webcal://a.netlify.app/calendar.ics')
    expect(screen.getAllByText(/Subscribe/)).toHaveLength(1)
  })

  it('honours a narrowed viewer list', () => {
    render(<InstallShelf viewers={VIEWERS.filter((v) => v.id === 'nba')} />)
    expect(screen.getByText('NBA')).toBeInTheDocument()
    expect(screen.queryByText('NFL')).not.toBeInTheDocument()
  })
})

describe('SportsPicker', () => {
  const setup = (selected = null) => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    render(<SportsPicker selected={selected} onChange={onChange} onClose={onClose} />)
    return { onChange, onClose }
  }

  it('offers every live viewer, all checked when nothing is narrowed', () => {
    setup(null)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(VIEWERS.length)
    expect(boxes.every((b) => b.checked)).toBe(true)
  })

  it('does not offer archived tournaments', () => {
    setup(null)
    for (const v of ARCHIVED_VIEWERS) expect(screen.queryByText(v.name)).not.toBeInTheDocument()
  })

  it('unchecking one reports the remaining ids', () => {
    const { onChange } = setup(null)
    fireEvent.click(screen.getByText('NBA'))
    const ids = onChange.mock.calls[0][0]
    expect(ids).not.toContain('nba')
    expect(ids).toHaveLength(VIEWERS.length - 1)
  })

  it('reports null once everything is checked again, so a future viewer shows by default', () => {
    const { onChange } = setup(VIEWERS.filter((v) => v.id !== 'nba').map((v) => v.id))
    fireEvent.click(screen.getByText('NBA'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('refuses to leave zero sports selected', () => {
    const { onChange } = setup(['nba'])
    const box = screen.getAllByRole('checkbox').find((b) => b.checked)
    expect(box).toBeDisabled() // the last one standing cannot be unchecked
    fireEvent.click(box)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('offers "Show all" only while narrowed', () => {
    const { onChange } = setup(['nba'])
    fireEvent.click(screen.getByText('Show all'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('hides "Show all" when nothing is narrowed', () => {
    setup(null)
    expect(screen.queryByText('Show all')).not.toBeInTheDocument()
  })

  it('closes on Done, on Escape, and on a backdrop click but not on a dialog click', () => {
    const { onClose } = setup(null)
    fireEvent.click(screen.getByText('Done'))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(document, { key: 'a' }) // not Escape
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(2) // stopPropagation

    fireEvent.click(screen.getByRole('dialog').parentElement)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('stops listening for Escape once unmounted', () => {
    const onClose = vi.fn()
    const { unmount } = render(<SportsPicker selected={null} onChange={vi.fn()} onClose={onClose} />)
    unmount()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('ServicesPicker', () => {
  const setup = (selected = []) => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    render(<ServicesPicker selected={selected} onChange={onChange} onClose={onClose} />)
    return { onChange, onClose }
  }

  it('lists the whole catalog, grouped', () => {
    setup()
    expect(screen.getAllByRole('checkbox')).toHaveLength(SERVICE_CATALOG.length)
    expect(screen.getByText('Peacock')).toBeInTheDocument()
    expect(screen.getByText('YouTube TV')).toBeInTheDocument()
  })

  it('adds and removes a service', () => {
    const { onChange } = setup([])
    fireEvent.click(screen.getByText('Peacock'))
    expect(onChange).toHaveBeenCalledWith(['peacock'])
  })

  it('removes an already-selected service', () => {
    const { onChange } = setup(['peacock', 'fubo'])
    fireEvent.click(screen.getByText('Peacock'))
    expect(onChange).toHaveBeenCalledWith(['fubo'])
  })

  it('shows selected services as checked', () => {
    setup(['netflix'])
    const netflix = screen.getAllByRole('checkbox').find((b) => b.checked)
    expect(netflix).toBeTruthy()
  })

  it('closes on Escape, on the backdrop, but not on a click inside the dialog', () => {
    const { onClose } = setup(['peacock'])
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'x' }) // not Escape
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1) // stopPropagation

    fireEvent.click(screen.getByRole('dialog').parentElement)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('stops listening for Escape once unmounted', () => {
    const onClose = vi.fn()
    const { unmount } = render(<ServicesPicker selected={[]} onChange={vi.fn()} onClose={onClose} />)
    unmount()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('hides "Clear all" when nothing is selected', () => {
    setup([])
    expect(screen.queryByText(/Clear all/)).not.toBeInTheDocument()
  })

  it('clears everything and closes', () => {
    const { onChange, onClose } = setup(['peacock'])
    fireEvent.click(screen.getByText(/Clear/i))
    expect(onChange).toHaveBeenCalledWith([])
    fireEvent.click(screen.getByText('Done'))
    expect(onClose).toHaveBeenCalled()
  })
})
