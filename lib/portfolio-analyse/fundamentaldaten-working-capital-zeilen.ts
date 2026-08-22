/**
 * Working-Capital-Tage (DIO/DSO/DPO) aus Bilanz+GuV ableiten,
 * wenn Macrotrends-Ratios fehlen.
 */

import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { wertAusMapFuerIso } from '@/lib/portfolio-analyse/fundamentaldaten-wert-fuer-iso'

function wert(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  return wertAusMapFuerIso(zeilen.find((z) => z.id === id)?.werte, key)
}

function upsertTageZeile(
  zeilen: FundamentalMetrikZeile[],
  id: string,
  label: string,
  werte: Record<string, number | null>,
): void {
  const existing = zeilen.find((z) => z.id === id)
  if (!existing) {
    zeilen.push({
      id,
      label,
      gruppe: 'umschlag',
      einheit: 'zahl',
      werte: { ...werte },
    })
    return
  }
  for (const [k, v] of Object.entries(werte)) {
    if (v != null && (existing.werte[k] == null || !Number.isFinite(existing.werte[k]!))) {
      existing.werte[k] = v
    }
  }
}

function tageAusBestandUndTagesrate(bestand: number | null, jahresrate: number | null): number | null {
  if (bestand == null || jahresrate == null || !(jahresrate > 0)) return null
  const tage = (bestand / jahresrate) * 365
  if (!Number.isFinite(tage) || tage < 0 || tage > 800) return null
  return Math.round(tage * 10) / 10
}

/**
 * Füllt fehlende DIO/DSO/DPO aus Vorräte/Forderungen + Umsatz/COGS-Proxy.
 * COGS-Proxy = Umsatz − Bruttogewinn.
 */
export function ergaenzeWorkingCapitalTageZeilen(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): void {
  if (perioden.length === 0) return

  const histKeys = perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
  const keys = [...histKeys]
  if (perioden.some((p) => p.iso === FUNDAMENTAL_TTM_KEY || p.istLtm)) {
    keys.push(FUNDAMENTAL_TTM_KEY)
  }

  const dio: Record<string, number | null> = {}
  const dso: Record<string, number | null> = {}
  const dpo: Record<string, number | null> = {}
  let hatDio = false
  let hatDso = false
  let hatDpo = false

  for (const key of keys) {
    const umsatz = wert(zeilen, 'umsatz', key)
    const brutto = wert(zeilen, 'bruttogewinn', key)
    const cogs = umsatz != null && brutto != null ? umsatz - brutto : null
    const vorraete = wert(zeilen, 'vorraete', key)
    const forderungen = wert(zeilen, 'forderungen', key)
    const verbindl = wert(zeilen, 'kurzfrist_verbindl', key)
    // Macrotrends mappt inventory-turnover auf id „anlagenumschlag“
    const lagerUmschlag = wert(zeilen, 'anlagenumschlag', key)
    const fordUmschlag = wert(zeilen, 'forderungsumschlag', key)

    let dioV = tageAusBestandUndTagesrate(vorraete, cogs)
    if (dioV == null && lagerUmschlag != null && lagerUmschlag > 0) {
      const ausTurnover = 365 / lagerUmschlag
      if (Number.isFinite(ausTurnover) && ausTurnover > 0 && ausTurnover < 800) {
        dioV = Math.round(ausTurnover * 10) / 10
      }
    }

    let dsoV = tageAusBestandUndTagesrate(forderungen, umsatz)
    if (dsoV == null && fordUmschlag != null && fordUmschlag > 0) {
      const ausTurnover = 365 / fordUmschlag
      if (Number.isFinite(ausTurnover) && ausTurnover > 0 && ausTurnover < 800) {
        dsoV = Math.round(ausTurnover * 10) / 10
      }
    }

    // DPO-Proxy: Payables ≈ ~35 % der kurzfristigen Verbindlichkeiten vs. COGS (oder Umsatz)
    const kostenbasis = cogs != null && cogs > 0 ? cogs : umsatz != null && umsatz > 0 ? umsatz * 0.55 : null
    const dpoV =
      verbindl != null && kostenbasis != null
        ? tageAusBestandUndTagesrate(verbindl * 0.35, kostenbasis)
        : null

    dio[key] = dioV
    dso[key] = dsoV
    dpo[key] = dpoV
    if (dioV != null) hatDio = true
    if (dsoV != null) hatDso = true
    if (dpoV != null) hatDpo = true
  }

  if (hatDio) upsertTageZeile(zeilen, 'dio', 'Lagerdauer (DIO, Tage)', dio)
  if (hatDso) upsertTageZeile(zeilen, 'dso', 'Forderungslaufzeit (DSO, Tage)', dso)
  if (hatDpo) upsertTageZeile(zeilen, 'dpo', 'Verbindlichkeitenlaufzeit (DPO, Tage)', dpo)

  // Cash Conversion Cycle (DSO + DIO − DPO) — Kapitalbindungs-Proxy, auch für Finanzdienstleister
  const dioZ = zeilen.find((z) => z.id === 'dio')
  const dsoZ = zeilen.find((z) => z.id === 'dso')
  const dpoZ = zeilen.find((z) => z.id === 'dpo')
  if (dsoZ || dioZ) {
    const ccc: Record<string, number | null> = {}
    let hatCcc = false
    for (const key of keys) {
      const dsoV = dsoZ?.werte[key] ?? null
      const dioV = dioZ?.werte[key] ?? 0
      const dpoV = dpoZ?.werte[key] ?? 0
      if (dsoV == null && (dioZ?.werte[key] == null)) continue
      const v = (dsoV ?? 0) + (dioV ?? 0) - (dpoV ?? 0)
      if (!Number.isFinite(v)) continue
      ccc[key] = Math.round(v * 10) / 10
      hatCcc = true
    }
    if (hatCcc) {
      upsertTageZeile(zeilen, 'ccc', 'Cash Conversion Cycle (Tage)', ccc)
    }
  }
}
