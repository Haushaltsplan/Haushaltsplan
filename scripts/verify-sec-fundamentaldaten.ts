/**
 * Smoke-Test: SEC Company Facts als GuV-Quelle (MA, MSFT) plus EU-ohne-CIK (ASML 20-F oder Yahoo).
 *
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/verify-sec-fundamentaldaten.ts
 */
import { readFileSync } from 'fs'
import { cagrJaehrlichAusSerie } from '../lib/portfolio-analyse/fundamentaldaten-format'
import {
  bereinigeUmsatzGrossVsNet,
  merkeBesserenUmsatz,
  waehleNettoUmsatz,
} from '../lib/portfolio-analyse/sec-umsatz-netto'
import { baueKontextWerte } from '../lib/portfolio-analyse/fundamentaldaten-kontext-werte'
import { historischeWerteAusZeile, werteGleicherStichtag } from '../lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import { FUNDAMENTAL_TTM_KEY } from '../lib/portfolio-analyse/fundamentaldaten-types'
import {
  ladeMacrotrendsFundamentaldaten,
  loeseMacrotrendsIdent,
} from '../lib/portfolio-analyse/macrotrends-scraper-server'

function loadEnv() {
  try {
    const raw = readFileSync('.env.local', 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1]!.trim()] = m[2]!.trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* */
  }
}
loadEnv()

const TICKER = [
  { t: 'MA', name: 'Mastercard', erwartetSec: true },
  { t: 'MSFT', name: 'Microsoft', erwartetSec: true },
  { t: 'ASML', name: 'ASML', erwartetSec: true },
]

function zaehle(zeile: { werte: Record<string, number | null> } | undefined): number {
  if (!zeile) return 0
  return Object.entries(zeile.werte).filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && v != null && Number.isFinite(v))
    .length
}

function pruefeUmsatzNettoHelfer(): number {
  let fail = 0
  if (waehleNettoUmsatz(14_950, 21_831) !== 14_950) {
    console.log('FAIL waehleNettoUmsatz nimmt nicht die Nettzahl')
    fail++
  }
  const merke = merkeBesserenUmsatz(
    { val: 21_831, tag: 'RevenueFromContractWithCustomerExcludingAssessedTax' },
    { val: 14_950, tag: 'Revenues' },
  )
  if (merke.val !== 14_950 || merke.tag !== 'Revenues') {
    console.log('FAIL merkeBesserenUmsatz', merke)
    fail++
  }
  const serie = bereinigeUmsatzGrossVsNet([
    { umsatz: 14_950, ebit: 6_650 },
    { umsatz: 21_831, ebit: 7_282 },
    { umsatz: 24_980, ebit: 8_100 },
    { umsatz: 18_880, ebit: 9_734 },
  ])
  if ((serie[1]!.umsatz ?? 99_999) > 18_000) {
    console.log('FAIL EBIT-Glaettung Jahr 2 bleibt brutto', serie[1])
    fail++
  }
  if ((serie[2]!.umsatz ?? 99_999) > 20_000) {
    console.log('FAIL EBIT-Glaettung Jahr 3 bleibt brutto', serie[2])
    fail++
  }
  return fail
}

