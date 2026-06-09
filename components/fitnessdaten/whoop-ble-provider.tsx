'use client'

import { mergeLiveSnapshot, ladeFitnessSnapshot } from '@/lib/fitnessdaten/history-storage'
import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'
import {
  dispatchWhoopBlePhase,
  dispatchWhoopBleSnapshot,
  istWhoopBleAlwaysOn,
  naechstesReconnectDelayMs,
  WHOOP_BLE_RECONNECT_INTERVAL_MS,
  WHOOP_BLE_RECONNECT_FAST_MS,
  WHOOP_SW_MESSAGE,
} from '@/lib/fitnessdaten/whoop-ble-keepalive'
import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { warteAufOmniaNativeBereit } from '@/lib/fitnessdaten/omnia-native-ready'
import {
  findeGespeichertesWhoopDevice,
  startWhoopNaeheWatcher,
  verbindeWhoopBle,
  whoopBleHinweis,
  whoopBleVerfuegbar,
  type WhoopDeviceAuswahl,
  type WhoopWebBleDebug,
  type WhoopWebBlePhase,
} from '@/lib/fitnessdaten/whoop-ble-connect'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import toast from 'react-hot-toast'

type WhoopBleContextValue = {
  phase: WhoopWebBlePhase
  deviceName: string | null
  fehler: string | null
  statusHint: string | null
  debug: WhoopWebBleDebug | null
  bleOk: boolean
  snapshot: FitnessSnapshot | null
  verbinden: (auswahl?: WhoopDeviceAuswahl) => Promise<void>
  trennen: () => void
}

const WhoopBleContext = createContext<WhoopBleContextValue | null>(null)

export function useWhoopBle(): WhoopBleContextValue {
  const ctx = useContext(WhoopBleContext)
  if (!ctx) throw new Error('useWhoopBle nur innerhalb WhoopBleProvider')
  return ctx
}

type Props = {
  children: ReactNode
}

function snapshotAusSession(
  snapshot: FitnessSnapshot | null,
  gen5: FitnessSnapshot['gen5'],
): FitnessSnapshot | null {
  if (!snapshot) return null
  const snap = gen5 ? { ...snapshot, gen5: gen5 ?? snapshot.gen5 } : snapshot
  if (snap.syncBackfill) return snap
  if (snap.live?.heartRateBpm != null && snap.live.heartRateBpm > 0) {
    return mergeLiveSnapshot(snap, snap.deviceInfo)
  }
  if (snap.live?.accel || snap.live?.skinTempC != null || snap.gen5) {
    return mergeLiveSnapshot(snap, snap.deviceInfo)
  }
  if (snap.gen5) return snap
  return null
}

