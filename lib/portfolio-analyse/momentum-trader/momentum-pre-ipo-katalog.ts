/** Bekannte Pre-IPO-Kandidaten — Yahoo liefert dafür oft keinen Treffer. */

export type MomentumPreIpoKandidat = {
  name: string
  /** Internes Tracking-Symbol (kein Börsenticker bis zur Listung). */
  symbol: string
  aliases: string[]
  /** Gerücht / Schätzung — Nutzer kann im UI anpassen. */
  ipoDatumVorschlag?: string | null
  notiz?: string
}

export const MOMENTUM_PRE_IPO_KATALOG: MomentumPreIpoKandidat[] = [
  {
    name: 'SpaceX',
    symbol: 'SPACEX',
    aliases: ['spacex', 'space x', 'space exploration', 'space exploration technologies'],
    ipoDatumVorschlag: null,
    notiz: 'Noch nicht gelistet — IPO-Datum manuell pflegen oder nach Sync prüfen.',
  },
  {
    name: 'Stripe',
    symbol: 'STRIPE',
    aliases: ['stripe'],
  },
  {
    name: 'Databricks',
    symbol: 'DATABRICKS',
    aliases: ['databricks'],
  },
  {
    name: 'Discord',
    symbol: 'DISCORD',
    aliases: ['discord'],
  },
  {
    name: 'Cerebras Systems',
    symbol: 'CEREBRAS',
    aliases: ['cerebras'],
  },
  {
    name: 'Klarna',
    symbol: 'KLARNA',
    aliases: ['klarna'],
  },
  {
    name: 'Chime',
    symbol: 'CHIME',
    aliases: ['chime', 'chime financial'],
  },
  {
    name: 'Fanatics',
    symbol: 'FANATICS',
    aliases: ['fanatics'],
  },
]

function normalisiereSuchtext(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .trim()
}

export function findePreIpoKandidaten(query: string): MomentumPreIpoKandidat[] {
  const q = normalisiereSuchtext(query)
  if (q.length < 2) return []

  const out: MomentumPreIpoKandidat[] = []
  for (const k of MOMENTUM_PRE_IPO_KATALOG) {
    const nameN = normalisiereSuchtext(k.name)
    const symN = k.symbol.toLowerCase()
    const match =
      nameN.includes(q) ||
      q.includes(nameN) ||
      symN.includes(q.replace(/\s/g, '')) ||
      k.aliases.some((a) => {
        const an = normalisiereSuchtext(a)
        return an.includes(q) || q.includes(an)
      })
    if (match && !out.some((x) => x.symbol === k.symbol)) out.push(k)
  }
  return out.slice(0, 8)
}

export function findePreIpoNachSymbol(symbol: string): MomentumPreIpoKandidat | null {
  const sym = symbol.trim().toUpperCase()
  return MOMENTUM_PRE_IPO_KATALOG.find((k) => k.symbol === sym) ?? null
}
