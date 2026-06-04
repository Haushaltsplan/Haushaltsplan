import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { portfolioLogoQuellen } from '@/lib/portfolio-analyse/portfolio-logos'

/** Manuelle IR-Startseiten (Investor Relations). */
const IR_NACH_ISIN: Record<string, string> = {
  US5949181045: 'https://www.microsoft.com/en-us/investor',
  US02079K1079: 'https://abc.xyz/investor/',
  US02079K3059: 'https://abc.xyz/investor/',
  US92826C8394: 'https://investor.visa.com/',
  US57636Q1040: 'https://investor.mastercard.com/',
  US91324P1021: 'https://www.unitedhealthgroup.com/investors.html',
  US81762P1021: 'https://investors.servicenow.com/',
  US8835561023: 'https://ir.thermofisher.com/',
  US78409V1044: 'https://investor.spglobal.com/',
  US55354G1004: 'https://www.msci.com/investor-relations',
  US7611521078: 'https://investors.resmed.com/',
  DE0006580806: 'https://www.mum.de/unternehmen/investor-relations',
  DE0005785802: 'https://www.mum.de/unternehmen/investor-relations',
  DE000A0BVU28: 'https://www.usu.com/de/unternehmen/investor-relations',
  FR0000121014: 'https://www.lvmh.com/investors',
  FR0000052292: 'https://finance.hermes.com/en/',
  NL0010273215: 'https://www.asml.com/en/investors',
  NL0000395903: 'https://www.wolterskluwer.com/en/investors',
  CH0418792922: 'https://www.sika.com/en/investors.html',
  CH0012221716: 'https://www.straumann.com/group/en/investors.html',
  GB0004052071: 'https://www.halma.com/investors',
  CA15135U1093: 'https://corpo.couche-tard.com/en/investors',
  CA015DM1098: 'https://corpo.couche-tard.com/en/investors',
}

const IR_PFADE = [
  '/investor-relations',
  '/investors',
  '/investor',
  '/en/investors',
  '/de/investor-relations',
  '/unternehmen/investor-relations',
]

function irAusDomain(domain: string, isin: string): string {
  const host = domain.replace(/^www\./, '')
  if (isin.startsWith('DE') || isin.startsWith('AT') || isin.startsWith('CH')) {
    return `https://www.${host}/de/investor-relations`
  }
  for (const pfad of IR_PFADE) {
    if (pfad.includes('/de/') && !isin.startsWith('DE')) continue
    return `https://www.${host}${pfad}`
  }
  return `https://www.${host}/investors`
}

export async function ladeInvestorRelationsUrl(
  isin: string,
  name: string,
  symbolYahoo?: string | null,
): Promise<string | null> {
  const isinNorm = isin.trim().toUpperCase()
  if (isinNorm.length < 10) return null

  const hard = IR_NACH_ISIN[isinNorm]
  if (hard) return hard

  const k = isinKenntnis(isinNorm)
  const logo = portfolioLogoQuellen(isinNorm, symbolYahoo ?? k?.symbolYahoo, name)
  const domain = logo.clearbitDomains?.[0]
  if (domain) return irAusDomain(domain, isinNorm)

  const key = (process.env.FINNHUB_API_KEY ?? '').trim()
  const sym = (symbolYahoo ?? k?.symbolYahoo ?? '').trim().toUpperCase()
  if (!key || !sym) return null

  const base = sym.includes('.') ? sym.split('.')[0] : sym
  for (const s of [sym, base]) {
    try {
      const u = new URL('https://finnhub.io/api/v1/stock/profile2')
      u.searchParams.set('symbol', s)
      u.searchParams.set('token', key)
      const res = await fetch(u.toString(), { next: { revalidate: 86400 } })
      if (!res.ok) continue
      const p = (await res.json()) as { weburl?: string }
      const web = p.weburl?.trim()
      if (!web) continue
      try {
        const host = new URL(web).hostname.replace(/^www\./, '')
        return irAusDomain(host, isinNorm)
      } catch {
        return web.endsWith('/') ? `${web}investors` : `${web}/investors`
      }
    } catch {
      continue
    }
  }

  return null
}