export function WhoopBleProvider({ children }: Props) {
  const [phase, setPhase] = useState<WhoopWebBlePhase>('idle')
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [statusHint, setStatusHint] = useState<string | null>(null)
  const [debug, setDebug] = useState<WhoopWebBleDebug | null>(null)
  const [snapshot, setSnapshot] = useState<FitnessSnapshot | null>(null)
  const [bleOk, setBleOk] = useState(() => whoopBleVerfuegbar())

  const disconnectRef = useRef<(() => void) | null>(null)
  const autoReconnectRef = useRef(true)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectingRef = useRef(false)
  const phaseRef = useRef<WhoopWebBlePhase>('idle')
  const reconnectVersucheRef = useRef(0)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const verbindenInternRef = useRef<
    (auswahl: WhoopDeviceAuswahl, existingDevice?: BluetoothDevice) => Promise<void>
  >(async () => {})

  const setPhaseBoth = useCallback((p: WhoopWebBlePhase) => {
    phaseRef.current = p
    setPhase(p)
    dispatchWhoopBlePhase(p)
  }, [])

  const publishSnapshot = useCallback((merged: FitnessSnapshot | null) => {
    if (!merged) return
    setSnapshot(merged)
    dispatchWhoopBleSnapshot(merged)
  }, [])

  const scheduleReconnect = useCallback((device?: BluetoothDevice, fast = false) => {
    if (!istWhoopBleAlwaysOn() || !autoReconnectRef.current) return
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    const delay = fast
      ? WHOOP_BLE_RECONNECT_FAST_MS
      : naechstesReconnectDelayMs(reconnectVersucheRef.current)
    reconnectTimerRef.current = setTimeout(() => {
      void verbindenInternRef.current('gespeichert', device)
    }, delay)
  }, [])

  const handleSessionUpdate = useCallback(
    (u: {
      phase: WhoopWebBlePhase
      deviceName: string | null
      snapshot: FitnessSnapshot | null
      error: string | null
      statusHint: string | null
      debug: WhoopWebBleDebug
      gen5: FitnessSnapshot['gen5']
    }) => {
      setPhaseBoth(u.phase)
      setDeviceName(u.deviceName)
      setFehler(u.error)
      setStatusHint(u.statusHint)
      setDebug(u.debug)
      const merged = snapshotAusSession(u.snapshot, u.gen5 ?? u.snapshot?.gen5)
      if (merged) publishSnapshot(merged)
      if (u.phase === 'live') reconnectVersucheRef.current = 0
    },
    [publishSnapshot, setPhaseBoth],
  )

  const trennen = useCallback(() => {
    autoReconnectRef.current = false
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = null
    disconnectRef.current?.()
    disconnectRef.current = null
    connectingRef.current = false
    setPhaseBoth('idle')
    setDeviceName(null)
    setFehler(null)
    setStatusHint(null)
    setDebug(null)
  }, [setPhaseBoth])

  const verbindenIntern = useCallback(
    async (auswahl: WhoopDeviceAuswahl, existingDevice?: BluetoothDevice) => {
      if (connectingRef.current) return
      if (!bleOk) return
      if (!istWhoopBleAlwaysOn() && !autoReconnectRef.current && auswahl === 'gespeichert' && !existingDevice) {
        return
      }

      if (
        phaseRef.current === 'live' ||
        phaseRef.current === 'connecting' ||
        phaseRef.current === 'waiting_hr'
      ) {
        return
      }

      connectingRef.current = true
      setFehler(null)
      if (!existingDevice) setStatusHint(null)
      setDebug(null)

      try {
        const manuell = auswahl === 'whoop' || auswahl === 'alle'
        let device = existingDevice
        if (!manuell && !device) {
          device = (await findeGespeichertesWhoopDevice()) ?? undefined
        }
        if (!manuell && !device) {
          reconnectVersucheRef.current++
          scheduleReconnect(undefined, false)
          return
        }

        const session = await verbindeWhoopBle(
          (u) => handleSessionUpdate(u),
          device ? 'gespeichert' : auswahl,
          {
            existingDevice: device,
            onRemoteDisconnect: (d) => {
              disconnectRef.current = null
              reconnectVersucheRef.current = 0
              scheduleReconnect(d, true)
            },
          },
        )
        disconnectRef.current = session.disconnect
        autoReconnectRef.current = true
        reconnectVersucheRef.current = 0
        if (manuell) toast.success('WHOOP verbunden')
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'WHOOP-Verbindung fehlgeschlagen.'
        setFehler(msg)
        if (auswahl === 'whoop' || auswahl === 'alle') toast.error(msg)
        reconnectVersucheRef.current++
        scheduleReconnect(existingDevice, false)
      } finally {
        connectingRef.current = false
      }
    },
    [bleOk, handleSessionUpdate, scheduleReconnect],
  )

  verbindenInternRef.current = verbindenIntern

  const verbinden = useCallback(
    async (auswahl: WhoopDeviceAuswahl = 'whoop') => {
      autoReconnectRef.current = true
      reconnectVersucheRef.current = 0
      await verbindenIntern(auswahl)
    },
    [verbindenIntern],
  )

  const versucheAutoReconnect = useCallback(async () => {
    if (!istWhoopBleAlwaysOn() || !autoReconnectRef.current || !bleOk) return
    if (phaseRef.current === 'live' || phaseRef.current === 'connecting' || phaseRef.current === 'waiting_hr') {
      return
    }
    if (connectingRef.current) return
    const device = await findeGespeichertesWhoopDevice()
    if (!device) return
    await verbindenIntern('gespeichert', device)
  }, [bleOk, verbindenIntern])

  useEffect(() => {
    setSnapshot(ladeFitnessSnapshot())
    autoReconnectRef.current = istWhoopBleAlwaysOn()
  }, [])

  useEffect(() => {
    if (!istOmniaNativeApp()) return
    void warteAufOmniaNativeBereit().then((ok) => {
      setBleOk(ok && whoopBleVerfuegbar())
      if (!ok) {
        const hint = whoopBleHinweis()
        if (hint) setFehler(hint)
      }
    })
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void versucheAutoReconnect()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('pageshow', onVisible)
    document.addEventListener('resume', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onVisible)
      document.removeEventListener('resume', onVisible)
    }
  }, [versucheAutoReconnect])

  useEffect(() => {
    void versucheAutoReconnect()
  }, [versucheAutoReconnect])

  /** Reconnect auch im Hintergrund-Tab (solange PWA-Prozess läuft). */
  useEffect(() => {
    if (!bleOk || !istWhoopBleAlwaysOn()) return
    const id = window.setInterval(() => {
      void versucheAutoReconnect()
    }, WHOOP_BLE_RECONNECT_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [bleOk, versucheAutoReconnect])

  /** Nähe-Watcher: Android erkennt WHOOP-Werbung → sofort verbinden. */
  useEffect(() => {
    if (!bleOk || !istWhoopBleAlwaysOn()) return
    let stop: (() => void) | null = null
    void startWhoopNaeheWatcher((device) => {
      if (phaseRef.current === 'live') return
      scheduleReconnect(device, true)
    }).then((cleanup) => {
      stop = cleanup
    })
    return () => stop?.()
  }, [bleOk, scheduleReconnect])

  /** Service Worker: Cloud-Sync im Hintergrund → Client reconnectet BLE. */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as { type?: string } | null
      if (data?.type === WHOOP_SW_MESSAGE) void versucheAutoReconnect()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [versucheAutoReconnect])

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [])

  /** Bildschirm wach halten (nur PWA — native App nutzt Foreground Service). */
  useEffect(() => {
    if (istOmniaNativeApp() || !istWhoopBleAlwaysOn() || phase !== 'live') {
      void wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
      return
    }
    if (!('wakeLock' in navigator)) return
    let cancelled = false
    const acquire = async () => {
      try {
        if (cancelled || document.visibilityState !== 'visible') return
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        wakeLockRef.current.addEventListener('release', () => {
          if (!cancelled && phaseRef.current === 'live') void acquire()
        })
      } catch {
        /* Batterie-Einstellungen oder Tab im Hintergrund */
      }
    }
    void acquire()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [phase])

  return (
    <WhoopBleContext.Provider
      value={{
        phase,
        deviceName,
        fehler,
        statusHint,
        debug,
        bleOk,
        snapshot,
        verbinden,
        trennen,
      }}
    >
      {children}
    </WhoopBleContext.Provider>
  )
}
