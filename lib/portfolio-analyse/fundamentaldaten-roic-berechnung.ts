/**
 * Berechnet historische ROIC-Zeitreihe aus GuV/Bilanz.
 * Zusätzlich: ROIC ex Goodwill (NOPAT / (IC − Goodwill)).
 *
 * IC = Eigenkapital + verzinsliche Schulden — **ohne Cash-Abzug**.
 * Bargeld rauszurechnen lässt den Nenner bei cash-starken Qualitätsfirmen
 * (ASML, MA, …) kollabieren und erzeugt 80–130 %-Artefakte. Dieselbe
 * Brutto-Definition steht in `kapitalbasis-ableitung.ts`.
 */

import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { wertAusMapFuerIso } from '@/lib/portfolio-analyse/fundamentaldaten-wert-fuer-iso'

const DEFAULT_TAX = 0.21
/** Ex-Goodwill > 100 % ist fast immer ein Nenner-Artefakt. */
const MAX_ROIC_EX_GW = 100
const MAX_ROIC = 80

function wert(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  return wertAusMapFuerIso(zeilen.find((z) => z.id === id)?.werte, key)
}

function upsertZeile(
  zeilen: FundamentalMetrikZeile[],
  id: string,
  label: string,
  werte: Record<string, number | null>,
  nurFehlende = true,
  meta?: {
    gruppe?: FundamentalMetrikZeile['gruppe']
    einheit?: FundamentalMetrikZeile['einheit']
  },
): void {
  const existing = zeilen.find((z) => z.id === id)
  if (!existing) {
    zeilen.push({
      id,
      label,
      gruppe: meta?.gruppe ?? 'rentabilitaet',
      einheit: meta?.einheit ?? 'prozent',
      werte: { ...werte },
    })
    return
  }
  for (const [k, v] of Object.entries(werte)) {
    if (v == null) continue
    if (!nurFehlende || existing.werte[k] == null || !Number.isFinite(existing.werte[k]!)) {
      existing.werte[k] = v
    }
  }
}

function histKeysAusPerioden(perioden: FundamentalPeriode[]): string[] {
  const histKeys = perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
  const keys = [...histKeys]
  if (perioden.some((p) => p.iso === FUNDAMENTAL_TTM_KEY || p.istLtm)) {
    keys.push(FUNDAMENTAL_TTM_KEY)
  }
  return keys
}

function anzahlNonNull(zeilen: FundamentalMetrikZeile[], id: string, keys: string[]): number {
  const z = zeilen.find((r) => r.id === id)
  if (!z) return 0
  return keys.filter((k) => z.werte[k] != null && Number.isFinite(z.werte[k]!)).length
}

function investedBrutto(zeilen: FundamentalMetrikZeile[], key: string): number | null {
  const equity = wert(zeilen, 'eigenkapital', key)
  if (equity == null) return null
  const debt = wert(zeilen, 'gesamtverschuldung', key)
  const ic = equity + (debt ?? 0)
  return ic > 0 ? ic : null
}

function investedDurchschnitt(
  zeilen: FundamentalMetrikZeile[],
  key: string,
  histOnly: string[],
): number | null {
  const cur = investedBrutto(zeilen, key)
  if (key === FUNDAMENTAL_TTM_KEY) {
    const a = histOnly.length >= 1 ? investedBrutto(zeilen, histOnly[histOnly.length - 1]!) : null
    const b = histOnly.length >= 2 ? investedBrutto(zeilen, histOnly[histOnly.length - 2]!) : null
    if (a != null && b != null) return (a + b) / 2
    return a ?? cur
  }
  const idx = histOnly.indexOf(key)
  const prev = idx > 0 ? investedBrutto(zeilen, histOnly[idx - 1]!) : null
  if (prev != null && cur != null) return (prev + cur) / 2
  return cur
}

function ekDurchschnitt(
  zeilen: FundamentalMetrikZeile[],
  key: string,
  histOnly: string[],
): number | null {
  const cur = wert(zeilen, 'eigenkapital', key)
  if (key === FUNDAMENTAL_TTM_KEY) {
    const a = histOnly.length >= 1 ? wert(zeilen, 'eigenkapital', histOnly[histOnly.length - 1]!) : null
    const b = histOnly.length >= 2 ? wert(zeilen, 'eigenkapital', histOnly[histOnly.length - 2]!) : null
    if (a != null && b != null) return (a + b) / 2
    return a ?? cur
  }
  const idx = histOnly.indexOf(key)
  const prev = idx > 0 ? wert(zeilen, 'eigenkapital', histOnly[idx - 1]!) : null
  if (prev != null && cur != null) return (prev + cur) / 2
  return cur
}

