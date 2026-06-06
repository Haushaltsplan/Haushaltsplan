import { berechneRmssd, parseStandardHeartRateMeasurement } from '@/lib/fitnessdaten/standard-hr-parse'
import type { FitnessLiveSample, FitnessSnapshot } from '@/lib/fitnessdaten/types'

const HEART_RATE_SERVICE = 0x180d
const HEART_RATE_MEASUREMENT = 0x2a37

export type WhoopWebBlePhase = 'idle' | 'connecting' | 'live' | 'error'

export function webBluetoothVerfuegbar(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export type WhoopWebBleSession = {
  phase: WhoopWebBlePhase
  deviceName: string | null
  snapshot: FitnessSnapshot | null
  error: string | null
  disconnect: () => void
}

/** WHOOP 5.0: Standard-HR (0x180D) direkt im Browser — kein USB, keine Flutter-App. */
export async function verbindeWhoopStandardHr(
  onUpdate: (session: Omit<WhoopWebBleSession, 'disconnect'>) => void,
): Promise<WhoopWebBleSession> {
  if (!webBluetoothVerfuegbar()) {
    const err = 'Web Bluetooth wird hier nicht unterstützt (Chrome/Edge auf HTTPS nötig).'
    onUpdate({ phase: 'error', deviceName: null, snapshot: null, error: err })
    throw new Error(err)
  }

  onUpdate({ phase: 'connecting', deviceName: null, snapshot: null, error: null })

  const bluetooth = navigator.bluetooth!
  let device: BluetoothDevice
  try {
    device = await bluetooth.requestDevice({
      filters: [{ namePrefix: 'WHOOP' }],
      optionalServices: [HEART_RATE_SERVICE],
    })
  } catch (e) {
    const msg = e instanceof Error && e.name === 'NotFoundError' ? 'Kein WHOOP ausgewählt.' : 'Verbindung abgebrochen.'
    onUpdate({ phase: 'error', deviceName: null, snapshot: null, error: msg })
    throw e
  }

  const rrRing: number[] = []
  const maxRr = 120

  const gatt = await device.gatt!.connect()
  const service = await gatt.getPrimaryService(HEART_RATE_SERVICE)
  const char = await service.getCharacteristic(HEART_RATE_MEASUREMENT)
  await char.startNotifications()

  const onHr = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic
    const parsed = parseStandardHeartRateMeasurement(target.value!)
    if (!parsed || parsed.heartRateBpm <= 0) return
    for (const rr of parsed.rrIntervalsMs) {
      rrRing.push(rr)
      if (rrRing.length > maxRr) rrRing.shift()
    }
    const rmssd = berechneRmssd(rrRing)
    const live: FitnessLiveSample = {
      heartRateBpm: parsed.heartRateBpm,
      rrIntervalsMs: [...rrRing],
      skinTempC: null,
      accel: null,
      recordedAt: new Date().toISOString(),
    }
    onUpdate({
      phase: 'live',
      deviceName: device.name ?? 'WHOOP',
      snapshot: {
        updatedAt: new Date().toISOString(),
        deviceName: device.name ?? undefined,
        connectionState: 'live',
        live,
        scores: rmssd != null ? { hrvRmssdMs: rmssd } : null,
      },
      error: null,
    })
  }

  char.addEventListener('characteristicvaluechanged', onHr)

  const disconnect = () => {
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
    onUpdate({ phase: 'idle', deviceName: null, snapshot: null, error: null })
  }

  device.addEventListener('gattserverdisconnected', () => {
    onUpdate({ phase: 'idle', deviceName: device.name ?? null, snapshot: null, error: 'Verbindung getrennt.' })
  })

  onUpdate({
    phase: 'live',
    deviceName: device.name ?? 'WHOOP',
    snapshot: {
      updatedAt: new Date().toISOString(),
      deviceName: device.name ?? undefined,
      connectionState: 'connecting',
      live: null,
    },
    error: null,
  })

  return {
    phase: 'live',
    deviceName: device.name ?? 'WHOOP',
    snapshot: null,
    error: null,
    disconnect,
  }
}
