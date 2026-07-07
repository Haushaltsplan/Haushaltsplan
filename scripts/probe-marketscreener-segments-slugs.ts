/**
 * Probe Marketscreener segments mit bekannten/korrigierten Slugs
 */
const SLUGS: Record<string, string> = {
  US02079K1079: 'ALPHABET-INC-24203373',
  US57636Q1040: 'MASTERCARD-INC-17163',
  US78409V1044: 'S-P-GLOBAL-INC-191560905',
  FR0000052292: 'HERMES-INTERNATIONAL-4635',
  US5949181045: 'MICROSOFT-CORPORATION-4835',
  US55354G1004: 'MSCI-INC-13685317',
  US92826C8394: 'VISA-INC-6469',
  US6795801009: 'OLD-DOMINION-FREIGHT-LINE-ODFL-10355',
  US94106L1098: 'WASTE-MANAGEMENT-INC-14869',
  US9078181081: 'UNION-PACIFIC-CORPORATION-14750',
  US5801351017: 'MCDONALD-S-CORPORATION-4833',
  IE000S9YS762: 'LINDE-PLC-16584236',
  US4370761029: 'HOME-DEPOT-INC-4836',
  US7757111049: 'ROLLINS-INC-14259',
  US1729081059: 'CINTAS-CORPORATION-4861',
  NL0010273215: 'ASML-HOLDING-N-V-12002973',
  US91324P1021: 'UNITEDHEALTH-GROUP-INC-14750',
  US8835561023: 'THERMO-FISHER-SCIENTIFIC-INC-14623',
  US7611521078: 'RESMED-INC-14277',
  US98978V1035: 'ZOETIS-INC-12482719',
  US81762P1021: 'SERVICENOW-INC-10912928',
  CH1175448666: 'STRAUMANN-HOLDING-AG-9364975',
  GB0004052071: 'HALMA-PLC-9590130',
  CH0418792922: 'SIKA-AG-2955924',
  US49714P1084: 'KINSALE-CAPITAL-GROUP-INC-31339903',
  US3841091040: 'GRACO-INC-12894',
  US9224751084: 'VEEVA-SYSTEMS-INC-16739207',
  CA01626P1484: 'ALIMENTATION-COUCHE-TARD-INC-1410907',
  US0404132054: 'ARISTA-NETWORKS-INC-16617700',
  NL0000395903: 'WOLTERS-KLUWER-12002974',
  US0576652004: 'BALCHEM-CORPORATION-10364',
  US23804L1035: 'DATADOG-INC-11661379',
}

const UA = 'Mozilla/5.0'

function decodeAttr(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function chartSegments(html: string, id: string) {
  const m = html.match(new RegExp(`id="${id}"[\\s\\S]*?data-fct-attr="(\\{[^"]+\\})"`))
  if (!m?.[1]) return null
  try {
    const p = JSON.parse(decodeAttr(m[1])) as { start?: number; data?: Record<string, { data: number[] }> }
    const names = Object.keys(p.data ?? {})
    const years = p.data?.[names[0]!]?.data.length ?? 0
    return { start: p.start, segments: names.length, years, names: names.slice(0, 4) }
  } catch {
    return null
  }
}

async function main() {
  let ok = 0
  let partial = 0
  let fail = 0
  for (const [isin, slug] of Object.entries(SLUGS)) {
    await new Promise((r) => setTimeout(r, 350))
    const url = `https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    const html = await res.text()
    if (!res.ok || html.length < 50_000) {
      console.log(`FAIL ${isin} ${slug} status=${res.status} len=${html.length}`)
      fail++
      continue
    }
    const rev = chartSegments(html, 'financialSegmentRevenueChar1')
    const geo = chartSegments(html, 'financialSegmentLastYearChar2')
    const biz = chartSegments(html, 'financialSegmentLastYearChar1')
    const hasRevTable = /Historical Breakdown of Revenue by Business/i.test(html)
    const hasGeoTable = /Geographical breakdown of sales/i.test(html)
    const tag = rev && geo && rev.years >= 5 ? 'OK' : rev || geo ? 'PARTIAL' : 'FAIL'
    if (tag === 'OK') ok++
    else if (tag === 'PARTIAL') partial++
    else fail++
    console.log(
      `${tag} ${isin} | rev=${rev?.segments ?? 0}seg/${rev?.years ?? 0}J ab${rev?.start ?? '?'} geo=${geo?.segments ?? 0}seg/${geo?.years ?? 0}J | ${rev?.names?.join(', ').slice(0, 60) ?? '-'}`,
    )
  }
  console.log(`\n${ok} OK, ${partial} PARTIAL, ${fail} FAIL`)
}

main()
