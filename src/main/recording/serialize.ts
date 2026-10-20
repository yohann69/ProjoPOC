const U8_KEY = '$u8'

/** JSON with typed arrays (waveforms, buffers) kept as base64 so a recording round-trips. */
export function encodeRecord(value: unknown): string {
  return JSON.stringify(value, function (this: Record<string, unknown>, key: string, v: unknown) {
    const original = this[key]
    if (original instanceof Uint8Array) {
      const bytes = Buffer.from(original.buffer, original.byteOffset, original.byteLength)
      return { [U8_KEY]: bytes.toString('base64') }
    }
    return v
  })
}

export function decodeRecord(text: string): unknown {
  return JSON.parse(text, (_key, v: unknown) => {
    if (
      typeof v === 'object' &&
      v !== null &&
      typeof (v as Record<string, unknown>)[U8_KEY] === 'string'
    ) {
      return new Uint8Array(Buffer.from((v as Record<string, string>)[U8_KEY] ?? '', 'base64'))
    }
    return v
  })
}

/** Copy of `value` with every numeric `ts` field moved by `offset` ms. */
export function shiftTimestamps<T>(value: T, offset: number): T {
  if (Array.isArray(value)) return value.map((v) => shiftTimestamps(v, offset)) as T
  if (typeof value !== 'object' || value === null || value instanceof Uint8Array) return value
  const entries = Object.entries(value).map(([key, v]) => [
    key,
    key === 'ts' && typeof v === 'number' ? v + offset : shiftTimestamps(v, offset)
  ])
  return Object.fromEntries(entries) as T
}
