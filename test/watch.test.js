import { describe, it, expect } from 'vitest'
import {
  SERVICE_CATALOG,
  SERVICE_BY_KEY,
  watchableServices,
  isWatchable,
} from '../src/utils/watch.js'

describe('service catalog', () => {
  it('has unique keys and a label + matcher for every entry', () => {
    const keys = SERVICE_CATALOG.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const s of SERVICE_CATALOG) {
      expect(s.label, s.key).toBeTruthy()
      expect(['stream', 'bundle']).toContain(s.kind)
      expect(typeof s.match).toBe('function')
    }
  })

  it('indexes by key', () => {
    expect(SERVICE_BY_KEY.peacock.label).toBe('Peacock')
    expect(Object.keys(SERVICE_BY_KEY)).toHaveLength(SERVICE_CATALOG.length)
  })

  it('covers both kinds, since the picker groups by them', () => {
    const kinds = new Set(SERVICE_CATALOG.map((s) => s.kind))
    expect([...kinds].sort()).toEqual(['bundle', 'stream'])
  })
})

describe('watchableServices', () => {
  it('matches a streamer by its own name', () => {
    expect(watchableServices(['Peacock'], ['peacock']).map((s) => s.key)).toEqual(['peacock'])
  })

  it('matches a bundle via a linear network it carries', () => {
    expect(watchableServices(['ESPN'], ['youtubetv']).map((s) => s.key)).toEqual(['youtubetv'])
  })

  it('returns every selected service that carries the game, in catalog order', () => {
    const keys = watchableServices(['CBS'], ['fubo', 'paramount', 'youtubetv']).map((s) => s.key)
    // Catalog order puts the streamer (paramount) before the bundles.
    expect(keys).toEqual(['paramount', 'youtubetv', 'fubo'])
  })

  it('does not match a service that lacks the network', () => {
    // Sling carries neither ABC nor CBS.
    expect(watchableServices(['ABC'], ['sling'])).toEqual([])
    expect(watchableServices(['CBS'], ['sling'])).toEqual([])
  })

  it('handles the USA Network name variants ESPN emits', () => {
    expect(isWatchable(['USA'], ['sling'])).toBe(true)
    expect(isWatchable(['USA Net'], ['sling'])).toBe(true)
  })

  it('handles the NFL Network variants', () => {
    expect(isWatchable(['NFL Network'], ['fubo'])).toBe(true)
    expect(isWatchable(['NFL Net'], ['fubo'])).toBe(true)
  })

  it('treats Max and HBO Max as the same service', () => {
    expect(isWatchable(['Max'], ['max'])).toBe(true)
    expect(isWatchable(['HBO Max'], ['max'])).toBe(true)
    expect(isWatchable(['TNT'], ['max'])).toBe(true) // Max restreams the Turner nets
  })

  it('is empty for an unknown broadcast', () => {
    expect(watchableServices(['Some RSN'], ['youtubetv', 'cable'])).toEqual([])
  })

  it('is empty when nothing is selected or the broadcast is unknown', () => {
    expect(watchableServices([], ['peacock'])).toEqual([])
    expect(watchableServices(['ESPN'], [])).toEqual([])
    expect(watchableServices(undefined, ['peacock'])).toEqual([])
    expect(watchableServices(['ESPN'], undefined)).toEqual([])
    expect(watchableServices(null, null)).toEqual([])
  })

  it('ignores a selected key that is not in the catalog', () => {
    expect(watchableServices(['ESPN'], ['not-a-service'])).toEqual([])
  })
})

describe('isWatchable', () => {
  it('is the boolean form of watchableServices', () => {
    expect(isWatchable(['Netflix'], ['netflix'])).toBe(true)
    expect(isWatchable(['Netflix'], ['peacock'])).toBe(false)
    expect(isWatchable([], [])).toBe(false)
  })

  it('matches a game listing several networks if any one is carried', () => {
    expect(isWatchable(['Peacock', 'NBC'], ['sling'])).toBe(true)
  })
})
