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

/** Manuell erfassbar — Aktien kommen aus der Portfolio-Analyse. */
export const MANUELLE_VERMOEGEN_KLASSEN: readonly VermoegenKlasseDef[] = VERMOEGEN_KLASSEN.filter(
  (k) => k.key !== 'aktien',
)

export function brauchtFondsIsin(klasse: VermoegenKlasse): boolean {
  return klasse === 'fonds'
}

export const ISIN_MUSTER = /^[A-Z]{2}[A-Z0-9]{10}$/

export function normalisiereIsinEingabe(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase()
}

export function istGueltigeIsin(raw: string): boolean {
  return ISIN_MUSTER.test(normalisiereIsinEingabe(raw))
}

export type VermoegenAnzeigePosten = {
  id: string
  titel: string
  betrag: number
  klasse: VermoegenKlasse
  /** Virtual: Depotwert aus Portfolio-Analyse, nicht in finanz_vermoegen. */
  quelle: 'manuell' | 'depot'
  isin?: string | null
  anzahl?: number | null
  kursEur?: number | null
  kursAenderungTagProzent?: number | null
  autoAbMonat?: string | null
  bausparerSparrateEur?: number
  hinweis?: string | null
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

export function naechsterIsoMonat(jetzt = new Date()): string {
  const d = new Date(jetzt.getFullYear(), jetzt.getMonth() + 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function isoMonatAusDatum(iso?: string | null): string | null {
  if (!iso) return null
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (m) return `${m[1]}-${m[2]}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function formatIsoMonatKurz(yyyymm: string): string {
  const [y, mo] = yyyymm.split('-').map((x) => Number.parseInt(x, 10))
  if (!y || !mo) return yyyymm
  try {
    return new Date(y, mo - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  } catch {
    return yyyymm
  }
}

export type BausparerAusgabe = {
  kategorie?: string | null
  beschreibung?: string | null
  betrag?: number | string | null
  datum?: string | null
}

export type FinanzCashflowBuchung = BausparerAusgabe

export function naechsterIsoTag(jetzt = new Date()): string {
  const d = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isoTagAusDatum(iso?: string | null): string | null {
  if (!iso) return null
  const m = String(iso).slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(m)) return m
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatIsoTagDe(isoTag: string): string {
  const m = isoTag.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return isoTag
  return `${m[3]}.${m[2]}.${m[1]}`
}

export function istGirokontoPosten(titel: string, klasse?: VermoegenKlasse | null): boolean {
  if (klasse && klasse !== 'bank') return false
  const t = deutschLower(titel)
  if (hatWort(t, 'tagesgeld', 'festgeld', 'sparbuch', 'bargeld')) return false
  return hatWort(t, 'girokonto', 'giro ') || t.includes('giro') || t.endsWith('giro')
}

export function giroAbDatumFuerPosten(cashflowAbDatum?: string | null, _erstelltAm?: string | null): string {
  if (cashflowAbDatum && /^\d{4}-\d{2}-\d{2}$/.test(cashflowAbDatum)) return cashflowAbDatum
  return naechsterIsoTag()
}

export function giroCashflowAbDatum(
  einnahmen: FinanzCashflowBuchung[],
  ausgaben: FinanzCashflowBuchung[],
  abDatum: string,
): { ein: number; aus: number; saldo: number } {
  const summe = (rows: FinanzCashflowBuchung[]) => {
    let s = 0
    for (const r of rows) {
      const tag = isoTagAusDatum(r.datum)
      if (!tag || tag < abDatum) continue
      const b = Number(r.betrag)
      if (Number.isFinite(b)) s += b
    }
    return Math.round(s * 100) / 100
  }
  const ein = summe(einnahmen)
  const aus = summe(ausgaben)
  return { ein, aus, saldo: Math.round((ein - aus) * 100) / 100 }
}

export function istBausparerBuchung(kategorie?: string | null, beschreibung?: string | null): boolean {
  return inferiereVermoegenKlasse(`${kategorie ?? ''} ${beschreibung ?? ''}`) === 'bausparer'
}

function bausparerSchluessel(titel: string): string {
  const t = titel
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
  if (t.includes('schwaebisch') || t.includes('hall')) return 'schwaebisch-hall'
  if (t.includes('wuestenrot')) return 'wuestenrot'
  if (/\blbs\b/.test(t)) return 'lbs'
  return 'allgemein'
}

/** Summe der Bausparer-Ausgaben ab `abMonat` (YYYY-MM), einem Posten zugeordnet. */
export function summeBausparerAusgabenAbMonat(
  ausgaben: BausparerAusgabe[],
  abMonat: string,
  postenTitel: string,
  alleBausparerTitel: string[],
): number {
  const eigene = bausparerSchluessel(postenTitel)
  const fremdeKeys = new Set(
    alleBausparerTitel.filter((t) => t !== postenTitel).map((t) => bausparerSchluessel(t)),
  )
  let summe = 0
  for (const a of ausgaben) {
    if (!istBausparerBuchung(a.kategorie, a.beschreibung)) continue
    const monat = isoMonatAusDatum(a.datum)
    if (!monat || monat < abMonat) continue
    const buchungKey = bausparerSchluessel(`${a.kategorie ?? ''} ${a.beschreibung ?? ''}`)
    if (buchungKey !== eigene && fremdeKeys.has(buchungKey)) continue
    if (eigene !== 'allgemein' && buchungKey !== 'allgemein' && buchungKey !== eigene) continue
    const b = Number(a.betrag)
    if (Number.isFinite(b)) summe += b
  }
  return Math.round(summe * 100) / 100
}

export function fondsWertEur(anzahl: number | null | undefined, kursEur: number | null | undefined, fallbackBetrag: number): number {
  if (anzahl != null && anzahl > 0 && kursEur != null && kursEur > 0) {
    return Math.round(anzahl * kursEur * 100) / 100
  }
  return Math.round((Number(fallbackBetrag) || 0) * 100) / 100
}
