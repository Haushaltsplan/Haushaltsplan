import { berechneRmssd, parseStandardHeartRateMeasurement } from '@/lib/fitnessdaten/standard-hr-parse'
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

export type WhoopWebBlePhase = 'idle' | 'connecting' | 'live' | 'waiting_hr' | 'error'

export function webBluetoothVerfuegbar(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export type WhoopWebBleSession = {
  phase: WhoopWebBlePhase
  deviceName: string | null
  snapshot: FitnessSnapshot | null
  error: string | null
  statusHint: string | null
  disconnect: () => void
}

function uuidKurz(uuid: string): string {
  const u = uuid.toLowerCase().replace(/-/g, '')
  if (u.length <= 8) return u
  return u.slice(4, 8)
}

async function findeHeartRateCharacteristic(
  gatt: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic> {
  // 1) Explizite Aliase
  for (const svc of HR_SERVICE_ALIASES) {
    for (const chr of HR_CHAR_ALIASES) {
      try {
        const service = await gatt.getPrimaryService(svc)
        return await service.getCharacteristic(chr)
      } catch {
        /* nächster Versuch */
      }
    }
  }

  // 2) Alle Services durchsuchen (WHOOP kann HR unter anderem Handle exposen)
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
      if (kurz === '2a37' || kurz.endsWith('2a37')) return c
    }
  }

  throw new Error(
    'Heart-Rate-Service (0x180D) nicht gefunden. Band am Handgelenk tragen und erneut verbinden.',
  )
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

/** WHOOP 5.0: Standard-HR (0x180D) direkt im Browser. */
export async function verbindeWhoopStandardHr(
  onUpdate: (session: Omit<WhoopWebBleSession, 'disconnect'>) => void,
): Promise<WhoopWebBleSession> {
  if (!webBluetoothVerfuegbar()) {
    const err = 'Web Bluetooth wird hier nicht unterstützt (Chrome/Edge auf HTTPS nötig).'
    onUpdate({ phase: 'error', deviceName: null, snapshot: null, error: err, statusHint: null })
    throw new Error(err)
  }

  onUpdate({
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
      optionalServices: [...HR_SERVICE_ALIASES],
    })
  } catch (e) {
    const msg = e instanceof Error && e.name === 'NotFoundError' ? 'Kein WHOOP ausgewählt.' : 'Verbindung abgebrochen.'
    onUpdate({ phase: 'error', deviceName: null, snapshot: null, error: msg, statusHint: null })
    throw e
  }

  const rrRing: number[] = []
  const maxRr = 120
  let letzteHrZeit = 0
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const gatt = await device.gatt!.connect()
  const char = await findeHeartRateCharacteristic(gatt)

  const verarbeiteHrBytes = (data: DataView | null | undefined) => {
    if (!data) return
    const parsed = parseStandardHeartRateMeasurement(data)
    if (!parsed) return
    if (parsed.heartRateBpm <= 0) {
      onUpdate({
        phase: 'waiting_hr',
        deviceName: device.name ?? 'WHOOP',
        snapshot: null,
        error: null,
        statusHint: 'Verbunden — warte auf optischen Puls-Lock (Band fest am Handgelenk, 10–30 s).',
      })
      return
    }
    letzteHrZeit = Date.now()
    for (const rr of parsed.rrIntervalsMs) {
      rrRing.push(rr)
      if (rrRing.length > maxRr) rrRing.shift()
    }
    const rmssd = berechneRmssd(rrRing)
    onUpdate({
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

  // WICHTIG: Listener VOR startNotifications registrieren
  char.addEventListener('characteristicvaluechanged', onHr)
  await char.startNotifications()

  // Einmaliger Sofort-Read (manche Geräte senden erst nach readValue)
  try {
    const initial = await char.readValue()
    verarbeiteHrBytes(initial)
  } catch {
    /* notify-only — normal */
  }

  // Fallback-Polling falls Notifications ausbleiben
  pollTimer = setInterval(() => {
    if (Date.now() - letzteHrZeit < 4000) return
    void char.readValue().then(verarbeiteHrBytes).catch(() => {})
  }, 2000)

  onUpdate({
    phase: 'waiting_hr',
    deviceName: device.name ?? 'WHOOP',
    snapshot: null,
    error: null,
    statusHint: 'Verbunden — warte auf ersten Pulswert …',
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
    onUpdate({ phase: 'idle', deviceName: null, snapshot: null, error: null, statusHint: null })
  }

  device.addEventListener('gattserverdisconnected', () => {
    if (pollTimer) clearInterval(pollTimer)
    onUpdate({
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
    disconnect,
  }
}
