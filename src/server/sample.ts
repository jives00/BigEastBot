// Throwaway markdown for the Phase 0 spike. The real renderer (render.ts) replaces this in
// Phase 1; this only needs to look enough like the sidebar to test tables and length.

export const TEAMS = [
  'Butler',
  'Creighton',
  'DePaul',
  'Georgetown',
  'Marquette',
  'Providence',
  'Seton Hall',
  "St John's",
  'UConn',
  'Villanova',
  'Xavier',
] as const

export type SpikeGame = {
  away: string
  home: string
  when: string
  network: string
}

type EspnEvent = {
  competitions?: {
    competitors?: {homeAway?: string; team?: {shortDisplayName?: string}}[]
    status?: {type?: {shortDetail?: string}}
    broadcasts?: {names?: string[]}[]
  }[]
}

export function parseGames(json: {events?: EspnEvent[]}): SpikeGame[] {
  return (json.events ?? []).map(ev => {
    const comp = ev.competitions?.[0]
    const team = (side: string): string =>
      comp?.competitors?.find(c => c.homeAway === side)?.team
        ?.shortDisplayName ?? '?'
    return {
      away: team('away'),
      home: team('home'),
      when: comp?.status?.type?.shortDetail ?? 'TBD',
      network: comp?.broadcasts?.[0]?.names?.[0] ?? '',
    }
  })
}

export function gamesMarkdown(games: readonly SpikeGame[]): string {
  if (!games.length) return '*No games found.*\n\n'
  return games
    .map(
      g =>
        `* ${g.away} vs ${g.home}, ${g.when}${g.network ? ` on ${g.network}` : ''}\n\n`,
    )
    .join('')
}

export function zeroStandingsMarkdown(): string {
  let md = 'TEAM | CONF | OVERALL\n:--:|:--:|:--:\n'
  for (const t of TEAMS) md += `${t} | 0-0 | 0-0\n`
  return md
}

export function spikeMarkdown(games: readonly SpikeGame[], at: Date): string {
  return (
    `*BigEastBot spike test, ${at.toISOString()}*\n\n---\n\n` +
    '**Recent/Upcoming Games**\n\n' +
    gamesMarkdown(games) +
    '---\n\n**Big East Basketball Standings:**\n\n' +
    zeroStandingsMarkdown()
  )
}
