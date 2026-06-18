/** IR-Seiten für Earnings-Call-Transkripte (Conference Call + Q&A). */

import { istTranskriptLinkStreng } from '@/lib/portfolio-analyse/earnings-call-transcript-heuristik'
import { earningsCallKenntnis } from '@/lib/portfolio-analyse/earnings-call-kenntnisse'
import { IR_NACH_ISIN } from '@/lib/portfolio-analyse/investor-relations-url'

export type IrEarningsQuelle = {
  listenUrls: string[]
  /** Q4-Plattform: Basis-URL für /feed/Event.svc (z. B. https://abc.xyz) */
  q4BasisUrls?: string[]
  keywords?: string[]
  /** false = nur Webcast/Slides, kein volles Transkript — dann Motley Fool primär */
  erwarteVollesTranskript?: boolean
}

/** ISIN → IR-Earnings-Seiten (Portfolio + häufige Fälle). */
export const IR_EARNINGS_NACH_ISIN: Record<string, IrEarningsQuelle> = {
  NL0010273215: {
    listenUrls: ['https://www.asml.com/en/investors/financial-results'],
  },
  FR0000121014: {
    listenUrls: [
      'https://www.lvmh.com/en/investors',
      'https://www.lvmh.com/en/financial-calendar',
    ],
  },
  FR0000052292: {
    listenUrls: [
      'https://finance.hermes.com/en/',
      'https://finance.hermes.com/en/publications/',
      'https://finance.hermes.com/fr/publications/',
    ],
    keywords: ['webcast', 'revenue', 'message', 'presentation', 'publishing'],
    erwarteVollesTranskript: false,
  },
  NL0000395903: {
    listenUrls: [
      'https://www.wolterskluwer.com/en/investors/financials/results',
      'https://www.wolterskluwer.com/en/investors/presentations/past-presentations',
    ],
    keywords: ['presentation', 'webcast', 'results'],
    erwarteVollesTranskript: false,
  },
  CH0418792922: {
    listenUrls: [
      'https://www.sika.com/en/investors/reports-publications/presentations.html',
      'https://www.sika.com/en/investors/reports-publications/financial-reports.html',
    ],
    erwarteVollesTranskript: false,
  },
  CH1175448666: {
    listenUrls: [
      'https://www.straumann.com/group/en/home/investors/financial-reports/conference-presentations.html',
      'https://www.straumann.com/group/en/home/media/annual-reports-and-publications.html',
    ],
    erwarteVollesTranskript: false,
  },
  CH0012221716: {
    listenUrls: [
      'https://www.straumann.com/group/en/home/investors/financial-reports/conference-presentations.html',
    ],
    erwarteVollesTranskript: false,
  },
  GB0004052071: {
    listenUrls: ['https://www.halma.com/investors/results-centre'],
    erwarteVollesTranskript: false,
  },
  DE0006580806: {
    listenUrls: [
      'https://www.mum.de/unternehmen/investor-relations/finanzberichte',
      'https://www.mum.de/unternehmen/investor-relations/praesentationen-presentations',
    ],
    erwarteVollesTranskript: false,
  },
  DE0005785802: {
    listenUrls: ['https://www.mum.de/unternehmen/investor-relations/finanzberichte'],
    erwarteVollesTranskript: false,
  },
  DE000A0BVU28: {
    listenUrls: ['https://www.usu.com/de/unternehmen/investor-relations/publikationen'],
  },
  CA01626P1484: {
    listenUrls: [
      'https://corporate.couche-tard.com/investors',
      'https://corporate.couche-tard.com/financial-reporting?cat=29',
    ],
    erwarteVollesTranskript: false,
  },
  CA15135U1093: {
    listenUrls: ['https://corporate.couche-tard.com/financial-reporting?cat=29'],
    erwarteVollesTranskript: false,
  },
  CA015DM1098: {
    listenUrls: ['https://corporate.couche-tard.com/financial-reporting?cat=29'],
    erwarteVollesTranskript: false,
  },
  US02079K1079: {
    listenUrls: ['https://abc.xyz/investor/earnings/'],
    q4BasisUrls: ['https://abc.xyz'],
  },
  US57636Q1040: {
    listenUrls: [
      'https://investor.mastercard.com/events-and-presentations/default.aspx',
      'https://investor.mastercard.com/financials-and-sec-filings/quarterly-results/default.aspx',
    ],
    q4BasisUrls: ['https://investor.mastercard.com'],
    erwarteVollesTranskript: false,
  },
  US92826C8394: {
    listenUrls: ['https://investor.visa.com/financial-information/quarterly-earnings/default.aspx'],
    q4BasisUrls: ['https://investor.visa.com'],
    erwarteVollesTranskript: false,
  },
  US5949181045: {
    listenUrls: ['https://www.microsoft.com/en-us/investor/earnings'],
    q4BasisUrls: ['https://microsoft.com', 'https://www.microsoft.com'],
  },
  US81762P1021: {
    listenUrls: ['https://investors.servicenow.com/financial-information/quarterly-results'],
  },
  US78409V1044: {
    listenUrls: ['https://investor.spglobal.com/financial-reports/quarterly-earnings'],
  },
  US91324P1021: {
    listenUrls: ['https://www.unitedhealthgroup.com/investors/financial-reports.html'],
  },
  US8835561023: {
    listenUrls: ['https://ir.thermofisher.com/financials/quarterly-results/default.aspx'],
  },
  US55354G1004: {
    listenUrls: ['https://ir.msci.com/financials/quarterly-results'],
  },
  US7611521078: {
    listenUrls: ['https://investor.resmed.com/financial-information/quarterly-results'],
  },
  US6795801009: {
    listenUrls: ['https://ir.odfl.com/financial-information/quarterly-results'],
  },
  US94106L1098: {
    listenUrls: ['https://investors.wm.com/financial-information/quarterly-results'],
  },
  US9078181081: {
    listenUrls: ['https://investor.unionpacific.com/financial-information/quarterly-results'],
  },
  US98978V1035: {
    listenUrls: ['https://investor.zoetis.com/financials/quarterly-results'],
  },
  US5801351017: {
    listenUrls: ['https://corporate.mcdonalds.com/corpmcd/investors/financial-information.html'],
  },
  US0576652004: {
    listenUrls: ['https://ir.balchem.com/financial-information/quarterly-results'],
  },
  IE000S9YS762: {
    listenUrls: ['https://www.linde.com/investors/financial-reports'],
  },
  US23804L1035: {
    listenUrls: ['https://investors.datadoghq.com/financial-information/quarterly-results'],
  },
  US49714P1084: {
    listenUrls: ['https://investors.kinsalecapitalgroup.com/financial-information/quarterly-results'],
  },
  US4370761029: {
    listenUrls: ['https://ir.homedepot.com/financial-reports/quarterly-earnings'],
  },
  US9224751084: {
    listenUrls: ['https://ir.veeva.com/financial-information/quarterly-results'],
  },
  US3841091040: {
    listenUrls: ['https://investors.graco.com/financial-information/quarterly-results'],
  },
  US0404132054: {
    listenUrls: ['https://investors.arista.com/financial-information/quarterly-results'],
  },
  US7757111049: {
    listenUrls: ['https://investors.rollins.com/financial-information/quarterly-results'],
  },
  US1729081059: {
    listenUrls: ['https://investors.cintas.com/financial-information/quarterly-results'],
  },
  US91680M1071: {
    listenUrls: ['https://investors.upstart.com/financial-information/quarterly-results'],
  },
}

