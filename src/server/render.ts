// Pure markdown rendering, ported from the Python bot (python-legacy tag, bigeastBot.py).
// Deliberate differences from the Python output:
// - Tournament prefixes match ESPN's mixed-case headlines. The Python bot compared against
//   all-caps strings, so it never showed them.
// - A final shows both teams' ranks. Python dropped the loser's rank when the away team won.
// - A live game always shows "score | clock". Python sometimes mangled the clock into a start
//   time, e.g. "1sthalf".
// - Postponed or canceled games show ESPN's status instead of a "0-0 | Postponed" score.
// - Team links point at the current season's Wikipedia page instead of hard-coded 2020-21 ones.

import {type Day, dayLabel} from './dates.ts'
import type {Game, Side, StandingRow} from './espn.ts'
import {teamById, teamSeasonUrl} from './teams.ts'

export type GameDay = {day: Day; games: Game[]}

/** Reddit rejects text-area widgets of 10,000+ characters. */
export const WIDGET_MAX_CHARS = 9_999
/** Old-Reddit sidebar (config/sidebar) limit. */
export const SIDEBAR_MAX_CHARS = 10_240

const TIMES_NOTE = '*All times are Big East-ern time unless otherwise noted.*'
const RANKINGS_NOTE = '*Rankings from AP Poll*'

