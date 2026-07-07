/**
 * MSFT: keine Monats-Segmente, Summe = Jahresumsatz
 * npx tsx scripts/diag-msft-summen.ts
 */
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ISIN_KENNTNISSE } from '../lib/portfolio-analyse/isin-kenntnisse'
import {
  extrahiereAlleDetailBloeckeAus10kHtml,
  mergeDetailInMap,
} from '../lib/portfolio-analyse/sec-edgar-detail-extraktion'
import {
  filterJahreNachArt,
  filterSegmentHistorie,
  istPeriodenLabel,
  teileUmsatzDetailInProduktUndGeo,
  type SecSegmentHistorie,
  type SecSegmentJahrEintrag,
  type SecSegmentRoh,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'
import {
  bereinigeHistorieGegenJahresumsatz,
  ergaenzeJahresluecken,
  interpoliereJahresluecken,
  vereinheitlicheSegmentHistorie,
} from '../lib/portfolio-analyse/sec-edgar-segment-normalisierung'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'test@example.com'
const MAX_FILINGS = 14

async function secFetch(url: string) {
  await new Promise((r) => setTimeout(r, 300))
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

function baueHistorie(art: 'produkt' | 'geo', jahre: SecSegmentJahrEintrag[]): SecSegmentHistorie | null {
  if (jahre.length < 2) return null
  return {
    art,
    jahre,
    segmentNamen: [...new Set(jahre.flatMap((j) => j.segmente.map((s) => s.name)))].sort(),
    anzahlJahre: jahre.length,
    aeltestesJahr: jahre[0]!.jahr,
    juengstesJahr: jahre[jahre.length - 1]!.jahr,
  }
}

async function ladeCompanyFactsUmsatz(cik: number): Promise<Map<number, number>> {
  const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`)
  const data = await res.json()
  const gaap = data?.facts?.['us-gaap'] ?? {}
  const out = new Map<number, number>()
  for (const tag of ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']) {
    const liste = gaap[tag]?.units?.USD as { fy?: number; fp?: string; form?: string; val?: number }[] | undefined
    if (!liste) continue
    for (const e of liste) {
      if (e.form !== '10-K' || e.fp !== 'FY' || !e.fy || e.val == null) continue
      const mio = Math.round(e.val / 1_000_000)
      const prev = out.get(e.fy)
      if (prev == null || mio > prev) out.set(e.fy, mio)
    }
  }
  return out
}

async function main() {
  const pos = NACHKAUF_RADAR_WHITELIST.find((p) => ISIN_KENNTNISSE[p.isin]?.symbolYahoo?.startsWith('MSFT'))
  if (!pos?.cik) return
  const cik = parseInt(pos.cik.replace(/^0+/, ''), 10)
  const cikStr = pos.cik.replace(/^0+/, '').padStart(10, '0')
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${cikStr}.json`)).json()
  const f = sub.filings.recent
  const kategorieMaps = new Map<string, Map<number, SecSegmentRoh[]>>()
  const kategorieMeta = new Map<string, Map<number, number>>()
  let n = 0
  for (let i = 0; i < f.form.length && n < MAX_FILINGS; i++) {
    if (f.form[i] !== '10-K') continue
    n++
    const acc = f.accessionNumber[i]
    const doc = f.primaryDocument[i]
    const report = parseInt(f.reportDate[i]?.slice(0, 4) ?? '0', 10)
    const html = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, '')}/${doc}`)).text()
    for (const kat of extrahiereAlleDetailBloeckeAus10kHtml(html)) {
      mergeDetailInMap(kategorieMaps as never, kat, report, kategorieMeta as never)
    }
  }

  const produktQuellen: SecSegmentJahrEintrag[][] = []
  for (const [id, m] of kategorieMaps) {
    const jahre = [...m.entries()].sort((a, b) => a[0] - b[0]).map(([jahr, segmente]) => ({ jahr, segmente }))
    if (id === 'umsatz_detail' || id === 'franchise_umsatz') {
      const split = teileUmsatzDetailInProduktUndGeo(jahre)
      produktQuellen.push(filterJahreNachArt(split.produkt, 'produkt'))
    } else if (!id.includes('geo')) {
      produktQuellen.push(filterJahreNachArt(jahre, 'produkt'))
    }
  }

  const umsatzMap = await ladeCompanyFactsUmsatz(cik)
  let produkt = bereinigeHistorieGegenJahresumsatz(
    vereinheitlicheSegmentHistorie(
      interpoliereJahresluecken(
        ergaenzeJahresluecken(
          produktQuellen.reduce<SecSegmentHistorie | null>((best, q) => {
            const h = baueHistorie('produkt', q)
            if (!h) return best
            if (!best || h.anzahlJahre > best.anzahlJahre) return h
            return best
          }, null),
          produktQuellen,
        ),
      ),
    ),
    umsatzMap,
  )

  if (!produkt) {
    console.log('kein produkt')
    return
  }

  const perioden = produkt.segmentNamen.filter((n) => istPeriodenLabel(n))
  console.log('Segmente:', produkt.segmentNamen.join(' | '))
  console.log('Perioden-Leaks:', perioden.length ? perioden.join(', ') : 'keine')
  let fehler = 0
  for (const j of produkt.jahre) {
    const summe = j.segmente.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
    const konzern = umsatzMap.get(j.jahr)
    const diff = konzern ? Math.abs(summe - konzern) / konzern : 0
    const ok = konzern ? diff <= 0.02 : true
    if (!ok) fehler++
    console.log(
      j.jahr,
      ok ? 'OK' : 'FEHLER',
      `Seg=${Math.round(summe)}`,
      konzern ? `Konzern=${konzern} (${Math.round(diff * 1000) / 10}%)` : '',
      `[${j.segmente.map((s) => s.name).join(', ')}]`,
    )
  }
  console.log(fehler ? `\n${fehler} Jahre mit Summenfehler` : '\nAlle Jahre summieren korrekt')
  process.exit(fehler || perioden.length ? 1 : 0)
}

main().catch(console.error)
