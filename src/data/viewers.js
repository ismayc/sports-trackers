// The viewers this hub fronts. Everything the hub knows about a viewer lives here:
// how to reach its ESPN feed, where its deployed app is, its calendar (webcal) host, and
// enough season-shape info to render a phase badge on a day with zero games.
//
// TWO LISTS, on purpose. `VIEWERS` is the LIVE set: the leagues and tournaments whose
// feeds are fetched, which fill the main grid, the sports picker, the install shelf and
// every "games today" count. `ARCHIVED_VIEWERS` (bottom of this file) holds finished
// editions whose apps still work but whose next tournament is years away — they render in
// a collapsed section, hidden by default, and are deliberately NOT fetched. Adding one to
// `VIEWERS` instead would put a permanent "Offseason" tile in the grid and spend a network
// round-trip per page load to learn nothing.
//
// Season shape is intentionally coarse — month windows, not exact schedules — because the
// hub never commits a schedule snapshot the way the individual viewers do. The badge is a
// hint ("In season" / "Offseason" / "Starts in Nd"); the live feed is the source of truth
// for whether anything is actually on today.
//
// `espnPath` slots into: site.api.espn.com/apis/site/v2/sports/{espnPath}/scoreboard
// `college: true` viewers get &groups=50&seasontype=3 appended AND the March-Madness
//   headline filter applied (see services/espn.js) — the seasontype=3 window also carries
//   NIT / Crown / WBIT games, which are NOT the tournament.

export const VIEWERS = [
  {
    id: 'nba',
    name: 'NBA',
    emoji: '🏀',
    espnPath: 'basketball/nba',
    url: 'https://ismayc.github.io/nba-schedule/',
    calendarHost: 'the-nba-schedule.netlify.app',
    kind: 'league',
    // Regular season Oct–Apr; playoffs Apr–Jun. Wraps the new year (start>end month).
    season: { startMonth: 10, startDay: 21, endMonth: 6 },
    playoffs: { startMonth: 4, endMonth: 6 },
  },
  {
    id: 'nfl',
    name: 'NFL',
    emoji: '🏈',
    espnPath: 'football/nfl',
    url: 'https://ismayc.github.io/nfl-schedule/',
    calendarHost: 'nfl-schedule.netlify.app',
    kind: 'league',
    // Sep through the Feb Super Bowl; playoffs Jan–Feb.
    season: { startMonth: 9, startDay: 4, endMonth: 2 },
    playoffs: { startMonth: 1, endMonth: 2 },
  },
  {
    id: 'wnba',
    name: 'WNBA',
    emoji: '🏀',
    espnPath: 'basketball/wnba',
    url: 'https://ismayc.github.io/wnba-schedule/',
    calendarHost: 'wnba-schedule.netlify.app',
    kind: 'league',
    // May–Oct, within one calendar year; playoffs Sep–Oct.
    season: { startMonth: 5, startDay: 1, endMonth: 10 },
    playoffs: { startMonth: 9, endMonth: 10 },
  },
  {
    id: 'epl',
    name: 'Premier League',
    emoji: '⚽',
    espnPath: 'soccer/eng.1',
    url: 'https://ismayc.github.io/premier-league/',
    calendarHost: 'premier-league.netlify.app',
    kind: 'league',
    // Aug–May, wraps the new year. No playoff round — it's a table to the final whistle.
    season: { startMonth: 8, startDay: 15, endMonth: 5 },
  },
  // Euros — still fully dormant, NOT in the archived shelf below. The viewer covers the
  // completed Euro 2024 and the next tournament is June–July 2028. Either promote it into
  // ARCHIVED_VIEWERS alongside the other finished editions, or move it back up here with
  // updated dates when the 2028 window approaches; the icon (public/icons/euros.png) and
  // the viewer are ready either way.
  // {
  //   id: 'euros',
  //   name: 'Euros',
  //   emoji: '⚽',
  //   espnPath: 'soccer/uefa.euro',
  //   url: 'https://ismayc.github.io/football-euros-viewer/',
  //   calendarHost: 'football-euros-viewer.netlify.app',
  //   kind: 'tournament',
  //   tournamentLabel: 'Tournament',
  //   window: { start: { m: 6, d: 14 }, end: { m: 7, d: 14 } },
  // },
  {
    id: 'mens-mm',
    name: "Men's March Madness",
    emoji: '🏀',
    espnPath: 'basketball/mens-college-basketball',
    url: 'https://ismayc.github.io/mens-march-madness/',
    calendarHost: 'mens-march-madness.netlify.app',
    kind: 'tournament',
    tournamentLabel: 'Tournament',
    college: true,
    // Only rows whose competition headline starts with this are the actual tournament.
    mmHeadline: "NCAA Men's Basketball Championship",
    window: { start: { m: 3, d: 17 }, end: { m: 4, d: 7 } },
  },
  {
    id: 'womens-mm',
    name: "Women's March Madness",
    emoji: '🏀',
    espnPath: 'basketball/womens-college-basketball',
    url: 'https://ismayc.github.io/womens-march-madness/',
    calendarHost: 'womens-march-madness.netlify.app',
    kind: 'tournament',
    tournamentLabel: 'Tournament',
    college: true,
    mmHeadline: "NCAA Women's Basketball Championship",
    window: { start: { m: 3, d: 18 }, end: { m: 4, d: 7 } },
  },
]

// Finished editions. Their apps are complete, tested archives and stay reachable, but the
// next tournament is years out, so they live in a collapsed shelf instead of the grid and
// their feeds are never fetched (see the note at the top of this file).
//
// `edition` is the year the app covers; `nextEdition` is when the competition returns, which
// is the honest reason the tile is tucked away. Deliberately NO champion or result here —
// the hub has a spoiler-free mode, and an always-visible label naming the winner would
// defeat it for someone about to open the archive.
export const ARCHIVED_VIEWERS = [
  {
    id: 'worldcup',
    name: 'World Cup',
    emoji: '⚽',
    url: 'https://ismayc.github.io/world-cup-viewer/',
    calendarHost: 'world-cup-viewer.netlify.app',
    kind: 'tournament',
    edition: '2026',
    nextEdition: '2030',
  },
  {
    id: 'wwc',
    name: "Women's World Cup",
    emoji: '⚽',
    url: 'https://ismayc.github.io/womens-world-cup-viewer/',
    calendarHost: 'womens-world-cup-viewer.netlify.app',
    kind: 'tournament',
    edition: '2023',
    nextEdition: '2027',
  },
  {
    id: 'copa',
    name: 'Copa América',
    emoji: '⚽',
    url: 'https://ismayc.github.io/copa-america-viewer/',
    calendarHost: 'copa-america-viewer.netlify.app',
    kind: 'tournament',
    edition: '2024',
    nextEdition: '2028',
  },
]

export const viewerById = Object.fromEntries(
  [...VIEWERS, ...ARCHIVED_VIEWERS].map((v) => [v.id, v])
)
