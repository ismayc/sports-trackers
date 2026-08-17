import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import TeamsPicker from '../src/components/TeamsPicker.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { VIEWERS } from '../src/data/viewers.js'

// The catalog service is mocked here and exercised directly in teams.test.js, so these tests
// are about what the DIALOG does with a catalog.
const { fetchTeams } = vi.hoisted(() => ({ fetchTeams: vi.fn() }))
vi.mock('../src/services/teams.js', () => ({ fetchTeams, parseTeams: vi.fn() }))

const team = (abbr, name, logo = null) => ({ abbr, name, logo })

const CATALOG = {
  nba: [team('BOS', 'Boston Celtics', 'celtics.png'), team('MIA', 'Miami Heat')],
  nfl: [team('SEA', 'Seattle Seahawks')],
  wnba: [team('MIA', 'Miami Sol')],
  epl: [team('ARS', 'Arsenal')],
}

let resolveCatalog
beforeEach(() => {
  fetchTeams.mockReset()
  fetchTeams.mockResolvedValue(CATALOG)
})

// The fetch resolves in a microtask; flush it inside act so React commits the state.
const settle = () => act(async () => {})

const show = async (onClose = vi.fn()) => {
  const r = render(
    <FollowProvider>
      <TeamsPicker onClose={onClose} />
    </FollowProvider>
  )
  await settle()
  return { ...r, onClose }
}

describe('TeamsPicker', () => {
  it('shows a loading line until the catalog lands', async () => {
    fetchTeams.mockReturnValue(new Promise((res) => (resolveCatalog = res)))
    render(
      <FollowProvider>
        <TeamsPicker onClose={vi.fn()} />
      </FollowProvider>
    )
    expect(screen.getByText('Loading teams…')).toBeInTheDocument()
    await act(async () => resolveCatalog(CATALOG))
    expect(screen.queryByText('Loading teams…')).not.toBeInTheDocument()
  })

  it('groups the teams under one heading per sport', async () => {
    await show()
    for (const v of VIEWERS) expect(screen.getByText(new RegExp(`^${v.name}`))).toBeInTheDocument()
    expect(screen.getByLabelText('Boston Celtics')).toBeInTheDocument()
    expect(screen.getByLabelText('Arsenal')).toBeInTheDocument()
  })

  it('checking a team writes the viewer app’s own follow key', async () => {
    await show()
    fireEvent.click(screen.getByLabelText('Boston Celtics'))
    expect(screen.getByLabelText('Boston Celtics')).toBeChecked()
    // Same origin as the NBA viewer, so this IS that app's store.
    expect(JSON.parse(localStorage.getItem('nba:followed'))).toEqual(['BOS'])
  })

  it('starts with the teams already followed in a viewer app checked', async () => {
    localStorage.setItem('pl:followed', JSON.stringify(['ARS']))
    await show()
    expect(screen.getByLabelText('Arsenal')).toBeChecked()
    expect(screen.getByLabelText('Seattle Seahawks')).not.toBeChecked()
  })

  it('keeps the same abbreviation in two sports apart', async () => {
    await show()
    const [nbaMia, wnbaMia] = screen.getAllByLabelText(/^Miami/)
    fireEvent.click(nbaMia)
    expect(nbaMia).toBeChecked()
    expect(wnbaMia).not.toBeChecked()
  })

  it('counts the followed teams in each sport’s heading', async () => {
    await show()
    fireEvent.click(screen.getByLabelText('Boston Celtics'))
    expect(screen.getByText(/NBA · 1 followed/)).toBeInTheDocument()
  })

  it('searches across every sport at once, by name or abbreviation', async () => {
    await show()
    fireEvent.change(screen.getByLabelText('Search teams'), { target: { value: 'ars' } })
    expect(screen.getByLabelText('Arsenal')).toBeInTheDocument()
    expect(screen.queryByLabelText('Boston Celtics')).not.toBeInTheDocument()
    // A sport with no match drops out entirely rather than leaving an empty heading.
    expect(screen.queryByText(/^NBA/)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search teams'), { target: { value: 'sea' } })
    expect(screen.getByLabelText('Seattle Seahawks')).toBeInTheDocument()
  })

  it('says so when nothing matches the search', async () => {
    await show()
    fireEvent.change(screen.getByLabelText('Search teams'), { target: { value: 'zzz' } })
    expect(screen.getByText('No team matches “zzz”.')).toBeInTheDocument()
  })

  it('reports a league whose catalog failed, without blanking the dialog', async () => {
    fetchTeams.mockResolvedValue({ ...CATALOG, nfl: [] })
    await show()
    expect(
      screen.getByText('Couldn’t load NFL teams. Star them from a game row instead.')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Boston Celtics')).toBeInTheDocument()
  })

  it('offers Clear all only once something is followed, and scopes it to the live sports', async () => {
    localStorage.setItem('wc2026:followed', JSON.stringify(['BRA']))
    await show()
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Boston Celtics'))
    fireEvent.click(screen.getByText('Clear all'))
    expect(screen.getByLabelText('Boston Celtics')).not.toBeChecked()
    // The archived World Cup app's picks are not the picker's to throw away.
    expect(JSON.parse(localStorage.getItem('wc2026:followed'))).toEqual(['BRA'])
  })

  it('renders the crest of a team that has one', async () => {
    const { container } = await show()
    expect(container.querySelectorAll('img.tp-logo')).toHaveLength(1)
    expect(container.querySelector('img.tp-logo')).toHaveAttribute('src', 'celtics.png')
  })

  it('closes on Done, on the backdrop, and on Escape', async () => {
    const { onClose, container } = await show()
    fireEvent.click(screen.getByText('Done'))
    fireEvent.click(container.querySelector('.modal-backdrop'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('does not close on a click inside the dialog', async () => {
    const { onClose } = await show()
    fireEvent.click(screen.getByRole('dialog'))
    fireEvent.keyDown(document, { key: 'a' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('aborts the catalog request if it is closed mid-flight', async () => {
    fetchTeams.mockReturnValue(new Promise(() => {}))
    const { unmount } = render(
      <FollowProvider>
        <TeamsPicker onClose={vi.fn()} />
      </FollowProvider>
    )
    const signal = fetchTeams.mock.calls[0][1].signal
    expect(signal.aborted).toBe(false)
    unmount()
    expect(signal.aborted).toBe(true)
  })
})
