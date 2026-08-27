/**
 * Anlageklassen für die Vermögensübersicht (Bank, Aktien, P2P, Bausparer, Fonds, …).
 * Freitext-Titel werden zugeordnet, gespeicherte `klasse` hat Vorrang (außer Default „sonstiges“
 * bei treffenderem Inferieren — damit alte Posten ohne Migration trotzdem landen).
 */

export type VermoegenKlasse =
  | 'bank'
  | 'aktien'
  | 'fonds'
  | 'p2p'
  | 'bausparer'
  | 'rente'
  | 'sonstiges'

export type VermoegenKlasseDef = {
  key: VermoegenKlasse
  label: string
  kurz: string
  farbe: string
  textClass: string
  beispiele: string
}

export const VERMOEGEN_KLASSEN: readonly VermoegenKlasseDef[] = [
  {
    key: 'bank',
    label: 'Bankguthaben',
    kurz: 'Bank',
    farbe: '#38bdf8',
    textClass: 'text-sky-300',
    beispiele: 'Giro, Tagesgeld, Festgeld, Bargeld',
  },
  {
    key: 'aktien',
    label: 'Aktienvermögen',
    kurz: 'Aktien',
    farbe: '#818cf8',
    textClass: 'text-indigo-300',
    beispiele: 'Depot, Trade Republic, Einzelaktien',
  },
  {
    key: 'fonds',
    label: 'Fonds',
    kurz: 'Fonds',
    farbe: '#2dd4bf',
    textClass: 'text-teal-300',
    beispiele: 'UniGlobal, Fonds außerhalb des Depots',
  },
  {
    key: 'p2p',
    label: 'P2P-Kredite',
    kurz: 'P2P',
    farbe: '#fb923c',
    textClass: 'text-orange-300',
    beispiele: 'Mintos, Bondora, PeerBerry',
  },
  {
    key: 'bausparer',
    label: 'Bausparer',
    kurz: 'Bausparer',
    farbe: '#facc15',
    textClass: 'text-yellow-300',
    beispiele: 'Schwäbisch Hall, LBS, Wüstenrot',
  },
  {
    key: 'rente',
    label: 'Altersvorsorge',
    kurz: 'Rente',
    farbe: '#c084fc',
    textClass: 'text-purple-300',
    beispiele: 'Riester, Rürup, Lebensversicherung',
  },
  {
    key: 'sonstiges',
    label: 'Sonstiges',
    kurz: 'Sonstiges',
    farbe: '#94a3b8',
    textClass: 'text-slate-300',
    beispiele: 'Krypto, Gold, andere Werte',
  },
] as const

const KLASSEN_MAP = new Map(VERMOEGEN_KLASSEN.map((k) => [k.key, k]))

export function vermoegenKlasseDef(key: VermoegenKlasse): VermoegenKlasseDef {
  return KLASSEN_MAP.get(key) ?? VERMOEGEN_KLASSEN[VERMOEGEN_KLASSEN.length - 1]
}

export function istVermoegenKlasse(v: unknown): v is VermoegenKlasse {
  return typeof v === 'string' && KLASSEN_MAP.has(v as VermoegenKlasse)
}

function deutschLower(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
}

function hatWort(t: string, ...teile: string[]) {
  return teile.some((x) => t.includes(x))
}

/**
 * Reihenfolge = Spezifität (Bausparer/P2P/Rente vor Bank/Fonds, Broker vor Giro).
 */
