// The 11 Big East men's basketball programs. `name` matches ESPN's shortDisplayName (what the
// sidebar shows); `wiki` is the Wikipedia team name used to build each season's team page link.

export type Team = {espnId: string; name: string; wiki: string}

export const TEAMS: readonly Team[] = [
  {espnId: '2086', name: 'Butler', wiki: 'Butler Bulldogs'},
  {espnId: '156', name: 'Creighton', wiki: 'Creighton Bluejays'},
  {espnId: '305', name: 'DePaul', wiki: 'DePaul Blue Demons'},
  {espnId: '46', name: 'Georgetown', wiki: 'Georgetown Hoyas'},
  {espnId: '269', name: 'Marquette', wiki: 'Marquette Golden Eagles'},
  {espnId: '2507', name: 'Providence', wiki: 'Providence Friars'},
  {espnId: '2550', name: 'Seton Hall', wiki: 'Seton Hall Pirates'},
  {espnId: '2599', name: "St John's", wiki: "St. John's Red Storm"},
  {espnId: '41', name: 'UConn', wiki: 'UConn Huskies'},
  {espnId: '222', name: 'Villanova', wiki: 'Villanova Wildcats'},
  {espnId: '2752', name: 'Xavier', wiki: 'Xavier Musketeers'},
]

export function teamById(espnId: string): Team | undefined {
  return TEAMS.find(t => t.espnId === espnId)
}

/** Wikipedia season page, e.g. 2026–27 Butler Bulldogs men's basketball team. */
export function teamSeasonUrl(wikiName: string, seasonYear: number): string {
  const title = `${seasonYear - 1}–${String(seasonYear).slice(2)} ${wikiName} men's basketball team`
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_')).replaceAll("'", '%27')}`
}
