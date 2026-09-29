/**
 * Smoke-Test: SEC Company Facts als GuV-Quelle (MA, MSFT) plus EU-ohne-CIK (ASML 20-F oder Yahoo).
 *
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/verify-sec-fundamentaldaten.ts
 */
import { readFileSync } from 'fs'
import { cagrJaehrlichAusSerie } from '../lib/portfolio-analyse/fundamentaldaten-format'
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

async function main() {
  let fail = 0
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
