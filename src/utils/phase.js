// Season-phase badge derivation.
//
// The badge has to be sensible on a day with zero games (the common case — on 2026-07-21
// only WNBA is in season). So it leans on the config's month windows, and lets the live
// feed *upgrade* the label when games are actually present:
//   - a league with a POSTSEASON game today                    -> "Playoffs"
//   - a tournament with games today                            -> "Tournament"
//   - otherwise fall back to the month-window read.
//
// "Playoffs" is deliberately NOT a calendar window. A league's regular season and its
// postseason routinely share a month — the WNBA runs into late September and its playoffs
// start after, the NBA overlaps in April/June, the NFL in January — so a month window
// labels the tail of the regular season "Playoffs". The feed's season type is the only
// signal that actually separates them, so `postseason` (from services/espn) drives it.
//
// `tone` drives the badge colour and the card sort (see App): hot > on > soon > cold.

import { daysUntilMonthDay } from './time.js'

const inMonthRange = (m, start, end) =>
  start <= end ? m >= start && m <= end : m >= start || m <= end // wraps the new year

export function seasonPhase(v, { now = new Date(), hasGames = false, postseason = false } = {}) {
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

  // Leagues. The month window is honest except at its leading edge: inside the start
  // month the season hasn't begun until startDay (the PL kicks off Aug 15 — the first
  // two weeks of August are still "Starts in Nd", not "In season").
  const beforeStart = m === v.season.startMonth && now.getDate() < (v.season.startDay || 1)
  if (!beforeStart && inMonthRange(m, v.season.startMonth, v.season.endMonth)) {
    // Only an actual postseason game on the feed makes it "Playoffs" — see the file
    // header on why the calendar can't be trusted for this. On a postseason off-day
    // (no games) this reads "In season", which is vaguer but never wrong.
    if (postseason) return { label: 'Playoffs', tone: 'hot' }
    return { label: 'In season', tone: 'on' }
  }

  const d = daysUntilMonthDay(now, v.season.startMonth, v.season.startDay || 1)
  if (d >= 0 && d <= 45) return { label: `Starts in ${d}d`, tone: 'soon', days: d }
  return { label: 'Offseason', tone: 'cold' }
}
