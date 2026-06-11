import { cagrProzent } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import {
  FUNDAMENTAL_TTM_KEY,
  type FundamentalDcfKontext,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

export type DcfEingaben = {
  basisFcfUsd: number
  aktienAnzahl: number
  nettoverschuldungUsd: number
  aktuellerKursUsd: number | null
  waccPct: number
  wachstumExplizitPct: number
  terminalWachstumPct: number
  prognoseJahre: number
}

export type DcfJahrZeile = {
  jahr: number
  fcfUsd: number
  pvUsd: number
}

export type DcfErgebnis = {
  ok: boolean
  fehler?: string
  jahre?: DcfJahrZeile[]
  pvExplizitUsd?: number
  terminalFcfUsd?: number
  terminalWertUsd?: number
  pvTerminalUsd?: number
  enterpriseValueUsd?: number
  equityValueUsd?: number
  fairValueProAktieUsd?: number | null
  upsidePct?: number | null
}

export type DcfSensitivitaetZelle = {
  waccPct: number
  terminalPct: number
  fairValueUsd: number | null
}

const DEFAULT_RISIKOFREI = 4.25
const DEFAULT_ERP = 5.5
const DEFAULT_TERMINAL = 2.5
const DEFAULT_PROGNOSE_JAHRE = 5

function wertZeile(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  const v = zeilen.find((z) => z.id === id)?.werte[key]
  return v != null && Number.isFinite(v) ? v : null
}

function historischeFyKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
}

function fcfCagr(zeilen: FundamentalMetrikZeile[], perioden: FundamentalPeriode[], jahre: number): number | null {
  const keys = historischeFyKeys(perioden)
  const fcf = zeilen.find((z) => z.id === 'fcf')
  if (!fcf || keys.length < 2) return null
  const slice = keys.slice(-(jahre + 1))
  const werte = slice.map((k) => fcf.werte[k]).filter((v): v is number => v != null && v > 0)
  if (werte.length < 2) return null
  return cagrProzent(werte, werte.length - 1)
}

export function schaetzeWaccAusCapm(beta: number | null, risikofrei = DEFAULT_RISIKOFREI, erp = DEFAULT_ERP): number {
  const b = beta != null && Number.isFinite(beta) ? beta : 1
  return Math.round((risikofrei + b * erp) * 100) / 100
}

export function baueDcfKontext(
  yahoo: YahooFundamentalKennzahlen | null,
  zeilen: FundamentalMetrikZeile[],
  perioden: FundamentalPeriode[],
): FundamentalDcfKontext {
  const fcfMio = wertZeile(zeilen, 'fcf', FUNDAMENTAL_TTM_KEY) ?? (() => {
    const keys = historischeFyKeys(perioden)
    const last = keys[keys.length - 1]
    return last ? wertZeile(zeilen, 'fcf', last) : null
  })()

  const aktienMio =
    wertZeile(zeilen, 'aktien', FUNDAMENTAL_TTM_KEY) ??
    (() => {
      const keys = historischeFyKeys(perioden)
      const last = keys[keys.length - 1]
      return last ? wertZeile(zeilen, 'aktien', last) : null
    })()

  const aktienAnzahl =
    yahoo?.sharesOutstanding ??
    (aktienMio != null ? aktienMio * 1_000_000 : null)

  const nettoverschuldungUsd =
    yahoo?.totalDebt != null && yahoo?.totalCash != null
      ? yahoo.totalDebt - yahoo.totalCash
      : null

  const aktuellerKursUsd =
    yahoo?.currentPrice ??
    (yahoo?.marketCap != null && aktienAnzahl != null && aktienAnzahl > 0
      ? yahoo.marketCap / aktienAnzahl
      : null)

  const basisFcfUsd = fcfMio != null ? fcfMio * 1_000_000 : null
  const fcfCagr3y = fcfCagr(zeilen, perioden, 3)
  const fcfCagr5y = fcfCagr(zeilen, perioden, 5)
  const umsatzwachstumPct =
    yahoo?.revenueGrowth != null && Number.isFinite(yahoo.revenueGrowth)
      ? yahoo.revenueGrowth * 100
      : null

  const wachstumVorschlag = clamp(
    fcfCagr3y ?? fcfCagr5y ?? umsatzwachstumPct ?? 8,
    -5,
    25,
  )

  return {
    basisFcfUsd,
    basisFcfQuelle: fcfMio != null ? (wertZeile(zeilen, 'fcf', FUNDAMENTAL_TTM_KEY) != null ? 'TTM' : 'Letztes GJ') : null,
    aktienAnzahl,
    nettoverschuldungUsd,
    aktuellerKursUsd,
    beta: yahoo?.beta ?? null,
    fcfCagr3yPct: fcfCagr3y,
    fcfCagr5yPct: fcfCagr5y,
    umsatzwachstumPct,
    waccVorschlagPct: schaetzeWaccAusCapm(yahoo?.beta ?? null),
    wachstumVorschlagPct: wachstumVorschlag,
    terminalWachstumVorschlagPct: DEFAULT_TERMINAL,
    prognoseJahreVorschlag: DEFAULT_PROGNOSE_JAHRE,
    risikofreierZinsPct: DEFAULT_RISIKOFREI,
    marktrisikopraemiePct: DEFAULT_ERP,
  }
}

