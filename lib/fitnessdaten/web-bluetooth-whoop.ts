import { berechneRmssd, parseStandardHeartRateMeasurement } from '@/lib/fitnessdaten/standard-hr-parse'
import {
  buildGen4WhoopPacket,
  CMD_TOGGLE_BROADCAST_HR,
  CMD_TOGGLE_REALTIME_HR,
} from '@/lib/fitnessdaten/whoop-gen4-packet'
import {
  buildGen5WhoopPacket,
  GEN5_CMD_TOGGLE_BROADCAST_HR,
} from '@/lib/fitnessdaten/whoop-gen5-packet'
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

const WHOOP_GEN5_SERVICE = 'fd4b0001-cce1-4033-93ce-002d5875f58a'
const WHOOP_GEN5_CMD_CHAR = 'fd4b0002-cce1-4033-93ce-002d5875f58a'
const WHOOP_GEN4_SERVICE = '61080001-8d6d-82b8-614a-1c8cb0f8dcc6'
const WHOOP_GEN4_CMD_CHAR = '61080002-8d6d-82b8-614a-1c8cb0f8dcc6'

const OPTIONAL_SERVICES = [
  ...HR_SERVICE_ALIASES,
  WHOOP_GEN5_SERVICE,
  WHOOP_GEN4_SERVICE,
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
  hrCharProps: string | null
  notifyStarted: boolean
  readErrors: number
  stuckSinceMs: number | null
  istGen5: boolean
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

function kopiereDataView(data: DataView): DataView {
  const copy = new Uint8Array(data.byteLength)
  for (let i = 0; i < data.byteLength; i++) copy[i] = data.getUint8(i)
  return new DataView(copy.buffer)
}

function bytesToHex(data: DataView): string {
  const p: string[] = []
  for (let i = 0; i < Math.min(data.byteLength, 24); i++) {
    p.push(data.getUint8(i).toString(16).padStart(2, '0'))
  }
  return p.join(' ')
}

function charProps(char: BluetoothRemoteGATTCharacteristic): string {
  const p: string[] = []
  if (char.properties.read) p.push('read')
  if (char.properties.write) p.push('write')
  if (char.properties.writeWithoutResponse) p.push('writeWoResp')
  if (char.properties.notify) p.push('notify')
  if (char.properties.indicate) p.push('indicate')
  return p.join(',') || '?'
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

function istGen5Whoop(services: string[]): boolean {
  return services.some((u) => u.toLowerCase().includes('fd4b0001'))
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
      if (uuidKurz(c.uuid) === '2a37') return c
    }
  }

  throw new Error('Heart-Rate-Service (0x180D) nicht am WHOOP gefunden.')
}

async function schreibeCmd(
  gatt: BluetoothRemoteGATTServer,
  serviceUuid: string,
  charUuid: string,
  packet: Uint8Array,
  label: string,
): Promise<string> {
  try {
    const svc = await gatt.getPrimaryService(serviceUuid)
    const chr = await svc.getCharacteristic(charUuid)
    await chr.writeValue(new Uint8Array(packet))
    return `${label}: OK (${uuidKurz(serviceUuid)})`
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('Authentication') || msg.includes('Not permitted') || msg.includes('Insufficient')) {
      return `${label}: Auth/Bond nötig (${uuidKurz(serviceUuid)})`
    }
    return `${label}: ${msg.slice(0, 60)}`
  }
}

