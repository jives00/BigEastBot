import assert from 'node:assert/strict'
import {test} from 'node:test'
import {
  gamesMarkdown,
  parseGames,
  spikeMarkdown,
  zeroStandingsMarkdown,
} from './sample.ts'

const event = {
  competitions: [
    {
      competitors: [
        {homeAway: 'home', team: {shortDisplayName: 'Georgetown'}},
        {homeAway: 'away', team: {shortDisplayName: 'Loyola MD'}},
      ],
      status: {type: {shortDetail: '11/2 - 6:30 PM EST'}},
      broadcasts: [{names: ['FS2']}],
    },
  ],
}

test('parseGames reads home/away by side, not position', () => {
  assert.deepEqual(parseGames({events: [event]}), [
    {
      away: 'Loyola MD',
      home: 'Georgetown',
      when: '11/2 - 6:30 PM EST',
      network: 'FS2',
    },
  ])
})

test('parseGames tolerates missing fields', () => {
  assert.deepEqual(parseGames({events: [{}]}), [
    {away: '?', home: '?', when: 'TBD', network: ''},
  ])
  assert.deepEqual(parseGames({}), [])
})

test('gamesMarkdown', () => {
  assert.equal(gamesMarkdown([]), '*No games found.*\n\n')
  assert.equal(
    gamesMarkdown(parseGames({events: [event]})),
    '* Loyola MD vs Georgetown, 11/2 - 6:30 PM EST on FS2\n\n',
  )
})

test('zero standings has a row per team', () => {
  const rows = zeroStandingsMarkdown().trim().split('\n')
  assert.equal(rows.length, 2 + 11)
  assert.ok(rows.slice(2).every(r => r.endsWith(' | 0-0 | 0-0')))
})

test('spikeMarkdown stamps the time', () => {
  const md = spikeMarkdown([], new Date('2026-10-07T00:00:00Z'))
  assert.ok(md.startsWith('*BigEastBot spike test, 2026-10-07T00:00:00.000Z*'))
})
