/**
 * Faktenblatt: jede Zahl, die im Video vorkommen darf, rechnet der Code — nie die KI.
 * Fehlt ein Wert, fehlt der Fakt. Es wird nichts geschätzt.
 */
import { baueScorecard } from '@/lib/portfolio-analyse/fundamentaldaten-scorecard'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { gesamtScoreAusPfeilern, type MoatKiBewertung } from '@/lib/portfolio-analyse/moat-ki-types'
import { metrikenAusPaket } from '@/lib/youtube/moat-short-zahlen'
import { pfeilerAufZielScore, urteilAusMoatScore } from '@/lib/youtube/moat-short-urteil'
import { monatJahr, pct, scorecardTextEnglisch, usd } from '@/lib/youtube/longform/longform-format'
import {
  LONGFORM_INVEST_USD,
  type LongformChart10k,
  type LongformFakt,
  type LongformFaktenblatt,
  type LongformMoat,
  type LongformScorecardSpalte,
  type LongformSegmente,
} from '@/lib/youtube/longform/longform-types'

const PFEILER_LABEL: Record<string, string> = {
  preissetzungsmacht: 'Pricing power',
  replikationsbarriere: 'Hard to copy',
  wechselkosten: 'Switching costs',
  marktdichte: 'Market control',
}

const URTEIL_EN: Record<string, string> = {
  tief: 'wide moat',
  moderat: 'narrow moat',
  schwach: 'weak moat',
  unklar: 'unclear moat',
}

const BALKEN_EN: Record<string, string> = {
  gewinnstabilitaet: 'Earnings stability',
  gewinnwachstum: 'Earnings growth',
  umsatzwachstum: 'Revenue growth',
  tilgungsjahre: 'Years to repay debt',
  discount: 'Discount',
  dividendenrendite: 'Dividend yield',
  dividendenstabilitaet: 'Dividend stability',
  dividendenwachstum: 'Dividend growth',
  ausschuettung: 'Payout ratio',
  fcfDeckung: 'FCF coverage',
  zinsdeckung: 'Interest coverage',
  fcfConversion: 'FCF conversion',
  verwaesserung: 'Share count p.a.',
  fwdWachstum: 'Exp. EPS growth',
  nrr: 'Net revenue retention',
  roic: 'ROIC',
  bruttomarge: 'Pricing power',
  bruttoStabilitaet: 'Margin stability',
  moatErosion: 'Moat status',
  renditeVerfall: 'Return decay',
  wachstumSubstanz: 'Growth quality',
  roic5y: 'ROIC model',
  incrementalRoic: 'Incremental ROIC',
  mantraQualitaet: 'Quality checklist',
}

type FaktEingabe = Omit<LongformFakt, 'stichtag' | 'quelle'> & { stichtag?: string; quelle?: string }

export type FaktenblattEingabe = {
  paket: FundamentaldatenPaket
  isin: string | null
  exportDatum: string
  chart: LongformChart10k | null
  moatKi: MoatKiBewertung | null
  logoUrl: string | null
  imDepot: boolean | null
}

