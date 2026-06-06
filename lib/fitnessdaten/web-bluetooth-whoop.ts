import { berechneRmssd, parseStandardHeartRateMeasurement } from '@/lib/fitnessdaten/standard-hr-parse'
import {
  buildGen4WhoopPacket,
  CMD_TOGGLE_BROADCAST_HR,
  CMD_TOGGLE_REALTIME_HR,
} from '@/lib/fitnessdaten/whoop-gen4-packet'
import type { FitnessLiveSample, FitnessSnapshot } from '@/lib/fitnessdaten/types'

const HR_SERVICE_ALIASES = [
  'heart_rate',
  '0000180d-0000-1000-8000-00805f9b34fb',
  0x180d,
] as const

const HR_CHAR_ALIASES = [
  'heart_rate_measurement',
  '00002a37-0000-1000-8000-00805f9b34fb',
  0x2a37,
] as const

const WHOOP_CMD_SERVICES = [
  'fd4b0001-cce1-4033-93ce-002d5875f58a',
  '61080001-8d6d-82b8-614a-1c8cb0f8dcc6',
] as const

const WHOOP_CMD_CHARS = [
  'fd4b0002-cce1-4033-93ce-002d5875f58a',
  '61080002-8d6d-82b8-614a-1c8cb0f8dcc6',
] as const

const OPTIONAL_SERVICES = [
  ...HR_SERVICE_ALIASES,
  ...WHOOP_CMD_SERVICES,
  'battery_service',
  'device_information',
] as const

export type WhoopWebBlePhase = 'idle' | 'connecting' | 'live' | 'waiting_hr' | 'error'

export type WhoopWebBleDebug = {
  services: string[]
  notifyCount: number
  lastRawHex: string | null
  enableLog: string[]
  batteryPercent: number | null
  hrCharUuid: string | null
  stuckSinceMs: number | null
}

export function webBluetoothVerfuegbar(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export function istMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
}

export type WhoopWebBleSession = {
  phase: WhoopWebBlePhase
  deviceName: string | null
  snapshot: FitnessSnapshot | null
  error: string | null
  statusHint: string | null
  debug: WhoopWebBleDebug
  disconnect: () => void
}

function uuidKurz(uuid: string): string {
  const u = uuid.toLowerCase().replace(/-/g, '')
  if (u.length <= 8) return u
  return u.slice(4, 8)
}

function bytesToHex(data: DataView): string {
  const p: string[] = []
  for (let i = 0; i < Math.min(data.byteLength, 24); i++) {
    p.push(data.getUint8(i).toString(16).padStart(2, '0'))
  }
  return p.join(' ')
}

async function leseBatteryProzent(gatt: BluetoothRemoteGATTServer): Promise<number | null> {
  try {
    const svc = await gatt.getPrimaryService('battery_service')
    const chr = await svc.getCharacteristic('battery_level')
    const val = await chr.readValue()
    if (val.byteLength >= 1) return val.getUint8(0)
  } catch {
    /* optional */
  }
  return null
}

async function listeServices(gatt: BluetoothRemoteGATTServer): Promise<string[]> {
  try {
    const services = await gatt.getPrimaryServices()
    return services.map((s) => s.uuid)
  } catch {
    return []
  }
}

