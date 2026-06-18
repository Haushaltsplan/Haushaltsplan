/** ISIN → kuratierte Ad-hoc / Pflichtmitteilungs-Listen (EU & UK). */

export type EuAdhocQuelle = {
  listenUrls: string[]
  /** Zusätzliche Pfad-Suffixe relativ zur IR-Startseite */
  pfadSuffixe?: string[]
  keywords?: string[]
}

/** Portfolio + typische Börsen-IR-Strukturen je ISIN. */
export const EU_ADHOC_NACH_ISIN: Record<string, EuAdhocQuelle> = {
  FR0000121014: {
    listenUrls: [
      'https://www.lvmh.com/en/regulated-information',
      'https://www.lvmh.com/en/investors/publications',
      'https://www.lvmh.com/en/financial-calendar',
    ],
    keywords: ['inside information', 'ad hoc', 'guidance', 'acquisition'],
  },
  FR0000052292: {
    listenUrls: [
      'https://finance.hermes.com/en/regulated-information',
      'https://finance.hermes.com/en/publications/',
    ],
    keywords: ['inside information', 'information réglementée', 'ad hoc'],
  },
  NL0010273215: {
    listenUrls: [
      'https://www.asml.com/en/investors/regulatory-news',
      'https://www.asml.com/en/investors/financial-news',
    ],
    keywords: ['inside information', 'regulatory', 'trading update'],
  },
  NL0000395903: {
    listenUrls: [
      'https://www.wolterskluwer.com/en/investors/regulatory-announcements',
      'https://www.wolterskluwer.com/en/news',
    ],
    keywords: ['inside information', 'regulatory announcement'],
  },
  CH0418792922: {
    listenUrls: [
      'https://www.sika.com/en/media/news.html',
      'https://www.sika.com/en/investors/regulatory-announcements.html',
    ],
    pfadSuffixe: ['/en/investors/ad-hoc-announcements.html'],
    keywords: ['ad hoc', 'inside information', 'media release'],
  },
  CH1175448666: {
    listenUrls: [
      'https://www.straumann.com/group/en/investors/regulatory-announcements.html',
      'https://www.straumann.com/group/en/media/news.html',
    ],
    keywords: ['ad hoc', 'inside information'],
  },
  CH0012221716: {
    listenUrls: [
      'https://www.straumann.com/group/en/investors/regulatory-announcements.html',
      'https://www.straumann.com/group/en/media/news.html',
    ],
  },
  GB0004052071: {
    listenUrls: [
      'https://www.halma.com/investors/regulatory-news',
      'https://www.halma.com/media/news',
    ],
    keywords: ['inside information', 'regulatory news', 'RNS'],
  },
  DE0006580806: {
    listenUrls: [
      'https://www.mum.de/unternehmen/investor-relations/ad-hoc-mitteilungen',
      'https://www.mum.de/unternehmen/investor-relations/publikationen',
    ],
    keywords: ['ad-hoc', 'dgap', 'eqs', 'directors dealing'],
  },
  DE0005785802: {
    listenUrls: [
      'https://www.mum.de/unternehmen/investor-relations/ad-hoc-mitteilungen',
      'https://www.mum.de/unternehmen/investor-relations/publikationen',
    ],
  },
  DE000A0BVU28: {
    listenUrls: [
      'https://www.usu.com/de/unternehmen/investor-relations/ad-hoc-mitteilungen',
      'https://www.usu.com/de/unternehmen/investor-relations/publikationen',
    ],
    keywords: ['ad-hoc', 'dgap', 'eqs'],
  },
  CA01626P1484: {
    listenUrls: [
      'https://corporate.couche-tard.com/financial-reporting?cat=29',
      'https://corporate.couche-tard.com/investors',
    ],
  },
  CA15135U1093: {
    listenUrls: [
      'https://corpo.couche-tard.com/en/news/press-releases',
      'https://corpo.couche-tard.com/en/investors',
    ],
  },
  CA015DM1098: {
    listenUrls: [
      'https://corpo.couche-tard.com/en/news/press-releases',
      'https://corpo.couche-tard.com/en/investors',
    ],
  },
}

/** Länder-spezifische IR-Pfad-Suffixe (relativ zur IR-Startseite). */
export const ADHOC_PFADE_NACH_LAND: Record<string, string[]> = {
  DE: [
    '/de/unternehmen/investor-relations/ad-hoc-mitteilungen',
    '/unternehmen/investor-relations/ad-hoc-mitteilungen',
    '/de/investor-relations/ad-hoc-mitteilungen',
    '/investor-relations/ad-hoc-mitteilungen',
    '/de/investor-relations/publikationen',
    '/investor-relations/publikationen',
    '/de/unternehmen/investor-relations/publikationen',
  ],
  FR: [
    '/en/regulated-information',
    '/fr/informations-reglementees',
    '/en/investors/regulated-information',
    '/en/investors/publications',
  ],
  NL: [
    '/en/investors/regulatory-news',
    '/en/investors/financial-news',
    '/investors/regulatory-announcements',
  ],
  CH: [
    '/en/investors/regulatory-announcements.html',
    '/group/en/investors/regulatory-announcements.html',
    '/en/investors/ad-hoc-announcements.html',
    '/en/media/news.html',
  ],
  GB: [
    '/investors/regulatory-news',
    '/investors/news/regulatory',
    '/media/news',
  ],
  IE: ['/investors/regulatory-news', '/investors/news'],
  BE: ['/en/investors/regulatory-information', '/investors/news'],
  LU: ['/en/investors/regulated-information'],
  AT: ['/de/investor-relations/ad-hoc-mitteilungen'],
  SE: ['/en/investors/regulatory-news'],
  DK: ['/investor/news/regulatory'],
  FI: ['/en/investors/releases'],
  NO: ['/investor/news'],
  ES: ['/en/investors/regulatory-information'],
  IT: ['/en/investors/regulatory-disclosures'],
}

export function euAdhocQuelleFuerIsin(isin: string | null | undefined): EuAdhocQuelle | null {
  if (!isin?.trim()) return null
  return EU_ADHOC_NACH_ISIN[isin.trim().toUpperCase()] ?? null
}

export function adhocPfadeFuerIsin(isin: string): string[] {
  const land = isin.trim().toUpperCase().slice(0, 2)
  return ADHOC_PFADE_NACH_LAND[land] ?? []
}
