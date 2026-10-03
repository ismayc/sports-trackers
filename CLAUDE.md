# Working notes for Claude

`README.md` documents how the hub is built. This file is the shorter, sharper list: the
mistakes this family has already **shipped**, so that no future session ships them again.
Read it before touching anything that reads the ESPN feed.

## The rule all of these are instances of

**ESPN's scoreboard answers every question, including the ones it does not know the answer
to.** It never returns "unknown": it returns a plausible-looking value with a flag beside
it, or an entry that belongs to something else entirely. Every error below is the same
error — reading one of those values as data.

So, for any field taken from the feed, ask: *can this field be a placeholder, a filler, or
a row from a neighbouring competition?* If yes, find the flag that says so (`timeValid`,
`season.type`, `competition.notes[].headline`, `broadcasts[].market`) and branch on it. A
value with no flag beside it is trustworthy; a value with a flag you ignored is a bug that
will ship looking perfectly normal.

## Errors already shipped (do not remake)

### 1. A tip time nobody has announced — found 2026-10-03

**Symptom.** The WNBA viewer promised Liberty @ Dream at "9 PM Mountain" for a game whose
start time had not been announced, and filed it on the wrong calendar day.

**Cause.** When the tip time is unknown ESPN sends `timeValid: false` and a `date` of
**midnight US Eastern on the day of the game**. The hub formatted that like any other
instant: `2026-10-04T04:00Z` became "9:00 PM" on **Oct 3** in Phoenix (UTC-7). The event's
own status line read `10/4 - TBD` the whole time.

**Rule.** Never format `date` without checking `timeValid`, and never bucket a placeholder
in the user's zone — a placeholder has no zone, only a date. `normalize` carries `timeTBD`
(set **only** on an explicit `false`; a missing field is an ordinary real time) and `day`,
the Eastern day of the placeholder. Everything that renders a game goes through
`gameDayKey` / `gameTime` / `gameDayTime` in `src/utils/time.js`.

**Also watch:** a TBD game tested against `tip > now` looks *already started* from the small
hours of its own day, so it silently drops out of a look-ahead on the one day it matters.
Bucket by day, not by instant, for these.

**Verify against the live feed, not a fixture:**

```bash
curl -s "https://site.web.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=20261011" \
  | python3 -c "import json,sys; [print(e['date'], e['competitions'][0].get('timeValid'), \
    e['competitions'][0]['status']['type']['shortDetail']) for e in json.load(sys.stdin)['events']]"
```

### 2. The rest, in one line each

Each is written up where it bites; this is the index.

| Error | Where it bit | Documented in |
|---|---|---|
| Preseason games counted as real — the NFL Hall of Fame Game offered as "next up" | 2026-07-29 | README "Preseason is ignored, by choice"; `isPreseason` |
| `dates=A-B` range queries started 400ing, silently truncating the look-ahead to ~2 days | Sep 2026 | `fetchViewerDay`; commit `a0248d6` |
| Query window anchored on UTC `now` while buckets were local — "Yesterday" emptied west of UTC | — | `DAYS_BACK` in `services/espn.js` |
| "Playoffs" derived from a month window, labelling the regular-season tail as playoffs | — | `utils/phase.js` header; commit `9b67b50` |
| NIT / Crown / WBIT games riding in the college `seasontype=3` window | — | `mmHeadline` in `data/viewers.js` |
| Away-market RSNs treated as watchable; NBC games hidden from Peacock subscribers | — | `broadcastNames`; commit `83bd1e3` |
| `/scoreboard/` logo variants are light-on-transparent — crests vanished on light backgrounds | 2026-08-17 | `teamLogo` in `services/espn.js` |
| An international break read as an offseason, with no explanation on the page | 2026-09-21 | README "International breaks are named, not left blank" |

## This repo is one of fourteen

Everything above is a property of **the feed**, not of this repo, so every sibling that
reads the same scoreboard has the same exposure. The hub is only where it happened to be
found. The family:

`wnba-schedule`, `nba-schedule`, `nfl-schedule`, `premier-league`, `mens-march-madness`,
`womens-march-madness`, `world-cup-viewer`, `womens-world-cup-viewer`,
`football-euros-viewer`, `copa-america-viewer`, `fiba-mens-world-cup-viewer`,
`fiba-womens-world-cup-viewer`, and this hub — with `sports-viewer-meta` holding the
canonical copies each repo vendors (see the header of `scripts/smoke-prod.mjs`).

**Canonical home for a cross-family note: `sports-viewer-meta/docs/LINEAGES.md`.** A fix
landed only here is half a fix: the viewer a reader actually opens is a sibling repo.

### Rollout status, 2026-10-03 — complete

All thirteen viewers and this hub carry the fix, and `audit-family.mjs` reports
**"All invariants hold across 13 repos"**, check 14 included. LINEAGES §6 has the
write-up.

The fix was not the same change thirteen times, and the differences are the useful part:

| Shape | Repos | What it needed |
|---|---|---|
| `tip`/`ko` field, `formatTime`+`dayKey`+`countdown` | WNBA, NBA, NFL, both March Madness, hub | `timeTbd` out of the fetch, three helpers routing every call site, `liveState`/`isImminent` guards, all-day ICS |
| Same idea, other lineage (`timeCore` factory) | Premier League | the same, in its own idiom — `koDay`/`koTime`/`koCountdown`, "Time TBC", and `whenBucket` instead of `liveState` |
| **Already modelled it** — `ko: null` + `tbdTip: true` | both FIBA viewers | only the upgrade path: a placeholder was allowed to *resolve* an honest "to be confirmed" into a confident wrong time |
| Committed schedule not from ESPN | Women's World Cup, Euros, Copa, World Cup | the live overlay's instant, which keys knockout matching — a placeholder instant is shared by every untimed game that date, so it pairs whichever two collide |

Two repos were actually wrong at the time, not merely exposed: the **NFL** had 24
flex-scheduled games (weeks 17 and 18) showing invented kickoffs a day early, and the
**WNBA** had the four semifinal Games 4 and 5 that started this. Everywhere else the
change is preventive, and the commits say so rather than implying a save.

The one thing still worth knowing: **check 14 would not have caught the original bug.**
It asks whether a fetch script mentions `timeValid` at all, and `wnba-schedule` did — on
the pending-slot path, which a playoff game takes only while one side is still "TBD". When
the matchup was decided the game moved to the ordinary path and lost the flag. A flag
handled on one path is not handled; when you touch a fetch script, grep every path that
writes a time.