export function defaultDcfEingaben(kontext: FundamentalDcfKontext): DcfEingaben | null {
  if (kontext.basisFcfUsd == null || kontext.basisFcfUsd <= 0) return null
  if (kontext.aktienAnzahl == null || kontext.aktienAnzahl <= 0) return null
  return {
    basisFcfUsd: kontext.basisFcfUsd,
    aktienAnzahl: kontext.aktienAnzahl,
    nettoverschuldungUsd: kontext.nettoverschuldungUsd ?? 0,
    aktuellerKursUsd: kontext.aktuellerKursUsd,
    waccPct: kontext.waccVorschlagPct,
    wachstumExplizitPct: kontext.wachstumVorschlagPct,
    terminalWachstumPct: kontext.terminalWachstumVorschlagPct,
    prognoseJahre: kontext.prognoseJahreVorschlag,
  }
}

export function berechneDcf(e: DcfEingaben): DcfErgebnis {
  const wacc = e.waccPct / 100
  const gExp = e.wachstumExplizitPct / 100
  const gTerm = e.terminalWachstumPct / 100

  if (!Number.isFinite(wacc) || wacc <= 0) return { ok: false, fehler: 'Ungültiger WACC.' }
  if (wacc <= gTerm) return { ok: false, fehler: 'WACC muss höher sein als das terminale Wachstum.' }
  if (e.basisFcfUsd <= 0) return { ok: false, fehler: 'Basis-FCF muss positiv sein (DCF nicht sinnvoll bei negativem FCF).' }
  if (e.prognoseJahre < 3 || e.prognoseJahre > 15) return { ok: false, fehler: 'Prognosezeitraum: 3–15 Jahre.' }

  const jahre: DcfJahrZeile[] = []
  let fcf = e.basisFcfUsd
  let pvExplizit = 0

  for (let t = 1; t <= e.prognoseJahre; t++) {
    fcf = fcf * (1 + gExp)
    const pv = fcf / Math.pow(1 + wacc, t)
    pvExplizit += pv
    jahre.push({ jahr: t, fcfUsd: fcf, pvUsd: pv })
  }

  const terminalFcf = fcf * (1 + gTerm)
  const terminalWert = terminalFcf / (wacc - gTerm)
  const pvTerminal = terminalWert / Math.pow(1 + wacc, e.prognoseJahre)
  const enterpriseValue = pvExplizit + pvTerminal
  const equityValue = enterpriseValue - e.nettoverschuldungUsd
  const fairValue = equityValue > 0 ? equityValue / e.aktienAnzahl : null
  const upside =
    fairValue != null && e.aktuellerKursUsd != null && e.aktuellerKursUsd > 0
      ? ((fairValue / e.aktuellerKursUsd) - 1) * 100
      : null

  return {
    ok: true,
    jahre,
    pvExplizitUsd: pvExplizit,
    terminalFcfUsd: terminalFcf,
    terminalWertUsd: terminalWert,
    pvTerminalUsd: pvTerminal,
    enterpriseValueUsd: enterpriseValue,
    equityValueUsd: equityValue,
    fairValueProAktieUsd: fairValue,
    upsidePct: upside,
  }
}

export function berechneSensitivitaet(
  basis: DcfEingaben,
  waccDelta: number[] = [-1, 0, 1],
  terminalDelta: number[] = [-0.5, 0, 0.5],
): DcfSensitivitaetZelle[] {
  const out: DcfSensitivitaetZelle[] = []
  for (const wd of waccDelta) {
    for (const td of terminalDelta) {
      const res = berechneDcf({
        ...basis,
        waccPct: basis.waccPct + wd,
        terminalWachstumPct: basis.terminalWachstumPct + td,
      })
      out.push({
        waccPct: basis.waccPct + wd,
        terminalPct: basis.terminalWachstumPct + td,
        fairValueUsd: res.ok ? (res.fairValueProAktieUsd ?? null) : null,
      })
    }
  }
  return out
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function formatDcfUsd(wert: number | null | undefined): string {
  if (wert == null || !Number.isFinite(wert)) return '–'
  const abs = Math.abs(wert)
  if (abs >= 1e12) return `${(wert / 1e12).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Bio. $`
  if (abs >= 1e9) return `${(wert / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd. $`
  if (abs >= 1e6) return `${(wert / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. $`
  return `${wert.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $`
}

export function formatDcfKurs(wert: number | null | undefined): string {
  if (wert == null || !Number.isFinite(wert)) return '–'
  return `${wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
}
