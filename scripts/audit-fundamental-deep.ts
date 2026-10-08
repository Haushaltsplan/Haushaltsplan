/**
 * Tiefere Stichprobe: ROIC/WACC/Spread, PEG-Quelle, Perioden-Zukunft, Reinvest, iROIC.
 *
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/audit-fundamental-deep.ts
 */
import { readFileSync } from 'fs'
import { ladeFundamentaldaten } from '../lib/portfolio-analyse/fundamentaldaten-server'
import { runWithPrimaeremOwner } from '../lib/request-owner'
import { parseDeZahl } from '../lib/portfolio-analyse/titel-vergleich-parse'
import { historischeJahresKeys } from '../lib/portfolio-analyse/fundamentaldaten-roic-hilfen'

try {
  const raw = readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const k = m[1]!.trim()
    if (!k || process.env[k]) continue
    process.env[k] = m[2]!.trim().replace(/^["']|["']$/g, '')
  }
} catch {
  /* */
}

/** Stichprobe aus typischem Depot/Watchlist-Universum — keine Radar-Whitelist-Only-Titel. */
const TITEL = [
  { isin: 'US92826C8394', symbolYahoo: 'V', name: 'Visa' },
  { isin: 'CH0418792922', symbolYahoo: 'SIKA.SW', name: 'Sika' },
  { isin: 'US8835561023', symbolYahoo: 'TMO', name: 'Thermo' },
  { isin: 'US6795801009', symbolYahoo: 'ODFL', name: 'ODFL' },
  { isin: 'FR0000052292', symbolYahoo: 'RMS.PA', name: 'Hermes' },
  { isin: 'US0404132054', symbolYahoo: 'ANET', name: 'Arista' },
  { isin: 'US5949181045', symbolYahoo: 'MSFT', name: 'Microsoft' },
]

function kmZahl(paket: Awaited<ReturnType<typeof ladeFundamentaldaten>>, id: string): number | null {
  const m = paket.keyMetrics.find((x) => x.id === id)
  if (!m) return null
  if (m.zahl != null && Number.isFinite(m.zahl)) return m.zahl
  return parseDeZahl(m.wert)
}

async function main() {
  const heute = new Date()
  const heuteIso = `${heute.getUTCFullYear()}-${String(heute.getUTCMonth() + 1).padStart(2, '0')}-${String(heute.getUTCDate()).padStart(2, '0')}`

  for (const t of TITEL) {
    const p = await runWithPrimaeremOwner(() =>
      ladeFundamentaldaten({
        isin: t.isin,
        symbolYahoo: t.symbolYahoo,
        name: t.name,
        cacheModus: 'immer',
      }),
    )
    if (!p.ok) {
      console.log(t.name, 'FAIL', p.fehler)
      continue
    }

    const zukunft = p.perioden.filter(
      (x) =>
        !x.istSchaetzung &&
        !x.istLtm &&
        !x.istNtm &&
        /^\d{4}-\d{2}-\d{2}$/.test(x.iso) &&
        x.iso > heuteIso,
    )
    const roic = kmZahl(p, 'ltm_roic')
    const wacc = kmZahl(p, 'wacc')
    const spread = kmZahl(p, 'ltm_value_spread')
    const peg = kmZahl(p, 'peg_ratio')
    const iroic = kmZahl(p, 'incremental_roic')
    const ivs = kmZahl(p, 'incremental_value_spread')
    const reinvest = kmZahl(p, 'reinvest_quote')
    const ndE = kmZahl(p, 'net_debt_ebitda')
    const fcfR = kmZahl(p, 'ltm_fcf_rendite')
    const pfcf = kmZahl(p, 'ltm_pfcf')
    const fcfCheck =
      pfcf != null && pfcf > 0 ? Math.round((100 / pfcf) * 100) / 100 : null

    console.log('\n===', t.name, '===')
    console.log({
      roic,
      wacc,
      spread,
      peg,
      iroic,
      ivs,
      reinvest,
      ndE,
      fcfR,
      pfcf,
      fcfCheck,
      zukunftHist: zukunft.map((x) => x.iso),
      dedupKeysTail: historischeJahresKeys(p.perioden).slice(-6),
      beta: p.mantraMeta?.beta,
    })

    if (fcfR != null && fcfCheck != null && Math.abs(fcfR - fcfCheck) > 0.5) {
      console.log('!! FCF-Rendite ≠ 1/PFCF', { fcfR, fcfCheck })
    }
    if (iroic != null && wacc != null && ivs != null && Math.abs(ivs - (iroic - wacc)) > 0.5) {
      console.log('!! iSpread ≠ iROIC−WACC', { iroic, wacc, ivs })
    }
    if (zukunft.length > 0) {
      console.log('!! Hist-Perioden in der Zukunft', zukunft.map((x) => x.iso))
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
