/**
 * npx tsx scripts/probe-ms-slug-list.ts
 */
const SLUGS: Record<string, string> = {
  SPGI: 'S-P-GLOBAL-INC-191560905',
  MSCI: 'MSCI-INC-13685317',
  V: 'VISA-INC-6469',
  ODFL: 'OLD-DOMINION-FREIGHT-LINE-10355',
  WM: 'WASTE-MANAGEMENT-INC-14869',
  UNP: 'UNION-PACIFIC-CORPORATION-14750',
  MCD: 'MCDONALD-S-CORPORATION-4833',
  LIN: 'LINDE-PLC-16584236',
  HD: 'HOME-DEPOT-INC-4836',
  ROL: 'ROLLINS-INC-14259',
  CTAS: 'CINTAS-CORPORATION-4861',
  UNH: 'UNITEDHEALTH-GROUP-INC-14750',
  TMO: 'THERMO-FISHER-SCIENTIFIC-INC-14623',
  RMD: 'RESMED-INC-14277',
  ZTS: 'ZOETIS-INC-12482719',
  NOW: 'SERVICENOW-INC-10912928',
  STMN: 'STRAUMANN-HOLDING-AG-9364975',
  H11: 'HALMA-PLC-9590130',
  SIKA: 'SIKA-AG-2955924',
  KNSL: 'KINSALE-CAPITAL-GROUP-INC-31339903',
  GGG: 'GRACO-INC-12894',
  VEEV: 'VEEVA-SYSTEMS-INC-16739207',
  ATD: 'ALIMENTATION-COUCHE-TARD-INC-1410907',
  ANET: 'ARISTA-NETWORKS-INC-16617700',
  WKL: 'WOLTERS-KLUWER-12002974',
  BCPC: 'BALCHEM-CORPORATION-10364',
  DDOG: 'DATADOG-INC-11661379',
}

const UA = 'Mozilla/5.0'
function decode(s: string) {
  return s.replace(/&quot;/g, '"')
}
function count(html: string, id: string) {
  const m = html.match(new RegExp(`id="${id}"[\\s\\S]*?data-fct-attr="(\\{[^"]+\\})"`))
  if (!m?.[1]) return 0
  try {
    return Object.keys((JSON.parse(decode(m[1])) as { data?: object }).data ?? {}).length
  } catch {
    return 0
  }
}

async function main() {
  for (const [sym, slug] of Object.entries(SLUGS)) {
    await new Promise((r) => setTimeout(r, 300))
    const html = await (
      await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
        headers: { 'User-Agent': UA },
      })
    ).text()
    const ca1 = count(html, 'financialSegmentCA1')
    const ca2 = count(html, 'financialSegmentCA2')
    console.log(
      sym.padEnd(5),
      resStatus(html),
      `len=${html.length}`,
      `prod=${ca1}`,
      `geo=${ca2}`,
      slug,
    )
  }
}
function resStatus(html: string) {
  return html.length > 80_000 ? 'OK' : 'SHORT'
}
main()
