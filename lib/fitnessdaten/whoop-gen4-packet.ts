/** Gen4-WHOOP-Kommando-Frame (whoopsie / whoomp) — Testweise auch an fd4b (5.0) senden. */

const CRC8_TABLE = [
  0, 7, 14, 9, 28, 27, 18, 21, 56, 63, 54, 49, 36, 35, 42, 45,
  112, 119, 126, 121, 108, 107, 98, 101, 72, 79, 70, 65, 84, 83, 90, 93,
  224, 231, 238, 233, 252, 251, 242, 245, 216, 223, 214, 209, 196, 195, 202, 205,
  144, 151, 158, 153, 140, 139, 130, 133, 168, 175, 166, 161, 180, 179, 186, 189,
  199, 192, 201, 206, 219, 220, 213, 210, 255, 248, 241, 246, 227, 228, 237, 234,
  183, 176, 185, 190, 171, 172, 165, 162, 143, 136, 129, 134, 147, 148, 157, 154,
  39, 32, 41, 46, 59, 60, 53, 50, 31, 24, 17, 22, 3, 4, 13, 10,
  87, 80, 89, 94, 75, 76, 69, 66, 111, 104, 97, 102, 115, 116, 125, 122,
  137, 142, 135, 128, 149, 146, 155, 156, 177, 182, 191, 184, 173, 170, 163, 164,
  249, 254, 247, 240, 229, 226, 235, 236, 193, 198, 207, 200, 221, 218, 211, 212,
  105, 110, 103, 96, 117, 114, 123, 124, 81, 86, 95, 88, 77, 74, 67, 68,
  25, 30, 23, 16, 5, 2, 11, 12, 33, 38, 47, 40, 61, 58, 51, 52,
  78, 73, 64, 71, 82, 85, 92, 91, 118, 113, 120, 127, 106, 109, 100, 99,
  62, 57, 48, 55, 34, 37, 44, 43, 6, 1, 8, 15, 26, 29, 20, 19,
  174, 169, 160, 167, 178, 181, 188, 187, 150, 145, 152, 159, 138, 141, 132, 131,
  222, 217, 208, 215, 194, 197, 204, 203, 230, 225, 232, 239, 250, 253, 244, 243,
]

function crc8(data: number[]): number {
  let crc = 0
  for (const b of data) crc = CRC8_TABLE[(crc ^ b) & 0xff]!
  return crc
}

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

/** TOGGLE_REALTIME_HR = 0x03, Payload [0x01] = an */
export function buildGen4WhoopPacket(seq: number, cmd: number, payload: number[] = []): Uint8Array {
  const inner = [0x23, seq & 0xff, cmd, ...payload]
  const pad = (4 - (inner.length % 4)) % 4
  for (let i = 0; i < pad; i++) inner.push(0)
  const length = inner.length + 4
  const lenBytes = [length & 0xff, (length >> 8) & 0xff]
  const c32 = crc32(inner)
  return new Uint8Array([
    0xaa,
    lenBytes[0]!,
    lenBytes[1]!,
    crc8(lenBytes),
    ...inner,
    c32 & 0xff,
    (c32 >> 8) & 0xff,
    (c32 >> 16) & 0xff,
    (c32 >> 24) & 0xff,
  ])
}

export const CMD_TOGGLE_REALTIME_HR = 0x03
export const CMD_TOGGLE_BROADCAST_HR = 0x0e
