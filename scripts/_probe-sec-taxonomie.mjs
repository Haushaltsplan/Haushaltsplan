/**
 * Diagnose: Welche SEC-Taxonomie/Formulare liefern die Non-US-Titel?
 * Aufruf: node scripts/_probe-sec-taxonomie.mjs ASML LIN SAP
 */

const UA = process.env.SEC_EDGAR_USER_AGENT || 'mein-haushalt-diagnose kontakt@example.com'

async function tickerMap() {
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': UA },
  })
  const j = await res.json()
  const m = new Map()
  for (const e of Object.values(j)) m.set(String(e.ticker).toUpperCase(), String(e.cik_str).padStart(10, '0'))
  return m
}

const map = await tickerMap()

for (const ticker of process.argv.slice(2)) {
  const cik = map.get(ticker.toUpperCase())
  if (!cik) {
    console.log(`\n### ${ticker}: nicht in SEC-Tickerliste (kein SEC-Filer)`)
    continue
  }
  const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) {
    console.log(`\n### ${ticker} (CIK ${cik}): companyfacts HTTP ${res.status}`)
    continue
  }
  const j = await res.json()
  const namespaces = Object.keys(j.facts ?? {})
  console.log(`\n### ${ticker} (CIK ${cik}) — ${j.entityName}`)
  console.log('Taxonomien:', namespaces.join(', '))

  for (const ns of namespaces) {
    const tags = Object.keys(j.facts[ns])
    const formen = new Set()
    const einheiten = new Set()
    let bsp = []
    for (const tag of tags.slice(0, 400)) {
      for (const [unit, liste] of Object.entries(j.facts[ns][tag].units ?? {})) {
        einheiten.add(unit)
        for (const e of liste) if (e.form) formen.add(e.form)
      }
    }
    // Kandidaten für Operating Income / Equity finden
    const kandidaten = tags.filter((t) =>
      /OperatingIncome|ProfitLossFromOperatingActivities|Equity$|EquityAttributable|Goodwill|Borrowings|CashAndCashEquivalents/.test(t),
    )
    console.log(`  ${ns}: ${tags.length} Tags | Formen: ${[...formen].join(', ')} | Einheiten: ${[...einheiten].slice(0, 6).join(', ')}`)
    console.log(`    relevante Tags: ${kandidaten.slice(0, 14).join(', ')}`)
  }
  await new Promise((r) => setTimeout(r, 400))
}
