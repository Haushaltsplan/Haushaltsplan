import type { Angebot } from '@/lib/angebote/types'

const PLATZHALTER_MARKEN = new Set([
  'this is no brand',
  'no brand',
  'ohne marke',
  'unbekannt',
])

/** Extrahiert Packungsgröße aus Freitext, z. B. "500 g", "1,5 l", "6x0,33l". */
export function parsePackung(text: string | null | undefined): {
  menge: number | null
  einheit: 'g' | 'ml' | 'st' | null
  text: string | null
} {
  if (!text?.trim()) return { menge: null, einheit: null, text: null }
  const raw = text.trim()

  const multi = raw.match(
    /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl)\b/i,
  )
  if (multi) {
    const n = Number(multi[1])
    const single = Number(multi[2].replace(',', '.'))
    const unit = multi[3].toLowerCase()
    const { menge, einheit } = toBase(n * single, unit)
    return { menge, einheit, text: raw }
  }

  const one = raw.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|stk|stück|st\.?)\b/i)
  if (one) {
    const val = Number(one[1].replace(',', '.'))
    const unit = one[2].toLowerCase().replace(/\.$/, '')
    if (unit.startsWith('st') || unit === 'stück') {
      return { menge: val, einheit: 'st', text: raw }
    }
    const { menge, einheit } = toBase(val, unit)
    return { menge, einheit, text: raw }
  }

  return { menge: null, einheit: null, text: raw }
}

function toBase(
  val: number,
  unit: string,
): { menge: number; einheit: 'g' | 'ml' } {
  switch (unit) {
    case 'kg':
      return { menge: val * 1000, einheit: 'g' }
    case 'g':
      return { menge: val, einheit: 'g' }
    case 'l':
      return { menge: val * 1000, einheit: 'ml' }
    case 'cl':
      return { menge: val * 10, einheit: 'ml' }
    case 'ml':
    default:
      return { menge: val, einheit: 'ml' }
  }
}

export function berechneGrundpreis(
  preisEur: number,
  menge: number | null,
  einheit: 'g' | 'ml' | 'st' | null,
): { grundpreisEur: number | null; grundpreisEinheit: 'kg' | 'l' | 'st' | null } {
  if (!Number.isFinite(preisEur) || preisEur <= 0 || !menge || menge <= 0 || !einheit) {
    return { grundpreisEur: null, grundpreisEinheit: null }
  }
  if (einheit === 'st') {
    return { grundpreisEur: round2(preisEur / menge), grundpreisEinheit: 'st' }
  }
  if (einheit === 'g') {
    return { grundpreisEur: round2((preisEur / menge) * 1000), grundpreisEinheit: 'kg' }
  }
  return { grundpreisEur: round2((preisEur / menge) * 1000), grundpreisEinheit: 'l' }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function cleanMarke(marke: string | null | undefined): string | null {
  if (!marke?.trim()) return null
  const t = marke.trim()
  if (PLATZHALTER_MARKEN.has(t.toLowerCase())) return null
  return t
}

export function parsePreisEur(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return round2(raw)
  if (typeof raw !== 'string') return null
  const cleaned = raw
    .replace(/[€\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? round2(n) : null
}

export function normalisiereAngebot(teil: Omit<Angebot, 'grundpreisEur' | 'grundpreisEinheit' | 'packungMenge' | 'packungEinheit'> & {
  packungMenge?: number | null
  packungEinheit?: 'g' | 'ml' | 'st' | null
  grundpreisEur?: number | null
  grundpreisEinheit?: 'kg' | 'l' | 'st' | null
}): Angebot {
  const marke = cleanMarke(teil.marke)
  let packungMenge = teil.packungMenge ?? null
  let packungEinheit = teil.packungEinheit ?? null
  if (packungMenge == null || packungEinheit == null) {
    const parsed = parsePackung(teil.packungText)
    packungMenge = parsed.menge
    packungEinheit = parsed.einheit
  }
  let grundpreisEur = teil.grundpreisEur ?? null
  let grundpreisEinheit = teil.grundpreisEinheit ?? null
  if (grundpreisEur == null) {
    const g = berechneGrundpreis(teil.preisEur, packungMenge, packungEinheit)
    grundpreisEur = g.grundpreisEur
    grundpreisEinheit = g.grundpreisEinheit
  }
  const name = marke && !teil.name.toLowerCase().startsWith(marke.toLowerCase())
    ? `${marke} ${teil.name}`.trim()
    : teil.name.trim()

  return {
    ...teil,
    name,
    marke,
    packungMenge,
    packungEinheit,
    grundpreisEur,
    grundpreisEinheit,
  }
}

export function filterUndSortiere(
  angebote: Angebot[],
  opts: {
    q?: string
    haendler?: string[]
    sort?: 'preis' | 'grundpreis' | 'haendler' | 'name'
  },
): Angebot[] {
  let list = angebote
  if (opts.haendler?.length) {
    const set = new Set(opts.haendler)
    list = list.filter((a) => set.has(a.haendler))
  }
  const q = opts.q?.trim().toLowerCase()
  if (q) {
    const terms = q.split(/\s+/).filter(Boolean)
    list = list.filter((a) => {
      const hay = `${a.name} ${a.marke ?? ''} ${a.kategorie ?? ''}`.toLowerCase()
      return terms.every((t) => hay.includes(t))
    })
  }
  const sort = opts.sort ?? 'preis'
  list = [...list].sort((a, b) => {
    if (sort === 'grundpreis') {
      const ga = a.grundpreisEur ?? Number.POSITIVE_INFINITY
      const gb = b.grundpreisEur ?? Number.POSITIVE_INFINITY
      if (ga !== gb) return ga - gb
    }
    if (sort === 'haendler') {
      const c = a.haendler.localeCompare(b.haendler)
      if (c !== 0) return c
    }
    if (sort === 'name') {
      return a.name.localeCompare(b.name, 'de')
    }
    return a.preisEur - b.preisEur
  })
  return list
}
