import {once} from 'node:events'
import type {IncomingMessage, ServerResponse} from 'node:http'
import {redis} from '@devvit/web/server'
import type {PartialJsonValue, UiResponse} from '@devvit/web/shared'
import {runSpike} from './spike.ts'

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
    case '/internal/menu/spike':
      writeJson<UiResponse>(200, await routeSpike(), rspMsg)
      return
    case '/internal/cron/heartbeat':
      await routeHeartbeat()
      writeJson(200, {}, rspMsg)
      return
    default:
      writeJson<ErrorRsp>(404, {error: 'not found', status: 404}, rspMsg)
  }
}

async function routeSpike(): Promise<UiResponse> {
  const results = await runSpike()
  for (const r of results)
    console.log(`[spike] ${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.detail}`)
  const failed = results.filter(r => !r.ok).map(r => r.step)
  return {
    showToast: {
      text: failed.length
        ? `Spike: FAILED ${failed.join(', ')} (see playtest logs)`
        : `Spike: all ${results.length} checks passed`,
      appearance: failed.length ? 'neutral' : 'success',
    },
  }
}

async function routeHeartbeat(): Promise<void> {
  const n = await redis.incrBy('spike:heartbeats', 1)
  console.log(`[heartbeat] #${n} at ${new Date().toISOString()}`)
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
