import assert from 'node:assert/strict'
import {test} from 'node:test'
import {fixture} from '../test/fixtures.ts'
import {
  type Game,
  parseScoreboard,
  type RawScoreboard,
  zeroStandings,
} from './espn.ts'
import {
  dayBlock,
  fitDays,
  type GameDay,
  gameLine,
  gamesWidget,
  SIDEBAR_MAX_CHARS,
  STATIC_TEXT,
  sidebar,
  standingsTable,
  startTime,
  tournamentPrefix,
  WIDGET_MAX_CHARS,
} from './render.ts'

const games = (date: string): Game[] =>
  parseScoreboard(fixture<RawScoreboard>(`scoreboard-${date}`))

const lines = (date: string): string[] => games(date).map(gameLine)

const game = (over: Partial<Game>): Game => ({
  id: '1',
  state: 'pre',
  final: false,
  detail: '',
  shortDetail: '11/2 - 7:00 PM EST',
  home: {name: 'Villanova', score: 0, rank: null},
  away: {name: 'Drexel', score: 0, rank: null},
  headline: '',
  network: '',
  ...over,
})

test('final: winner bold, both ranks, away-home score, Big East tourney prefix', () => {
  const l = lines('20260312')
  assert.ok(
    l.includes('* Big East Tournament - Xavier vs **#6 UConn** 68-93\n\n'),
  )
  assert.ok(
    l.includes('* Big East Tournament - **Georgetown** vs Villanova 78-64\n\n'),
  )
  assert.deepEqual(lines('20260314'), [
    "* Big East Tournament - #6 UConn vs **#13 St John's** 52-72\n\n",
  ])
})

test('NCAA tournament prefix and seeds-as-ranks', () => {
  const l = lines('20260320')
  assert.ok(l.includes('* NCAA - #15 Furman vs **#2 UConn** 71-82\n\n'))
  assert.ok(l.includes('* NCAA - **#9 Utah State** vs #8 Villanova 86-76\n\n'))
})

test('scheduled: start time and network', () => {
  const l = lines('20261102')
  assert.equal(l.length, 10)
  assert.equal(l[0], '* Loyola MD vs Georgetown, 6:30pm\n\n')
  assert.ok(l.includes('* Gardner-Webb vs UConn, 9:00pm on Peacock\n\n'))
})

test('live game shows score and clock', () => {
  const g = game({
    state: 'in',
    detail: '10:00 - 1st Half',
    shortDetail: '10:00 - 1st Half',
    home: {name: 'Villanova', score: 25, rank: 9},
    away: {name: 'Drexel', score: 20, rank: null},
    network: 'FS1',
  })
  assert.equal(
    gameLine(g),
    '* Drexel vs #9 Villanova, 20-25 | 10:00 - 1st Half on FS1\n\n',
  )
})

test('postponed and TBD', () => {
  assert.equal(
    gameLine(game({state: 'post', shortDetail: 'Postponed'})),
    '* Drexel vs Villanova, Postponed\n\n',
  )
  assert.equal(startTime('11/2 - TBD'), 'TBD')
  assert.equal(startTime('TBD'), 'TBD')
  assert.equal(startTime('11/14 - 12:00 PM EST'), '12:00pm')
})

test('tournament prefixes', () => {
  assert.equal(
    tournamentPrefix('Big East Tournament - Final'),
    'Big East Tournament - ',
  )
  assert.equal(
    tournamentPrefix(
      "NCAA Men's Basketball Championship - East Region - 1st Round",
    ),
    'NCAA - ',
  )
  assert.equal(tournamentPrefix("Men's NIT - First Round"), 'NIT - ')
  assert.equal(
    tournamentPrefix('College Basketball Crown - Quarterfinal'),
    'Crown - ',
  )
  assert.equal(tournamentPrefix('Community Classic'), '')
  assert.equal(tournamentPrefix(''), '')
})

test('day block header matches the old bot', () => {
  const block = dayBlock({day: '2026-11-02', games: games('20261102')})
  assert.ok(
    block.startsWith('\n**Monday, November 2nd**\n\n* Loyola MD vs Georgetown'),
  )
  assert.equal(dayBlock({day: '2026-11-03', games: []}), '')
})

test('fitDays drops whole days from the end', () => {
  const days: GameDay[] = ['2026-11-02', '2026-11-03', '2026-11-04'].map(
    day => ({
      day,
      games: games('20261102'),
    }),
  )
  const one = dayBlock(days[0] as GameDay).length
  const out = fitDays(days, one * 2 + 10)
  assert.equal(out, dayBlock(days[0] as GameDay) + dayBlock(days[1] as GameDay))
  assert.equal(fitDays(days, 5), '')
})

test('widgets and sidebar stay under Reddit limits on a packed schedule', () => {
  const busy: GameDay[] = Array.from({length: 8}, (_, i) => ({
    day: `2026-12-${String(i + 1).padStart(2, '0')}`,
    games: [...games('20261102'), ...games('20261102'), ...games('20260312')],
  }))
  const widget = gamesWidget(busy)
  assert.ok(widget.length <= WIDGET_MAX_CHARS, `widget ${widget.length}`)
  assert.ok(widget.includes('**Tuesday, December 1st**'))
  const side = sidebar(busy, zeroStandings(), 2027)
  assert.ok(side.length <= SIDEBAR_MAX_CHARS, `sidebar ${side.length}`)
  assert.ok(side.endsWith(STATIC_TEXT))
})

test('games widget: times note on top, rankings note at the bottom', () => {
  const md = gamesWidget([{day: '2026-11-02', games: games('20261102')}])
  assert.ok(
    md.startsWith(
      '*All times are Big East-ern time unless otherwise noted.*\n\n**Monday, November 2nd**\n\n',
    ),
  )
  assert.ok(md.endsWith('\n---\n\n*Rankings from AP Poll*'))
  assert.ok(gamesWidget([]).includes('*No games scheduled in the next week.*'))
})

test('standings table links the current season', () => {
  const md = standingsTable(zeroStandings(), 2027)
  const rows = md.trim().split('\n')
  assert.equal(rows.length, 13)
  assert.equal(
    rows[2],
    '[Butler](https://en.wikipedia.org/wiki/2026%E2%80%9327_Butler_Bulldogs_men%27s_basketball_team) | 0-0 | 0-0',
  )
  assert.ok(
    md.includes(
      '2026%E2%80%9327_St._John%27s_Red_Storm_men%27s_basketball_team',
    ),
  )
})

test('sidebar layout matches the old bot', () => {
  const side = sidebar(
    [{day: '2026-11-02', games: games('20261102')}],
    zeroStandings(),
    2027,
  )
  assert.ok(
    side.startsWith(
      '---\n\n**Recent/Upcoming Games**\n\n\n**Monday, November 2nd**\n\n',
    ),
  )
  assert.ok(
    side.includes(
      '\n---\n\n*All times are Big East-ern time unless otherwise noted.*\n\n---\n\n**Big East Basketball Standings:**\n\nTEAM | CONF | OVERALL\n:--:|:--:|:--:\n',
    ),
  )
})
