/**
 * FCF-Rendite (Free-Cashflow-Yield) = FCF / Marktkap = 1 / (Kurs/FCF).
 *
 * Macrotrends liefert nur das Multiple `pfcf`, keine Yield-Zeitreihe.
 * Nachkauf-Radar rechnet denselben Kehrwert bereits für den Score.
 */
import {
  FUNDAMENTAL_TTM_KEY,
  istFundamentalQuartalSchaetzungIso,
  type FundamentalKeyMetric,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { formatFundamentalWert } from '@/lib/portfolio-analyse/fundamentaldaten-format'

export const FCF_RENDITE_ZEILE_ID = 'fcf_rendite'
export const FCF_RENDITE_LABEL = 'FCF-Rendite %'

function wert(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  const v = zeilen.find((z) => z.id === id)?.werte[key]
  return v != null && Number.isFinite(v) ? v : null
}

/** 1 / pfcf in Prozent. Nur bei positivem Multiple (wie Radar). */
export function fcfRenditeAusPfcf(pfcf: number | null | undefined): number | null {
  if (pfcf == null || !(pfcf > 0)) return null
  const y = (1 / pfcf) * 100
  if (!Number.isFinite(y) || y <= 0 || y >= 100) return null
  return Math.round(y * 100) / 100
}

function fcfRenditeAusFcfUndMc(fcfMio: number | null, mcMio: number | null): number | null {
  if (fcfMio == null || mcMio == null || !(fcfMio > 0) || !(mcMio > 0)) return null
  const y = (fcfMio / mcMio) * 100
  if (!Number.isFinite(y) || y <= 0 || y >= 100) return null
  return Math.round(y * 100) / 100
}

function alleKeys(perioden: FundamentalPeriode[], zeilen: FundamentalMetrikZeile[]): string[] {
  const s = new Set<string>()
  for (const p of perioden) s.add(p.iso)
  for (const id of ['pfcf', 'fcf', 'marktkapitalisierung'] as const) {
    const z = zeilen.find((r) => r.id === id)
    if (!z) continue
    for (const k of Object.keys(z.werte)) s.add(k)
  }
  return [...s]
}

function renditeFuerKey(zeilen: FundamentalMetrikZeile[], key: string): number | null {
  return (
    fcfRenditeAusPfcf(wert(zeilen, 'pfcf', key)) ??
    fcfRenditeAusFcfUndMc(wert(zeilen, 'fcf', key), wert(zeilen, 'marktkapitalisierung', key))
  )
}

/**
 * Schreibt `fcf_rendite` in die Zeilenliste (in-place, neue Objekte).
 * Läuft client- und serverseitig — alte Caches ohne die Zeile werden aufgefüllt.
 */
export function ergaenzeFcfRenditeZeilen(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): void {
  const keys = alleKeys(perioden, zeilen)
  if (keys.length === 0) return

  const werte: Record<string, number | null> = {}
  let hat = false
  for (const key of keys) {
    const y = renditeFuerKey(zeilen, key)
    werte[key] = y
    if (y != null) hat = true
  }
  if (!hat) return

  const neu: FundamentalMetrikZeile = {
    id: FCF_RENDITE_ZEILE_ID,
    label: FCF_RENDITE_LABEL,
    gruppe: 'bewertung_trailing',
    einheit: 'prozent',
    werte,
  }
  const i = zeilen.findIndex((z) => z.id === FCF_RENDITE_ZEILE_ID)
  if (i < 0) {
    zeilen.push(neu)
    return
  }
  const alt = zeilen[i]!
  zeilen[i] = {
    ...alt,
    label: neu.label,
    gruppe: neu.gruppe,
    einheit: neu.einheit,
    werte: { ...alt.werte, ...werte },
  }
}

export function fcfRenditeKennzahlen(
  zeilen: FundamentalMetrikZeile[],
  perioden: FundamentalPeriode[],
): { ltm: number | null; fy: number | null } {
  const z = zeilen.find((r) => r.id === FCF_RENDITE_ZEILE_ID)
  if (!z) return { ltm: null, fy: null }
  const ttm = z.werte[FUNDAMENTAL_TTM_KEY]
  const hist = perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung)
    .map((p) => p.iso)
  let lastHist: number | null = null
  for (let i = hist.length - 1; i >= 0; i--) {
    const v = z.werte[hist[i]!]
    if (v != null && Number.isFinite(v)) {
      lastHist = v
      break
    }
  }
  const ltm = ttm != null && Number.isFinite(ttm) ? ttm : lastHist
  let fy: number | null = null
  for (const p of perioden) {
    if (!p.istSchaetzung || istFundamentalQuartalSchaetzungIso(p.iso)) continue
    const v = z.werte[p.iso]
    if (v != null && Number.isFinite(v)) {
      fy = v
      break
    }
  }
  return { ltm, fy }
}

function pctAnzeige(v: number | null): string {
  return v != null && Number.isFinite(v) ? formatFundamentalWert(v, 'prozent') : '–'
}

function upsertKeyMetric(
  metrics: FundamentalKeyMetric[],
  neu: FundamentalKeyMetric,
  afterId: string,
): FundamentalKeyMetric[] {
  const i = metrics.findIndex((m) => m.id === neu.id)
  if (i >= 0) {
    const next = [...metrics]
    next[i] = { ...next[i], ...neu }
    return next
  }
  const after = metrics.findIndex((m) => m.id === afterId)
  const next = [...metrics]
  next.splice(after >= 0 ? after + 1 : next.length, 0, neu)
  return next
}

/** Alte Caches ohne FCF-Rendite-Karten: aus der pfcf-Zeile nachziehen. */
export function ergaenzeFcfRenditeKeyMetrics(
  keyMetrics: FundamentalKeyMetric[],
  paket: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] },
): FundamentalKeyMetric[] {
  const { ltm, fy } = fcfRenditeKennzahlen(paket.zeilen, paket.perioden)
  let out = keyMetrics
  if (fy != null) {
    out = upsertKeyMetric(
      out,
      { id: 'ntm_fcf_rendite', label: 'FY FCF-Rendite', wert: pctAnzeige(fy), zahl: fy, gruppe: 'bewertung_ntm' },
      'ntm_mc_fcf',
    )
  }
  if (ltm != null) {
    out = upsertKeyMetric(
      out,
      { id: 'ltm_fcf_rendite', label: 'LTM FCF-Rendite', wert: pctAnzeige(ltm), zahl: ltm, gruppe: 'bewertung_ltm' },
      'ltm_pfcf',
    )
  }
  return out
}
