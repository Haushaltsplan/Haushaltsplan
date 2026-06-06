/** Standard BLE Heart Rate Measurement (0x2A37) — auch WHOOP 5.0 unbonded. */

export function parseStandardHeartRateMeasurement(data: DataView): {
  heartRateBpm: number
  rrIntervalsMs: number[]
} | null {
  if (data.byteLength < 2) return null
  const flags = data.getUint8(0)
  let offset = 1
  let heartRateBpm: number
  if (flags & 0x01) {
    if (data.byteLength < offset + 2) return null
    heartRateBpm = data.getUint16(offset, true)
    offset += 2
  } else {
    heartRateBpm = data.getUint8(offset)
    offset += 1
  }
  const rrIntervalsMs: number[] = []
  if (flags & 0x10) {
    while (offset + 1 < data.byteLength) {
      const raw = data.getUint16(offset, true)
      rrIntervalsMs.push(Math.round((raw * 1000) / 1024))
      offset += 2
    }
  }
  return { heartRateBpm, rrIntervalsMs }
}

export function berechneRmssd(rrMs: number[]): number | null {
  if (rrMs.length < 2) return null
  let sumSq = 0
  let n = 0
  for (let i = 1; i < rrMs.length; i++) {
    const d = rrMs[i]! - rrMs[i - 1]!
    sumSq += d * d
    n++
  }
  if (n === 0) return null
  return Math.round(Math.sqrt(sumSq / n) * 10) / 10
}
