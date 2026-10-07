// Calendar days are 'YYYY-MM-DD' strings in US Eastern time, which is what the sidebar and
// ESPN's scoreboard `dates=` parameter both think in. Arithmetic is done in UTC to dodge DST.

export type Day = string

const etFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function etDay(at: Date): Day {
  return etFormat.format(at)
}

export function addDays(day: Day, n: number): Day {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function maxDay(a: Day, b: Day): Day {
  return a > b ? a : b
}

export function espnDate(day: Day): string {
  return day.replaceAll('-', '')
}

export function dayMonth(day: Day): number {
  return Number(day.slice(5, 7))
}

/** "Monday, November 2nd", matching the old bot's day headers. */
export function dayLabel(day: Day): string {
  const d = new Date(`${day}T00:00:00Z`)
  const n = d.getUTCDate()
  const suffix =
    n % 100 >= 10 && n % 100 < 20
      ? 'th'
      : ({1: 'st', 2: 'nd', 3: 'rd'}[n % 10] ?? 'th')
  const label = d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  return `${label}${suffix}`
}
