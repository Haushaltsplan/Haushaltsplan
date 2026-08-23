/**
 * Diagnose: Rohdaten für NOPAT / Invested Capital aus SEC XBRL Company Facts.
 * Jahreszuordnung über `end`-Datum (nicht `fy` — das ist das Filing-Jahr!).
 * Aufruf: node scripts/_probe-kapitalbasis.mjs SPGI TMO MSFT
 */

const UA = process.env.SEC_EDGAR_USER_AGENT || 'mein-haushalt-diagnose kontakt@example.com'

const TAGS = {
  operatingIncome: [
    'OperatingIncomeLoss',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
  ],
  pretax: [
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
  ],
  tax: ['IncomeTaxExpenseBenefit'],
  equityParent: ['StockholdersEquity'],
  equityInclNci: ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  minorityInterest: ['MinorityInterest'],
  redeemableNci: ['RedeemableNoncontrollingInterestEquityCarryingAmount'],
  longTermDebt: ['LongTermDebtNoncurrent', 'LongTermDebt'],
  currentDebt: [
    'LongTermDebtCurrent',
    'DebtCurrent',
    'ShortTermBorrowings',
    'CommercialPaper',
    'OtherShortTermBorrowings',
  ],
  leases: ['OperatingLeaseLiabilityNoncurrent'],
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  shortTermInvestments: ['ShortTermInvestments', 'OtherShortTermInvestments', 'MarketableSecuritiesCurrent'],
  goodwill: ['Goodwill'],
  intangibles: [
    'IntangibleAssetsNetExcludingGoodwill',
    'FiniteLivedIntangibleAssetsNet',
  ],
  capex: [
    'PaymentsToAcquirePropertyPlantAndEquipment',
    'PaymentsToAcquireProductiveAssets',
    'PaymentsForCapitalImprovements',
    'PaymentsToAcquireOtherPropertyPlantAndEquipment',
  ],
  softwareCapex: ['PaymentsToDevelopSoftware', 'PaymentsToAcquireIntangibleAssets'],
  da: [
    'DepreciationDepletionAndAmortization',
    'DepreciationAmortizationAndAccretionNet',
    'DepreciationAndAmortization',
  ],
  acquisitions: ['PaymentsToAcquireBusinessesNetOfCashAcquired', 'PaymentsToAcquireBusinessesGross'],
}

/** Fiskaljahr aus Periodenende: endet der Abschluss vor Juli, zählt das Vorjahr. */
function fiskaljahrAusEnde(endeIso) {
  const d = new Date(endeIso)
  const jahr = d.getUTCFullYear()
  return d.getUTCMonth() + 1 <= 6 ? jahr - 1 : jahr
}

async function cikFuerTicker(ticker) {
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': UA },
  })
  const j = await res.json()
  for (const e of Object.values(j)) {
    if (String(e.ticker).toUpperCase() === ticker.toUpperCase()) {
      return String(e.cik_str).padStart(10, '0')
    }
  }
  return null
}

/**
 * Pro Fiskaljahr den besten Wert über ALLE Tags mergen.
 * Flow (start+end, ~365 Tage) vs. Stock (instant). Neuestes Filing gewinnt.
 */
function jahresWerte(facts, tagListe, artFlow) {
  const out = new Map()
  for (const tag of tagListe) {
    const einheiten = facts['us-gaap']?.[tag]?.units?.USD
    if (!einheiten) continue
    for (const e of einheiten) {
      if (e.form !== '10-K' && e.form !== '10-K/A') continue
      if (artFlow) {
        if (!e.start) continue
        const tage = (new Date(e.end) - new Date(e.start)) / 86400000
        if (tage < 330 || tage > 400) continue
      } else if (e.start) {
        continue
      }
      const jahr = fiskaljahrAusEnde(e.end)
      const alt = out.get(jahr)
      if (
        !alt ||
        new Date(e.filed) > new Date(alt.filed) ||
        (alt.wert == null && e.val != null)
      ) {
        out.set(jahr, { wert: e.val, end: e.end, filed: e.filed, tag })
      }
    }
  }
  return out
}

const FLOW = new Set([
  'operatingIncome',
  'pretax',
  'tax',
  'capex',
  'softwareCapex',
  'da',
  'acquisitions',
])

const mio = (v) => (v == null ? null : Math.round(v / 1_000_000))

async function probe(ticker) {
  const cik = await cikFuerTicker(ticker)
  if (!cik) {
    console.log(`\n### ${ticker}: CIK nicht gefunden`)
    return
  }
  const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) {
    console.log(`\n### ${ticker}: companyfacts HTTP ${res.status}`)
    return
  }
  const j = await res.json()

  const serien = {}
  for (const [name, tags] of Object.entries(TAGS)) {
    serien[name] = jahresWerte(j.facts, tags, FLOW.has(name))
  }

  const jahre = [...new Set(Object.values(serien).flatMap((m) => [...m.keys()]))]
    .filter((y) => y >= 2016)
    .sort()

  console.log(`\n### ${ticker} (CIK ${cik}) — ${j.entityName}`)
  const zeilen = []
  for (const jahr of jahre) {
    const g = (k) => serien[k].get(jahr)?.wert ?? null
    const opinc = g('operatingIncome')
    const pretax = g('pretax')
    const tax = g('tax')
    const eqParent = g('equityParent')
    const eqInclNci = g('equityInclNci')
    const nci = g('minorityInterest')
    const rnci = g('redeemableNci')
    const ltd = g('longTermDebt')
    const cd = g('currentDebt')
    const cash = g('cash')
    const sti = g('shortTermInvestments')

    const steuer =
      pretax != null && pretax > 0 && tax != null ? Math.min(0.5, Math.max(0, tax / pretax)) : 0.21
    const nopat = opinc != null ? opinc * (1 - steuer) : null
    const debt = (ltd ?? 0) + (cd ?? 0)
    const eqBasis =
      eqInclNci != null ? eqInclNci + (rnci ?? 0) : (eqParent ?? 0) + (nci ?? 0) + (rnci ?? 0)
    const ic = eqBasis + debt

    zeilen.push({
      jahr,
      NOPAT: mio(nopat),
      'Tax%': Math.round(steuer * 1000) / 10,
      Eq: mio(eqParent),
      'Eq+NCI': mio(eqBasis),
      Debt: mio(debt),
      Cash: mio(cash),
      GW: mio(g('goodwill')),
      Intang: mio(g('intangibles')),
      CapEx: mio(g('capex')),
      SwCapEx: mio(g('softwareCapex')),
      'D&A': mio(g('da')),
      'M&A': mio(g('acquisitions')),
      IC: mio(ic),
      'ROIC%': nopat != null && ic > 0 ? Math.round((nopat / ic) * 1000) / 10 : null,
    })
  }
  console.table(zeilen)

  const tagInfo = {}
  for (const [name, m] of Object.entries(serien)) {
    const tags = [...new Set([...m.values()].map((v) => v.tag))]
    tagInfo[name] = { tags: tags.join(', ') || '—', jahre: m.size }
  }
  console.table(tagInfo)
}

const tickers = process.argv.slice(2)
if (tickers.length === 0) tickers.push('SPGI')
for (const t of tickers) {
  await probe(t)
  await new Promise((r) => setTimeout(r, 400))
}
