import assert from 'node:assert/strict'
import {test} from 'node:test'
import {addDays, dayLabel, etDay} from './dates.ts'
import {isSeasonOver, modeFor, seasonYearFor, windowDays} from './season.ts'

const OPENER = '2026-11-02'

test('season year rolls over on May 1', () => {
  assert.equal(seasonYearFor('2026-10-06'), 2027)
  assert.equal(seasonYearFor('2027-01-15'), 2027)
  assert.equal(seasonYearFor('2027-04-30'), 2027)
  assert.equal(seasonYearFor('2027-05-01'), 2028)
})

test('mode boundaries around the opener', () => {
  assert.equal(modeFor('2026-10-02', OPENER), 'frozen') // opener - 31
  assert.equal(modeFor('2026-10-03', OPENER), 'preseason') // opener - 30
  assert.equal(modeFor('2026-10-31', OPENER), 'preseason') // opener - 2
  assert.equal(modeFor('2026-11-01', OPENER), 'in-season') // opener - 1
  assert.equal(modeFor('2027-03-20', OPENER), 'in-season')
  assert.equal(modeFor('2026-10-06', null), 'frozen')
  // May 1: next season's opener is ~6 months out.
  assert.equal(modeFor('2027-05-01', '2027-11-08'), 'frozen')
})

test("preseason: the season's first 7 days", () => {
  const pre = windowDays('2026-10-06', OPENER)
  assert.equal(pre.length, 7)
  assert.equal(pre[0], OPENER)
  assert.equal(pre[6], '2026-11-08')
})

test('in-season: yesterday plus 7 days ahead', () => {
  const live = windowDays('2026-12-10', OPENER)
  assert.equal(live.length, 8)
  assert.equal(live[0], '2026-12-09')
  assert.equal(live[1], '2026-12-10')
  assert.equal(live[7], '2026-12-16')
})

test('around the opener the window never starts before it', () => {
  // Day before the opener: no "yesterday", still 7 days from the opener.
  assert.deepEqual(
    windowDays('2026-11-01', OPENER),
    windowDays('2026-10-06', OPENER),
  )
  // Opening day: still nothing before it.
  const opening = windowDays('2026-11-02', OPENER)
  assert.equal(opening[0], OPENER)
  assert.equal(opening.at(-1), '2026-11-08')
  // Day after: yesterday is the opener.
  const next = windowDays('2026-11-03', OPENER)
  assert.equal(next.length, 8)
  assert.equal(next[0], OPENER)
  assert.equal(next.at(-1), '2026-11-09')
})

test('season over only in spring with an empty window', () => {
  assert.equal(isSeasonOver('2027-04-08', OPENER, 0), true)
  assert.equal(isSeasonOver('2027-04-08', OPENER, 1), false)
  assert.equal(isSeasonOver('2026-12-26', OPENER, 0), false) // holiday gap
})

test('dates are Eastern calendar days', () => {
  assert.equal(etDay(new Date('2026-11-03T00:00:00Z')), '2026-11-02')
  assert.equal(etDay(new Date('2026-11-03T05:00:00Z')), '2026-11-03')
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addDays('2026-11-01', -30), '2026-10-02')
  assert.equal(addDays('2027-02-28', 1), '2027-03-01')
})

test('day labels', () => {
  assert.equal(dayLabel('2026-11-02'), 'Monday, November 2nd')
  assert.equal(dayLabel('2026-11-11'), 'Wednesday, November 11th')
  assert.equal(dayLabel('2026-11-21'), 'Saturday, November 21st')
  assert.equal(dayLabel('2026-11-23'), 'Monday, November 23rd')
})
