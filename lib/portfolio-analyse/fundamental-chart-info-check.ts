/**
 * Regelbasierte Ampel: erfüllt die Aktie die Chart-Erklärung (Gut/Achtung)?
 * Keine KI — nur Kennzahlen aus dem gleichen Chart-Datensatz.
 */

import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type {
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

/** Panel-IDs der Qualitäts-Charts (+ eigene Auswahl). */
export type ChartInfoPanelId =
  | 'gewinn'
  | 'umsatz'
  | 'guv'
  | 'kosten'
  | 'rendite'
  | 'multiples'
  | 'verschuldung'
  | 'working_capital'
  | 'buyback'
  | 'eigen'

export type ChartInfoUrteilStatus = 'gut' | 'gemischt' | 'achtung' | 'unbekannt'

export type ChartInfoUrteil = {
  status: ChartInfoUrteilStatus
  /** Kurz: „Erfüllt“ / „Teilweise“ / … */
  label: string
  /** Ein Satz mit Bezug auf die Zahlen dieser Aktie. */
  text: string
}

type Punkt = { iso: string; v: number }

function istIstPeriode(p: FundamentalPeriode): boolean {
  return !p.istLtm && !p.istNtm && !p.istSchaetzung && p.iso !== FUNDAMENTAL_TTM_KEY
}

function serie(
  zeilen: FundamentalMetrikZeile[],
  id: string,
  perioden: FundamentalPeriode[],
): Punkt[] {
  const z = zeilen.find((x) => x.id === id)
  if (!z) return []
  const out: Punkt[] = []
  for (const p of perioden) {
    if (!istIstPeriode(p)) continue
    const v = z.werte[p.iso]
    if (v == null || !Number.isFinite(v)) continue
    out.push({ iso: p.iso, v })
  }
  return out
}

function letzter(s: Punkt[]): number | null {
  return s.length > 0 ? s[s.length - 1]!.v : null
}

/** CAGR grob über die Serie (erstes → letztes). */
function cagr(s: Punkt[]): number | null {
  if (s.length < 2) return null
  const a = s[0]!.v
  const b = s[s.length - 1]!.v
  if (a === 0 || !Number.isFinite(a) || !Number.isFinite(b)) return null
  if (a < 0 && b < 0) return null
  const jahre = Math.max(1, s.length - 1)
  if (a < 0 || b < 0) return (b - a) / Math.abs(a) / jahre
  return Math.pow(b / a, 1 / jahre) - 1
}

function trendSteigend(s: Punkt[], minPunkte = 3): boolean | null {
  if (s.length < minPunkte) return null
  const slice = s.slice(-Math.min(5, s.length))
  const a = slice[0]!.v
  const b = slice[slice.length - 1]!.v
  if (a === 0) return b > 0
  return b >= a * 0.98
}

function trendFallend(s: Punkt[], minPunkte = 3): boolean | null {
  const t = trendSteigend(s, minPunkte)
  if (t == null) return null
  if (s.length < minPunkte) return null
  const slice = s.slice(-Math.min(5, s.length))
  const a = slice[0]!.v
  const b = slice[slice.length - 1]!.v
  return b < a * 0.95
}

function absWert(v: number): number {
  return Math.abs(v)
}

function labelFuer(status: ChartInfoUrteilStatus): string {
  switch (status) {
    case 'gut':
      return 'Erfüllt'
    case 'gemischt':
      return 'Teilweise'
    case 'achtung':
      return 'Eher nicht'
    default:
      return 'Unklar'
  }
}

function urteil(status: ChartInfoUrteilStatus, text: string): ChartInfoUrteil {
  return { status, label: labelFuer(status), text }
}

function checkGewinn(zeilen: FundamentalMetrikZeile[], perioden: FundamentalPeriode[]): ChartInfoUrteil {
  const fcf = serie(zeilen, 'fcf', perioden)
  const ni = serie(zeilen, 'nettogewinn', perioden)
  const ocf = serie(zeilen, 'ocf', perioden)
  const div = serie(zeilen, 'dividenden_gezahlt', perioden)
  const eps = serie(zeilen, 'eps', perioden)

  const fcfL = letzter(fcf)
  const niL = letzter(ni)
  const divL = letzter(div)
  const ocfL = letzter(ocf)

  let gut = 0
  let schlecht = 0
  const gründe: string[] = []

  if (fcfL != null && niL != null && niL > 0) {
    const conv = fcfL / niL
    if (conv >= 0.85) {
      gut++
      gründe.push(`FCF-Conversion ~${Math.round(conv * 100)}%`)
    } else if (conv >= 0.55) {
      gut++
      schlecht++
      gründe.push(`FCF-Conversion nur ~${Math.round(conv * 100)}%`)
    } else {
      schlecht++
      gründe.push(`schwache FCF-Conversion (~${Math.round(conv * 100)}%)`)
    }
  } else if (fcfL != null && ocfL != null && ocfL > 0) {
    const conv = fcfL / ocfL
    if (conv >= 0.7) {
      gut++
      gründe.push('FCF nahe am operativen Cashflow')
    } else {
      schlecht++
      gründe.push('FCF bleibt hinter dem OCF zurück')
    }
  }

  const fcfUp = trendSteigend(fcf)
  const niUp = trendSteigend(ni)
  if (fcfUp === true && (niUp === true || niUp == null)) {
    gut++
    gründe.push('FCF im Trend stabil/steigend')
  } else if (fcfUp === false && niUp === true) {
    schlecht++
    gründe.push('Gewinn steigt, FCF nicht')
  }

  if (divL != null && fcfL != null && fcfL > 0) {
    const cover = absWert(divL) / fcfL
    if (cover <= 0.7) {
      gut++
      gründe.push('Dividende vom FCF gedeckt')
    } else if (cover <= 1.05) {
      gut++
      schlecht++
      gründe.push('Dividende zehrt den Großteil des FCF')
    } else {
      schlecht++
      gründe.push('Dividende übersteigt den FCF')
    }
  }

  const epsUp = trendSteigend(eps)
  if (epsUp === true) {
    gut++
    gründe.push('EPS wächst')
  } else if (epsUp === false) {
    schlecht++
    gründe.push('EPS fällt')
  }

  if (gut === 0 && schlecht === 0) {
    return urteil('unbekannt', 'Zu wenige Gewinn-/Cashflow-Jahre für ein Urteil.')
  }
  if (schlecht === 0 && gut >= 2) {
    return urteil('gut', `Passt: ${gründe.slice(0, 2).join('; ')}.`)
  }
  if (gut === 0 || schlecht >= gut + 1) {
    return urteil('achtung', `Warnsignale: ${gründe.filter((_, i) => i < 2).join('; ')}.`)
  }
  return urteil('gemischt', `Gemischt: ${gründe.slice(0, 2).join('; ')}.`)
}

function checkUmsatz(zeilen: FundamentalMetrikZeile[], perioden: FundamentalPeriode[]): ChartInfoUrteil {
  const umsatz = serie(zeilen, 'umsatz', perioden)
  const brutto = serie(zeilen, 'bruttomarge', perioden)
  const ebit = serie(zeilen, 'ebit_marge', perioden)
  const netto = serie(zeilen, 'nettomarge', perioden)

  const uCagr = cagr(umsatz)
  const b0 = brutto.length >= 2 ? brutto[0]!.v : null
  const b1 = letzter(brutto)
  const e0 = ebit.length >= 2 ? ebit[0]!.v : null
  const e1 = letzter(ebit)

  let gut = 0
  let schlecht = 0
  const gründe: string[] = []

  if (uCagr != null) {
    if (uCagr >= 0.03) {
      gut++
      gründe.push(`Umsatz +${(uCagr * 100).toFixed(0)}% p.a.`)
    } else if (uCagr >= -0.02) {
      gut++
      schlecht++
      gründe.push('Umsatz flach')
    } else {
      schlecht++
      gründe.push(`Umsatz ${(uCagr * 100).toFixed(0)}% p.a.`)
    }
  }

  if (b0 != null && b1 != null) {
    const d = b1 - b0
    if (d >= -1) {
      gut++
      gründe.push(d >= 0.5 ? 'Bruttomarge steigt' : 'Bruttomarge stabil')
    } else {
      schlecht++
      gründe.push(`Bruttomarge −${Math.abs(d).toFixed(1)} Pp.`)
    }
  } else if (e0 != null && e1 != null) {
    if (e1 >= e0 - 1) {
      gut++
      gründe.push('EBIT-Marge stabil')
    } else {
      schlecht++
      gründe.push('EBIT-Marge bröckelt')
    }
  }

  const n1 = letzter(netto)
  if (n1 != null && n1 > 15) {
    gut++
  } else if (n1 != null && n1 < 5) {
    schlecht++
  }

  if (gut === 0 && schlecht === 0) return urteil('unbekannt', 'Zu wenige Umsatz-/Margen-Jahre.')
  if (schlecht === 0) return urteil('gut', `Passt: ${gründe.slice(0, 2).join('; ')}.`)
  if (gut === 0 || schlecht > gut) return urteil('achtung', `Warnsignale: ${gründe.slice(0, 2).join('; ')}.`)
  return urteil('gemischt', `Gemischt: ${gründe.slice(0, 2).join('; ')}.`)
}

function checkGuv(zeilen: FundamentalMetrikZeile[], perioden: FundamentalPeriode[]): ChartInfoUrteil {
  const umsatz = serie(zeilen, 'umsatz', perioden)
  const ebit = serie(zeilen, 'ebit', perioden)
  const ni = serie(zeilen, 'nettogewinn', perioden)
  const uC = cagr(umsatz)
  const eC = cagr(ebit)
  const nC = cagr(ni)

  if (uC == null || (eC == null && nC == null)) {
    return urteil('unbekannt', 'Zu wenige GuV-Jahre für den Hebel-Check.')
  }
  const unten = eC ?? nC!
  if (unten >= uC - 0.01 && unten > -0.05) {
    return urteil(
      'gut',
      `Operativer Hebel ok: unten (${(unten * 100).toFixed(0)}% p.a.) hält mit dem Umsatz (${(uC * 100).toFixed(0)}% p.a.) mit.`,
    )
  }
  if (unten < uC - 0.05 || unten < -0.05) {
    return urteil(
      'achtung',
      `Unten kommt weniger an: unten ${(unten * 100).toFixed(0)}% vs. Umsatz ${(uC * 100).toFixed(0)}% p.a.`,
    )
  }
  return urteil('gemischt', 'Hebel unklar — Umsatz und Gewinn laufen nicht klar synchron.')
}

function checkKosten(zeilen: FundamentalMetrikZeile[], perioden: FundamentalPeriode[]): ChartInfoUrteil {
  const umsatz = serie(zeilen, 'umsatz', perioden)
  const sga = serie(zeilen, 'sga', perioden)
  const sbc = serie(zeilen, 'sbc', perioden)
  const capex = serie(zeilen, 'capex', perioden)
  const fcf = serie(zeilen, 'fcf', perioden)

  const gründe: string[] = []
  let gut = 0
  let schlecht = 0

  if (umsatz.length >= 2 && sga.length >= 2) {
    const u0 = umsatz[0]!.v
    const u1 = letzter(umsatz)!
    const s0 = absWert(sga[0]!.v)
    const s1 = absWert(letzter(sga)!)
    if (u0 > 0 && u1 > 0) {
      const r0 = s0 / u0
      const r1 = s1 / u1
      if (r1 <= r0 * 1.05) {
        gut++
        gründe.push('SG&A wächst nicht schneller als Umsatz')
      } else {
        schlecht++
        gründe.push('SG&A läuft dem Umsatz davon')
      }
    }
  }

  const sbcL = letzter(sbc)
  const fcfL = letzter(fcf)
  if (sbcL != null && fcfL != null && fcfL > 0) {
    const r = absWert(sbcL) / fcfL
    if (r <= 0.25) {
      gut++
      gründe.push('SBC klein vs. FCF')
    } else if (r <= 0.5) {
      gut++
      schlecht++
      gründe.push('SBC spürbar vs. FCF')
    } else {
      schlecht++
      gründe.push('SBC hoch vs. FCF')
    }
  }

  const capL = letzter(capex)
  if (capL != null && fcfL != null && fcfL > 0 && absWert(capL) > fcfL * 1.5 && trendSteigend(capex)) {
    schlecht++
    gründe.push('CapEx steigt stark vs. FCF')
  }

  if (gut === 0 && schlecht === 0) return urteil('unbekannt', 'Kosten-/Reinvestitionsdaten zu dünn.')
  if (schlecht === 0) return urteil('gut', `Passt: ${gründe.slice(0, 2).join('; ')}.`)
  if (gut === 0 || schlecht > gut) return urteil('achtung', `Warnsignale: ${gründe.slice(0, 2).join('; ')}.`)
  return urteil('gemischt', `Gemischt: ${gründe.slice(0, 2).join('; ')}.`)
}

function checkRendite(zeilen: FundamentalMetrikZeile[], perioden: FundamentalPeriode[]): ChartInfoUrteil {
  const roic = serie(zeilen, 'roi', perioden)
  const roicX = serie(zeilen, 'roi_ex_goodwill', perioden)
  const roe = serie(zeilen, 'roe', perioden)
  const r = letzter(roic) ?? letzter(roe)
  const rX = letzter(roicX)
  const fall = trendFallend(roic.length >= 3 ? roic : roe)

  if (r == null) return urteil('unbekannt', 'Keine ROIC/ROE-Serie.')

  if (r >= 15 && fall !== true) {
    const gw =
      rX != null && r != null && rX > 0 && r / rX > 1.4
        ? ' — Achtung: große Goodwill-Lücke'
        : ''
    if (gw) return urteil('gemischt', `ROIC/ROE ~${r.toFixed(0)}% ist stark${gw}.`)
    return urteil('gut', `Kapitalverzinsung stark (~${r.toFixed(0)}%), Trend nicht erodierend.`)
  }
  if (r >= 8 && fall !== true) {
    return urteil('gemischt', `Kapitalverzinsung ok (~${r.toFixed(0)}%), aber kein Top-Niveau.`)
  }
  if (fall === true) {
    return urteil('achtung', `Rendite fällt über die Jahre (zuletzt ~${r.toFixed(0)}%).`)
  }
  return urteil('achtung', `Kapitalverzinsung schwach (~${r.toFixed(0)}%).`)
}

function checkMultiples(zeilen: FundamentalMetrikZeile[], perioden: FundamentalPeriode[]): ChartInfoUrteil {
  const kgv = serie(zeilen, 'kgv', perioden)
  const pfcf = serie(zeilen, 'pfcf', perioden)
  const fcfR = serie(zeilen, 'fcf_rendite', perioden)
  const s = kgv.length >= 3 ? kgv : pfcf
  if (s.length < 3) return urteil('unbekannt', 'Zu kurze Multiple-Historie.')

  const last = s[s.length - 1]!.v
  const hist = s.slice(0, -1).map((p) => p.v).sort((a, b) => a - b)
  const med = hist[Math.floor(hist.length / 2)]!
  const fcfLast = letzter(fcfR)

  if (last <= med * 0.9) {
    return urteil('gut', `Multiple unter eigener Historie (aktuell ${last.toFixed(1)} vs. Median ${med.toFixed(1)}).`)
  }
  if (fcfLast != null && fcfLast >= 5 && last <= med * 1.15) {
    return urteil('gut', `FCF-Rendite ~${fcfLast.toFixed(1)}% bei Multiple nahe der Historie.`)
  }
  if (last >= med * 1.25) {
    return urteil('achtung', `Multiple am oberen Rand (${last.toFixed(1)} vs. Median ${med.toFixed(1)}).`)
  }
  return urteil('gemischt', `Multiple nah an der eigenen Historie (${last.toFixed(1)} ≈ Median ${med.toFixed(1)}).`)
}

function checkVerschuldung(zeilen: FundamentalMetrikZeile[], perioden: FundamentalPeriode[]): ChartInfoUrteil {
  const ndE = serie(zeilen, 'net_debt_ebitda', perioden)
  const netto = serie(zeilen, 'nettoverschuldung', perioden)
  const nd = letzter(ndE)
  const n = letzter(netto)

  if (nd != null) {
    if (nd <= 0) return urteil('gut', `Netto-Cash / negatives Multiple (Nettoverschuldung/EBITDA ${nd.toFixed(1)}×).`)
    if (nd <= 1.5) return urteil('gut', `Niedrige Verschuldung (${nd.toFixed(1)}× EBITDA).`)
    if (nd <= 3) return urteil('gemischt', `Moderate Verschuldung (${nd.toFixed(1)}× EBITDA).`)
    return urteil('achtung', `Hohe Verschuldung (${nd.toFixed(1)}× EBITDA).`)
  }
  if (n != null) {
    if (n <= 0) return urteil('gut', 'Netto-Cash-Position.')
    if (trendSteigend(netto) === true) return urteil('achtung', 'Nettoverschuldung steigt.')
    return urteil('gemischt', 'Verschuldung vorhanden — EBITDA-Multiple fehlt.')
  }
  return urteil('unbekannt', 'Keine brauchbare Verschuldungs-Serie.')
}

function checkWorkingCapital(zeilen: FundamentalMetrikZeile[], perioden: FundamentalPeriode[]): ChartInfoUrteil {
  const dso = serie(zeilen, 'dso', perioden)
  const dio = serie(zeilen, 'dio', perioden)
  const dpo = serie(zeilen, 'dpo', perioden)

  let schlecht = 0
  let gut = 0
  const gründe: string[] = []

  for (const [name, s] of [
    ['DSO', dso],
    ['DIO', dio],
  ] as const) {
    if (s.length < 2) continue
    const a = s[Math.max(0, s.length - 4)]!.v
    const b = s[s.length - 1]!.v
    if (a <= 0) continue
    const d = (b - a) / a
    if (d <= 0.05) {
      gut++
      gründe.push(`${name} stabil`)
    } else if (d <= 0.2) {
      schlecht++
      gründe.push(`${name} steigt leicht`)
    } else {
      schlecht++
      gründe.push(`${name} +${Math.round(d * 100)}%`)
    }
  }

  if (dpo.length >= 2) {
    const a = dpo[Math.max(0, dpo.length - 4)]!.v
    const b = dpo[dpo.length - 1]!.v
    if (a > 0 && (b - a) / a > 0.25) {
      schlecht++
      gründe.push('DPO springt hoch')
    }
  }

  if (gut === 0 && schlecht === 0) return urteil('unbekannt', 'Zu wenige Working-Capital-Jahre.')
  if (schlecht === 0) return urteil('gut', `Cash-Zyklus ok: ${gründe.slice(0, 2).join('; ')}.`)
  if (gut === 0 || schlecht > gut) return urteil('achtung', `WC-Warnung: ${gründe.slice(0, 2).join('; ')}.`)
  return urteil('gemischt', `Gemischt: ${gründe.slice(0, 2).join('; ')}.`)
}

function checkBuyback(zeilen: FundamentalMetrikZeile[], perioden: FundamentalPeriode[]): ChartInfoUrteil {
  const aktien = serie(zeilen, 'aktien', perioden)
  const buy = serie(zeilen, 'aktienrueckkauf', perioden)
  if (aktien.length < 2) return urteil('unbekannt', 'Keine brauchbare Aktienzahl-Serie.')

  const a0 = aktien[0]!.v
  const a1 = aktien[aktien.length - 1]!.v
  const d = a0 !== 0 ? (a1 - a0) / absWert(a0) : 0
  const buyAktiv = buy.some((p) => absWert(p.v) > 0)

  if (d <= -0.05) {
    return urteil('gut', `Aktienzahl fällt klar (${(d * 100).toFixed(0)}% über die Serie) — echte Verknappung.`)
  }
  if (d <= 0.02 && buyAktiv) {
    return urteil('gemischt', 'Rückkäufe sichtbar, Aktienzahl aber nur flach — SBC kann den Buyback auffressen.')
  }
  if (d > 0.05) {
    return urteil('achtung', `Aktienzahl steigt (${(d * 100).toFixed(0)}%) — Verwässerung.`)
  }
  return urteil('gemischt', 'Aktienzahl weitgehend flach.')
}

function checkEigen(zeilen: FundamentalMetrikZeile[], perioden: FundamentalPeriode[]): ChartInfoUrteil {
  const fcf = serie(zeilen, 'fcf', perioden)
  const ni = serie(zeilen, 'nettogewinn', perioden)
  if (fcf.length >= 2 && ni.length >= 2) {
    return checkGewinn(zeilen, perioden)
  }
  const umsatz = serie(zeilen, 'umsatz', perioden)
  if (umsatz.length >= 2) return checkUmsatz(zeilen, perioden)
  return urteil('unbekannt', 'Wähle Reihen, die zusammen eine Geschichte erzählen — dann greift die Ampel.')
}

const CHECKS: Record<
  ChartInfoPanelId,
  (zeilen: FundamentalMetrikZeile[], perioden: FundamentalPeriode[]) => ChartInfoUrteil
> = {
  gewinn: checkGewinn,
  umsatz: checkUmsatz,
  guv: checkGuv,
  kosten: checkKosten,
  rendite: checkRendite,
  multiples: checkMultiples,
  verschuldung: checkVerschuldung,
  working_capital: checkWorkingCapital,
  buyback: checkBuyback,
  eigen: checkEigen,
}

export function bewerteChartInfoFuerAktie(
  panelId: ChartInfoPanelId,
  zeilen: FundamentalMetrikZeile[],
  perioden: FundamentalPeriode[],
): ChartInfoUrteil {
  const fn = CHECKS[panelId]
  try {
    return fn(zeilen, perioden)
  } catch {
    return urteil('unbekannt', 'Bewertung fehlgeschlagen.')
  }
}