async function main() {
  let fail = pruefeUmsatzNettoHelfer()
  for (const x of TICKER) {
    const t0 = Date.now()
    const ident = await loeseMacrotrendsIdent(x.t, { erwarteterTicker: x.t, firmenname: x.name })
    if (!ident) {
      console.log('FAIL', x.t, 'kein Ident')
      fail++
      continue
    }
    const roh = await ladeMacrotrendsFundamentaldaten(ident)
    const ms = Date.now() - t0
    const umsatz = roh?.zeilen.find((z) => z.id === 'umsatz')
    const fyWerte = Object.entries(umsatz?.werte ?? {})
      .filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && v != null)
      .sort(([a], [b]) => a.localeCompare(b))
    const u2018 = fyWerte.find(([k]) => k.startsWith('2018'))?.[1]
    const u2017 = fyWerte.find(([k]) => k.startsWith('2017'))?.[1]
    if (x.t === 'MA' && u2018 != null && u2018 > 18_000) {
      console.log('FAIL MA 2018 Umsatz sieht nach Brutto/Incentives aus', u2018)
      fail++
    }
    if (x.t === 'MA' && u2017 != null && u2018 != null && u2018 / u2017 > 1.35) {
      console.log('FAIL MA 2018/2017 Umsatz-Sprung', u2017, u2018)
      fail++
    }
    const eps = roh?.zeilen.find((z) => z.id === 'eps')
    const ek = roh?.zeilen.find((z) => z.id === 'eigenkapital')
    const fy = roh?.perioden.filter((p) => !p.istLtm).at(-1)?.iso
    const nU = zaehle(umsatz)
    const nE = zaehle(eps)
    const nK = zaehle(ek)
    const secOk = roh?.guvQuelle === 'sec'
    const ok = roh != null && nU >= 6 && nE >= 4 && nK >= 4 && (!x.erwartetSec || secOk)
    if (!ok) fail++
    const aktien = roh?.zeilen.find((z) => z.id === 'aktien')
    if (x.t === 'MA' && aktien) {
      const a2010 = Object.entries(aktien.werte).find(([k]) => k.startsWith('2010'))?.[1]
      if (a2010 != null && a2010 < 400) {
        console.log('FAIL MA 2010 Aktien nicht split-bereinigt', a2010)
        fail++
      }
    }
    const fcf = roh?.zeilen.find((z) => z.id === 'fcf')
    const ni = roh?.zeilen.find((z) => z.id === 'nettogewinn')
    const aktienHist = historischeWerteAusZeile(aktien, roh?.perioden)
    const verw = cagrJaehrlichAusSerie(aktienHist)
    const paar = roh ? werteGleicherStichtag(fcf, ni, roh.perioden) : null
    const conv = paar != null ? (paar.zaehler / paar.nenner) * 100 : null
    const ctx = roh
      ? baueKontextWerte({
          yahoo: null,
          roh,
          schaetzungen: { perioden: [], zeilen: [] },
          yahooFinanz: null,
        })
      : null
    console.log(
      ok ? 'OK' : 'FAIL',
      x.t,
      `${ms}ms`,
      `quelle=${roh?.guvQuelle ?? 'null'}`,
      `perioden=${roh?.perioden.length ?? 0}`,
      `FY=${fy ?? '-'}`,
      `umsatzJ=${nU}`,
      `epsJ=${nE}`,
      `ekJ=${nK}`,
      `umsatz=${umsatz?.werte[fy ?? ''] ?? '-'}`,
    )
    console.log(
      ' ',
      `aktienFY=${aktien?.werte[fy ?? ''] ?? '-'}`,
      `aktienTTM=${aktien?.werte[FUNDAMENTAL_TTM_KEY] ?? '-'}`,
      `verwässerung=${verw != null ? verw.toFixed(2) + '%' : '-'}`,
      `fcfFY=${fcf?.werte[fy ?? ''] ?? '-'}`,
      `niFY=${ni?.werte[fy ?? ''] ?? '-'}`,
      `fcfTTM=${fcf?.werte[FUNDAMENTAL_TTM_KEY] ?? '-'}`,
      `niTTM=${ni?.werte[FUNDAMENTAL_TTM_KEY] ?? '-'}`,
      `conv=${conv != null ? conv.toFixed(2) + '%' : '-'}`,
      `ctxVerw=${ctx?.aktienVerwaesserungJaehrlichPct != null ? ctx.aktienVerwaesserungJaehrlichPct.toFixed(2) + '%' : '-'}`,
      `ctxConv=${ctx?.fcfConversion != null ? ctx.fcfConversion.toFixed(2) + '%' : '-'}`,
    )
  }
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
