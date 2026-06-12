/** Bodenbildung & klassische Umkehrmuster (Schlusskurse). */

import type { KursBar } from '@/lib/portfolio-analyse/chartanalyse-engine'

export type BodenKonfidenz = 'hoch' | 'mittel' | 'niedrig'

export type BodenMuster = {
  id: string
  titel: string
  beschreibung: string
  konfidenz: BodenKonfidenz
  /** Index-Bereich im Kursverlauf */
  vonIdx: number
  bisIdx: number
  zonenUnter?: number
  zonenOber?: number
}

function lokaleTiefs(closes: number[], radius = 3): number[] {
  const idx: number[] = []
  for (let i = radius; i < closes.length - radius; i++) {
    let ok = true
    for (let j = i - radius; j <= i + radius; j++) {
      if (j !== i && closes[j]! <= closes[i]!) ok = false
    }
    if (ok) idx.push(i)
  }
  return idx
}

function pctDiff(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(a, b, 1e-9)
}

/** Doppelboden (W): zwei ähnliche Tiefs mit Zwischenhoch. */
function erkenneDoppelboden(closes: number[], daten: string[]): BodenMuster | null {
  if (closes.length < 50) return null
  const tail = closes.slice(-120)
  const tailDaten = daten.slice(-120)
  const offset = closes.length - tail.length
  const tiefs = lokaleTiefs(tail, 4)
  if (tiefs.length < 2) return null

  for (let j = tiefs.length - 1; j >= 1; j--) {
    for (let i = j - 1; i >= 0; i--) {
      const b = tiefs[j]!
      const a = tiefs[i]!
      if (b - a < 10) continue
      const pa = tail[a]!
      const pb = tail[b]!
      if (pctDiff(pa, pb) > 0.03) continue

      const zwischen = tail.slice(a, b + 1)
      const peak = Math.max(...zwischen)
      if (peak < pa * 1.03) continue

      const nachB = tail.slice(b)
      if (nachB.length < 5) continue
      const aktuell = nachB[nachB.length - 1]!
      if (aktuell < peak * 0.98 && aktuell < pa * 1.02) continue

      return {
        id: 'doppelboden',
        titel: 'Doppelboden (W)',
        beschreibung: `Zwei vergleichbare Tiefs bei ${pa.toFixed(2)} / ${pb.toFixed(2)} (${tailDaten[a]} – ${tailDaten[b]}). Zwischenhoch bestätigt die W-Struktur — klassisches Umkehrmuster nach Abwärtsphase.`,
        konfidenz: pctDiff(pa, pb) < 0.015 && aktuell > peak * 0.95 ? 'hoch' : 'mittel',
        vonIdx: offset + a,
        bisIdx: offset + tail.length - 1,
        zonenUnter: Math.min(pa, pb) * 0.98,
        zonenOber: peak,
      }
    }
  }
  return null
}

/** Dreifachboden: drei ähnliche Tiefs. */
function erkenneDreifachboden(closes: number[]): BodenMuster | null {
  if (closes.length < 70) return null
  const tail = closes.slice(-150)
  const offset = closes.length - tail.length
  const tiefs = lokaleTiefs(tail, 4)
  if (tiefs.length < 3) return null

  for (let k = tiefs.length - 1; k >= 2; k--) {
    const c = tiefs[k]!
    const b = tiefs[k - 1]!
    const a = tiefs[k - 2]!
    if (c - a < 20) continue
    const pa = tail[a]!
    const pb = tail[b]!
    const pc = tail[c]!
    if (pctDiff(pa, pb) > 0.035 || pctDiff(pb, pc) > 0.035 || pctDiff(pa, pc) > 0.04) continue
    const avg = (pa + pb + pc) / 3
    return {
      id: 'dreifachboden',
      titel: 'Dreifachboden',
      beschreibung: `Drei Tiefs um ${avg.toFixed(2)} — starke horizontale Unterstützung. Oft langfristiger Boden vor neuem Aufwärtstrend.`,
      konfidenz: 'hoch',
      vonIdx: offset + a,
      bisIdx: offset + tail.length - 1,
      zonenUnter: avg * 0.97,
      zonenOber: avg * 1.06,
    }
  }
  return null
}

