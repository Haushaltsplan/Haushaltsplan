/**
 * Abgeleitete Bewertungs-Historien (Dividendenrendite, Ausschüttungsquote),
 * damit Key-Metrics wie ROIC auf echte Zeitreihen navigieren können.
 */
import {
  FUNDAMENTAL_TTM_KEY,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

function wert(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  const v = zeilen.find((z) => z.id === id)?.werte[key]
  return v != null && Number.isFinite(v) ? v : null
}

function periodenKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden.map((p) => p.iso)
}

function leereWerte(keys: string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const k of keys) out[k] = null
  return out
}

/** Kurs: optional Chart-Preis, sonst KGV × EPS. */
function kursFuerSpalte(
  zeilen: FundamentalMetrikZeile[],
  key: string,
  kursByIso?: Record<string, number | null> | null,
): number | null {
  const ausChart = kursByIso?.[key]
  if (ausChart != null && ausChart > 0) return ausChart
  const kgv = wert(zeilen, 'kgv', key)
  const eps = wert(zeilen, 'eps', key)
  if (kgv != null && kgv > 0 && eps != null && eps > 0) return kgv * eps
  return null
}

function upsertZeile(zeilen: FundamentalMetrikZeile[], neu: FundamentalMetrikZeile): void {
  const i = zeilen.findIndex((z) => z.id === neu.id)
  if (i < 0) {
    zeilen.push(neu)
    return
  }
  // Bestehende Historie behalten (Macrotrends-Kurschart), Lücken + TTM aus neu füllen
  const alt = zeilen[i]!
  const werte = { ...alt.werte }
  for (const [k, v] of Object.entries(neu.werte)) {
    if (v == null || !Number.isFinite(v)) continue
    if (werte[k] == null || !Number.isFinite(werte[k]!) || k === FUNDAMENTAL_TTM_KEY) {
      werte[k] = v
    }
  }
  for (const [k, v] of Object.entries(neu.werte)) {
    if (!(k in werte)) werte[k] = v
  }
  zeilen[i] = { ...alt, label: neu.label, gruppe: neu.gruppe, einheit: neu.einheit, werte }
}

/**
 * Schreibt `ausschuettungsquote` und `dividendenrendite` in die Zeilenliste (in-place).
 */
export function ergaenzeDividendenHistorieZeilen(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
  yahoo?: { dividendYield?: number; payoutRatio?: number } | null,
  kursByIso?: Record<string, number | null> | null,
): void {
  const keys = periodenKeys(perioden)
  if (keys.length === 0) return

  const payoutWerte = leereWerte(keys)
  const yieldWerte = leereWerte(keys)
  let hatPayout = false
  let hatYield = false

  for (const key of keys) {
    const divMio = wert(zeilen, 'dividenden_gezahlt', key)
    const nettoMio = wert(zeilen, 'nettogewinn', key)
    const aktienMio = wert(zeilen, 'aktien', key)

    if (divMio != null && nettoMio != null && nettoMio > 0) {
      const pct = (Math.abs(divMio) / nettoMio) * 100
      if (Number.isFinite(pct) && pct > 0 && pct < 500) {
        payoutWerte[key] = pct
        hatPayout = true
      }
    }

    const kurs = kursFuerSpalte(zeilen, key, kursByIso)
    if (divMio != null && aktienMio != null && aktienMio > 0 && kurs != null && kurs > 0) {
      const dps = Math.abs(divMio) / aktienMio
      const yld = (dps / kurs) * 100
      if (Number.isFinite(yld) && yld >= 0 && yld < 50) {
        yieldWerte[key] = yld
        hatYield = true
      }
    }
  }

  if (keys.includes(FUNDAMENTAL_TTM_KEY)) {
    if (yahoo?.payoutRatio != null && Number.isFinite(yahoo.payoutRatio) && yahoo.payoutRatio > 0) {
      const pct = yahoo.payoutRatio > 2 ? yahoo.payoutRatio : yahoo.payoutRatio * 100
      if (pct > 0 && pct < 500) {
        payoutWerte[FUNDAMENTAL_TTM_KEY] = pct
        hatPayout = true
      }
    } else if (payoutWerte[FUNDAMENTAL_TTM_KEY] == null) {
      const hist = keys.filter((k) => k !== FUNDAMENTAL_TTM_KEY && payoutWerte[k] != null)
      const last = hist[hist.length - 1]
      if (last) payoutWerte[FUNDAMENTAL_TTM_KEY] = payoutWerte[last]!
    }

    if (yahoo?.dividendYield != null && Number.isFinite(yahoo.dividendYield) && yahoo.dividendYield > 0) {
      const yld = yahoo.dividendYield < 1 ? yahoo.dividendYield * 100 : yahoo.dividendYield
      if (yld > 0 && yld < 50) {
        yieldWerte[FUNDAMENTAL_TTM_KEY] = yld
        hatYield = true
      }
    } else if (yieldWerte[FUNDAMENTAL_TTM_KEY] == null) {
      const hist = keys.filter((k) => k !== FUNDAMENTAL_TTM_KEY && yieldWerte[k] != null)
      const last = hist[hist.length - 1]
      if (last) yieldWerte[FUNDAMENTAL_TTM_KEY] = yieldWerte[last]!
    }
  }

  if (hatPayout) {
    upsertZeile(zeilen, {
      id: 'ausschuettungsquote',
      label: 'Ausschüttungsquote %',
      gruppe: 'bewertung_trailing',
      einheit: 'prozent',
      werte: payoutWerte,
    })
  }

  if (hatYield) {
    upsertZeile(zeilen, {
      id: 'dividendenrendite',
      label: 'Dividendenrendite %',
      gruppe: 'bewertung_trailing',
      einheit: 'prozent',
      werte: yieldWerte,
    })
  }
}