export function inferiereVermoegenKlasse(titel: string): VermoegenKlasse {
  const t = deutschLower(titel)
  if (!t) return 'sonstiges'

  if (hatWort(t, 'bauspar', 'schwaebisch hall', 'wuestenrot', 'lbs ', ' lbs', 'bausparkasse')) {
    return 'bausparer'
  }
  if (
    hatWort(
      t,
      'p2p',
      'p 2 p',
      'mintos',
      'bondora',
      'peerberry',
      'peer berry',
      'auxmoney',
      'estateguru',
      'twino',
      'robocash',
      'viainvest',
      'peer-to-peer',
    )
  ) {
    return 'p2p'
  }
  if (
    hatWort(
      t,
      'uniprofirente',
      'uniprofi',
      'riester',
      'ruerup',
      'altersvorsorge',
      'betriebsrente',
      'lebensversicherung',
      'pensionskasse',
    )
  ) {
    return 'rente'
  }
  if (hatWort(t, 'allianz') && hatWort(t, 'rente', 'leben', 'lv', 'vorsorge')) {
    return 'rente'
  }
  if (
    hatWort(
      t,
      'uniglobal',
      'union investment',
      'fondsspar',
      'investmentfonds',
      'aktiv gemanagt',
    ) ||
    /\bfonds?\b/.test(t) ||
    /\bfond\b/.test(t)
  ) {
    return 'fonds'
  }
  if (
    hatWort(
      t,
      'trade republic',
      'traderepublic',
      'parqet',
      'scalable',
      'smartbroker',
      'justtrade',
      'flatex',
      'consorsbank',
      'comdirect',
      'einzelaktie',
      'wertpapier',
    ) ||
    /\baktie(n)?\b/.test(t) ||
    /\bdepot\b/.test(t)
  ) {
    return 'aktien'
  }
  if (
    hatWort(
      t,
      'tagesgeld',
      'festgeld',
      'giro',
      'sparbuch',
      'bargeld',
      'sparkasse',
      'volksbank',
      'ing-diba',
      'ing diba',
      'postbank',
      'commerzbank',
      'n26',
      'c24',
      'dkb',
      'revolut',
      'kontostand',
      'girokonto',
      'tagesgeldkonto',
    ) ||
    /\bbank(konto|guthaben)?\b/.test(t) ||
    /\bkonto\b/.test(t)
  ) {
    return 'bank'
  }
  if (hatWort(t, 'krypto', 'bitcoin', 'ethereum', 'gold', 'silber', 'muenze')) {
    return 'sonstiges'
  }
  return 'sonstiges'
}

/** Gespeicherte Klasse, sonst Inferenz; Default „sonstiges“ weicht der Inferenz. */
export function effektiveVermoegenKlasse(titel: string, gespeichert?: string | null): VermoegenKlasse {
  const inferiert = inferiereVermoegenKlasse(titel)
  if (istVermoegenKlasse(gespeichert) && gespeichert !== 'sonstiges') return gespeichert
  if (inferiert !== 'sonstiges') return inferiert
  return istVermoegenKlasse(gespeichert) ? gespeichert : 'sonstiges'
}

export type VermoegenAnzeigePosten = {
  id: string
  titel: string
  betrag: number
  klasse: VermoegenKlasse
  /** Virtual: Depotwert aus Portfolio-Analyse, nicht in finanz_vermoegen. */
  quelle: 'manuell' | 'depot'
}

export function gruppiereVermoegen(posten: VermoegenAnzeigePosten[]) {
  const summeJeKlasse = new Map<VermoegenKlasse, number>()
  const listen = new Map<VermoegenKlasse, VermoegenAnzeigePosten[]>()
  for (const k of VERMOEGEN_KLASSEN) {
    summeJeKlasse.set(k.key, 0)
    listen.set(k.key, [])
  }
  for (const p of posten) {
    const betrag = Number(p.betrag) || 0
    summeJeKlasse.set(p.klasse, (summeJeKlasse.get(p.klasse) || 0) + betrag)
    listen.get(p.klasse)?.push(p)
  }
  for (const arr of listen.values()) {
    arr.sort((a, b) => b.betrag - a.betrag)
  }
  const gesamt = Math.round([...summeJeKlasse.values()].reduce((a, b) => a + b, 0) * 100) / 100
  const klassenMitWert = VERMOEGEN_KLASSEN.filter((k) => (summeJeKlasse.get(k.key) || 0) !== 0).map((k) => ({
    ...k,
    betrag: Math.round((summeJeKlasse.get(k.key) || 0) * 100) / 100,
    anteil: gesamt > 0 ? (summeJeKlasse.get(k.key) || 0) / gesamt : 0,
    posten: listen.get(k.key) ?? [],
  }))
  return { gesamt, klassenMitWert, listen, summeJeKlasse }
}

export const FINANZEN_DEPOT_EINBEZIEHEN_LS = 'finanzen-depot-einbeziehen-v1'
