import { median, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type { DivvydiaryRohZeile } from '@/lib/portfolio-analyse/divvydiary-scraper-server'

export type DividendenPrognoseTreffer = {
  exDate: string
  payDate: string
  amount: number
  bestaetigt: boolean
}

type ZahlungsSlot = {
  monat: number
  payTag: number
  exTag: number
}

function nurVergangenheit(rows: DivvydiaryRohZeile[], heute: string): DivvydiaryRohZeile[] {
  return rows
    .filter((r) => r.payDate < heute && !r.forecast)
    .sort((a, b) => a.payDate.localeCompare(b.payDate))
}

/** Medianes Wachstum zwischen aufeinanderfolgenden Zahlungen (Cap ±40 %). */
export function berechneZahlungswachstum(past: DivvydiaryRohZeile[]): number {
  if (past.length < 2) return 0
  const raten: number[] = []
  for (let i = 1; i < past.length; i++) {
    const alt = past[i - 1].amount
    const neu = past[i].amount
    if (alt > 0 && neu > 0) raten.push(neu / alt - 1)
  }
  if (raten.length === 0) return 0
  const m = median(raten)
  return Math.max(-0.4, Math.min(0.4, m))
}

function medianTag(tags: number[]): number {
  return Math.round(median(tags))
}

/**
 * Nur wiederkehrende Zahlungsmonate (≥2 verschiedene Jahre mit Zahlung in diesem Monat).
 * Einmalige Ausreißer (z. B. falscher Juni-Eintrag) fallen raus.
 */
export function slotsAusHistorie(past: DivvydiaryRohZeile[]): ZahlungsSlot[] {
  const byMonat = new Map<number, DivvydiaryRohZeile[]>()
  for (const r of past) {
    const m = Number(r.payDate.slice(5, 7))
    const list = byMonat.get(m) ?? []
    list.push(r)
    byMonat.set(m, list)
  }

  const jahreGesamt = new Set(past.map((r) => r.payDate.slice(0, 4))).size
  const slots: ZahlungsSlot[] = []

  for (const [monat, list] of byMonat) {
    const jahreInMonat = new Set(list.map((r) => r.payDate.slice(0, 4))).size
    const einzigerMonatImDatensatz = byMonat.size === 1

    if (!einzigerMonatImDatensatz && jahreInMonat < 2) continue
    if (jahreGesamt >= 4 && jahreInMonat < Math.max(2, Math.ceil(jahreGesamt * 0.25))) continue

    const payTags = list.map((r) => Number(r.payDate.slice(8, 10)))
    const exTags = list.map((r) => Number(r.exDate.slice(8, 10)))
    slots.push({
      monat,
      payTag: medianTag(payTags),
      exTag: medianTag(exTags),
    })
  }

  return slots.sort((a, b) => a.monat - b.monat)
}

export function payMonatPasstZuSlots(payDate: string, slots: ZahlungsSlot[]): boolean {
  const m = Number(payDate.slice(5, 7))
  return slots.some((s) => s.monat === m)
}

function isoDatum(jahr: number, monat: number, tag: number): string {
  const lastDay = new Date(Date.UTC(jahr, monat, 0)).getUTCDate()
  const t = Math.min(Math.max(1, tag), lastDay)
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(t).padStart(2, '0')}`
}

/** Betrag: letzte Zahlung im Slot, Wachstum bevorzugt Jahr-über-Jahr im selben Monat. */
function betragFuerSlot(past: DivvydiaryRohZeile[], monat: number, fallbackWachstum: number): number {
  const slotRows = past
    .filter((r) => Number(r.payDate.slice(5, 7)) === monat)
    .sort((a, b) => a.payDate.localeCompare(b.payDate))
  if (slotRows.length === 0) return 0
  const letzte = slotRows[slotRows.length - 1]
  if (slotRows.length >= 2) {
    const vorjahr = slotRows[slotRows.length - 2]
    if (vorjahr.amount > 0 && letzte.payDate.slice(0, 4) !== vorjahr.payDate.slice(0, 4)) {
      const yoy = letzte.amount / vorjahr.amount - 1
      const rate = Math.max(-0.4, Math.min(0.4, yoy))
      return letzte.amount * (1 + rate)
    }
  }
  return letzte.amount * (1 + fallbackWachstum)
}

function alleSlotTermine(
  slots: ZahlungsSlot[],
  past: DivvydiaryRohZeile[],
  heute: string,
  bis: string,
  wachstum: number,
): DividendenPrognoseTreffer[] {
  const heuteJahr = Number(heute.slice(0, 4))
  const letzteZahlung = past[past.length - 1]?.payDate ?? ''
  const hits: DividendenPrognoseTreffer[] = []

  for (let jahr = heuteJahr; jahr <= heuteJahr + 1; jahr++) {
    for (const slot of slots) {
      const pay = isoDatum(jahr, slot.monat, slot.payTag)
      const ex = isoDatum(jahr, slot.monat, slot.exTag)
      if (pay < heute || pay > bis) continue
      if (pay <= letzteZahlung) continue
      const amount = betragFuerSlot(past, slot.monat, wachstum)
      if (amount <= 0) continue
      hits.push({
        exDate: ex,
        payDate: pay,
        amount: Math.round(amount * 10000) / 10000,
        bestaetigt: false,
      })
    }
  }

  return hits.sort((a, b) => a.payDate.localeCompare(b.payDate))
}

function dedupeNaheTermine(termini: DividendenPrognoseTreffer[]): DividendenPrognoseTreffer[] {
  const out: DividendenPrognoseTreffer[] = []
  for (const t of termini.sort((a, b) => a.payDate.localeCompare(b.payDate))) {
    const clash = out.find(
      (u) => u.bestaetigt === t.bestaetigt && Math.abs(tageZwischenIso(u.payDate, t.payDate)) <= 5,
    )
    if (clash) {
      if (t.bestaetigt && !clash.bestaetigt) {
        const i = out.indexOf(clash)
        out[i] = t
      }
      continue
    }
    out.push(t)
  }
  return out
}

/**
 * Alle Termine im Fenster: bestätigte (gegen Historie geprüft), DivvyDiary-Forecasts, dann Slot-Prognosen.
 */
export function listeDividendenTermine(
  rows: DivvydiaryRohZeile[],
  heute: string,
  bis: string,
): DividendenPrognoseTreffer[] {
  const past = nurVergangenheit(rows, heute)
  const slots = slotsAusHistorie(past)
  const wachstum = berechneZahlungswachstum(past)
  const hatMuster = past.length >= 2 && slots.length > 0

  const zukunft = rows
    .filter((r) => r.payDate >= heute && r.payDate <= bis)
    .sort((a, b) => a.payDate.localeCompare(b.payDate))

  const out: DividendenPrognoseTreffer[] = []
  const usedPay = new Set<string>()

  const passtOderKeinMuster = (pay: string) => !hatMuster || payMonatPasstZuSlots(pay, slots)

  for (const r of zukunft) {
    if (!r.forecast) {
      if (!passtOderKeinMuster(r.payDate)) continue
      out.push({
        exDate: r.exDate,
        payDate: r.payDate,
        amount: r.amount,
        bestaetigt: true,
      })
      usedPay.add(r.payDate)
    }
  }

  for (const r of zukunft) {
    if (!r.forecast) continue
    if (!passtOderKeinMuster(r.payDate)) continue
    if (usedPay.has(r.payDate)) continue
    out.push({
      exDate: r.exDate,
      payDate: r.payDate,
      amount: r.amount,
      bestaetigt: false,
    })
    usedPay.add(r.payDate)
  }

  if (hatMuster) {
    for (const p of alleSlotTermine(slots, past, heute, bis, wachstum)) {
      const naheBekannt = [...usedPay].some((d) => Math.abs(tageZwischenIso(d, p.payDate)) <= 7)
      if (naheBekannt) continue
      out.push(p)
      usedPay.add(p.payDate)
    }
  }

  return dedupeNaheTermine(out)
}

/** Nächster Termin (Kompatibilität). */
export function waehleDividendenTermin(
  rows: DivvydiaryRohZeile[],
  heute: string,
  bis: string,
): DividendenPrognoseTreffer | null {
  return listeDividendenTermine(rows, heute, bis)[0] ?? null
}
