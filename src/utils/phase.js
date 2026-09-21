// Season-phase badge derivation.
//
// The badge has to be sensible on a day with zero games (the common case — on 2026-07-21
// only WNBA is in season). So it leans on the config's date windows (a league's `season`
// months, a tournament's `runs` dates), and lets the live feed *upgrade* the label when
// games are actually present:
//   - a league with a POSTSEASON game today                    -> "Playoffs"
//   - a tournament with games today                            -> "Tournament"
//   - otherwise fall back to the date-window read.
//
// One label runs the other way: a league inside a configured international break (only the
// Premier League has any) reads "Int’l break" instead of "In season", and a game on the feed
// that day cancels it. See `currentBreak` and data/viewers.
//
// "Playoffs" is deliberately NOT a calendar window. A league's regular season and its
// postseason routinely share a month — the WNBA runs into late September and its playoffs
// start after, the NBA overlaps in April/June, the NFL in January — so a month window
// labels the tail of the regular season "Playoffs". The feed's season type is the only
// signal that actually separates them, so `postseason` (from services/espn) drives it.
//
// `tone` drives the badge colour and the card sort (see App): hot > on > soon > cold.

import { daysUntilMonthDay, daysUntilDate, localDayISO } from './time.js'

const inMonthRange = (m, start, end) =>
  start <= end ? m >= start && m <= end : m >= start || m <= end // wraps the new year

// The badge a stopped league wears. Exported so the page can pick those cards out by it
// rather than repeating the "in a window AND nothing on the feed" test and drifting from it.
export const BREAK_LABEL = 'Int’l break'

// The break a league is inside right now, or null. Windows are inclusive 'YYYY-MM-DD' spans
// on the viewer (see data/viewers, epl), so this is a lexical string comparison on the local
// day — the same test the tournament archive boundary uses. Exported because the page note
// needs the window itself (its `resumes` date), not just the badge it produces.
export function currentBreak(v, now = new Date()) {
  const today = localDayISO(now)
  return (v.breaks || []).find((b) => today >= b.start && today <= b.end) || null
}

export function seasonPhase(v, { now = new Date(), hasGames = false, postseason = false } = {}) {
  const m = now.getMonth() + 1

  if (v.kind === 'tournament') {
    // World Cup / March Madness: they only "exist" during their edition. Games on the feed
    // are the definitive signal; `runs.start` is just for an imminent "Starts in Nd". Once
    // the edition ends the viewer is archived (see data/viewers isArchived) and never reaches
    // this badge.
    if (hasGames) return { label: v.tournamentLabel || 'Tournament', tone: 'hot' }
    if (v.runs) {
      const d = daysUntilDate(now, v.runs.start)
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
    // An international break: in season, but the competition is stopped, so "In season" over
    // an empty card is the vague reading the badge exists to avoid. Configured rather than
    // derived (the feed shows a hole and never says why), and therefore the feed still
    // outranks it — a game today means the calendar is wrong about this day, not the feed,
    // exactly as with "Playoffs" above. `cold` sorts it down beside the offseason cards,
    // which is honest: nothing is on.
    if (!hasGames && currentBreak(v, now)) return { label: BREAK_LABEL, tone: 'cold' }
    return { label: 'In season', tone: 'on' }
  }

  const d = daysUntilMonthDay(now, v.season.startMonth, v.season.startDay || 1)
  if (d >= 0 && d <= 45) return { label: `Starts in ${d}d`, tone: 'soon', days: d }
  return { label: 'Offseason', tone: 'cold' }
}
