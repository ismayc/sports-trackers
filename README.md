# Sports Trackers — the family hub

A one-page "home base" for Chester Ismay's family of sports viewers. It answers a single
question at a glance: **which of my sports have games today?** — and deep-links into each
viewer for the details.

It fronts six active viewers (a seventh, the World Cup, is disabled in
`src/data/viewers.js` until the 2030 window approaches):

| Sport | Viewer | Season |
|---|---|---|
| 🏀 NBA | [nba-schedule](https://ismayc.github.io/nba-schedule/) | Oct–Jun |
| 🏈 NFL | [nfl-schedule](https://ismayc.github.io/nfl-schedule/) | Sep–Feb |
| 🏀 WNBA | [wnba-schedule](https://ismayc.github.io/wnba-schedule/) | May–Oct |
| ⚽ Premier League | [premier-league](https://ismayc.github.io/premier-league/) | Aug–May |
| 🏀 Men's March Madness | [mens-march-madness](https://ismayc.github.io/mens-march-madness/) | mid-Mar–early-Apr |
| 🏀 Women's March Madness | [womens-march-madness](https://ismayc.github.io/womens-march-madness/) | mid-Mar–early-Apr |
| ⚽ World Cup *(dormant until 2030)* | [world-cup-viewer](https://ismayc.github.io/world-cup-viewer/) | quadrennial |

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
  with `?teams=ABBR`;
- a **Next two weeks** breakdown — every upcoming game across the visible viewers,
  grouped by day, tagged with the sport it comes from, each row linking into its viewer.
  It respects both selections below, so it always agrees with the cards;
- **Sports** and **My services** pickers — choose which viewers to show, and optionally
  filter everything (cards, my-teams, the two-week breakdown) down to games on the
  streaming/TV services you actually have;
- an **install & subscribe** shelf — Open links plus `webcal://` calendar subscriptions
  for the viewers that publish a Netlify `.ics` feed.

### Feed traps baked in

- **March Madness filtering.** The men's/women's college `seasontype=3` window also carries
  NIT / Crown / WBIT games. The hub keeps only rows whose `competitions[0].notes[0].headline`
  starts with `NCAA Men's/Women's Basketball Championship`, and fetches those two with
  `&groups=50&seasontype=3`. See `src/services/espn.js`.
- **Timezone bucketing.** A 10pm Pacific tip is a different calendar day back east, so the
  three-day fetch is re-bucketed by the viewer's zone (`utils/time.js#dayKey`).
- **Range thinning.** A date-range scoreboard query never drops its earliest games but
  thins the middle days of a dense league's window, so the 14-day look-ahead is fetched
  as two ~week ranges instead of one (`services/espn.js`).
- **Graceful offseason.** An empty or unreachable feed never throws — the card falls back
  to its season-phase badge. The World Cup feed (`soccer/fifa.world`) is reachable but
  returns matches only during the tournament; the rest of the four-year cycle it reads
  "Offseason".

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm run preview  # serve the built dist/
```

Deploys to GitHub Pages from `main` via `.github/workflows/ci.yml`. `vite.config.js` uses
`base: './'` so `dist/` serves correctly under the `/sports-trackers/` subpath.

Unofficial. Not affiliated with the NBA, NFL, WNBA, Premier League, FIFA, or NCAA.
