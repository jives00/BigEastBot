// Which part of the year it is, and therefore what the sidebar should do. See "Season modes" in
// plans/plan-devvit-migration.md.

import {addDays, type Day, dayMonth, maxDay} from './dates.ts'

export type Mode = 'frozen' | 'preseason' | 'in-season'

/** Days of upcoming games shown: today plus the next 6. Yesterday is shown too, for results. */
export const DAYS_AHEAD = 7
export const PRESEASON_LEAD_DAYS = 30
/** An empty games window this long after the opener means the season is over. */
export const SEASON_OVER_AFTER_DAYS = 120

/** Seasons are named by the year they end in: 2026-27 is 2027. Rolls over on May 1. */
export function seasonYearFor(today: Day): number {
  const year = Number(today.slice(0, 4))
  return dayMonth(today) >= 5 ? year + 1 : year
}

export function modeFor(today: Day, opener: Day | null): Mode {
  if (!opener || today < addDays(opener, -PRESEASON_LEAD_DAYS)) return 'frozen'
  if (today < addDays(opener, -1)) return 'preseason'
  return 'in-season'
}

/**
 * Yesterday through 6 days ahead. In preseason it's the season's first 7 days instead, starting
 * at the opener.
 */
export function windowDays(today: Day, opener: Day): Day[] {
  const start = maxDay(addDays(today, -1), opener)
  const end = maxDay(
    addDays(today, DAYS_AHEAD - 1),
    addDays(opener, DAYS_AHEAD - 1),
  )
  const days: Day[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  return days
}

export function isSeasonOver(
  today: Day,
  opener: Day,
  gamesInWindow: number,
): boolean {
  return gamesInWindow === 0 && today >= addDays(opener, SEASON_OVER_AFTER_DAYS)
}
