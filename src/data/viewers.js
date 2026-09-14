// The viewers this hub fronts. Everything the hub knows about a viewer lives here:
// how to reach its ESPN feed, where its deployed app is, its calendar (webcal) host, and
// enough season-shape info to render a phase badge on a day with zero games.
//
// ONE master list, `ALL_VIEWERS`. The live-vs-archived split is DERIVED from the clock, not
// hand-maintained: `liveViewers(now)` is the set the hub fetches and fills the main grid,
// the sports picker and the install shelf with; `archivedViewers(now)` is the finished
// editions that render in the collapsed "Completed tournaments" shelf and are never fetched.
//
// A tournament AUTO-ARCHIVES once `now` is past its edition's `runs.end` (see isArchived).
// Nothing has to be moved by hand when a Final is played. Reviving one for its next edition
// is the one manual step left: update its `runs` (and `edition` / `nextEdition`) to the new
// dates, which is work you do anyway to load the new schedule into the viewer app. Until
// then a finished tournament simply stays in the Completed shelf. Leagues never archive:
// they roll from season to season in place, so they are always live.
//
// Season shape is intentionally coarse. A league carries month windows (`season`); the badge
// is a hint ("In season" / "Offseason" / "Starts in Nd") and the live feed is the source of
// truth for whether anything is actually on today. A tournament carries `runs`, the real
// start/end dates of the edition it currently covers, so the archive boundary and the
// "Starts in Nd" countdown are both exact.
//
// `espnPath` slots into: site.web.api.espn.com/apis/site/v2/sports/{espnPath}/scoreboard
// `college: true` viewers get &groups=50&seasontype=3 appended AND the March-Madness
//   headline filter applied (see services/espn.js), because the seasontype=3 window also
//   carries NIT / Crown / WBIT games, which are NOT the tournament. Without `mmHeadline` those
//   games show as though they were the tournament, so it must survive alongside the fetch config
//   even while the viewer sits archived, ready to revive.
// `followKey` is the viewer app's OWN localStorage key for its followed teams. Every app in
//   the family is deployed under https://ismayc.github.io/<app>/, which is the same origin as
//   this hub, so the hub reads and writes those keys directly instead of keeping a private
//   copy. Starring a team here follows it there and back again. See context/follow.jsx.
//   An archived viewer keeps its key too: its picks are never shown here, but the hub must
//   not drop a key it rewrites.
//
// ONE CAVEAT on the auto-archive, recorded so it is not forgotten (Chester's call,
// 2026-07-29): the two March Madness viewers are ANNUAL, not quadrennial. Once their edition
// ends they archive like the rest, so the hub will NOT surface their games the following
// March until their `runs`/`edition` are advanced to the new year. The other tournaments have
// no window to miss for years.

