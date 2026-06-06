import {
  markiereGetrennt,
  markiereHistoriePaket,
  markiereSyncFertig,
  markiereSyncStart,
  markiereVerbunden,
  mergeHistoricalEvent,
  mergeHistoricalR22,
  r22ZuTimestampMs,
  verarbeiteSyncPuffer,
} from '@/lib/fitnessdaten/offline-sync'
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
import { abonniereBatteryUpdates, leseWhoopDeviceInfo } from '@/lib/fitnessdaten/device-info'
import type { FitnessHrPoint, FitnessLiveSample, FitnessSnapshot, Gen5StreamStatus, WhoopDeviceInfo } from '@/lib/fitnessdaten/types'
import { startGen5CustomSession, type Gen5SessionState } from '@/lib/fitnessdaten/whoop-gen5-session'
import type { Gen5EventSample, R22Sample } from '@/lib/fitnessdaten/whoop-gen5-protocol'

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
  'fd4b0003-cce1-4033-93ce-002d5875f58a',
  'fd4b0004-cce1-4033-93ce-002d5875f58a',
  'fd4b0005-cce1-4033-93ce-002d5875f58a',
  'fd4b0007-cce1-4033-93ce-002d5875f58a',
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
  gen5: Gen5StreamStatus | null
}

export type WhoopDeviceAuswahl = 'whoop' | 'alle' | 'gespeichert'

/** Schritte wenn WHOOP in der Geräteliste fehlt oder nicht koppelt. */
export const WHOOP_WIEDERHERSTELLUNG = [
  'WHOOP-App öffnen und warten, bis der Strap oben wieder „verbunden“ ist (nicht zuerst Omnia).',
  'Band an Ladeclip oder Handgelenk — 30–60 s warten (grünes Licht / Vibration).',
  'Handy: Bluetooth aus → 10 Sekunden → wieder an.',
  'Android: Einstellungen → Verbundene Geräte → WHOOP → „Verbindung trennen“ / „Entfernen“ (OS-Kopplung, kein Account).',
  'Alle Omnia-/Chrome-Tabs schließen; Chrome aus den letzten Apps wischen.',
  'Falls am PC verbunden war: dort Bluetooth → WHOOP entfernen.',
  '2–3 Minuten warten, WHOOP-App erneut öffnen, dann hier „WHOOP verbinden“ oder „Alle Geräte scannen“.',
] as const

export const WHOOP_NICHT_GEFUNDEN_HINT =
  'WHOOP erscheint nicht in der Liste? Zuerst WHOOP-App öffnen (Strap verbinden), dann unten „Wiederherstellung“ durchgehen.'

function istWhoopName(name: string | undefined): boolean {
  if (!name) return false
  return name.toUpperCase().includes('WHOOP')
}

async function waehleWhoopDevice(bluetooth: Bluetooth, auswahl: WhoopDeviceAuswahl): Promise<BluetoothDevice> {
  if (auswahl === 'gespeichert' && bluetooth.getDevices) {
    const devices = await bluetooth.getDevices()
    const whoop = devices.find((d) => istWhoopName(d.name))
    if (whoop) return whoop
  }

  if (auswahl === 'alle') {
    return bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [...OPTIONAL_SERVICES],
    })
  }

  return bluetooth.requestDevice({
    filters: [{ namePrefix: 'WHOOP' }],
    optionalServices: [...OPTIONAL_SERVICES],
  })
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
  gen5: Gen5StreamStatus | null
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
  hrHistory: FitnessHrPoint[],
  deviceInfo: WhoopDeviceInfo | null,
  sensorContact: boolean | null,
  energyExpendedKj: number | null,
  sessionStartedAt: string,
): FitnessSnapshot {
  const live: FitnessLiveSample = {
    heartRateBpm,
    rrIntervalsMs: [...rrRing],
    skinTempC: null,
    accel: null,
    sensorContact,
    energyExpendedKj,
    recordedAt: new Date().toISOString(),
  }
  return {
    updatedAt: new Date().toISOString(),
    deviceName: device.name ?? undefined,
    connectionState: 'live',
    live,
    scores: rmssd != null ? { hrvRmssdMs: rmssd } : null,
    deviceInfo,
    hrHistory: [...hrHistory],
    sessionStartedAt,
  }
}