function ttmSumme4(
  zeile: FundamentalMetrikZeile | undefined,
  iso: string,
  histOnly: string[],
): number | null {
  if (!zeile) return null
  const idx = histOnly.indexOf(iso)
  if (idx < 3) return null
  const window = histOnly.slice(idx - 3, idx + 1)
  for (let i = 1; i < window.length; i++) {
    const gap =
      (Date.parse(window[i]!) - Date.parse(window[i - 1]!)) / 86_400_000
    if (gap < 60 || gap > 130) return null
  }
  let sum = 0
  for (const k of window) {
    const v = zeile.werte[k]
    if (v == null || !Number.isFinite(v)) return null
    sum += v
  }
  return sum
}

/**
 * Quartals-Kennzahlen mit TTM-Zähler / Bestands-Nenner.
 * Einzelquartal-Flow ÷ Bilanz ergibt ~¼ Jahresrendite bzw. ×4 WC-Tage.
 */
export function ergaenzeQuartalsRenditenTTM(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): void {
  const histOnly = histKeysAusPerioden(perioden).filter((k) => k !== FUNDAMENTAL_TTM_KEY)

  // Immer Einzelquartal-Flow÷Bestand leeren (auch bei <4 Perioden)
  for (const id of [
    'roe',
    'roa',
    'roi',
    'roi_ex_goodwill',
    'kapitalumschlag',
    'anlagenumschlag',
    'forderungsumschlag',
    'dio',
    'dso',
    'dpo',
    'net_debt_ebitda',
    'ccc',
  ]) {
    const z = zeilen.find((r) => r.id === id)
    if (!z) continue
    for (const iso of histOnly) z.werte[iso] = null
  }

  if (histOnly.length < 4) return

  const roiWerte: Record<string, number | null> = {}
  const roiExGw: Record<string, number | null> = {}
  const roeWerte: Record<string, number | null> = {}
  const roaWerte: Record<string, number | null> = {}
  const umschlagWerte: Record<string, number | null> = {}
  const lagerUmschlag: Record<string, number | null> = {}
  const fordUmschlag: Record<string, number | null> = {}
  const dioWerte: Record<string, number | null> = {}
  const dsoWerte: Record<string, number | null> = {}
  const dpoWerte: Record<string, number | null> = {}
  const ndEbitdaWerte: Record<string, number | null> = {}
  let hatRoi = false
  let hatExGw = false
  let hatRoe = false
  let hatRoa = false
  let hatUmschlag = false
  let hatLager = false
  let hatFord = false
  let hatDio = false
  let hatDso = false
  let hatDpo = false
  let hatNdE = false

  const assetsDurchschnitt = (iso: string): number | null => {
    const cur = wert(zeilen, 'gesamtvermoegen', iso)
    const idx = histOnly.indexOf(iso)
    const prev = idx > 0 ? wert(zeilen, 'gesamtvermoegen', histOnly[idx - 1]!) : null
    if (prev != null && cur != null) return (prev + cur) / 2
    return cur
  }

  for (const iso of histOnly) {
    const ttmEbit = ttmSumme4(zeilen.find((z) => z.id === 'ebit'), iso, histOnly)
    const ttmNi = ttmSumme4(zeilen.find((z) => z.id === 'nettogewinn'), iso, histOnly)
    const ttmUmsatz = ttmSumme4(zeilen.find((z) => z.id === 'umsatz'), iso, histOnly)
    const ttmEbitda = ttmSumme4(zeilen.find((z) => z.id === 'ebitda'), iso, histOnly)
    const invested = investedDurchschnitt(zeilen, iso, histOnly)
    const goodwill = wert(zeilen, 'goodwill', iso)
    const assetsAvg = assetsDurchschnitt(iso)
    const vorraete = wert(zeilen, 'vorraete', iso)
    const forderungen = wert(zeilen, 'forderungen', iso)
    const lieferverb = wert(zeilen, 'lieferverbindlichkeiten', iso)
    const umsatzQ = wert(zeilen, 'umsatz', iso)
    const bruttoQ = wert(zeilen, 'bruttogewinn', iso)
    const cogsQ = umsatzQ != null && bruttoQ != null ? umsatzQ - bruttoQ : null
    // TTM-COGS: Summe Quartals-COGS aus Umsatz−Brutto
    let ttmCogs: number | null = null
    {
      const idx = histOnly.indexOf(iso)
      if (idx >= 3) {
        const window = histOnly.slice(idx - 3, idx + 1)
        let ok = true
        let sum = 0
        for (let i = 1; i < window.length; i++) {
          const gap =
            (Date.parse(window[i]!) - Date.parse(window[i - 1]!)) / 86_400_000
          if (gap < 60 || gap > 130) {
            ok = false
            break
          }
        }
        if (ok) {
          for (const k of window) {
            const u = wert(zeilen, 'umsatz', k)
            const b = wert(zeilen, 'bruttogewinn', k)
            if (u == null || b == null) {
              ok = false
              break
            }
            sum += u - b
          }
        }
        if (ok) ttmCogs = sum
      }
    }

    if (ttmEbit != null && invested != null && invested > 0) {
      const nopat = ttmEbit * (1 - DEFAULT_TAX)
      const roic = (nopat / invested) * 100
      if (Number.isFinite(roic) && Math.abs(roic) <= MAX_ROIC) {
        roiWerte[iso] = Math.round(roic * 10) / 10
        hatRoi = true
      } else {
        roiWerte[iso] = null
      }

      const hatGw = goodwill != null && goodwill > 0
      const investedExGw = hatGw ? invested - goodwill : invested
      const gwDominiert = hatGw && goodwill! >= invested * 0.85
      if (hatGw && investedExGw > 0 && !gwDominiert) {
        const roicX = (nopat / investedExGw) * 100
        if (Number.isFinite(roicX) && Math.abs(roicX) <= MAX_ROIC_EX_GW) {
          roiExGw[iso] = Math.round(roicX * 10) / 10
          hatExGw = true
        } else {
          roiExGw[iso] = null
        }
      } else if (!hatGw && roiWerte[iso] != null) {
        roiExGw[iso] = roiWerte[iso]
        hatExGw = true
      } else {
        roiExGw[iso] = null
      }
    } else {
      roiWerte[iso] = null
      roiExGw[iso] = null
    }

    const ekDen = ekDurchschnitt(zeilen, iso, histOnly)
    if (ttmNi != null && ekDen != null && ekDen > 0) {
      const roe = (ttmNi / ekDen) * 100
      // MA/V u. a. haben ROE > 150 % durch Buybacks — Cap nur gegen Skalenbruch
      if (Number.isFinite(roe) && Math.abs(roe) <= 500) {
        roeWerte[iso] = Math.round(roe * 10) / 10
        hatRoe = true
      } else {
        roeWerte[iso] = null
      }
    } else {
      roeWerte[iso] = null
    }

    if (ttmNi != null && assetsAvg != null && assetsAvg > 0) {
      const roa = (ttmNi / assetsAvg) * 100
      if (Number.isFinite(roa) && Math.abs(roa) <= 100) {
        roaWerte[iso] = Math.round(roa * 10) / 10
        hatRoa = true
      } else roaWerte[iso] = null
    } else roaWerte[iso] = null

    if (ttmUmsatz != null && assetsAvg != null && assetsAvg > 0) {
      const u = ttmUmsatz / assetsAvg
      if (Number.isFinite(u) && u > 0 && u < 50) {
        umschlagWerte[iso] = Math.round(u * 100) / 100
        hatUmschlag = true
      } else umschlagWerte[iso] = null
    } else umschlagWerte[iso] = null

    if (ttmCogs != null && ttmCogs > 0 && vorraete != null && vorraete > 0) {
      const turn = ttmCogs / vorraete
      if (Number.isFinite(turn) && turn > 0 && turn < 200) {
        lagerUmschlag[iso] = Math.round(turn * 100) / 100
        hatLager = true
      } else lagerUmschlag[iso] = null
      const dio = (vorraete / ttmCogs) * 365
      if (Number.isFinite(dio) && dio >= 0 && dio <= 800) {
        dioWerte[iso] = Math.round(dio * 10) / 10
        hatDio = true
      } else dioWerte[iso] = null
    } else {
      lagerUmschlag[iso] = null
      dioWerte[iso] = null
    }

    if (ttmUmsatz != null && ttmUmsatz > 0 && forderungen != null && forderungen > 0) {
      const turn = ttmUmsatz / forderungen
      if (Number.isFinite(turn) && turn > 0 && turn < 200) {
        fordUmschlag[iso] = Math.round(turn * 100) / 100
        hatFord = true
      } else fordUmschlag[iso] = null
      const dso = (forderungen / ttmUmsatz) * 365
      if (Number.isFinite(dso) && dso >= 0 && dso <= 800) {
        dsoWerte[iso] = Math.round(dso * 10) / 10
        hatDso = true
      } else dsoWerte[iso] = null
    } else {
      fordUmschlag[iso] = null
      dsoWerte[iso] = null
    }

    if (ttmCogs != null && ttmCogs > 0 && lieferverb != null && lieferverb > 0) {
      const dpo = (lieferverb / ttmCogs) * 365
      if (Number.isFinite(dpo) && dpo >= 0 && dpo <= 800) {
        dpoWerte[iso] = Math.round(dpo * 10) / 10
        hatDpo = true
      } else dpoWerte[iso] = null
    } else dpoWerte[iso] = null

    const nd = wert(zeilen, 'nettoverschuldung', iso)
    if (nd != null && ttmEbitda != null && ttmEbitda > 0) {
      ndEbitdaWerte[iso] = Math.round((nd / ttmEbitda) * 100) / 100
      hatNdE = true
    } else ndEbitdaWerte[iso] = null

    void cogsQ
  }

  if (hatRoi) {
    upsertZeile(zeilen, 'roi', 'Return on Invested Capital (ROIC %)', roiWerte, false)
  }
  if (hatExGw) {
    upsertZeile(zeilen, 'roi_ex_goodwill', 'ROIC ex Goodwill %', roiExGw, false)
  }
  if (hatRoe) {
    upsertZeile(zeilen, 'roe', 'Eigenkapitalrendite (ROE %)', roeWerte, false)
  }
  if (hatRoa) {
    upsertZeile(zeilen, 'roa', 'Gesamtkapitalrendite (ROA %)', roaWerte, false)
  }
  if (hatUmschlag) {
    upsertZeile(zeilen, 'kapitalumschlag', 'Kapitalumschlaghäufigkeit', umschlagWerte, false, {
      gruppe: 'umschlag',
      einheit: 'ratio',
    })
  }
  if (hatLager) {
    upsertZeile(zeilen, 'anlagenumschlag', 'Lagerumschlag', lagerUmschlag, false, {
      gruppe: 'umschlag',
      einheit: 'ratio',
    })
  }
  if (hatFord) {
    upsertZeile(zeilen, 'forderungsumschlag', 'Forderungsumschlag', fordUmschlag, false, {
      gruppe: 'umschlag',
      einheit: 'ratio',
    })
  }
  if (hatDio) {
    upsertZeile(zeilen, 'dio', 'Lagerdauer (DIO, Tage)', dioWerte, false, {
      gruppe: 'umschlag',
      einheit: 'zahl',
    })
  }
  if (hatDso) {
    upsertZeile(zeilen, 'dso', 'Forderungslaufzeit (DSO, Tage)', dsoWerte, false, {
      gruppe: 'umschlag',
      einheit: 'zahl',
    })
  }
  if (hatDpo) {
    upsertZeile(zeilen, 'dpo', 'Verbindlichkeitenlaufzeit (DPO, Tage)', dpoWerte, false, {
      gruppe: 'umschlag',
      einheit: 'zahl',
    })
  }
  if (hatNdE) {
    upsertZeile(zeilen, 'net_debt_ebitda', 'Net Debt / EBITDA (TTM)', ndEbitdaWerte, false, {
      gruppe: 'bewertung_trailing',
      einheit: 'multiple',
    })
  } else {
    // Falsche Quartals-ND/EBITDA (÷ Einzelquartal) entfernen
    const ndZ = zeilen.find((z) => z.id === 'net_debt_ebitda')
    if (ndZ) {
      for (const iso of histOnly) ndZ.werte[iso] = null
    }
  }

  // CCC neu aus korrigierten Tagen
  const dioZ = zeilen.find((z) => z.id === 'dio')
  const dsoZ = zeilen.find((z) => z.id === 'dso')
  const dpoZ = zeilen.find((z) => z.id === 'dpo')
  if (dsoZ || dioZ) {
    const ccc: Record<string, number | null> = {}
    let hatCcc = false
    for (const iso of histOnly) {
      const dsoV = dsoZ?.werte[iso] ?? null
      const dioV = dioZ?.werte[iso] ?? null
      const dpoV = dpoZ?.werte[iso] ?? 0
      if (dsoV == null && dioV == null) {
        ccc[iso] = null
        continue
      }
      const v = (dsoV ?? 0) + (dioV ?? 0) - (dpoV ?? 0)
      if (!Number.isFinite(v)) {
        ccc[iso] = null
        continue
      }
      ccc[iso] = Math.round(v * 10) / 10
      hatCcc = true
    }
    if (hatCcc) {
      upsertZeile(zeilen, 'ccc', 'Cash Conversion Cycle (Tage)', ccc, false, {
        gruppe: 'umschlag',
        einheit: 'zahl',
      })
    }
  }
}