export function tournamentPrefix(headline: string): string {
  if (/big east (men's )?(tournament|championship)/i.test(headline))
    return 'Big East Tournament - '
  if (/ncaa men's basketball championship/i.test(headline)) return 'NCAA - '
  if (/\bNIT\b|national invitation/i.test(headline)) return 'NIT - '
  if (/\bCBI\b|college basketball invitational/i.test(headline)) return 'CBI - '
  if (/basketball crown/i.test(headline)) return 'Crown - '
  return ''
}

/** "11/2 - 6:30 PM EST" → "6:30pm"; anything without a clock time → "TBD". */
export function startTime(shortDetail: string): string {
  const m = /(\d{1,2}:\d{2})\s*([AP]M)/i.exec(shortDetail)
  return m ? `${m[1]}${m[2]?.toLowerCase()}` : 'TBD'
}

function team(side: Side): string {
  return side.rank ? `#${side.rank} ${side.name}` : side.name
}

export function gameLine(g: Game): string {
  const matchup = (away: string, home: string): string => `${away} vs ${home}`
  const score = `${g.away.score}-${g.home.score}`
  const on = g.network ? ` on ${g.network}` : ''
  let body: string
  if (g.final) {
    const awayWon = g.away.score > g.home.score
    const homeWon = g.home.score > g.away.score
    const away = awayWon ? `**${team(g.away)}**` : team(g.away)
    const home = homeWon ? `**${team(g.home)}**` : team(g.home)
    body = `${matchup(away, home)} ${score}`
  } else if (g.state === 'in') {
    body = `${matchup(team(g.away), team(g.home))}, ${score} | ${g.detail}${on}`
  } else if (g.state === 'post') {
    body = `${matchup(team(g.away), team(g.home))}, ${g.shortDetail || g.detail}`
  } else {
    body = `${matchup(team(g.away), team(g.home))}, ${startTime(g.shortDetail)}${on}`
  }
  return `* ${tournamentPrefix(g.headline)}${body}\n\n`
}

export function dayBlock({day, games}: GameDay): string {
  if (!games.length) return ''
  return `\n**${dayLabel(day)}**\n\n${games.map(gameLine).join('')}`
}

/**
 * Day blocks that fit in `budget` characters. Whole days are dropped from the end, so the
 * nearest games always survive and no line is cut in half.
 */
export function fitDays(days: readonly GameDay[], budget: number): string {
  let out = ''
  for (const d of days) {
    const block = dayBlock(d)
    if (out.length + block.length > budget) break
    out += block
  }
  return out
}

export function standingsTable(
  rows: readonly StandingRow[],
  seasonYear: number,
): string {
  let md = 'TEAM | CONF | OVERALL\n:--:|:--:|:--:\n'
  for (const r of rows) {
    const wiki = teamById(r.espnId)?.wiki
    const name = wiki
      ? `[${r.name}](${teamSeasonUrl(wiki, seasonYear)})`
      : r.name
    md += `${name} | ${r.conf} | ${r.overall}\n`
  }
  return md
}

/** The full old-Reddit sidebar (config/sidebar), laid out exactly like the Python bot's. */
export function sidebar(
  days: readonly GameDay[],
  rows: readonly StandingRow[],
  seasonYear: number,
): string {
  const standings =
    '**Big East Basketball Standings:**\n\n' +
    standingsTable(rows, seasonYear) +
    STATIC_TEXT
  const head = '---\n\n**Recent/Upcoming Games**\n\n'
  const tail = `\n---\n\n${TIMES_NOTE}\n\n---\n\n`
  const budget =
    SIDEBAR_MAX_CHARS - head.length - tail.length - standings.length
  return head + fitDays(days, budget) + tail + standings
}

export function gamesWidget(days: readonly GameDay[]): string {
  const header = `${TIMES_NOTE}\n`
  const footer = `\n---\n\n${RANKINGS_NOTE}`
  const games = fitDays(days, WIDGET_MAX_CHARS - header.length - footer.length)
  return (
    header + (games || '\n*No games scheduled in the next week.*\n') + footer
  )
}

export function standingsWidget(
  rows: readonly StandingRow[],
  seasonYear: number,
): string {
  return standingsTable(rows, seasonYear)
}

// Verbatim from the Python bot's getStaticText(). The team-site link block at the end is what
// old Reddit's sidebar CSS hangs the team logos on, so its order and titles must not change.
export const STATIC_TEXT = `
${RANKINGS_NOTE}

---

Welcome to the Big East Conference subreddit! Step right up and post your Big East news, team news that could affect the conference, a picture of you at a game, your mom at a game, and especially any hype videos! Basically, we'll tell you if we don't want you to post something. GET TO IT!

---

**School Specific Subreddits**

* /r/ButlerUniversity

* /r/Creighton || /r/whiteandblue

* /r/DePaul

* /r/Georgetown

* /r/Marquette || /r/mubb

* /r/ProvidenceCollege || /r/pcbb

* /r/SHU || /r/shubb

* /r/StJohns

* /r/Villanova

* /r/XavierUniversity

---

**Other College Basketball Subreddits:**

* /r/CollegeBasketball

* /r/ACC

* /r/AmericanAthletic

* /r/Atlantic10

* /r/TheB1G

* /r/BigXII

* /r/Conference_USA

* /r/MidAmerican

* /r/MountainWest

* /r/Pac12

* /r/SECbasketball/

---

**Other Stuff:**

* [Big East Team Blogs and Forums](http://www.reddit.com/r/bigeast/wiki/externalsites)

* [/r/BigEast Traffic Stats](http://www.reddit.com/r/BigEast/about/traffic/)

* [Archive of Sidebar Images](http://www.reddit.com/r/bigeast/wiki/sidebarimages)


[Butler Bulldogs](http://www.butlersports.com/ "Butler Bulldogs")
[Creighton Blue Jays](http://www.gocreighton.com/ "Creighton Bluejays")
[DePaul Blue Demons](http://www.depaulbluedemons.com/ "DePaul Blue Demons")
[Georgetown Hoyas](http://www.guhoyas.com/ "Georgetown Hoyas")
[Marquette Golden Eagles](http://www.gomarquette.com/ "Marquette Golden Eagles")
[Providence Friars](http://www.friars.com/ "Providence Friars")
[Seton Hall Pirates](http://www.shupirates.com/ "Seton Hall Pirates")
[St. Johns Red Storm](http://www.redstormsports.com/ "St. Johns Red Storm")
[Connecticut Huskies](https://uconnhuskies.com/ "Connecticut Huskies")
[Villanova Wildcats](http://www.villanova.com/ "Villanova Wildcats")
[Xavier Musketeers](http://www.goxavier.com/ "Xavier Musketeers")

#####[Big East](http://reddit.com/r/BigEast)`
