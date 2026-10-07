import assert from 'node:assert/strict'
import {test} from 'node:test'
import {fixture} from '../test/fixtures.ts'
import {
  openerFromSchedules,
  parseScoreboard,
  parseStandings,
  type RawSchedule,
  type RawScoreboard,
  type RawStandings,
  zeroStandings,
} from './espn.ts'

test('standings sorted by ESPN seed with conf and overall records', () => {
  const rows = parseStandings(fixture<RawStandings>('standings-2026'))
  assert.equal(rows.length, 11)
  assert.deepEqual(rows[0], {
    espnId: '2599',
    name: "St John's",
    conf: '18-2',
    overall: '30-7',
    seed: 1,
  })
  assert.equal(rows[1]?.name, 'UConn')
  assert.equal(rows[10]?.name, 'Georgetown')
  assert.deepEqual(
    rows.map(r => r.seed),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  )
})

test('empty standings (before tip-off) parse to nothing', () => {
  assert.deepEqual(parseStandings({}), [])
  assert.deepEqual(parseStandings({standings: {entries: []}}), [])
})

test('zero standings: all 11 teams, alphabetical, 0-0', () => {
  const rows = zeroStandings()
  assert.equal(rows.length, 11)
  assert.equal(rows[0]?.name, 'Butler')
  assert.equal(rows[10]?.name, 'Xavier')
  assert.ok(rows.every(r => r.conf === '0-0' && r.overall === '0-0'))
})

test('scoreboard parsing', () => {
  assert.deepEqual(
    parseScoreboard(fixture<RawScoreboard>('scoreboard-20260326')),
    [],
  )
  const [g] = parseScoreboard(fixture<RawScoreboard>('scoreboard-20260314'))
  assert.equal(g?.final, true)
  assert.deepEqual(g?.home, {name: "St John's", score: 72, rank: 13})
  assert.deepEqual(g?.away, {name: 'UConn', score: 52, rank: 6})
  const [pre] = parseScoreboard(fixture<RawScoreboard>('scoreboard-20261102'))
  assert.equal(pre?.state, 'pre')
  assert.equal(pre?.home.rank, null) // curatedRank 99 = unranked
})

test('opener is the earliest Eastern game day', () => {
  const schedule = fixture<RawSchedule>('schedule-2507-2027')
  // First game is 2026-11-03T00:00Z = 7pm Eastern on Nov 2.
  assert.equal(openerFromSchedules([schedule], 2027), '2026-11-02')
  assert.equal(
    openerFromSchedules(
      [schedule, {events: [{date: '2026-11-01T23:00Z'}]}],
      2027,
    ),
    '2026-11-01',
  )
  assert.equal(openerFromSchedules([{events: []}, {}], 2027), null)
})

test('opener ignores games from the wrong season', () => {
  assert.equal(
    openerFromSchedules([{events: [{date: '2026-03-01T23:00Z'}]}], 2027),
    null,
  )
})
