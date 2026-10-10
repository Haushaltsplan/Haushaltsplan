/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/diag-backlog-q.ts [TICKER]
 */
import { ladeCompanyFactsJson } from '../lib/portfolio-analyse/sec-edgar-companyfacts-server'
import { cikFuerTicker } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { extrahiereBacklogAusCompanyFacts } from '../lib/portfolio-analyse/sec-edgar-backlog-server'

async function main() {
  const sym = (process.argv[2] ?? 'GOOGL').toUpperCase()
  const cik = await cikFuerTicker(sym)
  console.log(sym, 'CIK', cik)
  if (!cik) return
  const facts = await ladeCompanyFactsJson(cik)
  const gaap = facts?.facts?.['us-gaap'] ?? {}
  const candidates = Object.keys(gaap).filter(
    (k) => /remainingperformance|backlog/i.test(k) && !/percent|timing|yearone/i.test(k),
  )
  console.log('candidate tags', candidates.slice(0, 12))
  for (const tag of candidates.slice(0, 3)) {
    const units = gaap[tag]?.units ?? {}
    const liste = Object.values(units)[0] ?? []
    const recent = [...liste]
      .filter((e) => (e.val ?? 0) > 0)
      .sort((a, b) => (a.end ?? '').localeCompare(b.end ?? ''))
      .slice(-16)
    console.log(
      '\n',
      tag,
      recent.map((e) => `${e.end} ${e.fp}/${e.form}=${Math.round((e.val ?? 0) / 1e6)}`).join(' | '),
    )
  }
  const hist = extrahiereBacklogAusCompanyFacts(facts as never)
  console.log('\nextrahiert jahre', hist?.eintraege.map((e) => `${e.jahr}:${e.wertMio}`).join(', '))
  console.log(
    'quartale',
    hist?.quartale?.map((q) => `${q.label}=${q.wertMio}`).join(', ') ?? '(keine)',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
