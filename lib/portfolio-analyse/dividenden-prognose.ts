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

/** Nur aktuelle Historie für Zahlungsmuster (alte Juni-Termine bei Hermès o. ä. ignorieren). */
const MUSTER_LOOKBACK_JAHRE = 8
const MUSTER_MIN_JAHR_RECENT = 4

function historieFuerMuster(past: DivvydiaryRohZeile[], heute: string): DivvydiaryRohZeile[] {
  const cut = `${Number(heute.slice(0, 4)) - MUSTER_LOOKBACK_JAHRE}-01-01`
  const recent = past.filter((r) => r.payDate >= cut)
  return recent.length >= 2 ? recent : past
}

/**
 * Wiederkehrende Zahlungsmonate aus **aktueller** Historie (≥2 Jahre im Fenster).
 */
export function slotsAusHistorie(past: DivvydiaryRohZeile[], heute: string): ZahlungsSlot[] {
  const basis = historieFuerMuster(past, heute)
  const recentAb = `${Number(heute.slice(0, 4)) - MUSTER_MIN_JAHR_RECENT}-01-01`

  const byMonat = new Map<number, DivvydiaryRohZeile[]>()
  for (const r of basis) {
    const m = Number(r.payDate.slice(5, 7))
    const list = byMonat.get(m) ?? []
    list.push(r)
    byMonat.set(m, list)
  }

  const jahreGesamt = new Set(basis.map((r) => r.payDate.slice(0, 4))).size
  const slots: ZahlungsSlot[] = []

  for (const [monat, list] of byMonat) {
    const recentList = list.filter((r) => r.payDate >= recentAb)
    if (recentList.length === 0) continue

    const jahreInMonat = new Set(recentList.map((r) => r.payDate.slice(0, 4))).size
    const einzigerMonatImDatensatz = byMonat.size === 1

    if (!einzigerMonatImDatensatz && jahreInMonat < 2) continue
    if (jahreGesamt >= 4 && jahreInMonat < Math.max(2, Math.ceil(jahreGesamt * 0.25))) continue

    const payTags = recentList.map((r) => Number(r.payDate.slice(8, 10)))
    const exTags = recentList.map((r) => Number(r.exDate.slice(8, 10)))
    slots.push({
      monat,
      payTag: medianTag(payTags),
      exTag: medianTag(exTags),
    })
  }

  let sorted = entferneBenachbarteSchwaechereSlots(slots, byMonat).sort((a, b) => a.monat - b.monat)

  const zahlungenProJahr = jahreGesamt > 0 ? basis.length / jahreGesamt : basis.length
  if (zahlungenProJahr <= 1.5 && sorted.length > 1) {
    let bestMonat = sorted[0].monat
    let bestJahre = 0
    for (const [monat, list] of byMonat) {
      const jahre = new Set(
        list.filter((r) => r.payDate >= recentAb).map((r) => r.payDate.slice(0, 4)),
      ).size
      if (jahre > bestJahre) {
        bestJahre = jahre
        bestMonat = monat
      }
    }
    sorted = sorted.filter((s) => s.monat === bestMonat)
  }

  return sorted
}

/** Mindestabstand Prognose nach letztem bestätigtem Termin (~1 Quartal). */
export const MIN_TAGE_PROGNOSE_NACH_BESTAETIGT = 75

function jahreMitZahlungInMonat(past: DivvydiaryRohZeile[], monat: number): number {
  return new Set(
    past.filter((r) => Number(r.payDate.slice(5, 7)) === monat).map((r) => r.payDate.slice(0, 4)),
  ).size
}

function monatAbstand(a: number, b: number): number {
  const d = (b - a + 12) % 12
  return d === 0 ? 12 : d
}

