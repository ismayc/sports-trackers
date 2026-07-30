# Sports Trackers — the family hub

[![CI](https://github.com/ismayc/sports-trackers/actions/workflows/ci.yml/badge.svg)](https://github.com/ismayc/sports-trackers/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/endpoint?url=https://ismayc.github.io/sports-trackers/coverage.json)](https://github.com/ismayc/sports-trackers/actions/workflows/ci.yml)

A one-page "home base" for Chester Ismay's family of sports viewers. It answers a single
question at a glance: **which of my sports have games today?** — and deep-links into each
viewer for the details.

It fronts **four live viewers** — every one an ongoing league — in a single 4-across row
(2×2 on mobile), plus a **collapsed shelf of completed tournaments**, hidden by default.

| Sport | Viewer | Season |
|---|---|---|
| 🏀 WNBA | [wnba-schedule](https://ismayc.github.io/wnba-schedule/) | May–Oct |
| ⚽ Premier League | [premier-league](https://ismayc.github.io/premier-league/) | Aug–May |
| 🏈 NFL | [nfl-schedule](https://ismayc.github.io/nfl-schedule/) | Sep–Feb |
| 🏀 NBA | [nba-schedule](https://ismayc.github.io/nba-schedule/) | Oct–Jun |

Archived — `ARCHIVED_VIEWERS` in `src/data/viewers.js`, never fetched, collapsed by default,
ordered soonest-to-return:

| Tournament | Viewer | Edition | Returns |
|---|---|---|---|
| 🏀 Men's March Madness | [mens-march-madness](https://ismayc.github.io/mens-march-madness/) | 2026 | **2027** |
| 🏀 Women's March Madness | [womens-march-madness](https://ismayc.github.io/womens-march-madness/) | 2026 | **2027** |
| ⚽ Women's World Cup | [womens-world-cup-viewer](https://ismayc.github.io/womens-world-cup-viewer/) | 2023 | 2027 |
| ⚽ Euros | [football-euros-viewer](https://ismayc.github.io/football-euros-viewer/) | 2024 | 2028 |
| ⚽ Copa América | [copa-america-viewer](https://ismayc.github.io/copa-america-viewer/) | 2024 | 2028 |
| ⚽ World Cup | [world-cup-viewer](https://ismayc.github.io/world-cup-viewer/) | 2026 | 2030 |

Archived viewers **keep their fetch config** (`espnPath`, `window`, and March Madness's
`mmHeadline`), so reviving one is a straight move of the object back into `VIEWERS` — the data
alone therefore can't tell you they aren't fetched, which is why `test/app.test.jsx` asserts
that the feed loader only ever receives the live list.

⚠️ **The two March Madness viewers are annual**, unlike the quadrennial four: archiving them
means **the hub will not surface their games in March 2027** until one is moved back into
`VIEWERS`. That is a deliberate trade, recorded here so it isn't a surprise next spring.

## Preseason is ignored, by choice

ESPN's scoreboard returns exhibition games, and a plain date query has no reason to exclude
them — on 29 Jul 2026 the two-week look-ahead offered the NFL Hall of Fame Game as "next
up". The hub drops any event ESPN stamps `season.type === 1` and says so at the top of the
page, because an unexplained empty NFL card reads as a bug. Only type 1 is dropped: 3 is the
postseason and 5 is the NBA play-in, both of which must show.

## How it works

Like the rest of the family: **zero backend, no API key, no `.env`.** At page load the
browser hits ESPN's keyless, CORS-open scoreboard for each viewer — three single-day
queries around today for an exact "today" bucket, plus two ~week-long range queries out
to a 14-day horizon for the look-ahead — buckets games by the *user's* timezone (Intl
parts, not UTC), and renders:

- a **card per viewer** — today's game count, a pulsing live indicator, the next upcoming
  game when nothing's on, and a season-phase badge (In season / Playoffs / Tournament /
  Starts in Nd / Offseason);
- a **My teams playing today** section — star any team in the listings and the hub tracks
  it in *its own* `localStorage` (`st:follow`), then deep-links matches into their viewer
  with `?team=ABBR` (singular — a `?teams=` list is silently ignored by every viewer);
- a **Yesterday** recap — collapsed by default (the page's job is what's on now):
  yesterday's finals with scores across the visible viewers, one press away. Follows the
  sports picker but not the services filter — a result isn't hidden because you lack the
  channel;
- a **Next two weeks** breakdown — every upcoming game across the visible viewers,
  tagged with the sport it comes from, in the family's two presentations: a day-grouped
  **Schedule** list and a calendar **Week** grid (Sunday-start weeks over the horizon,
  today outlined, out-of-range days dimmed), toggled by tabs and remembered per device.
  It respects both selections below, so it always agrees with the cards;
- **Sports** and **My services** pickers — choose which viewers to show, and optionally
  filter everything (cards, my-teams, the two-week breakdown) down to games on the
  streaming/TV services you actually have;
- **spoiler-free mode** — the family's 🙈 toggle: matchups and Final/Live states stay,
  the numbers go (including yesterday's recap), persisted per device;
- a **timezone picker** — the family's one-tap zone list; a shared link's `?tz=` wins
  on load, then the saved choice, then the detected device zone. Every bucket (today,
  yesterday, the two-week views) recomputes in the chosen zone;
- **game deep links** — every game row opens its viewer directly on that game's detail
  (`?game=<espn id>`, read by every viewer in the family), with `&team=ABBR` riding along as the
  fallback filter if the app's committed snapshot doesn't hold the game yet;
- an **install & subscribe** shelf — Open links plus `webcal://` calendar subscriptions
  for the viewers that publish a Netlify `.ics` feed.

### Feed traps baked in

- **March Madness filtering** (currently dormant — both viewers are archived, so nothing
  exercises this until one is revived; the code and config are kept precisely so it works the
  day it is). The men's/women's college `seasontype=3` window also carries NIT / Crown / WBIT
  games. Only rows whose `competitions[0].notes[0].headline` starts with
  `NCAA Men's/Women's Basketball Championship` are kept, and those two viewers are fetched
  with `&groups=50&seasontype=3`. See `src/services/espn.js`.
- **Timezone bucketing.** A 10pm Pacific tip is a different calendar day back east, so the
  fetched days are re-bucketed by the viewer's zone (`utils/time.js#dayKey`). The days
  requested are derived from the user's OWN yesterday/today, not from UTC `now` — anchoring on
  UTC silently emptied the whole "Yesterday" section for anyone west of UTC late in their day,
  because local yesterday had by then moved two days back. `dates=` is also not a UTC day:
  verified against the live feed, `dates=20260728` returns instants from `07-28T23:30Z` to
  `07-29T02:00Z`, i.e. ESPN files by the US Eastern day. See `DAYS_BACK` in
  `services/espn.js` for why [tKey-2, tKey+1] covers every timezone on earth.
- **Range thinning.** A date-range scoreboard query never drops its earliest games but
  thins the middle days of a dense league's window, so the 14-day look-ahead is fetched
  as two ~week ranges instead of one (`services/espn.js`).
- **Preseason.** Exhibition games arrive in an ordinary date query and are dropped by
  `season.type === 1` — see the section above, and `isPreseason` in `services/espn.js`.
- **Graceful offseason.** An empty or unreachable feed never throws — the card falls back
  to its season-phase badge. That is also why a finished quadrennial tournament belongs in
  `ARCHIVED_VIEWERS` rather than the grid: its feed is reachable but empty for years, so a
  live tile would be a permanent "Offseason" card costing a network round-trip per load.

## Develop

```bash
npm install
npm run dev             # local dev server
npm run build           # production build to dist/
npm run preview         # serve the built dist/
npm test                # run the Vitest suite
npm run test:watch      # watch mode
npm run coverage:badge  # tests + coverage, and refresh the badge endpoint
```

**Tests: 256 across 16 files, at 100% statements, branches, functions and lines.** Unlike
the sibling viewers — which round the statement figure for their badge — this repo is
literally 100% on every metric, and the two places that made that awkward were fixed rather
than excused: an unreachable `?? 0` in the card sort was removed in favour of a test pinning
the invariant it guarded (`utils/phase` never returns the `soon` tone without a numeric
`days`), and the remaining `|| []` / `|| ''` fallbacks each got a test that actually
triggers them (`test/defensive-fallbacks.test.jsx`).

Two things to know before adding tests:

- **The suite is pinned to `America/New_York`** (`vite.config.js`), not UTC, because the
  hub's whole job is re-bucketing a UTC feed into the user's calendar day. A test that
  quietly assumes UTC day boundaries fails locally instead of only on CI.
  `test/timezone-pinned.test.js` asserts the pin.
- **The network is stubbed off unconditionally** in `test/setup.js`. The viewers guard the
  same stub with `if (!global.fetch)`, which never fires on Node 18+ — here that would mean
  real ESPN calls from the suite, since `App.jsx` fetches every viewer on mount.

Deploys to GitHub Pages from `main` via `.github/workflows/ci.yml`, which now runs the suite
and regenerates the coverage badge before building. `vite.config.js` uses `base: './'` so
`dist/` serves correctly under the `/sports-trackers/` subpath.

Unofficial. Not affiliated with the NBA, NFL, WNBA, Premier League, FIFA, or NCAA.