const ALL_VIEWERS = [
  {
    id: 'nba',
    name: 'NBA',
    emoji: '🏀',
    espnPath: 'basketball/nba',
    url: 'https://ismayc.github.io/nba-schedule/',
    calendarHost: 'the-nba-schedule.netlify.app',
    followKey: 'nba:followed',
    kind: 'league',
    // Regular season Oct–Apr; playoffs run to June. Wraps the new year (start>end month).
    // The playoff window is not configured: "Playoffs" comes from the feed's season type
    // (see utils/phase), because the postseason shares months with the regular season.
    season: { startMonth: 10, startDay: 21, endMonth: 6 },
  },
  {
    id: 'nfl',
    name: 'NFL',
    emoji: '🏈',
    espnPath: 'football/nfl',
    url: 'https://ismayc.github.io/nfl-schedule/',
    calendarHost: 'the-nfl-schedule.netlify.app',
    followKey: 'nfl:followed',
    kind: 'league',
    // Sep through the Feb Super Bowl. "Playoffs" comes from the feed's season type, not
    // the calendar: January is both the regular-season tail and the playoffs.
    season: { startMonth: 9, startDay: 4, endMonth: 2 },
  },
  {
    id: 'wnba',
    name: 'WNBA',
    emoji: '🏀',
    espnPath: 'basketball/wnba',
    url: 'https://ismayc.github.io/wnba-schedule/',
    calendarHost: 'the-wnba-schedule.netlify.app',
    followKey: 'wnba:followed',
    kind: 'league',
    // May–Oct, within one calendar year. "Playoffs" comes from the feed's season type,
    // not the calendar: the regular season runs into late September, the playoffs start
    // after, so both live in September.
    season: { startMonth: 5, startDay: 1, endMonth: 10 },
  },
  {
    id: 'epl',
    name: 'Premier League',
    emoji: '⚽',
    espnPath: 'soccer/eng.1',
    url: 'https://ismayc.github.io/premier-league/',
    calendarHost: 'premier-league-viewer.netlify.app',
    followKey: 'pl:followed',
    kind: 'league',
    // Aug–May, wraps the new year. No playoff round; it's a table to the final whistle.
    season: { startMonth: 8, startDay: 15, endMonth: 5 },
  },
  {
    id: 'fiba-wwc',
    name: "FIBA Women's World Cup",
    emoji: '🏀',
    espnPath: 'basketball/fiba',
    url: 'https://ismayc.github.io/fiba-womens-world-cup-viewer/',
    calendarHost: 'fiba-womens-world-cup-viewer.netlify.app',
    followKey: 'fwwc:followed',
    kind: 'tournament',
    tournamentLabel: 'World Cup',
    // 4-13 September 2026, Berlin. Auto-archives on 2026-09-14; next edition is 2030.
    runs: { start: '2026-09-04', end: '2026-09-13' },
    edition: '2026',
    nextEdition: '2030',
  },
  {
    id: 'mens-mm',
    name: "Men's March Madness",
    emoji: '🏀',
    espnPath: 'basketball/mens-college-basketball',
    url: 'https://ismayc.github.io/mens-march-madness/',
    calendarHost: 'mens-march-madness.netlify.app',
    followKey: 'mmm:followed',
    kind: 'tournament',
    tournamentLabel: 'Tournament',
    college: true,
    // Only rows whose competition headline starts with this are the actual tournament.
    mmHeadline: "NCAA Men's Basketball Championship",
    runs: { start: '2026-03-17', end: '2026-04-07' },
    edition: '2026',
    nextEdition: '2027',
  },
  {
    id: 'womens-mm',
    name: "Women's March Madness",
    emoji: '🏀',
    espnPath: 'basketball/womens-college-basketball',
    url: 'https://ismayc.github.io/womens-march-madness/',
    calendarHost: 'womens-march-madness.netlify.app',
    followKey: 'mmw:followed',
    kind: 'tournament',
    tournamentLabel: 'Tournament',
    college: true,
    mmHeadline: "NCAA Women's Basketball Championship",
    runs: { start: '2026-03-18', end: '2026-04-07' },
    edition: '2026',
    nextEdition: '2027',
  },
  {
    id: 'wwc',
    name: "Women's World Cup",
    emoji: '⚽',
    espnPath: 'soccer/fifa.wwc',
    url: 'https://ismayc.github.io/womens-world-cup-viewer/',
    calendarHost: 'womens-world-cup-viewer.netlify.app',
    followKey: 'wwc:followed',
    kind: 'tournament',
    tournamentLabel: 'Tournament',
    // The 2023 edition (Australia & New Zealand). `runs` is this edition's real dates; reset
    // it to the new dates when reviving, or the "Starts in Nd" countdown points at the wrong
    // day.
    runs: { start: '2023-07-20', end: '2023-08-20' },
    edition: '2023',
    nextEdition: '2027',
  },
  {
    id: 'euros',
    name: 'Euros',
    emoji: '⚽',
    espnPath: 'soccer/uefa.euro',
    url: 'https://ismayc.github.io/football-euros-viewer/',
    calendarHost: 'football-euros-viewer.netlify.app',
    followKey: 'euros:followed',
    kind: 'tournament',
    tournamentLabel: 'Tournament',
    runs: { start: '2024-06-14', end: '2024-07-14' },
    edition: '2024',
    nextEdition: '2028',
  },
  {
    id: 'copa',
    name: 'Copa América',
    emoji: '⚽',
    espnPath: 'soccer/conmebol.america',
    url: 'https://ismayc.github.io/copa-america-viewer/',
    calendarHost: 'copa-america-viewer.netlify.app',
    followKey: 'copa:followed',
    kind: 'tournament',
    tournamentLabel: 'Tournament',
    runs: { start: '2024-06-20', end: '2024-07-14' },
    edition: '2024',
    nextEdition: '2028',
  },
  {
    id: 'worldcup',
    name: 'World Cup',
    emoji: '⚽',
    espnPath: 'soccer/fifa.world',
    url: 'https://ismayc.github.io/world-cup-viewer/',
    calendarHost: 'world-cup-viewer.netlify.app',
    followKey: 'wc2026:followed',
    kind: 'tournament',
    tournamentLabel: 'Tournament',
    runs: { start: '2026-06-11', end: '2026-07-19' },
    edition: '2026',
    nextEdition: '2030',
  },
]

export { ALL_VIEWERS }

// The local calendar day as an ISO 'YYYY-MM-DD' string. ISO dates sort lexically, so the
// archive test below is a plain string comparison against `runs.end`.
const localDayISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// A tournament is archived once the current day is strictly PAST its edition's end date. On
// the end day itself (the Final) it is still live. Leagues never archive.
export const isArchived = (v, now = new Date()) =>
  v.kind === 'tournament' && !!v.runs && localDayISO(now) > v.runs.end

// The set the hub fetches and renders in the grid: everything not currently archived.
export const liveViewers = (now = new Date()) => ALL_VIEWERS.filter((v) => !isArchived(v, now))

// The Completed-tournaments shelf, ordered by when each competition returns (soonest first),
// so whatever is closest to mattering again sits at the front.
export const archivedViewers = (now = new Date()) =>
  ALL_VIEWERS.filter((v) => isArchived(v, now)).sort((a, b) => Number(a.nextEdition) - Number(b.nextEdition))

export const viewerById = Object.fromEntries(ALL_VIEWERS.map((v) => [v.id, v]))