/** Inverse SKS (vereinfacht): Schulter – Kopf (tiefer) – Schulter. */
function erkenneInverseHeadShoulders(closes: number[]): BodenMuster | null {
  if (closes.length < 60) return null
  const tail = closes.slice(-100)
  const offset = closes.length - tail.length
  const tiefs = lokaleTiefs(tail, 3)
  if (tiefs.length < 3) return null

  for (let i = 0; i < tiefs.length - 2; i++) {
    const l = tiefs[i]!
    const h = tiefs[i + 1]!
    const r = tiefs[i + 2]!
    const pl = tail[l]!
    const ph = tail[h]!
    const pr = tail[r]!
    if (ph >= pl * 0.99 || ph >= pr * 0.99) continue
    if (pctDiff(pl, pr) > 0.05) continue
    if (ph > pl * 0.92) continue

    const hals = Math.max(...tail.slice(l, r + 1))
    const aktuell = tail[tail.length - 1]!
    if (aktuell < hals * 0.97) continue

    return {
      id: 'inverse_hs',
      titel: 'Inverse Head & Shoulders',
      beschreibung: `Umgekehrte Kopf-Schulter-Formation: tieferer Kopf bei ${ph.toFixed(2)}, Schultern bei ${pl.toFixed(2)} / ${pr.toFixed(2)}. Nackenlinie ca. ${hals.toFixed(2)}.`,
      konfidenz: aktuell > hals ? 'hoch' : 'mittel',
      vonIdx: offset + l,
      bisIdx: offset + tail.length - 1,
      zonenUnter: ph,
      zonenOber: hals * 1.02,
    }
  }
  return null
}

/** Serie höherer Tiefs nach Abwärtsphase. */
function erkenneHigherLows(closes: number[]): BodenMuster | null {
  if (closes.length < 40) return null
  const tiefs = lokaleTiefs(closes, 5)
  if (tiefs.length < 3) return null
  const last3 = tiefs.slice(-3)
  const p0 = closes[last3[0]!]!
  const p1 = closes[last3[1]!]!
  const p2 = closes[last3[2]!]!
  if (p1 > p0 * 1.01 && p2 > p1 * 1.01) {
    return {
      id: 'higher_lows',
      titel: 'Höhere Tiefs (Akkumulation)',
      beschreibung: `Aufeinanderfolgende höhere Tiefs (${p0.toFixed(2)} → ${p1.toFixed(2)} → ${p2.toFixed(2)}) — typisch für Bodenbildung und schrittweise Übernahme.`,
      konfidenz: 'mittel',
      vonIdx: last3[0]!,
      bisIdx: closes.length - 1,
      zonenUnter: p2 * 0.97,
      zonenOber: p2 * 1.08,
    }
  }
  return null
}

/** Bullische RSI-Divergenz am Tief. */
export function erkenneRsiDivergenz(
  closes: number[],
  rsiSerie: (number | null)[],
): BodenMuster | null {
  const tiefs = lokaleTiefs(closes, 5)
  if (tiefs.length < 2) return null
  const b = tiefs[tiefs.length - 1]!
  const a = tiefs[tiefs.length - 2]!
  if (b - a < 8) return null

  const pa = closes[a]!
  const pb = closes[b]!
  const ra = rsiSerie[a]
  const rb = rsiSerie[b]
  if (ra == null || rb == null) return null

  if (pb < pa * 0.995 && rb > ra + 3) {
    return {
      id: 'rsi_divergenz',
      titel: 'Bullische RSI-Divergenz',
      beschreibung: `Kurs tieferes Tief (${pb.toFixed(2)} vs. ${pa.toFixed(2)}), RSI höheres Tief (${rb.toFixed(0)} vs. ${ra.toFixed(0)}) — verkaufdruck lässt nach, oft Vorbote einer Bodenwende.`,
      konfidenz: rb - ra > 8 ? 'hoch' : 'mittel',
      vonIdx: a,
      bisIdx: closes.length - 1,
      zonenUnter: pb * 0.98,
      zonenOber: pb * 1.1,
    }
  }
  return null
}

