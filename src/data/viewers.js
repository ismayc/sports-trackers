// The seven viewers this hub fronts. Everything the hub knows about a viewer lives here:
// how to reach its ESPN feed, where its deployed app is, its calendar (webcal) host, and
// enough season-shape info to render a phase badge on a day with zero games.
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
  // World Cup — disabled after the 2026 tournament; the next is 2030, so it would read
  // "Offseason" for the next four years. Uncomment (and it reappears on the hub) when the
  // 2030 window approaches. The icon (public/icons/worldcup.png) and viewer are untouched.
  // {
  //   id: 'worldcup',
  //   name: 'World Cup',
  //   emoji: '⚽',
  //   espnPath: 'soccer/fifa.world',
  //   url: 'https://ismayc.github.io/world-cup-viewer/',
  //   calendarHost: 'world-cup-viewer.netlify.app',
  //   kind: 'tournament',
  //   tournamentLabel: 'Tournament',
  //   window: { start: { m: 6, d: 11 }, end: { m: 7, d: 19 } },
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

export const viewerById = Object.fromEntries(VIEWERS.map((v) => [v.id, v]))
