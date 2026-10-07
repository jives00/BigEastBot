// One update pass: work out the season mode, fetch ESPN, render, and write the old-Reddit
// sidebar and the two new-Reddit widgets. Each target compares against its live content and is
// only written when it changed, which also means a mod's manual edit is left alone until the
// scores change.

import {context, reddit, redis} from '@devvit/web/server'
import {type Day, etDay} from './dates.ts'
import {
  fetchOpener,
  fetchScoreboard,
  fetchStandings,
  type StandingRow,
  zeroStandings,
} from './espn.ts'
import {type GameDay, gamesWidget, sidebar, standingsWidget} from './render.ts'
import {
  isSeasonOver,
  type Mode,
  modeFor,
  seasonYearFor,
  windowDays,
} from './season.ts'

const SIDEBAR_PAGE = 'config/sidebar'
export const GAMES_WIDGET = 'Recent/Upcoming Games'
export const STANDINGS_WIDGET = 'Big East Standings'
const OPENER_TTL_MS = 24 * 60 * 60 * 1000
const NO_OPENER = 'none'

type WriteResult = 'updated' | 'created' | 'unchanged' | `failed: ${string}`

export type UpdateSummary = {
  today: Day
  seasonYear: number
  opener: Day | null
  mode: Mode
  frozenReason?: string
  sidebar?: WriteResult
  gamesWidget?: WriteResult
  standingsWidget?: WriteResult
}

export async function update(
  opts: {refreshOpener?: boolean} = {},
): Promise<UpdateSummary> {
  const sub = context.subredditName
  if (!sub) throw Error('no subreddit in context')

  const today = etDay(new Date())
  const seasonYear = seasonYearFor(today)
  const opener = await getOpener(seasonYear, opts.refreshOpener ?? false)
  const mode = modeFor(today, opener)
  const summary: UpdateSummary = {today, seasonYear, opener, mode}

  if (mode === 'frozen' || !opener) {
    summary.frozenReason = opener
      ? `preseason starts 30 days before the ${opener} opener`
      : `no ${seasonYear - 1}-${String(seasonYear).slice(2)} schedule from ESPN yet`
    return summary
  }

  // Any ESPN failure throws here, before anything is written, so a flaky response can never
  // publish a sidebar with missing days.
  const days: GameDay[] = await Promise.all(
    windowDays(today, opener).map(async day => ({
      day,
      games: await fetchScoreboard(day),
    })),
  )
  const gameCount = days.reduce((n, d) => n + d.games.length, 0)
  if (isSeasonOver(today, opener, gameCount)) {
    summary.mode = 'frozen'
    summary.frozenReason = 'season over; keeping the final results up'
    return summary
  }

  let rows: StandingRow[] =
    mode === 'preseason' ? [] : await fetchStandings(seasonYear)
  if (!rows.length) rows = zeroStandings()

  summary.sidebar = await capture(() =>
    writeSidebar(sub, sidebar(days, rows, seasonYear)),
  )
  const live = await reddit.getWidgets(sub).catch(err => err as Error)
  if (live instanceof Error) {
    const failed: WriteResult = `failed: ${live.message}`
    summary.gamesWidget = failed
    summary.standingsWidget = failed
  } else {
    summary.gamesWidget = await capture(() =>
      writeWidget(sub, live, GAMES_WIDGET, gamesWidget(days)),
    )
    summary.standingsWidget = await capture(() =>
      writeWidget(
        sub,
        live,
        STANDINGS_WIDGET,
        standingsWidget(rows, seasonYear),
      ),
    )
  }
  return summary
}

async function getOpener(
  seasonYear: number,
  refresh: boolean,
): Promise<Day | null> {
  const key = `opener:${seasonYear}`
  const cached = refresh ? undefined : await redis.get(key)
  if (cached) return cached === NO_OPENER ? null : cached
  const opener = await fetchOpener(seasonYear)
  await redis.set(key, opener ?? NO_OPENER, {
    expiration: new Date(Date.now() + OPENER_TTL_MS),
  })
  return opener
}

async function writeSidebar(
  sub: string,
  content: string,
): Promise<WriteResult> {
  const current = await reddit.getWikiPage(sub, SIDEBAR_PAGE)
  if (current.content.trim() === content.trim()) return 'unchanged'
  await reddit.updateWikiPage({
    subredditName: sub,
    page: SIDEBAR_PAGE,
    content,
    reason: 'BigEastBot scores/standings update',
  })
  return 'updated'
}

type LiveWidget = {id: string; name: string; text?: string}

async function writeWidget(
  sub: string,
  live: readonly LiveWidget[],
  name: string,
  text: string,
): Promise<WriteResult> {
  const existing = live.find(w => w.name === name)
  if (!existing) {
    await reddit.addWidget({
      type: 'textarea',
      subreddit: sub,
      shortName: name,
      text,
    })
    return 'created'
  }
  if ((existing.text ?? '').trim() === text.trim()) return 'unchanged'
  await reddit.updateWidget({
    type: 'textarea',
    subreddit: sub,
    id: existing.id,
    shortName: name,
    text,
  })
  return 'updated'
}

async function capture(fn: () => Promise<WriteResult>): Promise<WriteResult> {
  try {
    return await fn()
  } catch (err) {
    return `failed: ${err instanceof Error ? err.message : String(err)}`
  }
}