export function baueFaktenblatt(e: FaktenblattEingabe): LongformFaktenblatt {
  const { paket } = e
  const fakten: LongformFakt[] = []
  const hinweise: string[] = []
  const exportTag = e.exportDatum.slice(0, 10)
  const add = (f: FaktEingabe, standard: { stichtag: string; quelle: string }) => {
    if (f.einheit !== 'text' && (f.wert == null || !Number.isFinite(f.wert))) return
    fakten.push({ ...f, stichtag: f.stichtag ?? standard.stichtag, quelle: f.quelle ?? standard.quelle })
  }

  const c = e.chart
  if (c) {
    const s = { stichtag: c.endDatum, quelle: 'Yahoo Finance, Tageskurse (adjclose = Dividenden reinvestiert)' }
    const invest = LONGFORM_INVEST_USD
    const rendite = (c.endwertGesamt / invest - 1) * 100
    const cagr = (Math.pow(c.endwertGesamt / invest, 1 / c.jahre) - 1) * 100
    const divUsd = c.endwertGesamt - c.endwertNurKurs
    add({ id: 'k10.invest', label: 'Amount invested', wert: invest, text: usd(invest), einheit: 'usd' }, s)
    add({ id: 'k10.start', label: 'Start date', wert: null, text: monatJahr(c.startDatum), einheit: 'text' }, s)
    add({ id: 'k10.jahre', label: 'Holding period (years)', wert: c.jahre, text: `${Math.round(c.jahre)} years`, einheit: 'jahre' }, s)
    add({ id: 'k10.endwert', label: 'Value today, dividends reinvested', wert: c.endwertGesamt, text: usd(c.endwertGesamt), einheit: 'usd' }, s)
    add({ id: 'k10.rendite', label: 'Total return', wert: rendite, text: pct(rendite), einheit: 'pct' }, s)
    add({ id: 'k10.cagr', label: 'Annual return (CAGR)', wert: cagr, text: pct(cagr), einheit: 'pct' }, s)
    add({ id: 'k10.nur_kurs', label: 'Value today, price only', wert: c.endwertNurKurs, text: usd(c.endwertNurKurs), einheit: 'usd' }, s)
    if (divUsd > 50) {
      add({ id: 'k10.dividenden_usd', label: 'Extra from reinvested dividends', wert: divUsd, text: usd(divUsd), einheit: 'usd' }, s)
    }
    if (c.endwertSpy != null) {
      const spyRendite = (c.endwertSpy / invest - 1) * 100
      add({ id: 'k10.spy_endwert', label: 'Same $10,000 in the S&P 500 (SPY)', wert: c.endwertSpy, text: usd(c.endwertSpy), einheit: 'usd' }, s)
      add({ id: 'k10.spy_rendite', label: 'S&P 500 total return', wert: spyRendite, text: pct(spyRendite), einheit: 'pct' }, s)
      const diff = c.endwertGesamt - c.endwertSpy
      add({ id: 'k10.vs_spy', label: diff >= 0 ? 'Ahead of the S&P 500 by' : 'Behind the S&P 500 by', wert: Math.abs(diff), text: usd(Math.abs(diff)), einheit: 'usd' }, s)
    }
    if (c.drawdown) {
      add({ id: 'k10.drawdown', label: 'Worst drop from a high', wert: c.drawdown.pct, text: pct(c.drawdown.pct), einheit: 'pct' }, s)
      add({ id: 'k10.drawdown_hoch', label: 'Drop started', wert: null, text: monatJahr(c.drawdown.hochDatum), einheit: 'text' }, s)
      add({ id: 'k10.drawdown_tief', label: 'Bottom', wert: null, text: monatJahr(c.drawdown.tiefDatum), einheit: 'text' }, s)
      const tiefWert = c.punkte.reduce((m, p) => (p.d <= c.drawdown!.tiefDatum ? p.aktie : m), c.punkte[0]?.aktie ?? 0)
      add({ id: 'k10.drawdown_wert', label: 'Your $10,000 at the bottom', wert: tiefWert, text: usd(tiefWert), einheit: 'usd' }, s)
    }
    if (c.waehrung !== 'USD') hinweise.push(`Kurse in ${c.waehrung}, für die 10.000-$-Rechnung tagesgenau in USD umgerechnet.`)
  } else {
    hinweise.push('Keine 10-Jahres-Kurshistorie gefunden — der Chart-Abschnitt hat keine Zahlen.')
  }

  const exp = { stichtag: exportTag, quelle: 'Fundamentaldaten-Export, Kennzahlen' }
  for (const m of metrikenAusPaket(paket)) {
    const roh = paket.keyMetrics.find((k) => k.id === m.id)?.zahl ?? null
    add({ id: `km.${m.id}`, label: m.label, wert: roh, text: m.value, einheit: m.value.endsWith('%') ? 'pct' : m.value.endsWith('pts') ? 'pp' : 'x' }, exp)
  }

  let burggraben: LongformScorecardSpalte | null = null
  try {
    const sc = baueScorecard(paket, e.isin)
    const sp = sc.strategien.find((x) => x.id === 'burggraben')
    if (sp) {
      burggraben = {
        titel: 'Moat',
        score: sp.score,
        balken: sp.balken.map((b) => ({
          label: BALKEN_EN[b.id] ?? b.label,
          wertText: scorecardTextEnglisch(b.wertText),
          position: b.position,
        })),
      }
      if (sp.score != null) {
        add({ id: 'sc.burggraben', label: 'Scorecard: moat quality (1–10)', wert: sp.score, text: `${sp.score} out of 10`, einheit: 'score' }, { stichtag: exportTag, quelle: 'Scorecard der App (baueScorecard)' })
      }
    }
  } catch {
    hinweise.push('Scorecard konnte nicht berechnet werden.')
  }

  let moat: LongformMoat | null = null
  if (e.moatKi) {
    const zielScore = burggraben?.score != null && Number.isFinite(burggraben.score) ? burggraben.score : null
    const rohScores = e.moatKi.pfeiler.map((p) => Math.round(p.score))
    const kalibriert = zielScore != null ? pfeilerAufZielScore(rohScores, zielScore) : rohScores
    const s = {
      stichtag: (e.moatKi.stand || exportTag).slice(0, 10),
      quelle:
        zielScore != null
          ? 'Moat-Check, Gesamtscore = Scorecard-Burggraben; Pfeiler relativ kalibriert'
          : 'Moat-Check (KI-Bewertung der App)',
    }
    const pfeiler = e.moatKi.pfeiler.map((p, i) => ({
      id: p.id,
      label: PFEILER_LABEL[p.id] ?? p.id,
      score: kalibriert[i] ?? Math.round(p.score),
      begruendung: p.begruendung,
      risiko: p.risiko,
    }))
    const score =
      zielScore != null
        ? Math.round(zielScore * 10) / 10
        : pfeiler.length
          ? gesamtScoreAusPfeilern(pfeiler.map((p) => p.score))
          : e.moatKi.score
    const urteilKey = zielScore != null ? urteilAusMoatScore(score) : e.moatKi.urteil
    moat = {
      pfeiler,
      score,
      urteil: URTEIL_EN[urteilKey] ?? urteilKey,
      geschaeftsmodell: e.moatKi.geschaeftsmodell,
      zerstoerung: e.moatKi.zerstoerungsszenarien ?? [],
    }
    add({ id: 'moat.score', label: 'Moat score (out of 10)', wert: score, text: `${score} out of 10`, einheit: 'score' }, s)
    add({ id: 'moat.urteil', label: 'Moat verdict', wert: null, text: moat.urteil, einheit: 'text' }, s)
    for (const p of pfeiler) {
      add({ id: `moat.${p.id}`, label: `${p.label} (out of 10)`, wert: p.score, text: `${p.score} out of 10`, einheit: 'score' }, s)
    }
  } else {
    hinweise.push('Kein Moat-Check vorhanden — die Pfeiler-Szene entfällt.')
  }

  const segmente = segmenteAus(paket)
  if (segmente) {
    const s = { stichtag: exportTag, quelle: `SEC-Segmente ${segmente.art === 'geo' ? 'nach Region' : 'nach Produkt'}${segmente.jahr ? ` FY${segmente.jahr}` : ''}` }
    segmente.eintraege.forEach((x, i) => {
      add({ id: `seg.${i}`, label: `Revenue share: ${x.name}`, wert: x.anteilPct, text: pct(x.anteilPct), einheit: 'pct' }, s)
    })
  } else {
    hinweise.push('Kein Umsatzmix im Export (bei EU/CH/UK üblich). Lade ein IR-Dokument hoch, sonst entfällt die Segmentgrafik.')
  }

  return {
    ticker: (paket.symbolYahoo?.split('.')[0] || paket.ticker).toUpperCase(),
    firmenname: paket.firmenname,
    isin: e.isin,
    symbolYahoo: paket.symbolYahoo,
    sektor: paket.sektor,
    branche: paket.branche,
    beschreibung: paket.beschreibung,
    website: paket.website,
    exportDatum: exportTag,
    kursDatum: c?.endDatum ?? null,
    fakten,
    chart: c,
    moat,
    burggraben,
    segmente,
    logoUrl: e.logoUrl,
    imDepot: e.imDepot,
    hinweise,
  }
}

