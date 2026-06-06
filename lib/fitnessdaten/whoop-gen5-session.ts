/**
 * WHOOP 5.0 Custom-Service (fd4b) — Bond, Handshake, r22-Stream, Historie.
 * Benötigt OS-Bond (typisch via WHOOP-App auf demselben Handy).
 */

import {
  buildCursorAckPacket,
  buildGen5InitSequence,
  extractHistoryCursor,
  GEN5_CMD_CHAR,
  GEN5_SERVICE,
  parseGen5Envelope,
  parseGen5Event,
  parseR22Inner,
  type Gen5EventSample,
  type R22Sample,
} from '@/lib/fitnessdaten/whoop-gen5-protocol'

export type Gen5Phase =
  | 'idle'
  | 'subscribing'
  | 'bond_required'
  | 'handshake'
  | 'streaming'
  | 'historical'
  | 'error'

export type Gen5SessionState = {
  phase: Gen5Phase
  log: string[]
  r22Count: number
  historyPackets: number
  lastError: string | null
}

export type Gen5Callbacks = {
  onState: (state: Gen5SessionState) => void
  onR22: (sample: R22Sample) => void
  onEvent: (event: Gen5EventSample) => void
}

function kopiereBytes(data: DataView): Uint8Array {
  return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
}

export async function startGen5CustomSession(
  gatt: BluetoothRemoteGATTServer,
  callbacks: Gen5Callbacks,
): Promise<(() => void) | null> {
  const log: string[] = []
  let phase: Gen5Phase = 'subscribing'
  let r22Count = 0
  let historyPackets = 0
  let seq = 10
  let cmdChar: BluetoothRemoteGATTCharacteristic | null = null
  const listeners: Array<{ char: BluetoothRemoteGATTCharacteristic; fn: (e: Event) => void }> = []

  const emit = (partial: Partial<Gen5SessionState> = {}) => {
    callbacks.onState({
      phase,
      log: [...log],
      r22Count,
      historyPackets,
      lastError: null,
      ...partial,
    })
  }

  let svc: BluetoothRemoteGATTService
  try {
    svc = await gatt.getPrimaryService(GEN5_SERVICE)
  } catch {
    log.push('fd4b0001 nicht gefunden')
    emit({ phase: 'error', lastError: 'Gen5-Service fehlt' })
    return null
  }

  try {
    cmdChar = await svc.getCharacteristic(GEN5_CMD_CHAR)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log.push(`CMD-Char: ${msg}`)
    if (msg.includes('Authentication') || msg.includes('Insufficient')) {
      emit({ phase: 'bond_required', lastError: 'Bond nötig — WHOOP-App einmal koppeln' })
    } else {
      emit({ phase: 'error', lastError: msg })
    }
    return null
  }

  const chars = await svc.getCharacteristics()
  let subscribed = 0
  for (const char of chars) {
    if (!char.properties.notify) continue
    if (char.uuid.toLowerCase() === GEN5_CMD_CHAR.toLowerCase()) continue

    const handler = (event: Event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic
      const val = target.value
      if (!val) return
      const raw = kopiereBytes(val)
      const frame = parseGen5Envelope(raw)
      if (!frame) return

      if (frame.type === 0x2f) {
        const sample = parseR22Inner(frame.inner)
        if (sample && sample.heartRateBpm > 0) {
          r22Count++
          callbacks.onR22(sample)
          emit()
        }
      }

      const ev = parseGen5Event(frame.inner)
      if (ev) callbacks.onEvent(ev)

      const cursor = extractHistoryCursor(frame.inner)
      if (cursor && cmdChar) {
        historyPackets++
        phase = 'historical'
        void cmdChar
          .writeValue(new Uint8Array(buildCursorAckPacket(seq++, cursor)))
          .then(() => emit())
          .catch(() => {
            /* ignore */
          })
      }
    }

    try {
      char.addEventListener('characteristicvaluechanged', handler)
      await char.startNotifications()
      listeners.push({ char, fn: handler })
      subscribed++
      log.push(`NOTIFY OK: ${char.uuid.slice(0, 8)}…`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log.push(`NOTIFY ${char.uuid.slice(0, 8)}: ${msg.slice(0, 40)}`)
      if (msg.includes('Authentication') || msg.includes('Insufficient')) {
        phase = 'bond_required'
      }
    }
  }

  if (subscribed === 0) {
    emit({
      phase: 'bond_required',
      lastError: 'Kein NOTIFY-Kanal — Android-Bond via WHOOP-App nötig',
    })
    return () => {
      for (const { char, fn } of listeners) {
        try {
          char.removeEventListener('characteristicvaluechanged', fn)
          void char.stopNotifications()
        } catch {
          /* ignore */
        }
      }
    }
  }

  emit({ phase: 'handshake' })

  const initPackets = buildGen5InitSequence(seq)
  seq += initPackets.length
  for (let i = 0; i < initPackets.length; i++) {
    try {
      await cmdChar.writeValue(new Uint8Array(initPackets[i]!))
      log.push(`Handshake ${i + 1}/${initPackets.length} OK`)
      emit()
      await new Promise((r) => setTimeout(r, 120))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log.push(`Handshake ${i + 1} fehlgeschlagen: ${msg.slice(0, 50)}`)
      if (msg.includes('Authentication') || msg.includes('Insufficient')) {
        emit({ phase: 'bond_required', lastError: msg })
        break
      }
    }
  }

  phase = 'streaming'
  emit()

  return () => {
    for (const { char, fn } of listeners) {
      try {
        char.removeEventListener('characteristicvaluechanged', fn)
        void char.stopNotifications()
      } catch {
        /* ignore */
      }
    }
    phase = 'idle'
    emit()
  }
}