/** WHOOP 5.0: Standard-HR (0x180D) im Browser. */
export async function verbindeWhoopStandardHr(
  onUpdate: (session: Omit<WhoopWebBleSession, 'disconnect'>) => void,
  auswahl: WhoopDeviceAuswahl = 'whoop',
): Promise<WhoopWebBleSession> {
  let gen5Status: Gen5StreamStatus | null = null

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
    gen5: null,
  }

  let letzterPhase: WhoopWebBlePhase = 'idle'
  let letzterDeviceName: string | null = null
  let letzterSnapshot: FitnessSnapshot | null = null
  let letzterFehler: string | null = null
  let letzterHint: string | null = null

  const emit = (partial: Omit<WhoopWebBleSession, 'disconnect' | 'debug' | 'gen5'>) => {
    letzterPhase = partial.phase
    letzterDeviceName = partial.deviceName
    letzterSnapshot = partial.snapshot
    letzterFehler = partial.error
    letzterHint = partial.statusHint
    debug.gen5 = gen5Status
    onUpdate({ ...partial, debug: { ...debug }, gen5: gen5Status })
  }

  const emitDebug = () => {
    if (letzterSnapshot) {
      letzterSnapshot = { ...letzterSnapshot, gen5: gen5Status }
    }
    onUpdate({
      phase: letzterPhase,
      deviceName: letzterDeviceName,
      snapshot: letzterSnapshot,
      error: letzterFehler,
      statusHint: letzterHint,
      debug: { ...debug },
      gen5: gen5Status,
    })
  }

  const gen5ToStatus = (s: Gen5SessionState): Gen5StreamStatus => ({
    phase: s.phase,
    r22Count: s.r22Count,
    historyPackets: s.historyPackets,
    lastError: s.lastError,
    log: s.log,
  })

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
    device = await waehleWhoopDevice(bluetooth, auswahl)
    if (auswahl === 'alle' && !istWhoopName(device.name)) {
      emit({
        phase: 'error',
        deviceName: device.name ?? null,
        snapshot: null,
        error: `„${device.name ?? 'Gerät'}“ ist kein WHOOP — bitte WHOOP in der Liste wählen.`,
        statusHint: WHOOP_NICHT_GEFUNDEN_HINT,
      })
      throw new Error('Kein WHOOP gewählt')
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'Kein WHOOP gewählt') throw e
    const notFound = e instanceof Error && e.name === 'NotFoundError'
    const msg = notFound ? 'Kein Gerät ausgewählt oder WHOOP nicht in der Liste.' : 'Verbindung abgebrochen.'
    emit({
      phase: 'error',
      deviceName: null,
      snapshot: null,
      error: msg,
      statusHint: notFound ? WHOOP_NICHT_GEFUNDEN_HINT : null,
    })
    throw e
  }

  const rrRing: number[] = []
  const maxRr = 120
  const hrHistory: FitnessHrPoint[] = []
  const sessionStartedAt = new Date().toISOString()
  let deviceInfo: WhoopDeviceInfo | null = null
  let batteryCleanup: (() => void) | null = null
  let gen5Cleanup: (() => void) | null = null
  let letzteHrZeit = 0
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let debugTimer: ReturnType<typeof setInterval> | null = null

  const gatt = await device.gatt!.connect()
  markiereVerbunden()
  debug.services = await listeServices(gatt)
  debug.istGen5 = istGen5Whoop(debug.services)
  deviceInfo = await leseWhoopDeviceInfo(gatt)
  verarbeiteSyncPuffer(device.name ?? 'WHOOP', deviceInfo)
  debug.batteryPercent = await leseBatteryProzent(gatt)
  if (debug.batteryPercent != null) {
    deviceInfo = { ...deviceInfo, batteryPercent: debug.batteryPercent }
  }
  batteryCleanup = await abonniereBatteryUpdates(gatt, (pct) => {
    debug.batteryPercent = pct
    deviceInfo = { ...(deviceInfo ?? {}), batteryPercent: pct }
    if (letzterSnapshot?.live?.heartRateBpm) {
      emit({
        phase: letzterPhase === 'idle' ? 'live' : letzterPhase,
        deviceName: device.name ?? 'WHOOP',
        snapshot: {
          ...letzterSnapshot,
          deviceInfo,
          updatedAt: new Date().toISOString(),
        },
        error: null,
        statusHint: letzterHint,
      })
    } else {
      emitDebug()
    }
  })

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
    hrHistory.push({ t: Date.now(), bpm: parsed.heartRateBpm })
    if (hrHistory.length > 120) hrHistory.shift()
    emit({
      phase: 'live',
      deviceName: device.name ?? 'WHOOP',
      snapshot: snapshotAusHr(
        device,
        parsed.heartRateBpm,
        rrRing,
        rmssd,
        hrHistory,
        deviceInfo,
        parsed.sensorContact,
        parsed.energyExpendedKj,
        sessionStartedAt,
      ),
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

  const anwendeGen5R22 = (sample: R22Sample) => {
    const t = r22ZuTimestampMs(sample.tsSec)
    const isHistorical =
      gen5Status?.phase === 'historical' || Math.abs(Date.now() - t) > 90_000
    if (isHistorical && sample.heartRateBpm > 0) {
      if (gen5Status?.phase === 'historical') markiereHistoriePaket()
      else markiereSyncStart()
      const merged = mergeHistoricalR22(sample, device.name ?? 'WHOOP', deviceInfo)
      if (merged) {
        emit({
          phase: 'live',
          deviceName: device.name ?? 'WHOOP',
          snapshot: { ...merged, syncBackfill: true, gen5: gen5Status },
          error: null,
          statusHint: 'Synchronisiere gespeicherte Band-Daten …',
        })
      }
      return
    }
    if (!letzterSnapshot?.live) return
    const live: FitnessLiveSample = {
      ...letzterSnapshot.live,
      heartRateBpm: sample.heartRateBpm > 0 ? sample.heartRateBpm : letzterSnapshot.live.heartRateBpm,
      accel: sample.accel ?? letzterSnapshot.live.accel,
      recordedAt: new Date().toISOString(),
    }
    emit({
      phase: 'live',
      deviceName: device.name ?? 'WHOOP',
      snapshot: {
        ...letzterSnapshot,
        updatedAt: new Date().toISOString(),
        live,
        gen5: gen5Status,
      },
      error: null,
      statusHint: null,
    })
  }

  const anwendeGen5Event = (ev: Gen5EventSample) => {
    if (!letzterSnapshot) return
    const merged = mergeHistoricalEvent(ev, letzterSnapshot)
    emit({
      phase: letzterPhase === 'idle' ? 'live' : letzterPhase,
      deviceName: device.name ?? 'WHOOP',
      snapshot: { ...merged, gen5: gen5Status },
      error: null,
      statusHint: letzterHint,
    })
  }

  if (debug.istGen5) {
    gen5Cleanup = await startGen5CustomSession(gatt, {
      onState: (s) => {
        const prev = gen5Status?.phase
        gen5Status = gen5ToStatus(s)
        debug.gen5 = gen5Status
        if (prev === 'historical' && s.phase === 'streaming') {
          markiereSyncFertig()
        }
        if (s.phase === 'historical') markiereSyncStart()
        emitDebug()
      },
      onR22: anwendeGen5R22,
      onEvent: anwendeGen5Event,
    })
  }

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
    batteryCleanup?.()
    batteryCleanup = null
    gen5Cleanup?.()
    gen5Cleanup = null
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
    markiereGetrennt()
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
    gen5: gen5Status,
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