/**
 * Füllt ROIC-Jahre in-place (Brutto-IC, Durchschnitt aus t und t−1).
 * Schreibt immer auch `roi_ex_goodwill`, wenn Goodwill + IC verfügbar.
 */
export function ergaenzeRoicAusBilanz(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): void {
  if (perioden.length === 0) return

  const keys = histKeysAusPerioden(perioden)
  const histOnly = keys.filter((k) => k !== FUNDAMENTAL_TTM_KEY)

  const roiWerte: Record<string, number | null> = {}
  const roiExGw: Record<string, number | null> = {}
  let hatRoi = false
  let hatExGw = false

  for (const key of keys) {
    const ebit = wert(zeilen, 'ebit', key)
    const goodwill = wert(zeilen, 'goodwill', key)
    const invested = investedDurchschnitt(zeilen, key, histOnly)

    if (ebit == null || invested == null || invested <= 0) {
      roiWerte[key] = null
      roiExGw[key] = null
      continue
    }

    const nopat = ebit * (1 - DEFAULT_TAX)
    const roic = (nopat / invested) * 100
    // Auch negative ROIC ausweisen (Verlustjahre); Extremwerte weiter kappen
    if (Number.isFinite(roic) && Math.abs(roic) <= MAX_ROIC) {
      roiWerte[key] = Math.round(roic * 10) / 10
      hatRoi = true
    } else {
      roiWerte[key] = null
    }

    const hatGoodwill = goodwill != null && goodwill > 0
    const investedExGw = hatGoodwill ? invested - goodwill : invested
    const gwDominiert = hatGoodwill && invested > 0 && goodwill! >= invested * 0.85
    if (hatGoodwill && investedExGw > 0 && !gwDominiert) {
      const roicX = (nopat / investedExGw) * 100
      if (Number.isFinite(roicX) && Math.abs(roicX) <= MAX_ROIC_EX_GW) {
        roiExGw[key] = Math.round(roicX * 10) / 10
        hatExGw = true
      } else {
        roiExGw[key] = null
      }
    } else if (invested > 0 && !hatGoodwill) {
      roiExGw[key] = roiWerte[key]
      if (roiExGw[key] != null) hatExGw = true
    } else {
      roiExGw[key] = null
    }
  }

  if (hatRoi) {
    upsertZeile(zeilen, 'roi', 'Return on Invested Capital (ROIC %)', roiWerte, false)
  }
  if (hatExGw) {
    upsertZeile(zeilen, 'roi_ex_goodwill', 'ROIC ex Goodwill %', roiExGw, false)
  } else {
    const gwN = anzahlNonNull(zeilen, 'goodwill', histOnly)
    const existing = zeilen.find((r) => r.id === 'roi_ex_goodwill')
    if (gwN > 0 && existing) {
      for (const key of keys) {
        existing.werte[key] = null
      }
    } else if (gwN === 0) {
      const roiZ = zeilen.find((r) => r.id === 'roi')
      if (roiZ) {
        const spiegel: Record<string, number | null> = {}
        for (const key of keys) {
          const v = roiZ.werte[key]
          if (v != null && Number.isFinite(v)) spiegel[key] = v
        }
        if (Object.keys(spiegel).length > 0) {
          upsertZeile(zeilen, 'roi_ex_goodwill', 'ROIC ex Goodwill %', spiegel, true)
        }
      }
    }
  }
}

/** Letzter verfügbarer ROIC ex Goodwill (für Key Metrics / Mantra). */
export function letzterRoicExGoodwill(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): number | null {
  const keys = histKeysAusPerioden(perioden).filter((k) => k !== FUNDAMENTAL_TTM_KEY)
  const z = zeilen.find((r) => r.id === 'roi_ex_goodwill')
  if (!z) return null
  for (let i = keys.length - 1; i >= 0; i--) {
    const v = z.werte[keys[i]!]
    if (v != null && Number.isFinite(v)) return v
  }
  const ttm = z.werte[FUNDAMENTAL_TTM_KEY]
  return ttm != null && Number.isFinite(ttm) ? ttm : null
}
