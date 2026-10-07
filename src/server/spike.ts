// Phase 0 feasibility checks (see plans/plan-devvit-migration.md). Run from the
// "[BigEastBot] Run spike checks" mod menu item on r/jives00test.

import {context, reddit} from '@devvit/web/server'
import {parseGames, type SpikeGame, spikeMarkdown} from './sample.ts'

export type SpikeResult = {step: string; ok: boolean; detail: string}

const ESPN =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball'
const ESPN_STANDINGS =
  'https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/standings'
const OPENING_NIGHT = '20261102'
const WIDGET_NAME = 'BigEastBot Spike'
const WIDGET_PROBE_LENGTHS = [5_000, 10_000, 15_000]

export async function runSpike(): Promise<SpikeResult[]> {
  const sub = context.subredditName
  if (!sub) return [{step: 'context', ok: false, detail: 'no subredditName'}]

  const results: SpikeResult[] = []
  const step = async (
    name: string,
    fn: () => Promise<string>,
  ): Promise<boolean> => {
    try {
      results.push({step: name, ok: true, detail: await fn()})
      return true
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      results.push({step: name, ok: false, detail})
      return false
    }
  }

  const appUser = await reddit.getAppUser().catch(() => undefined)
  results.push({
    step: 'app-account',
    ok: Boolean(appUser),
    detail: appUser ? `u/${appUser.username}` : 'getAppUser returned nothing',
  })

  let games: SpikeGame[] = []
  await step('espn-scoreboard', async () => {
    const json = await getJson(
      `${ESPN}/scoreboard?groups=4&limit=300&dates=${OPENING_NIGHT}`,
    )
    games = parseGames(json as Parameters<typeof parseGames>[0])
    return `${games.length} games on ${OPENING_NIGHT}`
  })

  await step('espn-standings', async () => {
    const json = (await getJson(`${ESPN_STANDINGS}?group=4&season=2027`)) as {
      standings?: {entries?: unknown[]}
    }
    return `${json.standings?.entries?.length ?? 0} entries for 2026-27 (0 expected before tip-off)`
  })

  const content = spikeMarkdown(games, new Date())

  await step('wiki-config-sidebar', async () => {
    const before = await reddit.getWikiPage(sub, 'config/sidebar')
    await reddit.updateWikiPage({
      subredditName: sub,
      page: 'config/sidebar',
      content,
      reason: 'BigEastBot spike test',
    })
    const after = await reddit.getWikiPage(sub, 'config/sidebar')
    if (after.content.trim() !== content.trim())
      throw Error('write returned OK but content did not round-trip')
    const author = after.revisionAuthorId
      ? (await reddit.getUserById(after.revisionAuthorId))?.username
      : undefined
    return `revision ${before.revisionId} -> ${after.revisionId}, author u/${author ?? '?'}`
  })

  let widgetId: string | undefined
  await step('widget-upsert', async () => {
    const existing = (await reddit.getWidgets(sub)).find(
      w => w.name === WIDGET_NAME,
    )
    if (existing) {
      await reddit.updateWidget({
        type: 'textarea',
        subreddit: sub,
        id: existing.id,
        shortName: WIDGET_NAME,
        text: content,
      })
      widgetId = existing.id
      return `updated ${existing.id} (${content.length} chars)`
    }
    const created = await reddit.addWidget({
      type: 'textarea',
      subreddit: sub,
      shortName: WIDGET_NAME,
      text: content,
    })
    widgetId = created.id
    return `created ${created.id} (${content.length} chars)`
  })

  if (widgetId) {
    const id = widgetId
    await step('widget-size-limit', async () => {
      const accepted: number[] = []
      let rejected = ''
      for (const len of WIDGET_PROBE_LENGTHS) {
        try {
          await reddit.updateWidget({
            type: 'textarea',
            subreddit: sub,
            id,
            shortName: WIDGET_NAME,
            text: content.padEnd(len, '.'),
          })
          accepted.push(len)
        } catch (err) {
          rejected = `${len} rejected (${err instanceof Error ? err.message : err})`
          break
        }
      }
      // Put the readable content back so the table can be checked by eye.
      await reddit.updateWidget({
        type: 'textarea',
        subreddit: sub,
        id,
        shortName: WIDGET_NAME,
        text: content,
      })
      return `accepted ${accepted.join(', ') || 'none'}${rejected ? `; ${rejected}` : ''}`
    })
  }

  return results
}

async function getJson(url: string): Promise<unknown> {
  const rsp = await fetch(url)
  if (!rsp.ok) throw Error(`HTTP ${rsp.status} for ${url}`)
  return rsp.json()
}