async function findeHeartRateCharacteristic(
  gatt: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic> {
  for (const svc of HR_SERVICE_ALIASES) {
    for (const chr of HR_CHAR_ALIASES) {
      try {
        const service = await gatt.getPrimaryService(svc)
        return await service.getCharacteristic(chr)
      } catch {
        /* next */
      }
    }
  }

  const services = await gatt.getPrimaryServices()
  for (const service of services) {
    let chars: BluetoothRemoteGATTCharacteristic[] = []
    try {
      chars = await service.getCharacteristics()
    } catch {
      continue
    }
    for (const c of chars) {
      const kurz = uuidKurz(c.uuid)
      if (kurz === '2a37') return c
    }
  }

  throw new Error('Heart-Rate-Service (0x180D) nicht am WHOOP gefunden.')
}

async function versucheWhoopStreamingAktivieren(
  gatt: BluetoothRemoteGATTServer,
): Promise<string[]> {
  const log: string[] = []
  let seq = 0

  const schreibe = async (cmd: number, payload: number[], label: string) => {
    const packet = buildGen4WhoopPacket(seq++, cmd, payload)
    for (const svcUuid of WHOOP_CMD_SERVICES) {
      for (const chrUuid of WHOOP_CMD_CHARS) {
        try {
          const svc = await gatt.getPrimaryService(svcUuid)
          const chr = await svc.getCharacteristic(chrUuid)
          await chr.writeValue(new Uint8Array(packet))
          log.push(`${label}: OK (${uuidKurz(svcUuid)})`)
          return
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          if (msg.includes('Authentication') || msg.includes('Not permitted')) {
            log.push(`${label}: Auth nötig (${uuidKurz(svcUuid)})`)
          }
        }
      }
    }
    log.push(`${label}: nicht geschrieben`)
  }

  await schreibe(CMD_TOGGLE_REALTIME_HR, [0x01], 'Realtime-HR')
  await schreibe(CMD_TOGGLE_BROADCAST_HR, [0x01], 'Broadcast-HR')

  return log
}

function snapshotAusHr(
  device: BluetoothDevice,
  heartRateBpm: number,
  rrRing: number[],
  rmssd: number | null,
): FitnessSnapshot {
  const live: FitnessLiveSample = {
    heartRateBpm,
    rrIntervalsMs: [...rrRing],
    skinTempC: null,
    accel: null,
    recordedAt: new Date().toISOString(),
  }
  return {
    updatedAt: new Date().toISOString(),
    deviceName: device.name ?? undefined,
    connectionState: 'live',
    live,
    scores: rmssd != null ? { hrvRmssdMs: rmssd } : null,
  }
}

/** WHOOP 5.0: Standard-HR (0x180D) im Browser. */
export async function verbindeWhoopStandardHr(
  onUpdate: (session: Omit<WhoopWebBleSession, 'disconnect'>) => void,
): Promise<WhoopWebBleSession> {
  const debug: WhoopWebBleDebug = {
    services: [],
    notifyCount: 0,
    lastRawHex: null,
    enableLog: [],
    batteryPercent: null,
    hrCharUuid: null,
    stuckSinceMs: null,
  }

  const emit = (partial: Omit<WhoopWebBleSession, 'disconnect' | 'debug'>) => {
    onUpdate({ ...partial, debug: { ...debug } })
  }

  if (!webBluetoothVerfuegbar()) {
    const err = 'Web Bluetooth wird hier nicht unterstützt (Chrome/Edge auf HTTPS nötig).'
    emit({ phase: 'error', deviceName: null, snapshot: null, error: err, statusHint: null })
    throw new Error(err)
  }

  emit({
    phase: 'connecting',
    deviceName: null,
    snapshot: null,
    error: null,
    statusHint: 'Gerät wird verbunden …',
  })

  const bluetooth = navigator.bluetooth!
  let device: BluetoothDevice
  try {
    device = await bluetooth.requestDevice({
      filters: [{ namePrefix: 'WHOOP' }],
      optionalServices: [...OPTIONAL_SERVICES],
    })
  } catch (e) {
    const msg = e instanceof Error && e.name === 'NotFoundError' ? 'Kein WHOOP ausgewählt.' : 'Verbindung abgebrochen.'
    emit({ phase: 'error', deviceName: null, snapshot: null, error: msg, statusHint: null })
    throw e
  }

  const rrRing: number[] = []
  const maxRr = 120
  let letzteHrZeit = 0
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const gatt = await device.gatt!.connect()
  debug.services = await listeServices(gatt)
  debug.batteryPercent = await leseBatteryProzent(gatt)

  debug.enableLog = await versucheWhoopStreamingAktivieren(gatt)
  await new Promise((r) => setTimeout(r, 400))

  const char = await findeHeartRateCharacteristic(gatt)
  debug.hrCharUuid = char.uuid

  const verbindungsStart = Date.now()
  debug.stuckSinceMs = verbindungsStart

  const verarbeiteHrBytes = (data: DataView | null | undefined) => {
    if (!data || data.byteLength === 0) return
    debug.notifyCount++
    debug.lastRawHex = bytesToHex(data)
    const parsed = parseStandardHeartRateMeasurement(data)
    if (!parsed) return
    if (parsed.heartRateBpm <= 0) {
      emit({
        phase: 'waiting_hr',
        deviceName: device.name ?? 'WHOOP',
        snapshot: null,
        error: null,
        statusHint:
          'Signal da, aber Puls = 0 — Band fest am Handgelenk halten (optischer Sensor braucht Kontakt).',
      })
      return
    }
    letzteHrZeit = Date.now()
    debug.stuckSinceMs = null
    for (const rr of parsed.rrIntervalsMs) {
      rrRing.push(rr)
      if (rrRing.length > maxRr) rrRing.shift()
    }
    const rmssd = berechneRmssd(rrRing)
    emit({
      phase: 'live',
      deviceName: device.name ?? 'WHOOP',
      snapshot: snapshotAusHr(device, parsed.heartRateBpm, rrRing, rmssd),
      error: null,
      statusHint: null,
    })
  }

  const onHr = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic
    verarbeiteHrBytes(target.value)
  }

  char.addEventListener('characteristicvaluechanged', onHr)
  await char.startNotifications()

  try {
    verarbeiteHrBytes(await char.readValue())
  } catch {
    /* notify-only ok */
  }

  pollTimer = setInterval(() => {
    const alterMs = Date.now() - verbindungsStart
    if (debug.notifyCount === 0 && alterMs > 18_000) {
      emit({
        phase: 'waiting_hr',
        deviceName: device.name ?? 'WHOOP',
        snapshot: null,
        error: null,
        statusHint: diagnoseKeinPuls(device.name ?? 'WHOOP', debug.batteryPercent),
      })
    }
    if (Date.now() - letzteHrZeit < 2500) return
    void char
      .readValue()
      .then(verarbeiteHrBytes)
      .catch(() => {
        /* notify-only ok */
      })
  }, 1500)

  const hint = !istMobileBrowser()
    ? 'Am PC verbunden — WHOOP streamt oft zuverlässiger über Chrome auf dem Android-Handy (gleiche Omnia-URL).'
    : 'Verbunden — warte auf ersten Pulswert (10–30 s am Handgelenk).'

  emit({
    phase: 'waiting_hr',
    deviceName: device.name ?? 'WHOOP',
    snapshot: null,
    error: null,
    statusHint: hint,
  })

  const disconnect = () => {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
    try {
      char.removeEventListener('characteristicvaluechanged', onHr)
      void char.stopNotifications()
    } catch {
      /* ignore */
    }
    try {
      gatt.disconnect()
    } catch {
      /* ignore */
    }
    emit({ phase: 'idle', deviceName: null, snapshot: null, error: null, statusHint: null })
  }

  device.addEventListener('gattserverdisconnected', () => {
    if (pollTimer) clearInterval(pollTimer)
    emit({
      phase: 'idle',
      deviceName: device.name ?? null,
      snapshot: null,
      error: 'Verbindung getrennt.',
      statusHint: null,
    })
  })

  return {
    phase: 'waiting_hr',
    deviceName: device.name ?? 'WHOOP',
    snapshot: null,
    error: null,
    statusHint: null,
    debug,
    disconnect,
  }
}

function diagnoseKeinPuls(deviceName: string, batteryPercent: number | null): string {
  const batt =
    batteryPercent != null
      ? ` BLE-Verbindung OK (Akku ${batteryPercent} %), aber kein Puls.`
      : ' Verbunden, aber kein Pulssignal.'
  if (!istMobileBrowser()) {
    return (
      `${deviceName}:${batt} Am Windows-PC liefert WHOOP 5.0 den Standard-Puls (0x180D) oft nicht — das ist eine bekannte Web-Bluetooth-Grenze. ` +
      `Öffne dieselbe Omnia-Seite in Chrome auf deinem Android-Handy, Band am Handgelenk, WHOOP-App geschlossen.`
    )
  }
  return (
    `${deviceName}:${batt} Band fest am Handgelenk (grüner Sensor auf Haut), WHOOP-App beenden, 30 s warten. ` +
    `Wenn „BLE-Signale“ in den Technischen Details bei 0 bleibt: Trennen und neu verbinden.`
  )
}
