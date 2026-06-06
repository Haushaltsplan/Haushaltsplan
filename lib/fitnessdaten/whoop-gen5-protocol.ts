/** WHOOP 5.0 Gen5 — Protokoll (Parse, Befehle, r22). */

import { buildGen5WhoopPacket } from '@/lib/fitnessdaten/whoop-gen5-packet'

export { buildGen5WhoopPacket, GEN5_CMD_TOGGLE_BROADCAST_HR } from '@/lib/fitnessdaten/whoop-gen5-packet'

export const GEN5_SERVICE = 'fd4b0001-cce1-4033-93ce-002d5875f58a'
export const GEN5_CMD_CHAR = 'fd4b0002-cce1-4033-93ce-002d5875f58a'
export const GEN5_CMD_FROM = 'fd4b0003-cce1-4033-93ce-002d5875f58a'
export const GEN5_EVENTS = 'fd4b0004-cce1-4033-93ce-002d5875f58a'
export const GEN5_DATA = 'fd4b0005-cce1-4033-93ce-002d5875f58a'
export const GEN5_EXTRA = 'fd4b0007-cce1-4033-93ce-002d5875f58a'

export const GEN5_CMD_GET_HELLO = 0x91
export const GEN5_CMD_GET_ADVERTISING_NAME = 0x8d
export const GEN5_CMD_GET_DATA_RANGE = 0x22
export const GEN5_CMD_SEND_HISTORICAL = 0x16
export const GEN5_CMD_CURSOR_ACK = 0x17
export const GEN5_CMD_SET_CONFIG = 0x78

export const GEN5_TYPE_COMMAND = 0x23
export const GEN5_TYPE_CMD_RESPONSE = 0x24
export const GEN5_TYPE_R22 = 0x2f
export const GEN5_TYPE_METADATA = 0x31
export const GEN5_TYPE_EVENT = 0x30

/** 15 Feature-Flags aus WHOOP-App-Capture (Jude Wilson). */
export const GEN5_SET_CONFIG_FLAGS = [
  'enable_r22_packets',
  'enable_r22_v2_packets',
  'enable_r22_v3_packets',
  'enable_r22_v5_packets',
  'enable_r22_v6_packets',
  'enable_r22_v8_packets',
  'make_hrfm_visible',
  'hr_ch_switching',
  'enable_passive_strap_fit_gen5',
  'enable_sig11_during_sleep',
  'enable_realtime_streaming',
  'enable_historical_offload',
  'sigproc_10_sec_dp',
  'enable_imu_streaming',
  'general_ab_test',
] as const

export type Gen5ParsedFrame = {
  inner: Uint8Array
  type: number
  cmd?: number
  seq?: number
}

export type R22Sample = {
  tsSec: number
  heartRateBpm: number
  heartRate2Bpm: number
  accel: { x: number; y: number; z: number } | null
}

export type Gen5EventSample = {
  eventType: number
  tsSec: number
  batteryPercent: number | null
  skinTempC: number | null
}

/** Entpackt Gen5-Envelope [AA 01 len field crc16 inner crc32]. */
export function parseGen5Envelope(raw: Uint8Array): Gen5ParsedFrame | null {
  if (raw.length < 12 || raw[0] !== 0xaa || raw[1] !== 0x01) return null
  const len = raw[2]! | (raw[3]! << 8)
  const total = len + 8
  if (raw.length < total) return null
  const innerLen = len - 4
  if (innerLen < 4) return null
  const inner = raw.slice(8, 8 + innerLen)
  const type = inner[0]!
  const frame: Gen5ParsedFrame = { inner, type }
  if (type === GEN5_TYPE_COMMAND || type === GEN5_TYPE_CMD_RESPONSE) {
    if (inner.length >= 4) {
      frame.seq = inner[1]
      frame.cmd = inner[2]
    }
  }
  return frame
}

export function buildSetConfigPayload(featureName: string, value = 1): number[] {
  const encoded = new TextEncoder().encode(featureName)
  const name = new Array<number>(32).fill(0)
  for (let i = 0; i < Math.min(32, encoded.length); i++) name[i] = encoded[i]!
  return [...name, value & 0xff, 0, 0, 0]
}

export function buildGen5InitSequence(startSeq = 0): Uint8Array[] {
  const packets: Uint8Array[] = []
  let seq = startSeq
  packets.push(buildGen5WhoopPacket(seq++, GEN5_CMD_GET_HELLO, 0x01))
  packets.push(buildGen5WhoopPacket(seq++, GEN5_CMD_GET_ADVERTISING_NAME, 0x01))
  for (const flag of GEN5_SET_CONFIG_FLAGS) {
    packets.push(
      buildGen5WhoopPacket(seq++, GEN5_CMD_SET_CONFIG, 0x01, buildSetConfigPayload(flag, 1)),
    )
  }
  packets.push(buildGen5WhoopPacket(seq++, GEN5_CMD_GET_DATA_RANGE, 0x00))
  packets.push(buildGen5WhoopPacket(seq++, GEN5_CMD_SEND_HISTORICAL, 0x00))
  return packets
}

/** r22-Payload (112-Byte-Variante, Jude Wilson). */
export function parseR22Inner(inner: Uint8Array): R22Sample | null {
  if (inner[0] !== GEN5_TYPE_R22) return null
  const payload = inner.slice(4)
  if (payload.length < 49) return null
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  const tsSec = view.getUint32(7, true)
  const heartRateBpm = payload[14] ?? 0
  const heartRate2Bpm = payload.length > 29 ? (payload[29] ?? 0) : 0
  let accel: R22Sample['accel'] = null
  try {
    accel = {
      x: view.getFloat32(37, true),
      y: view.getFloat32(41, true),
      z: view.getFloat32(45, true),
    }
    const mag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2)
    if (!Number.isFinite(mag) || mag > 20) accel = null
  } catch {
    accel = null
  }
  return { tsSec, heartRateBpm, heartRate2Bpm, accel }
}

/** Metadata 0x31 — Cursor für Historical-ACK (Bytes 13–20 der Inner). */
export function extractHistoryCursor(inner: Uint8Array): Uint8Array | null {
  if (inner[0] !== GEN5_TYPE_METADATA || inner.length < 21) return null
  return inner.slice(13, 21)
}

export function buildCursorAckPacket(seq: number, cursor: Uint8Array): Uint8Array {
  return buildGen5WhoopPacket(seq, GEN5_CMD_CURSOR_ACK, 0x01, [...cursor])
}

/** Event 0x30 — u.a. Batterie (3), Temperatur (17). */
export function parseGen5Event(inner: Uint8Array): Gen5EventSample | null {
  if (inner[0] !== GEN5_TYPE_EVENT || inner.length < 12) return null
  const view = new DataView(inner.buffer, inner.byteOffset, inner.byteLength)
  const eventType = view.getUint16(6, true)
  const tsSec = view.getUint32(8, true)
  const payload = inner.slice(12)
  let batteryPercent: number | null = null
  let skinTempC: number | null = null
  if (eventType === 3 && payload.length >= 4) {
    batteryPercent = Math.min(100, Math.max(0, view.getUint32(12, true) / 10))
  }
  if (eventType === 17 && payload.length >= 2) {
    skinTempC = view.getInt16(12, true) / 10
  }
  return { eventType, tsSec, batteryPercent, skinTempC }
}
