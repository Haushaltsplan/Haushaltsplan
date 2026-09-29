/**
 * Smoke-Test: SEC Company Facts als GuV-Quelle (MA, MSFT) plus EU-ohne-CIK (ASML 20-F oder Yahoo).
 *
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/verify-sec-fundamentaldaten.ts
 */
import { readFileSync } from 'fs'
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
  }
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