function segmenteAus(paket: FundamentaldatenPaket): LongformSegmente | null {
  const st = paket.erweitert?.secStruktur
  if (!st) return null
  const kandidaten: { art: 'produkt' | 'geo'; liste: typeof st.segmenteProdukt }[] = [
    { art: 'produkt', liste: st.segmenteProdukt ?? [] },
    { art: 'geo', liste: st.segmenteGeo ?? [] },
  ]
  for (const k of kandidaten) {
    const eintraege = k.liste
      .filter((x) => x.anteilPct != null && x.anteilPct > 0 && x.name?.trim())
      .map((x) => ({ name: x.name.trim(), anteilPct: Math.round(x.anteilPct! * 10) / 10 }))
      .sort((a, b) => b.anteilPct - a.anteilPct)
    if (eintraege.length >= 2) {
      const top = eintraege.slice(0, 6)
      const rest = eintraege.slice(6).reduce((a, x) => a + x.anteilPct, 0)
      if (rest > 0.5) top.push({ name: 'Other', anteilPct: Math.round(rest * 10) / 10 })
      return { art: k.art, jahr: st.berichtJahr, eintraege: top }
    }
  }
  return null
}

/** Kompakte Textform fürs KI-Prompt: nur Kennung, Bezeichnung, erlaubter Text. */
export function faktenFuerPrompt(fb: LongformFaktenblatt): string {
  return fb.fakten.map((f) => `${f.id} | ${f.label} | ${f.text} | as of ${f.stichtag}`).join('\n')
}
