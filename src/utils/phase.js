// Season-phase badge derivation.
//
// The badge has to be sensible on a day with zero games (the common case — on 2026-07-21
// only WNBA is in season). So it leans on the config's month windows, and lets the live
// feed *upgrade* the label when games are actually present:
//   - a league with games today OR inside its playoff months  -> "Playoffs"
//   - a tournament with games today                            -> "Tournament"
//   - otherwise fall back to the month-window read.
//
// `tone` drives the badge colour and the card sort (see App): hot > on > soon > cold.

import { daysUntilMonthDay } from './time.js'

const inMonthRange = (m, start, end) =>
  start <= end ? m >= start && m <= end : m >= start || m <= end // wraps the new year

export function seasonPhase(v, { now = new Date(), hasGames = false } = {}) {
  const m = now.getMonth() + 1

  if (v.kind === 'tournament') {
    // World Cup / March Madness: they only "exist" during their window. Games on the feed
    // are the definitive signal; the window is just for an imminent "Starts in Nd".
    if (hasGames) return { label: v.tournamentLabel || 'Tournament', tone: 'hot' }
    if (v.window) {
      const d = daysUntilMonthDay(now, v.window.start.m, v.window.start.d)
      if (d >= 0 && d <= 30) return { label: `Starts in ${d}d`, tone: 'soon', days: d }
    }
    return { label: 'Offseason', tone: 'cold' }
  }

  // Leagues.
  if (inMonthRange(m, v.season.startMonth, v.season.endMonth)) {
    if (v.playoffs && inMonthRange(m, v.playoffs.startMonth, v.playoffs.endMonth))
      return { label: 'Playoffs', tone: 'hot' }
    return { label: 'In season', tone: 'on' }
  }

  const d = daysUntilMonthDay(now, v.season.startMonth, v.season.startDay || 1)
  if (d >= 0 && d <= 45) return { label: `Starts in ${d}d`, tone: 'soon', days: d }
  return { label: 'Offseason', tone: 'cold' }
}