export function irEarningsQuelleFuerIsin(isin: string | null | undefined): IrEarningsQuelle | null {
  if (!isin?.trim()) return null
  const key = isin.trim().toUpperCase()
  const hard = IR_EARNINGS_NACH_ISIN[key]
  if (hard) return hard

  const meta = earningsCallKenntnis(key)
  if (meta?.irNurWebcast) {
    return { listenUrls: [], erwarteVollesTranskript: false }
  }

  const irHome = IR_NACH_ISIN[key]
  if (irHome) {
    return { listenUrls: [irHome] }
  }

  return null
}

export function istTranskriptLink(text: string, href: string): boolean {
  return istTranskriptLinkStreng(text, href)
}

export function scoreTranskriptLink(text: string, href: string): number {
  const combined = `${text} ${href}`.toLowerCase()
  let score = 0
  if (combined.includes('transcript') || combined.includes('transkript')) score += 12
  if (/investor-call|investor call|results-video-transcript/i.test(combined)) score += 14
  if (
    combined.includes('conference call') ||
    combined.includes('earnings call') ||
    combined.includes('konferenz') ||
    combined.includes('quartalsgespräch') ||
    combined.includes('quartalsgespraech') ||
    combined.includes('results call')
  ) {
    score += 10
  }
  if (combined.includes('webcast') || combined.includes('replay')) score += 8
  if (/revenue_q|ca_t[1-4]|message.*executive|executive management|analyst conference/i.test(combined)) score += 6
  if (/assets-finance\.hermes\.com/i.test(href)) score += 5
  if (/q[1-4]\s*20\d{2}|20\d{2}.*q[1-4]/i.test(combined)) score += 6
  if (/\.pdf$/i.test(href)) score += 2
  if (combined.includes('presentation') && !combined.includes('transcript')) score -= 8
  if (/press release|earnings release/i.test(combined) && !combined.includes('transcript')) score -= 10
  return score
}
