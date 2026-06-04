import { kalenderQuartalAusPeriodEnd } from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'

/** Geschätztes Periodenende ~6 Wochen vor dem Earnings-Termin. */
export function periodEndAusEarningsTermin(terminIso: string): string {
  const d = new Date(`${terminIso.slice(0, 10)}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 45)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function quartalLabelAusTermin(terminIso: string): string {
  return kalenderQuartalAusPeriodEnd(periodEndAusEarningsTermin(terminIso)).label
}

/**
 * Eindeutiger Schlüssel pro Geschäftsquartal (1 Termin pro Q).
 * Nur aus dem Berichtsdatum abgeleitet — Finnhub-Q-Labels können bei mehreren
 * Juli-Terminen (z. B. Alphabet) auf verschiedene Q zeigen und Doppel erzeugen.
 */
export function fiskalQuartalSchluessel(
  terminIso: string,
  _jahr?: number | null,
  _quartal?: number | null,
): string {
  const derived = kalenderQuartalAusPeriodEnd(periodEndAusEarningsTermin(terminIso))
  return `${derived.jahr}-Q${derived.quartal}`
}

export function vorherigesFiskalQuartal(heuteIso?: string): { jahr: number; quartal: number; key: string } {
  const { quartal, jahr } = kalenderQuartalAusPeriodEnd(
    periodEndAusEarningsTermin(heuteIso ?? heuteIsoUtc()),
  )
  let q = quartal - 1
  let y = jahr
  if (q < 1) {
    q = 4
    y -= 1
  }
  return { jahr: y, quartal: q, key: `${y}-Q${q}` }
}

export function msHeaderAusQuartalLabel(quartalLabel: string): string | null {
  const m = /^Q(\d)\s+(\d{4})$/i.exec(quartalLabel.trim())
  if (!m) return null
  return `${m[2]} Q${m[1]}`
}

export function quartalLabelKandidatenAusTermin(terminIso: string): string[] {
  const { quartal, jahr, label } = kalenderQuartalAusPeriodEnd(periodEndAusEarningsTermin(terminIso))
  const out = new Set<string>([label])
  let q = quartal
  let y = jahr
  q -= 1
  if (q < 1) {
    q = 4
    y -= 1
  }
  out.add(`Q${q} ${y}`)
  q = quartal + 1
  y = jahr
  if (q > 4) {
    q = 1
    y += 1
  }
  out.add(`Q${q} ${y}`)
  return [...out]
}

/** Typischer Berichtsmonat (Mitte) für Marketscreener-Spalte „YYYY Qn“. */
export function typischerBerichtIso(msLabel: string): string | null {
  const m = /^(\d{4})\s+Q(\d)$/i.exec(msLabel.trim())
  if (!m) return null
  const fy = Number(m[1])
  const q = Number(m[2])
  const slots: Record<number, [number, number]> = {
    1: [4, 20],
    2: [7, 25],
    3: [10, 25],
    4: [1, 25],
  }
  const slot = slots[q]
  if (!slot) return null
  const year = q === 4 ? fy + 1 : fy
  return `${year}-${String(slot[0]).padStart(2, '0')}-${String(slot[1]).padStart(2, '0')}`
}

export function waehleMsQuartalFuerTermin(msHeaderLabels: string[], terminIso: string): string | null {
  const termin = terminIso.slice(0, 10)
  let best: { label: string; diff: number } | null = null
  for (const label of msHeaderLabels) {
    const bericht = typischerBerichtIso(label)
    if (!bericht) continue
    const diff = Math.abs(tageZwischenIso(bericht, termin))
    if (diff > 100) continue
    if (!best || diff < best.diff) best = { label, diff }
  }
  return best?.label ?? null
}

export function terminIstVergangen(termin: string | undefined): boolean {
  if (!termin) return false
  return termin.slice(0, 10) <= heuteIsoUtc()
}
