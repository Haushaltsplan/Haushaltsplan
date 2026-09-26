/** Verhaltenseinblicke: Logbuch × nächste Recovery/HFV/Schlaf (Whoop-ähnlich lokal). */

import { ladeDailyStore, type WhoopDayRecord } from '@/lib/fitnessdaten/daily-records'
import {
  LOGBUCH_FRAGEN,
  type LogbuchFrageId,
  type LogbuchTagRecord,
} from '@/lib/fitnessdaten/logbuch'
import { isoAddDaysKalender } from '@/lib/fitnessdaten/iso-date'

export type BehaviorInsight = {
  frageId: LogbuchFrageId
  label: string
  /** Mittlere Δ Recovery (Ja-Tage vs Nein-Tage), %-Punkte. */
  deltaRecovery: number | null
  deltaHrv: number | null
  deltaSleepMin: number | null
  nJa: number
  nNein: number
  summary: string
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function nextDayMetrics(
  logDate: string,
  byDate: Map<string, WhoopDayRecord>,
): { recovery: number | null; hrv: number | null; sleepMin: number | null } {
  const next = isoAddDaysKalender(logDate, 1)
  const d = byDate.get(next)
  return {
    recovery: d?.recoveryPercent ?? d?.localRecoveryPercent ?? null,
    hrv: d?.hrvRmssd ?? d?.localHrv ?? null,
    sleepMin: d?.sleepMinutes ?? d?.localSleepMinutes ?? null,
  }
}

/**
 * Korreliert Logbuch-Antworten mit Metriken am Folgetag.
 * Mindestens 3 Ja- und 3 Nein-Tage für eine Aussage.
 */
export function berechneBehaviorInsights(minN = 3): BehaviorInsight[] {
  const store = ladeDailyStore()
  const byDate = new Map(store.days.map((d) => [d.date, d]))
  const logbuch: LogbuchTagRecord[] = store.logbuch ?? []
  const out: BehaviorInsight[] = []

  for (const def of LOGBUCH_FRAGEN) {
    const jaRec: number[] = []
    const neinRec: number[] = []
    const jaHrv: number[] = []
    const neinHrv: number[] = []
    const jaSleep: number[] = []
    const neinSleep: number[] = []

    for (const tag of logbuch) {
      const a = tag.antworten[def.id]
      if (!a) continue
      const m = nextDayMetrics(tag.date, byDate)
      if (a.ja) {
        if (m.recovery != null) jaRec.push(m.recovery)
        if (m.hrv != null) jaHrv.push(m.hrv)
        if (m.sleepMin != null) jaSleep.push(m.sleepMin)
      } else {
        if (m.recovery != null) neinRec.push(m.recovery)
        if (m.hrv != null) neinHrv.push(m.hrv)
        if (m.sleepMin != null) neinSleep.push(m.sleepMin)
      }
    }

    const nJa = Math.max(jaRec.length, jaHrv.length, jaSleep.length)
    const nNein = Math.max(neinRec.length, neinHrv.length, neinSleep.length)
    if (jaRec.length < minN || neinRec.length < minN) {
      out.push({
        frageId: def.id,
        label: def.frage,
        deltaRecovery: null,
        deltaHrv: null,
        deltaSleepMin: null,
        nJa: jaRec.length,
        nNein: neinRec.length,
        summary:
          jaRec.length + neinRec.length < minN * 2
            ? `Noch zu wenig Daten (${jaRec.length + neinRec.length}/${minN * 2} Tage).`
            : `Braucht ≥${minN}× Ja und ≥${minN}× Nein.`,
      })
      continue
    }

    const mJa = mean(jaRec)!
    const mNein = mean(neinRec)!
    const deltaRecovery = Math.round((mJa - mNein) * 10) / 10
    const mhJa = mean(jaHrv)
    const mhNein = mean(neinHrv)
    const deltaHrv =
      mhJa != null && mhNein != null ? Math.round((mhJa - mhNein) * 10) / 10 : null
    const msJa = mean(jaSleep)
    const msNein = mean(neinSleep)
    const deltaSleepMin =
      msJa != null && msNein != null ? Math.round(msJa - msNein) : null

    let summary: string
    if (Math.abs(deltaRecovery) < 2) {
      summary = `Kaum Effekt auf Recovery (Δ ${deltaRecovery > 0 ? '+' : ''}${deltaRecovery} %).`
    } else if (deltaRecovery < 0) {
      summary = `Bei „Ja“: Recovery am Folgetag im Schnitt ${Math.abs(deltaRecovery)} % niedriger (n=${nJa}/${nNein}).`
    } else {
      summary = `Bei „Ja“: Recovery am Folgetag im Schnitt +${deltaRecovery} % (n=${nJa}/${nNein}).`
    }

    out.push({
      frageId: def.id,
      label: def.frage,
      deltaRecovery,
      deltaHrv,
      deltaSleepMin,
      nJa,
      nNein,
      summary,
    })
  }

  return out.sort((a, b) => {
    const da = a.deltaRecovery != null ? Math.abs(a.deltaRecovery) : -1
    const db = b.deltaRecovery != null ? Math.abs(b.deltaRecovery) : -1
    return db - da
  })
}

export function topBehaviorInsight(): BehaviorInsight | null {
  const all = berechneBehaviorInsights(3)
  const strong = all.find((i) => i.deltaRecovery != null && Math.abs(i.deltaRecovery) >= 3)
  return strong ?? all.find((i) => i.deltaRecovery != null) ?? null
}
