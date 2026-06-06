/** WHOOP 5.0 (Gen5) — Frame-Envelope laut Jude Wilson / whoopsie-Erweiterung. */

const CRC32_POLY = 0xedb88320
const CRC32_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? CRC32_POLY ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

function crc32(data: number[]): number {
  let crc = 0xffffffff
  for (const b of data) crc = CRC32_TABLE[(crc ^ b) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function crc16Modbus(bytes: number[]): number {
  let crc = 0xffff
  for (const b of bytes) {
    crc ^= b
    for (let i = 0; i < 8; i++) {
      crc = (crc & 1) !== 0 ? (crc >> 1) ^ 0xa001 : crc >> 1
    }
  }
  return crc & 0xffff
}

/** Inner: [0x23][seq][cmd][b3][payload…], gepadded auf 4-Byte-Grenze. */
export function buildGen5WhoopPacket(
  seq: number,
  cmd: number,
  b3: number,
  payload: number[] = [],
  field = 0x0001,
): Uint8Array {
  const inner = [0x23, seq & 0xff, cmd, b3, ...payload]
  const pad = (4 - (inner.length % 4)) % 4
  for (let i = 0; i < pad; i++) inner.push(0)

  const len = inner.length + 4
  const lenLo = len & 0xff
  const lenHi = (len >> 8) & 0xff
  const fieldLo = field & 0xff
  const fieldHi = (field >> 8) & 0xff
  const headerForCrc = [0xaa, 0x01, lenLo, lenHi, fieldLo, fieldHi]
  const crc16 = crc16Modbus(headerForCrc)
  const c32 = crc32(inner)

  return new Uint8Array([
    0xaa,
    0x01,
    lenLo,
    lenHi,
    fieldLo,
    fieldHi,
    crc16 & 0xff,
    (crc16 >> 8) & 0xff,
    ...inner,
    c32 & 0xff,
    (c32 >> 8) & 0xff,
    (c32 >> 16) & 0xff,
    (c32 >> 24) & 0xff,
  ])
}

/** Broadcast-HR einschalten (wie WHOOP-App „HR Broadcast“). */
export const GEN5_CMD_TOGGLE_BROADCAST_HR = 0x0e
