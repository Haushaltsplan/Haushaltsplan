'use client'

import { mergeLiveSnapshot } from '@/lib/fitnessdaten/history-storage'
import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'
import {
  findeGespeichertesWhoopDevice,
  verbindeWhoopStandardHr,
  webBluetoothVerfuegbar,
  type WhoopDeviceAuswahl,
  type WhoopWebBleDebug,
  type WhoopWebBlePhase,
} from '@/lib/fitnessdaten/web-bluetooth-whoop'
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
  onSnapshot: (s: FitnessSnapshot | null) => void
  onPhaseChange?: (p: WhoopWebBlePhase) => void
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

export function WhoopBleProvider({ children, onSnapshot, onPhaseChange }: Props) {
  const [phase, setPhase] = useState<WhoopWebBlePhase>('idle')
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [statusHint, setStatusHint] = useState<string | null>(null)
  const [debug, setDebug] = useState<WhoopWebBleDebug | null>(null)
  const [bleOk] = useState(() => webBluetoothVerfuegbar())

  const disconnectRef = useRef<(() => void) | null>(null)
  const autoReconnectRef = useRef(true)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectingRef = useRef(false)
  const phaseRef = useRef<WhoopWebBlePhase>('idle')

  const setPhaseBoth = useCallback(
    (p: WhoopWebBlePhase) => {
      phaseRef.current = p
      setPhase(p)
      onPhaseChange?.(p)
    },
    [onPhaseChange],
  )

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
      if (merged) onSnapshot(merged)
    },
    [onSnapshot, setPhaseBoth],
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
      connectingRef.current = true
      setFehler(null)
      if (!existingDevice) setStatusHint(null)
      setDebug(null)

      try {
        const session = await verbindeWhoopStandardHr((u) => handleSessionUpdate(u), existingDevice ? 'gespeichert' : auswahl, {
            existingDevice,
            onRemoteDisconnect: (device) => {
              if (!autoReconnectRef.current) return
              if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
              reconnectTimerRef.current = setTimeout(() => {
                void verbindenIntern('gespeichert', device)
              }, 2000)
            },
          },
        )
        disconnectRef.current = session.disconnect
        autoReconnectRef.current = true
        if (!existingDevice) toast.success('WHOOP verbunden')
      } catch {
        /* Fehler in onUpdate */
      } finally {
        connectingRef.current = false
      }
    },
    [bleOk, handleSessionUpdate],
  )

  const verbinden = useCallback(
    async (auswahl: WhoopDeviceAuswahl = 'whoop') => {
      autoReconnectRef.current = true
      await verbindenIntern(auswahl)
    },
    [verbindenIntern],
  )

  const versucheAutoReconnect = useCallback(async () => {
    if (!autoReconnectRef.current || !bleOk) return
    if (phaseRef.current === 'live' || phaseRef.current === 'connecting' || phaseRef.current === 'waiting_hr') {
      return
    }
    if (connectingRef.current) return
    const device = await findeGespeichertesWhoopDevice()
    if (!device) return
    await verbindenIntern('gespeichert', device)
  }, [bleOk, verbindenIntern])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void versucheAutoReconnect()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [versucheAutoReconnect])

  useEffect(() => {
    void versucheAutoReconnect()
  }, [versucheAutoReconnect])

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [])

  return (
    <WhoopBleContext.Provider
      value={{
        phase,
        deviceName,
        fehler,
        statusHint,
        debug,
        bleOk,
        verbinden,
        trennen,
      }}
    >
      {children}
    </WhoopBleContext.Provider>
  )
}
