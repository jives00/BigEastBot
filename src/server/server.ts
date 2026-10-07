import {once} from 'node:events'
import type {IncomingMessage, ServerResponse} from 'node:http'
import type {PartialJsonValue, UiResponse} from '@devvit/web/shared'
import {type UpdateSummary, update} from './update.ts'

type ErrorRsp = {error: string; status: number}

export async function onReq(
  reqMsg: IncomingMessage,
  rspMsg: ServerResponse,
): Promise<void> {
  try {
    await route(reqMsg, rspMsg)
  } catch (err) {
    const msg = `server error; ${err instanceof Error ? err.stack : err}`
    console.error(msg)
    writeJson<ErrorRsp>(500, {error: msg, status: 500}, rspMsg)
  }
}

async function route(
  reqMsg: IncomingMessage,
  rspMsg: ServerResponse,
): Promise<void> {
  if (reqMsg.method !== 'POST') {
    writeJson<ErrorRsp>(404, {error: 'not found', status: 404}, rspMsg)
    return
  }
  await drain(reqMsg)

  switch (reqMsg.url) {
    case '/internal/cron/update-sidebar':
      log(await update())
      writeJson(200, {}, rspMsg)
      return
    case '/internal/menu/update-now':
      writeJson<UiResponse>(200, await routeUpdateNow(), rspMsg)
      return
    default:
      writeJson<ErrorRsp>(404, {error: 'not found', status: 404}, rspMsg)
  }
}

async function routeUpdateNow(): Promise<UiResponse> {
  try {
    const summary = await update({refreshOpener: true})
    log(summary)
    return {showToast: {text: toastText(summary), appearance: 'success'}}
  } catch (err) {
    console.error(`[update] failed: ${err instanceof Error ? err.stack : err}`)
    return {
      showToast: `Update failed: ${err instanceof Error ? err.message : err}`,
    }
  }
}

export function toastText(s: UpdateSummary): string {
  const head = `${s.mode}, opener ${s.opener ?? 'unknown'}`
  if (s.frozenReason) return `${head}: no changes (${s.frozenReason})`
  return `${head}. Sidebar ${s.sidebar}, games widget ${s.gamesWidget}, standings widget ${s.standingsWidget}`
}

function log(s: UpdateSummary): void {
  console.log(`[update] ${JSON.stringify(s)}`)
}

async function drain(reqMsg: IncomingMessage): Promise<void> {
  reqMsg.resume()
  await once(reqMsg, 'end')
}

function writeJson<T extends PartialJsonValue>(
  status: number,
  json: Readonly<T>,
  rsp: ServerResponse,
): void {
  const body = JSON.stringify(json)
  rsp.writeHead(status, {
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json',
  })
  rsp.end(body)
}