/** Juli+August o. ä. — nur den Monat mit mehr Jahren Historie behalten. */
function entferneBenachbarteSchwaechereSlots(
  slots: ZahlungsSlot[],
  byMonat: Map<number, DivvydiaryRohZeile[]>,
): ZahlungsSlot[] {
  if (slots.length <= 1) return slots
  const jahre = (m: number) =>
    new Set((byMonat.get(m) ?? []).map((r) => r.payDate.slice(0, 4))).size

  let s = [...slots]
  let changed = true
  while (changed && s.length > 1) {
    changed = false
    const sorted = [...s].sort((a, b) => a.monat - b.monat)
    const drop = new Set<number>()
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]
      const b = sorted[(i + 1) % sorted.length]
      if (monatAbstand(a.monat, b.monat) !== 1) continue
      const ja = jahre(a.monat)
      const jb = jahre(b.monat)
      if (ja < jb) {
        drop.add(a.monat)
        changed = true
      } else if (jb < ja) {
        drop.add(b.monat)
        changed = true
      }
    }
    s = s.filter((x) => !drop.has(x.monat))
  }
  return s
}

function scorePrognoseMonat(payDate: string, slots: ZahlungsSlot[], past: DivvydiaryRohZeile[]): number {
  const m = Number(payDate.slice(5, 7))
  const tag = Number(payDate.slice(8, 10))
  const jahre = jahreMitZahlungInMonat(past, m)
  const slot = slots.find((s) => s.monat === m)
  const tagDiff = slot ? Math.abs(slot.payTag - tag) : 50
  const slotBonus = slot ? 500 : 0
  return jahre * 1000 + slotBonus - tagDiff
}

/** Max. eine Prognose pro ~Quartal; bei Kollision gewinnt der historisch passendere Monat. */
export function dedupePrognosenImQuartalsabstand(
  termini: DividendenPrognoseTreffer[],
  slots: ZahlungsSlot[],
  past: DivvydiaryRohZeile[],
): DividendenPrognoseTreffer[] {
  const bestaetigt = termini.filter((t) => t.bestaetigt)
  const prognosen = termini.filter((t) => !t.bestaetigt).sort((a, b) => a.payDate.localeCompare(b.payDate))
  const kept: DividendenPrognoseTreffer[] = []

  for (const p of prognosen) {
    const clashIdx = kept.findIndex(
      (k) => Math.abs(tageZwischenIso(k.payDate, p.payDate)) < MIN_TAGE_PROGNOSE_NACH_BESTAETIGT,
    )
    if (clashIdx < 0) {
      kept.push(p)
      continue
    }
    const sp = scorePrognoseMonat(p.payDate, slots, past)
    const sk = scorePrognoseMonat(kept[clashIdx].payDate, slots, past)
    if (sp > sk) {
      kept[clashIdx] = p
    } else if (sp === sk && Number(p.payDate.slice(5, 7)) > Number(kept[clashIdx].payDate.slice(5, 7))) {
      kept[clashIdx] = p
    }
  }

  return [...bestaetigt, ...kept].sort((a, b) => a.payDate.localeCompare(b.payDate))
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
  const bisJahr = Number(bis.slice(0, 4))
  const letzteZahlung = past[past.length - 1]?.payDate ?? ''
  const hits: DividendenPrognoseTreffer[] = []

  for (let jahr = heuteJahr; jahr <= bisJahr; jahr++) {
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
  const slots = slotsAusHistorie(past, heute)
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

  const bestaetigtePay = out.filter((t) => t.bestaetigt).map((t) => t.payDate)

  const prognoseErlaubt = (pay: string): boolean => {
    if (bestaetigtePay.length === 0) return true
    return !bestaetigtePay.some(
      (b) => Math.abs(tageZwischenIso(b, pay)) < MIN_TAGE_PROGNOSE_NACH_BESTAETIGT,
    )
  }

  for (const r of zukunft) {
    if (!r.forecast) continue
    if (!passtOderKeinMuster(r.payDate)) continue
    if (usedPay.has(r.payDate)) continue
    if (!prognoseErlaubt(r.payDate)) continue
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
      if (!prognoseErlaubt(p.payDate)) continue
      out.push(p)
      usedPay.add(p.payDate)
    }
  }

  return dedupePrognosenImQuartalsabstand(dedupeNaheTermine(out), slots, past)
}

/** Nächster Termin (Kompatibilität). */
export function waehleDividendenTermin(
  rows: DivvydiaryRohZeile[],
  heute: string,
  bis: string,
): DividendenPrognoseTreffer | null {
  return listeDividendenTermine(rows, heute, bis)[0] ?? null
}
