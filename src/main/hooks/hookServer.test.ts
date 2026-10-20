import { createServer, request } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import type { HookServerStatus } from '@shared/hooks'
import { encodeFrame, HookServer } from './hookServer'

const servers: HookServer[] = []
const statuses: HookServerStatus[] = []
const port = (): number => 41000 + Math.floor(Math.random() * 15000)

async function startServer(p = port()) {
  const server = new HookServer((s) => statuses.push(s))
  servers.push(server)
  await server.start(p)
  return { server, port: p }
}

const open = (p: number) =>
  new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${p}`)
    ws.onopen = () => resolve(ws)
    ws.onerror = () => reject(new Error('connect failed'))
  })

const nextMessage = (ws: WebSocket) =>
  new Promise<unknown>((resolve) => {
    ws.onmessage = (e) => resolve(JSON.parse(String(e.data)))
  })

afterEach(async () => {
  statuses.length = 0
  await Promise.all(servers.splice(0).map((s) => s.stop()))
})

describe('HookServer', () => {
  it('accepts WebSocket clients and broadcasts JSON to all of them', async () => {
    const { server, port: p } = await startServer()
    const [a, b] = await Promise.all([open(p), open(p)])
    const received = Promise.all([nextMessage(a), nextMessage(b)])
    server.broadcast({ type: 'beat', deck: 1, note: 'caf\u00e9' })
    expect(await received).toEqual([
      { type: 'beat', deck: 1, note: 'caf\u00e9' },
      { type: 'beat', deck: 1, note: 'caf\u00e9' }
    ])
    expect(server.status()).toMatchObject({ listening: true, port: p, clients: 2 })
    a.close()
    b.close()
  })

  it('reports client count changes and drops clients on stop', async () => {
    const { server, port: p } = await startServer()
    const ws = await open(p)
    expect(statuses[statuses.length - 1]?.clients).toBe(1)
    const closed = new Promise((resolve) => (ws.onclose = resolve))
    await server.stop()
    await closed
    expect(server.status()).toEqual({ listening: false, port: null, clients: 0 })
  })

  it('reports an error instead of throwing when the port is taken', async () => {
    const taken = createServer()
    const p = port()
    await new Promise<void>((resolve) => taken.listen(p, '127.0.0.1', resolve))
    const { server } = await startServer(p)
    expect(server.status().listening).toBe(false)
    expect(server.status().error).toMatch(/EADDRINUSE/)
    taken.close()
  })

  it('refuses plain HTTP requests and only listens on loopback', async () => {
    const { port: p } = await startServer()
    const status = await new Promise<number>((resolve, reject) => {
      request({ host: '127.0.0.1', port: p }, (res) => resolve(res.statusCode ?? 0))
        .on('error', reject)
        .end()
    })
    expect(status).toBe(426)
  })

  it('encodes frames with the right length forms', () => {
    const small = encodeFrame(0x1, Buffer.alloc(5, 'a'))
    expect([...small.subarray(0, 2)]).toEqual([0x81, 5])
    const medium = encodeFrame(0x1, Buffer.alloc(300))
    expect([...medium.subarray(0, 4)]).toEqual([0x81, 126, 1, 44])
    const large = encodeFrame(0x1, Buffer.alloc(70000))
    expect(large[1]).toBe(127)
    expect(large.readUInt32BE(6)).toBe(70000)
    expect(large.length).toBe(10 + 70000)
  })
})
