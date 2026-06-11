/** IR-Seiten für Earnings-Call-Transkripte (Conference Call + Q&A). */

import { istTranskriptLinkStreng } from '@/lib/portfolio-analyse/earnings-call-transcript-heuristik'

export type IrEarningsQuelle = {
  listenUrls: string[]
  /** Q4-Plattform: Basis-URL für /feed/Event.svc (z. B. https://abc.xyz) */
  q4BasisUrls?: string[]
  keywords?: string[]
}

/** ISIN → IR-Earnings-Seiten (Portfolio + häufige Fälle). */
export const IR_EARNINGS_NACH_ISIN: Record<string, IrEarningsQuelle> = {
  NL0010273215: {
    listenUrls: ['https://www.asml.com/en/investors/financial-results'],
  },
  FR0000121014: {
    listenUrls: ['https://www.lvmh.com/investors/publications'],
  },
  FR0000052292: {
    listenUrls: ['https://finance.hermes.com/en/publications/'],
  },
  NL0000395903: {
    listenUrls: ['https://www.wolterskluwer.com/en/investors/financials'],
  },
  CH0418792922: {
    listenUrls: ['https://www.sika.com/en/investors/financial-reports.html'],
  },
  CH0012221716: {
    listenUrls: ['https://www.straumann.com/group/en/investors/results-and-presentations.html'],
  },
  GB0004052071: {
    listenUrls: ['https://www.halma.com/investors/results-centre'],
  },
  DE0006580806: {
    listenUrls: ['https://www.mum.de/unternehmen/investor-relations/finanzberichte'],
  },
  DE0005785802: {
    listenUrls: ['https://www.mum.de/unternehmen/investor-relations/finanzberichte'],
  },
  DE000A0BVU28: {
    listenUrls: ['https://www.usu.com/de/unternehmen/investor-relations/publikationen'],
  },
  CA15135U1093: {
    listenUrls: ['https://corpo.couche-tard.com/en/financial-reports'],
  },
  CA015DM1098: {
    listenUrls: ['https://corpo.couche-tard.com/en/financial-reports'],
  },
  US02079K1079: {
    listenUrls: ['https://abc.xyz/investor/earnings/'],
    q4BasisUrls: ['https://abc.xyz'],
  },
  US02079K3059: {
    listenUrls: ['https://abc.xyz/investor/earnings/'],
    q4BasisUrls: ['https://abc.xyz'],
  },
  US57636Q1040: {
    listenUrls: [
      'https://investor.mastercard.com/events-and-presentations/default.aspx',
      'https://investor.mastercard.com/financials-and-sec-filings/quarterly-results/default.aspx',
    ],
    q4BasisUrls: ['https://investor.mastercard.com'],
  },
  US5949181045: {
    listenUrls: ['https://www.microsoft.com/en-us/investor/earnings'],
    q4BasisUrls: ['https://microsoft.com', 'https://www.microsoft.com'],
  },
  US81762P1021: {
    listenUrls: ['https://investors.servicenow.com/financial-information/quarterly-results'],
  },
}

export function irEarningsQuelleFuerIsin(isin: string | null | undefined): IrEarningsQuelle | null {
  if (!isin?.trim()) return null
  return IR_EARNINGS_NACH_ISIN[isin.trim().toUpperCase()] ?? null
}

export function istTranskriptLink(text: string, href: string): boolean {
  return istTranskriptLinkStreng(text, href)
}

export function scoreTranskriptLink(text: string, href: string): number {
  const combined = `${text} ${href}`.toLowerCase()
  let score = 0
  if (combined.includes('transcript')) score += 12
  if (combined.includes('conference call') || combined.includes('earnings call')) score += 10
  if (combined.includes('webcast')) score += 4
  if (/q[1-4]\s*20\d{2}|20\d{2}.*q[1-4]/i.test(combined)) score += 6
  if (/\.pdf$/i.test(href)) score += 2
  if (combined.includes('presentation') && !combined.includes('transcript')) score -= 8
  if (/press release|earnings release/i.test(combined) && !combined.includes('transcript')) score -= 10
  return score
}
