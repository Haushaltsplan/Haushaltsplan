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
  exOffset: number
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
    if (alt > 0 && neu > 0) {
      raten.push(neu / alt - 1)
    }
  }
  if (raten.length === 0) return 0
  const m = median(raten)
  return Math.max(-0.4, Math.min(0.4, m))
}

function slotsAusHistorie(past: DivvydiaryRohZeile[]): ZahlungsSlot[] {
  const byMonat = new Map<number, DivvydiaryRohZeile[]>()
  for (const r of past) {
    const m = Number(r.payDate.slice(5, 7))
    const list = byMonat.get(m) ?? []
    list.push(r)
    byMonat.set(m, list)
  }
  const slots: ZahlungsSlot[] = []
  for (const [monat, list] of byMonat) {
    const last = list[list.length - 1]
    const payTag = Number(last.payDate.slice(8, 10))
    const exTag = Number(last.exDate.slice(8, 10))
    slots.push({
      monat,
      payTag,
      exTag,
      exOffset: Math.max(1, tageZwischenIso(last.exDate, last.payDate)),
    })
  }
  return slots.sort((a, b) => a.monat - b.monat)
}

function isoDatum(jahr: number, monat: number, tag: number): string {
  const t = Math.min(tag, 28)
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(t).padStart(2, '0')}`
}

function betragFuerSlot(past: DivvydiaryRohZeile[], monat: number, wachstum: number): number {
  const slotRows = past
    .filter((r) => Number(r.payDate.slice(5, 7)) === monat)
    .sort((a, b) => a.payDate.localeCompare(b.payDate))
  if (slotRows.length === 0) return 0
  const letzte = slotRows[slotRows.length - 1]
  return letzte.amount * (1 + wachstum)
}

function naechsterSlotTermin(
  slots: ZahlungsSlot[],
  past: DivvydiaryRohZeile[],
  heute: string,
  bis: string,
  wachstum: number,
): DividendenPrognoseTreffer | null {
  const heuteJahr = Number(heute.slice(0, 4))
  const letzteZahlung = past[past.length - 1]?.payDate ?? ''
  const kandidaten: Array<{ pay: string; ex: string; amount: number }> = []

  for (let jahr = heuteJahr; jahr <= heuteJahr + 1; jahr++) {
    for (const slot of slots) {
      const pay = isoDatum(jahr, slot.monat, slot.payTag)
      const ex = isoDatum(jahr, slot.monat, slot.exTag)
      if (pay < heute || pay > bis) continue
      if (pay <= letzteZahlung) continue
      const amount = betragFuerSlot(past, slot.monat, wachstum)
      if (amount <= 0) continue
      kandidaten.push({ pay, ex, amount })
    }
  }

  kandidaten.sort((a, b) => a.pay.localeCompare(b.pay))
  const hit = kandidaten[0]
  if (!hit) return null

  return {
    exDate: hit.ex,
    payDate: hit.pay,
    amount: Math.round(hit.amount * 10000) / 10000,
    bestaetigt: false,
  }
}

/** Angekündigter Termin (ohne forecast) hat Vorrang vor Prognose. */
export function waehleDividendenTermin(
  rows: DivvydiaryRohZeile[],
  heute: string,
  bis: string,
): DividendenPrognoseTreffer | null {
  const zukunft = rows
    .filter((r) => r.payDate >= heute && r.payDate <= bis)
    .sort((a, b) => a.payDate.localeCompare(b.payDate))

  const bestaetigt = zukunft.find((r) => !r.forecast)
  if (bestaetigt) {
    return {
      exDate: bestaetigt.exDate,
      payDate: bestaetigt.payDate,
      amount: bestaetigt.amount,
      bestaetigt: true,
    }
  }

  const past = nurVergangenheit(rows, heute)
  if (past.length < 2) return null

  const wachstum = berechneZahlungswachstum(past)
  const slots = slotsAusHistorie(past)
  if (slots.length === 0) return null

  return naechsterSlotTermin(slots, past, heute, bis, wachstum)
}
