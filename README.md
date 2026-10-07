# BigEastBot

BigEastBot keeps the sidebar of [r/BigEast](https://www.reddit.com/r/bigeast) up to date with Big
East men's basketball scores, upcoming games and conference standings. It's built for one
community, r/BigEast. Its moderators install it, and it runs on its own from then on.

Every 5 minutes it reads public scores and standings from ESPN and updates:

- **The old-Reddit sidebar** (old.reddit.com): the full sidebar, with recent and upcoming games,
  the standings table, and the community's welcome text and links.
- **Two new-Reddit sidebar widgets:** "Recent/Upcoming Games" and "Big East Standings".

It only writes when something has actually changed, so the subreddit's wiki history isn't
flooded with identical edits.

## What it shows

**Games:** yesterday's results plus the next 7 days, grouped under a header for each day. For
example:

> **Monday, November 2nd**
>
> * Loyola MD vs Georgetown, 6:30pm
> * Big East Tournament - Xavier vs **#6 UConn** 68-93

- **Finals:** the winner is in bold.
- **Live games:** the score and clock.
- **Upcoming games:** the tip time (Eastern) and the TV network.
- **Rankings:** AP rankings (#1–25) appear next to team names.
- **Tournaments:** Big East Tournament, NCAA, NIT, CBI and Crown games are labeled.

**Standings:** all 11 Big East teams with conference and overall records. They're listed in
ESPN's order of finish, which applies tiebreakers. Each team links to its Wikipedia page for the
current season.

## The season calendar

The app follows the college basketball calendar on its own; nothing needs to be set each year.

| When | What the sidebar does |
|---|---|
| **Off-season** (May until ~30 days before the first game) | Nothing changes. Last season's final results and standings stay up. |
| **Preseason** (from 30 days before the first game) | Shows the season's first 7 days of games, with every team at 0-0. |
| **Season** (from the day before the first game) | Yesterday's results plus the next 7 days, and live standings. |
| **Season over** (spring, once no games remain) | Stops updating, so the final results stay up. |

The app finds the first game of the season from ESPN's team schedules. It checks once a day.

## Installing and using it

1. A moderator of the subreddit installs **bigeastbot** from the Reddit Apps directory. The app
   then gets its own account, **u/bigeastbot**, which makes the sidebar edits.
2. Nothing needs configuring. The first update happens within 5 minutes.
3. **New Reddit only:** the first time it runs, the app adds its two widgets at the bottom of the
   sidebar. Drag them into place once, under Mod Tools → Community Appearance → Sidebar. They
   stay where you put them.

**Moderator menu:** on the subreddit page in new Reddit, open the `...` menu and choose
**"[BigEastBot] Update sidebar now"**. It re-checks the season's start date, updates
immediately, and shows a short result. For example: *"preseason, opener 2026-11-01. Sidebar
updated, games widget unchanged, standings widget unchanged."*

**Operational notes:**

- **Manual sidebar edits:** the app owns the old-Reddit sidebar text. Moderator edits to it are
  overwritten at the next score change. To change the welcome text or links, change the app.
- **Widget names:** the app finds its widgets by title. If a widget is renamed or deleted, the
  app creates a fresh one at the bottom of the sidebar.
- **ESPN outages:** if ESPN doesn't respond, that update is skipped and nothing is written. The
  sidebar never shows a half-finished list, and the next run 5 minutes later tries again.
- **Size limits:** on very busy weeks, later days are dropped to stay within Reddit's sidebar
  and widget limits (about 10,000 characters). The nearest games are always kept.

## Fetch Domains

The following domains are requested for this app:

- `site.api.espn.com`: provides the Big East scoreboard (scores, tip times, TV networks, AP
  rankings and tournament labels), the conference standings, and team schedules, which are used
  to find each season's first game. The app only reads this public sports data. It sends no
  Reddit or user data to ESPN.

## Data and privacy

The app collects no personal information about anyone. It reads public sports data from ESPN and
writes to the sidebar of the subreddit it's installed in. The only thing it stores is the date of
the current season's first game, cached for a day. See the [Privacy Policy](PRIVACY.md) and
[Terms of Service](TERMS.md).

## For developers

The app is a [Devvit Web](https://developers.reddit.com/) server-only app written in TypeScript.
It runs on Node 24.18 or later.

| File | What it does |
|---|---|
| `src/server/update.ts` | One update pass: season mode, ESPN fetches, then the sidebar and widget writes |
| `src/server/season.ts` | Off-season, preseason and in-season rules, and the games window |
| `src/server/espn.ts` | ESPN fetchers and parsers |
| `src/server/render.ts` | Markdown for the sidebar and widgets |
| `src/server/teams.ts` | The 11 programs and their ESPN IDs |

```bash
npm install
npm test                          # types, lint, unit tests (saved ESPN fixtures), build
npx devvit playtest <test-sub>    # live test on a subreddit you moderate with <200 members
npm run publish                   # submit a new version for Reddit app review
```

Before 2026-27 this was a Python/PRAW bot. That version is kept at the `python-legacy` git tag.

## License

[GPL-3.0](LICENSE)
