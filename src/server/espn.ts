// ESPN's unofficial site API: fetchers plus defensive parsers. Parsers are pure so they can be
// tested against the saved responses in src/test/fixtures/.

import {type Day, espnDate, etDay} from './dates.ts'
import {TEAMS, teamById} from './teams.ts'

const SITE =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball'
const STANDINGS =
  'https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/standings'
const BIG_EAST_GROUP = '4'
const TIMEOUT_MS = 10_000

export type Side = {name: string; score: number; rank: number | null}

export type Game = {
  id: string
  state: 'pre' | 'in' | 'post'
  final: boolean
  detail: string
  shortDetail: string
  home: Side
  away: Side
  headline: string
  network: string
}

export type StandingRow = {
  espnId: string
  name: string
  conf: string
  overall: string
  seed: number | null
}

type RawCompetitor = {
  homeAway?: string
  score?: string
  team?: {id?: string; shortDisplayName?: string}
  curatedRank?: {current?: number}
}

type RawEvent = {
  id?: string
  date?: string
  competitions?: {
    status?: {
      type?: {
        name?: string
        state?: string
        detail?: string
        shortDetail?: string
      }
    }
    competitors?: RawCompetitor[]
    notes?: {headline?: string}[]
    broadcasts?: {names?: string[]}[]
  }[]
}

export type RawScoreboard = {events?: RawEvent[]}
export type RawSchedule = {events?: {date?: string}[]}
export type RawStandings = {
  standings?: {
    entries?: {
      team?: {id?: string; shortDisplayName?: string}
      stats?: {type?: string; displayValue?: string}[]
    }[]
  }
}

export function parseScoreboard(json: RawScoreboard): Game[] {
  return (json.events ?? []).map(parseGame)
}

function parseGame(ev: RawEvent): Game {
  const comp = ev.competitions?.[0]
  const type = comp?.status?.type
  const state =
    type?.state === 'in' || type?.state === 'post' ? type.state : 'pre'
  const side = (homeAway: 'home' | 'away', index: number): Side => {
    const c =
      comp?.competitors?.find(x => x.homeAway === homeAway) ??
      comp?.competitors?.[index]
    const rank = c?.curatedRank?.current
    return {
      name: c?.team?.shortDisplayName ?? 'TBD',
      score: Number(c?.score ?? 0) || 0,
      rank: rank && rank >= 1 && rank <= 25 ? rank : null,
    }
  }
  return {
    id: ev.id ?? '',
    state,
    final: state === 'post' && (type?.name ?? '').startsWith('STATUS_FINAL'),
    detail: type?.detail ?? '',
    shortDetail: type?.shortDetail ?? '',
    // ESPN lists home first; homeAway is checked anyway in case that ever changes.
    home: side('home', 0),
    away: side('away', 1),
    headline: comp?.notes?.[0]?.headline ?? '',
    network: comp?.broadcasts?.[0]?.names?.[0] ?? '',
  }
}

/** Rows in ESPN's order of finish (playoffseed, which applies tiebreakers). */
export function parseStandings(json: RawStandings): StandingRow[] {
  const rows = (json.standings?.entries ?? []).map(e => {
    const stat = (type: string): string | undefined =>
      e.stats?.find(s => s.type === type)?.displayValue
    const espnId = e.team?.id ?? ''
    const seed = Number(stat('playoffseed'))
    return {
      espnId,
      name: teamById(espnId)?.name ?? e.team?.shortDisplayName ?? '?',
      conf: stat('vsconf') ?? '0-0',
      overall: stat('total') ?? '0-0',
      seed: Number.isFinite(seed) && seed > 0 ? seed : null,
    }
  })
  return rows.sort(
    (a, b) =>
      (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER),
  )
}

export function zeroStandings(): StandingRow[] {
  return TEAMS.map(t => ({
    espnId: t.espnId,
    name: t.name,
    conf: '0-0',
    overall: '0-0',
    seed: null,
  }))
}

/**
 * Earliest game day (Eastern) across the given schedules, or null if none are published. Games
 * before September of the season's first year are ignored, in case ESPN answers with the wrong
 * season's schedule.
 */
export function openerFromSchedules(
  schedules: RawSchedule[],
  seasonYear: number,
): Day | null {
  const earliest = `${seasonYear - 1}-09-01`
  let opener: Day | null = null
  for (const s of schedules)
    for (const ev of s.events ?? []) {
      if (!ev.date) continue
      const day = etDay(new Date(ev.date))
      if (day >= earliest && (!opener || day < opener)) opener = day
    }
  return opener
}

export async function fetchScoreboard(day: Day): Promise<Game[]> {
  return parseScoreboard(
    (await getJson(
      `${SITE}/scoreboard?lang=en&region=us&calendartype=blacklist&limit=300&groups=${BIG_EAST_GROUP}&dates=${espnDate(day)}`,
    )) as RawScoreboard,
  )
}

export async function fetchStandings(
  seasonYear: number,
): Promise<StandingRow[]> {
  return parseStandings(
    (await getJson(
      `${STANDINGS}?group=${BIG_EAST_GROUP}&season=${seasonYear}`,
    )) as RawStandings,
  )
}

export async function fetchOpener(seasonYear: number): Promise<Day | null> {
  const schedules = await Promise.all(
    TEAMS.map(
      async t =>
        (await getJson(
          `${SITE}/teams/${t.espnId}/schedule?season=${seasonYear}&seasontype=2`,
        )) as RawSchedule,
    ),
  )
  return openerFromSchedules(schedules, seasonYear)
}

async function getJson(url: string): Promise<unknown> {
  const rsp = await fetch(url, {signal: AbortSignal.timeout(TIMEOUT_MS)})
  if (!rsp.ok) throw Error(`ESPN HTTP ${rsp.status} for ${url}`)
  return rsp.json()
}