/** Versucht Broadcast-HR per Kommando (0x0e) — wie Schalter in der WHOOP-App. */
async function versucheBroadcastHrAktivieren(
  gatt: BluetoothRemoteGATTServer,
  gen5: boolean,
): Promise<string[]> {
  const log: string[] = []
  let seq = 0

  if (gen5) {
    const gen5Pkt = buildGen5WhoopPacket(seq++, GEN5_CMD_TOGGLE_BROADCAST_HR, 0x01, [0x01])
    log.push(await schreibeCmd(gatt, WHOOP_GEN5_SERVICE, WHOOP_GEN5_CMD_CHAR, gen5Pkt, 'Gen5 Broadcast-HR'))
  }

  const gen4Pkt = buildGen4WhoopPacket(seq, CMD_TOGGLE_BROADCAST_HR, [0x01])
  log.push(await schreibeCmd(gatt, WHOOP_GEN5_SERVICE, WHOOP_GEN5_CMD_CHAR, gen4Pkt, 'Gen4-Frame Broadcast (fd4b)'))
  log.push(await schreibeCmd(gatt, WHOOP_GEN4_SERVICE, WHOOP_GEN4_CMD_CHAR, gen4Pkt, 'Gen4-Frame Broadcast (6108)'))

  const realtimePkt = buildGen4WhoopPacket(seq + 1, CMD_TOGGLE_REALTIME_HR, [0x01])
  log.push(await schreibeCmd(gatt, WHOOP_GEN5_SERVICE, WHOOP_GEN5_CMD_CHAR, realtimePkt, 'Gen4 Realtime-HR (fd4b)'))

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
    hrCharProps: null,
    notifyStarted: false,
    readErrors: 0,
    stuckSinceMs: null,
    istGen5: false,
  }

  let letzterPhase: WhoopWebBlePhase = 'idle'
  let letzterDeviceName: string | null = null
  let letzterSnapshot: FitnessSnapshot | null = null
  let letzterFehler: string | null = null
  let letzterHint: string | null = null

  const emit = (partial: Omit<WhoopWebBleSession, 'disconnect' | 'debug'>) => {
    letzterPhase = partial.phase
    letzterDeviceName = partial.deviceName
    letzterSnapshot = partial.snapshot
    letzterFehler = partial.error
    letzterHint = partial.statusHint
    onUpdate({ ...partial, debug: { ...debug } })
  }

  const emitDebug = () => {
    onUpdate({
      phase: letzterPhase,
      deviceName: letzterDeviceName,
      snapshot: letzterSnapshot,
      error: letzterFehler,
      statusHint: letzterHint,
      debug: { ...debug },
    })
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
  let debugTimer: ReturnType<typeof setInterval> | null = null

  const gatt = await device.gatt!.connect()
  debug.services = await listeServices(gatt)
  debug.istGen5 = istGen5Whoop(debug.services)
  debug.batteryPercent = await leseBatteryProzent(gatt)

  const char = await findeHeartRateCharacteristic(gatt)
  debug.hrCharUuid = char.uuid
  debug.hrCharProps = charProps(char)

  const verbindungsStart = Date.now()
  debug.stuckSinceMs = verbindungsStart

  const verarbeiteHrBytes = (data: DataView | null | undefined) => {
    if (!data || data.byteLength === 0) return
    debug.notifyCount++
    debug.lastRawHex = bytesToHex(data)
    emitDebug()
    const parsed = parseStandardHeartRateMeasurement(data)
    if (!parsed) return
    if (parsed.heartRateBpm <= 0) {
      emit({
        phase: 'waiting_hr',
        deviceName: device.name ?? 'WHOOP',
        snapshot: null,
        error: null,
        statusHint:
          'BLE-Signal empfangen, Puls = 0 — Band fest am Handgelenk (grüner Sensor braucht Hautkontakt).',
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
    const value = target.value
    if (!value) return
    verarbeiteHrBytes(kopiereDataView(value))
  }

  char.addEventListener('characteristicvaluechanged', onHr)
  await char.startNotifications()
  debug.notifyStarted = true
  emitDebug()

  try {
    verarbeiteHrBytes(kopiereDataView(await char.readValue()))
  } catch {
    /* notify-only ok */
  }

  debug.enableLog = await versucheBroadcastHrAktivieren(gatt, debug.istGen5)
  emitDebug()

  pollTimer = setInterval(() => {
    const alterMs = Date.now() - verbindungsStart
    if (debug.notifyCount === 0 && alterMs > 15_000) {
      emit({
        phase: 'waiting_hr',
        deviceName: device.name ?? 'WHOOP',
        snapshot: null,
        error: null,
        statusHint: diagnoseKeinPuls(debug),
      })
    }
    if (Date.now() - letzteHrZeit < 2000 && letzteHrZeit > 0) return
    void char
      .readValue()
      .then((v) => verarbeiteHrBytes(kopiereDataView(v)))
      .catch(() => {
        debug.readErrors++
        emitDebug()
      })
  }, 1200)

  debugTimer = setInterval(() => {
    if (letzterPhase === 'waiting_hr' || letzterPhase === 'live') emitDebug()
  }, 2000)

  emit({
    phase: 'waiting_hr',
    deviceName: device.name ?? 'WHOOP',
    snapshot: null,
    error: null,
    statusHint: initialHint(),
  })

  const disconnect = () => {
    if (pollTimer) clearInterval(pollTimer)
    if (debugTimer) clearInterval(debugTimer)
    pollTimer = null
    debugTimer = null
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
    if (debugTimer) clearInterval(debugTimer)
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

function initialHint(): string {
  return (
    'Schritt 1: In der WHOOP-App „HR Broadcast“ / „Puls senden“ einschalten (Gerät oben rechts). ' +
    'Schritt 2: Band am Handgelenk — dann hier warten (10–30 s).'
  )
}

function diagnoseKeinPuls(debug: WhoopWebBleDebug): string {
  const batt =
    debug.batteryPercent != null
      ? ` GATT OK (Akku ${debug.batteryPercent} %),`
      : ''
  const authNoetig = debug.enableLog.some((l) => l.includes('Auth/Bond'))

  if (debug.notifyCount === 0) {
    let msg =
      `Kein Pulssignal.${batt} HR-Notify: ${debug.notifyStarted ? 'an' : 'aus'}. ` +
      `Wahrscheinlich fehlt „HR Broadcast“ in der WHOOP-App — dort einschalten, Band am Handgelenk, dann Trennen und neu verbinden.`
    if (authNoetig) {
      msg +=
        ' Broadcast per Kommando scheiterte (Bond nötig) — deshalb unbedingt in der WHOOP-App aktivieren, nicht nur in Omnia verbinden.'
    }
    if (!istMobileBrowser()) {
      msg += ' Am PC streamt WHOOP oft gar nicht; Android-Chrome ist zuverlässiger.'
    }
    return msg
  }

  return 'Signal empfangen, aber kein gültiger Puls — Band am Handgelenk halten.'
}
