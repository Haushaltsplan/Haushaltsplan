/** Rollen für den App-Zugang. Gäste sehen nur die Portfolioanalyse mit eigenen Daten. */

export type OmniaRolle = 'owner' | 'portfolio_gast' | 'none'

export const PORTFOLIO_GAST_ROLLE = 'portfolio_gast' as const

export const PORTFOLIO_ANALYSE_PFAD = '/portfolioanalyse'

export type AuthUserFuerRolle = {
  id?: string | null
  email?: string | null
  app_metadata?: Record<string, unknown> | null
} | null | undefined

function splitEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function ownerEmailsAusEnv(): string[] {
  const server = splitEmails(process.env.APP_ALLOWED_EMAILS || '')
  if (server.length > 0) return server
  return splitEmails(process.env.NEXT_PUBLIC_ALLOWED_EMAILS || '')
}

export function ownerEmailsPublic(): string[] {
  return splitEmails(process.env.NEXT_PUBLIC_ALLOWED_EMAILS || '')
}

export function omniaRolleAusUser(
  user: AuthUserFuerRolle,
  ownerEmails: string[] = ownerEmailsAusEnv(),
): OmniaRolle {
  if (!user?.id) return 'none'
  const email = String(user.email || '').toLowerCase()
  const meta = String(user.app_metadata?.omnia_rolle || '').trim()
  if (ownerEmails.length > 0 && email && ownerEmails.includes(email)) return 'owner'
  if (meta === PORTFOLIO_GAST_ROLLE) return 'portfolio_gast'
  if (ownerEmails.length === 0) return 'owner'
  return 'none'
}

export function istPortfolioAnalysePfad(pathname: string): boolean {
  return pathname === PORTFOLIO_ANALYSE_PFAD || pathname.startsWith(`${PORTFOLIO_ANALYSE_PFAD}/`)
}

export function gastSeiteErlaubt(pathname: string): boolean {
  if (istPortfolioAnalysePfad(pathname)) return true
  if (pathname === '/datenschutz' || pathname.startsWith('/datenschutz/')) return true
  if (pathname === '/auth/confirm' || pathname.startsWith('/auth/confirm/')) return true
  return false
}

/** APIs, die ein Portfolio-Gast aufrufen darf (alles andere → 403). */
export function gastApiErlaubt(pathname: string): boolean {
  if (pathname.startsWith('/api/portfolio-analyse/')) return true
  if (pathname === '/api/portfolio-berater') return true
  if (pathname.startsWith('/api/client-state/')) return true
  if (pathname === '/api/zugriff/ich') return true
  return false
}

export function loginZielFuerRolle(rolle: OmniaRolle): string {
  return rolle === 'portfolio_gast' ? PORTFOLIO_ANALYSE_PFAD : '/'
}
