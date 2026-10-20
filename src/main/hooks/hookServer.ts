import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { Duplex } from 'node:stream'
import type { HookServerStatus } from '@shared/hooks'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
const MAX_CLIENTS = 20
const MAX_FRAME_BYTES = 64 * 1024
const MAX_BACKLOG_BYTES = 1024 * 1024
const LOOPBACK = '127.0.0.1'

const OP_TEXT = 0x1
const OP_CLOSE = 0x8
const OP_PING = 0x9
const OP_PONG = 0xa

/** Server-to-client frames are never masked (RFC 6455 section 5.1). */
export function encodeFrame(opcode: number, payload: Buffer): Buffer {
  const length = payload.length
  const header =
    length < 126
      ? Buffer.from([0x80 | opcode, length])
      : length < 65536
        ? Buffer.from([0x80 | opcode, 126, length >> 8, length & 0xff])
        : Buffer.concat([Buffer.from([0x80 | opcode, 127, 0, 0, 0, 0]), Buffer.alloc(4)])
  if (length >= 65536) header.writeUInt32BE(length, 6)
  return Buffer.concat([header, payload])
}

/** Reads one client frame (always masked); returns null until the whole frame has arrived. */
function decodeFrame(
  buffer: Buffer
): { opcode: number; payload: Buffer; size: number } | 'too-big' | null {
  if (buffer.length < 2) return null
  const opcode = buffer[0]! & 0x0f
  const masked = (buffer[1]! & 0x80) !== 0
  let length = buffer[1]! & 0x7f
  let offset = 2
  if (length === 126) {
    if (buffer.length < 4) return null
    length = buffer.readUInt16BE(2)
    offset = 4
  } else if (length === 127) {
    return 'too-big'
  }
  if (length > MAX_FRAME_BYTES) return 'too-big'
  const maskLength = masked ? 4 : 0
  if (buffer.length < offset + maskLength + length) return null
  const payload = Buffer.from(buffer.subarray(offset + maskLength, offset + maskLength + length))
  if (masked) {
    for (let i = 0; i < payload.length; i++) payload[i] = payload[i]! ^ buffer[offset + (i % 4)]!
  }
  return { opcode, payload, size: offset + maskLength + length }
}

/** Minimal send-only WebSocket server on loopback; inbound text messages are ignored. */
export class HookServer {
  private server: Server | null = null
  private port: number | null = null
  private error: string | undefined
  private readonly sockets = new Set<Duplex>()

  constructor(private readonly onStatus: (status: HookServerStatus) => void) {}

  status(): HookServerStatus {
    return {
      listening: this.server !== null,
      port: this.port,
      clients: this.sockets.size,
      ...(this.error ? { error: this.error } : {})
    }
  }

  async start(port: number): Promise<HookServerStatus> {
    await this.stop()
    this.error = undefined
    const server = createServer((_req, res) => {
      res
        .writeHead(426, { Upgrade: 'websocket' })
        .end('DeckPulse hook server: connect with a WebSocket')
    })
    server.on('upgrade', (req, socket) => this.accept(req.headers, socket))
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, LOOPBACK, () => resolve())
      })
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      server.close()
      this.notify()
      return this.status()
    }
    server.on('error', (error) => {
      this.error = error.message
      this.notify()
    })
    this.server = server
    this.port = port
    this.notify()
    return this.status()
  }

  async stop(): Promise<void> {
    const server = this.server
    this.server = null
    this.port = null
    for (const socket of this.sockets) socket.destroy()
    this.sockets.clear()
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
    this.notify()
  }

  broadcast(message: object): void {
    if (this.sockets.size === 0) return
    const frame = encodeFrame(OP_TEXT, Buffer.from(JSON.stringify(message)))
    for (const socket of this.sockets) {
      if (socket.writableLength < MAX_BACKLOG_BYTES) socket.write(frame)
    }
  }

  private notify(): void {
    this.onStatus(this.status())
  }

  private accept(headers: Record<string, string | string[] | undefined>, socket: Duplex): void {
    const key = headers['sec-websocket-key']
    const valid =
      String(headers.upgrade).toLowerCase() === 'websocket' &&
      typeof key === 'string' &&
      Buffer.from(key, 'base64').length === 16 &&
      headers['sec-websocket-version'] === '13'
    if (!valid) return void socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
    if (this.sockets.size >= MAX_CLIENTS)
      return void socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n')
    const accept = createHash('sha1')
      .update(key + GUID)
      .digest('base64')
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
    )
    this.sockets.add(socket)
    this.notify()
    let pending = Buffer.alloc(0)
    const drop = (): void => {
      if (this.sockets.delete(socket)) this.notify()
      socket.destroy()
    }
    socket.on('data', (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk])
      for (let frame = decodeFrame(pending); frame; frame = decodeFrame(pending)) {
        if (frame === 'too-big') return drop()
        pending = pending.subarray(frame.size)
        if (frame.opcode === OP_PING) socket.write(encodeFrame(OP_PONG, frame.payload))
        if (frame.opcode === OP_CLOSE) {
          socket.write(encodeFrame(OP_CLOSE, Buffer.alloc(0)))
          return drop()
        }
      }
    })
    socket.on('close', drop)
    socket.on('error', drop)
  }
}
