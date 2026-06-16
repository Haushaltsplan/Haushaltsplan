import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

/** Bekannte Slugs (finances-URL: /quote/stock/{slug}/finances/). */
const SLUGS: Record<string, string> = {
  US5949181045: 'MICROSOFT-CORP-4835',
  US02079K1079: 'ALPHABET-INC-24203373',
  US02079K3059: 'ALPHABET-INC-24203373',
  NL0010273215: 'ASML-HOLDING-N-V-12002973',
  DE0006580806: 'MENSCH-UND-MASCHINE-SOFTWARE-436035',
}

function slugAusName(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function marketscreenerSlugKandidaten(
  isin: string,
  name: string,
  symbolYahoo?: string | null,
): string[] {
  const isinNorm = isin.trim().toUpperCase()
  const out: string[] = []
  const add = (s: string) => {
    const t = s.trim()
    if (t && !out.includes(t)) out.push(t)
  }

  const hard = SLUGS[isinNorm]
  if (hard) add(hard)

  const k = isinKenntnis(isinNorm)
  if (k?.name) {
    const n = slugAusName(k.name)
    if (n.length > 3) {
      add(`${n}-CORP`)
      add(`${n}-INC`)
    }
  }

  const sym = (symbolYahoo ?? k?.symbolYahoo ?? '').trim().toUpperCase()
  if (sym && !sym.includes('.')) {
    add(`${slugAusName(sym)}-CORP`)
  }

  if (name.trim()) {
    const n = slugAusName(name)
    if (n.length > 3) add(n)
  }

  return out
}
