# Sports Trackers — the family hub

A one-page "home base" for Chester Ismay's family of sports viewers. It answers a single
question at a glance: **which of my sports have games today?** — and deep-links into each
viewer for the details.

It fronts seven viewers:

| Sport | Viewer | Season |
|---|---|---|
| 🏀 NBA | [nba-schedule](https://ismayc.github.io/nba-schedule/) | Oct–Jun |
| 🏈 NFL | [nfl-schedule](https://ismayc.github.io/nfl-schedule/) | Sep–Feb |
| 🏀 WNBA | [wnba-schedule](https://ismayc.github.io/wnba-schedule/) | May–Oct |
| ⚽ Premier League | [premier-league](https://ismayc.github.io/premier-league/) | Aug–May |
| ⚽ World Cup | [world-cup-viewer](https://ismayc.github.io/world-cup-viewer/) | quadrennial |
| 🏀 Men's March Madness | [mens-march-madness](https://ismayc.github.io/mens-march-madness/) | mid-Mar–early-Apr |
| 🏀 Women's March Madness | [womens-march-madness](https://ismayc.github.io/womens-march-madness/) | mid-Mar–early-Apr |

## How it works

Like the rest of the family: **zero backend, no API key, no `.env`.** At page load the
browser hits ESPN's keyless, CORS-open scoreboard for each viewer over a today-centered
`[-1, 0, +1]` day window, buckets games into "today" by the *user's* timezone (Intl parts,
not UTC), and renders:

- a **card per viewer** — today's game count, a pulsing live indicator, the next upcoming
  game when nothing's on, and a season-phase badge (In season / Playoffs / Tournament /
  Starts in Nd / Offseason);
- a **My teams playing today** section — star any team in the listings and the hub tracks
  it in *its own* `localStorage` (`st:follow`), then deep-links matches into their viewer
  with `?teams=ABBR`;
- an **install & subscribe** shelf — Open links plus `webcal://` calendar subscriptions
  for the viewers that publish a Netlify `.ics` feed.

### Feed traps baked in

- **March Madness filtering.** The men's/women's college `seasontype=3` window also carries
  NIT / Crown / WBIT games. The hub keeps only rows whose `competitions[0].notes[0].headline`
  starts with `NCAA Men's/Women's Basketball Championship`, and fetches those two with
  `&groups=50&seasontype=3`. See `src/services/espn.js`.
- **Timezone bucketing.** A 10pm Pacific tip is a different calendar day back east, so the
  three-day fetch is re-bucketed by the viewer's zone (`utils/time.js#dayKey`).
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