/** V-förmige Erholung nach starkem Einbruch. */
function erkenneVErholung(closes: number[]): BodenMuster | null {
  if (closes.length < 25) return null
  const tail = closes.slice(-40)
  const offset = closes.length - tail.length
  const min = Math.min(...tail)
  const minIdx = tail.indexOf(min)
  if (minIdx < 5 || minIdx > tail.length - 4) return null

  const vorher = tail[Math.max(0, minIdx - 15)]!
  const drop = (vorher - min) / vorher
  const aktuell = tail[tail.length - 1]!
  const rebound = (aktuell - min) / min
  if (drop >= 0.08 && rebound >= 0.05) {
    return {
      id: 'v_erholung',
      titel: 'V-Erholung / Capitulation',
      beschreibung: `Starker Einbruch von ${(drop * 100).toFixed(0)} % mit anschließender Erholung von ${(rebound * 100).toFixed(0)} % — mögliche Capitulation und kurzfristiger Boden.`,
      konfidenz: rebound > 0.1 ? 'mittel' : 'niedrig',
      vonIdx: offset + minIdx,
      bisIdx: closes.length - 1,
      zonenUnter: min,
      zonenOber: aktuell,
    }
  }
  return null
}

/** Fallender Keil (bullish): fallende Hochs & Tiefs, enger werdend. */
function erkenneFallenderKeil(closes: number[]): BodenMuster | null {
  if (closes.length < 35) return null
  const tail = closes.slice(-50)
  const offset = closes.length - tail.length
  const hochs: number[] = []
  const tiefIdx = lokaleTiefs(tail, 2)
  for (let i = 2; i < tail.length - 2; i++) {
    let ok = true
    for (let j = i - 2; j <= i + 2; j++) {
      if (j !== i && tail[j]! >= tail[i]!) ok = false
    }
    if (ok) hochs.push(i)
  }
  if (hochs.length < 2 || tiefIdx.length < 2) return null

  const h1 = tail[hochs[hochs.length - 2]!]!
  const h2 = tail[hochs[hochs.length - 1]!]!
  const l1 = tail[tiefIdx[tiefIdx.length - 2]!]!
  const l2 = tail[tiefIdx[tiefIdx.length - 1]!]!
  if (h2 < h1 && l2 < l1 && h2 - l2 < h1 - l1) {
    return {
      id: 'fallender_keil',
      titel: 'Fallender Keil (bullish)',
      beschreibung: 'Enger werdender Abwärtskanal — typisches bullishes Umkehrmuster vor Ausbruch nach oben.',
      konfidenz: 'mittel',
      vonIdx: offset,
      bisIdx: closes.length - 1,
      zonenUnter: l2,
      zonenOber: h2,
    }
  }
  return null
}

export function erkenneAlleBodenMuster(
  bars: KursBar[],
  rsiSerie: (number | null)[],
): BodenMuster[] {
  const closes = bars.map((b) => b.close)
  const daten = bars.map((b) => b.datum)
  const kandidaten = [
    erkenneDoppelboden(closes, daten),
    erkenneDreifachboden(closes),
    erkenneInverseHeadShoulders(closes),
    erkenneHigherLows(closes),
    erkenneRsiDivergenz(closes, rsiSerie),
    erkenneVErholung(closes),
    erkenneFallenderKeil(closes),
  ].filter((m): m is BodenMuster => m != null)

  const seen = new Set<string>()
  return kandidaten
    .filter((m) => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })
    .sort((a, b) => {
      const rank = { hoch: 0, mittel: 1, niedrig: 2 }
      return rank[a.konfidenz] - rank[b.konfidenz]
    })
}

export function bodenGesamtUrteil(muster: BodenMuster[]): {
  status: 'wahrscheinlich' | 'moeglich' | 'unwahrscheinlich'
  label: string
  kurz: string
} {
  if (muster.some((m) => m.konfidenz === 'hoch')) {
    return {
      status: 'wahrscheinlich',
      label: 'Boden wahrscheinlich',
      kurz: 'Mehrere starke Umkehrhinweise — erhöhte Chance auf abgeschlossene Korrektur.',
    }
  }
  if (muster.length >= 2) {
    return {
      status: 'moeglich',
      label: 'Boden möglich',
      kurz: 'Mehrere Muster deuten auf eine Formierung hin — Bestätigung durch Ausbruch abwarten.',
    }
  }
  if (muster.length === 1) {
    return {
      status: 'moeglich',
      label: 'Erste Boden-Hinweise',
      kurz: muster[0]!.beschreibung,
    }
  }
  return {
    status: 'unwahrscheinlich',
    label: 'Kein klares Bodensignal',
    kurz: 'Aktuell keine klassische Bodenformation erkennbar — Trend oder Seitwärtsphase dominiert.',
  }
}
