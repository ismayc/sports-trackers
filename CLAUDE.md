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

### Rollout status, 2026-10-03

Error 1 is fixed in **this repo** and in **`wnba-schedule`**, the viewer it was spotted in,
and written up in `sports-viewer-meta/docs/LINEAGES.md` §6 as a trap class rather than a
one-off. The eleven other viewers are **unverified** — not known to be broken, not known to
be safe. A sibling only has this bug if it renders a tip time from a feed that can carry a
placeholder, which most of them do.

`audit-family.mjs` check 14 answers that in one command, for whatever is cloned:

```bash
node sports-viewer-meta/scripts/audit-family.mjs
```

It is deliberately the cheap half of the check — it asks whether a fetch script mentions
`timeValid` at all. Note what that cannot catch, because it is exactly how this bug lived
so long in `wnba-schedule`: **that repo did handle the flag**, on the path a playoff game
takes only while one side is still "TBD". When the matchup was decided the game moved to
the ordinary path and lost the flag. The viewer was correct right until the bracket filled
in, which is the moment anyone looks. So the check would have passed it. A flag handled on
one path is not handled — when you touch a fetch script, grep every path that writes a tip.
