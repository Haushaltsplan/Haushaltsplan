/**
 * Rohpaket-Rekorder für BLE-Protokollanalyse (WHOOP Gen5 + Standard-HR).
 * Hält je Kanal/Pakettyp die ersten und die neuesten Pakete, damit seltene Typen
 * (Events, Metadaten) nicht von tausenden r22-Paketen verdrängt werden.
 */

import { safeLocalStorageSetItem } from '@/lib/local-storage-safe'

const STORAGE_KEY = 'mein-haushalt:whoop-ble-rohpakete'
const ERSTE_PRO_TYP = 5
const NEUESTE_PRO_TYP = 15
const SPEICHER_INTERVALL_MS = 5000

export type BleRohpaket = {
  t: number
  kanal: string
  typ: string
  len: number
  hex: string
}

type Gruppe = { erste: BleRohpaket[]; neueste: BleRohpaket[]; anzahl: number }

type RecorderState = {
  gruppen: Record<string, Gruppe>
  geraet: string | null
  firmware: string | null
}

let state: RecorderState | null = null
let speicherTimer: ReturnType<typeof setTimeout> | null = null
const listener = new Set<() => void>()

function lade(): RecorderState {
  if (state) return state
  state = { gruppen: {}, geraet: null, firmware: null }
  if (typeof window === 'undefined') return state
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) state = { ...state, ...(JSON.parse(raw) as RecorderState) }
  } catch {
    /* ignore */
  }
  return state
}

function planeSpeichern(): void {
  if (typeof window === 'undefined' || speicherTimer) return
  speicherTimer = setTimeout(() => {
    speicherTimer = null
    if (state) safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(state))
  }, SPEICHER_INTERVALL_MS)
}

function benachrichtige(): void {
  for (const fn of listener) fn()
}

function hexAus(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) {
    s += (i ? ' ' : '') + bytes[i]!.toString(16).padStart(2, '0')
  }
  return s
}

/** Gen5-Envelope AA 01 … → Typ = erstes Byte des Inner-Frames (Offset 8). */
function typVon(kanal: string, bytes: Uint8Array): string {
  if (kanal === '2a37') return 'hr'
  if (bytes.length >= 9 && bytes[0] === 0xaa && bytes[1] === 0x01) {
    return `0x${bytes[8]!.toString(16).padStart(2, '0')}`
  }
  return 'fragment'
}

export function kanalKurz(uuid: string): string {
  const u = uuid.toLowerCase().replace(/-/g, '')
  return u.length <= 8 ? u : u.slice(4, 8)
}

export function zeichneBlePaketAuf(kanalUuid: string, bytes: Uint8Array): void {
  if (bytes.length === 0) return
  const s = lade()
  const kanal = kanalKurz(kanalUuid)
  const typ = typVon(kanal, bytes)
  const key = `${kanal}|${typ}`
  const g = (s.gruppen[key] ??= { erste: [], neueste: [], anzahl: 0 })
  const paket: BleRohpaket = { t: Date.now(), kanal, typ, len: bytes.length, hex: hexAus(bytes) }
  g.anzahl++
  if (g.erste.length < ERSTE_PRO_TYP) g.erste.push(paket)
  else {
    g.neueste.push(paket)
    if (g.neueste.length > NEUESTE_PRO_TYP) g.neueste.shift()
  }
  planeSpeichern()
  benachrichtige()
}

export function setzeBleRekorderGeraet(name: string | null, firmware: string | null): void {
  const s = lade()
  s.geraet = name
  s.firmware = firmware
  planeSpeichern()
}

export function bleRohpaketAnzahl(): number {
  return Object.values(lade().gruppen).reduce((a, g) => a + g.anzahl, 0)
}

export function abonniereBleRekorder(fn: () => void): () => void {
  listener.add(fn)
  return () => {
    listener.delete(fn)
  }
}

export function loescheBleRohpakete(): void {
  state = { gruppen: {}, geraet: state?.geraet ?? null, firmware: state?.firmware ?? null }
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY)
  benachrichtige()
}

function uhrzeit(t: number): string {
  return new Date(t).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Text zum Einfügen in eine KI / Protokollanalyse. */
export function exportiereBleRohpaketeText(): string {
  const s = lade()
  const zeilen: string[] = [
    '# WHOOP BLE-Rohpakete (Omnia Whoop)',
    `Gerät: ${s.geraet ?? 'unbekannt'} · Firmware: ${s.firmware ?? 'unbekannt'}`,
    `Export: ${new Date().toLocaleString('de-DE')}`,
    '',
    'Kanäle: 2a37 = Standard Heart Rate Measurement; fd4b0003/0004/0005/0007 = WHOOP Gen5 Notify.',
    'Gen5-Envelope: [AA 01][len u16 LE][field u16][crc16] + Inner + [crc32]. Inner[0] = Pakettyp',
    '(0x24 Cmd-Response, 0x2F r22 Echtzeit, 0x30 Event, 0x31 Metadaten/History-Cursor).',
    'Bisher dekodiert in r22 (Payload = Inner ab Byte 4): u32 LE Zeitstempel @7, Puls @14,',
    'Puls2 @29, Beschleunigung float32 LE x/y/z @37/41/45. Event: u16 Typ @6, u32 ts @8,',
    'Typ 3 = Akku (u32/10 @12), Typ 17 = Hauttemperatur (i16/10 @12). Rest unbekannt.',
    '„fragment“ = Notification ohne AA-01-Kopf (Fortsetzung eines längeren Frames).',
    '',
  ]
  const gruppen = Object.entries(s.gruppen).sort(([a], [b]) => a.localeCompare(b))
  if (gruppen.length === 0) {
    zeilen.push('(Noch keine Pakete aufgezeichnet — WHOOP verbinden und einige Minuten tragen.)')
  }
  for (const [key, g] of gruppen) {
    const [kanal, typ] = key.split('|')
    zeilen.push(`## Kanal ${kanal} · Typ ${typ} · ${g.anzahl} empfangen`)
    for (const p of [...g.erste, ...g.neueste]) {
      zeilen.push(`${uhrzeit(p.t)} [${p.len} B] ${p.hex}`)
    }
    zeilen.push('')
  }
  return zeilen.join('\n')
}
