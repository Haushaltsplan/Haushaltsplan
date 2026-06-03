import type { AnkuendigteDividendeEintrag } from '@/lib/portfolio-analyse/ankuendigte-dividenden'

const MONAT_KURZ = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const

export const KALENDER_WOCHENTAGE = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'] as const

export type DividendenKalenderTag = {
  iso: string
  tag: number
  imMonat: boolean
  eintraege: AnkuendigteDividendeEintrag[]
  summeEur: number
}

export type DividendenKalenderMonat = {
  monatKey: string
  titel: string
  summeEur: number
  wochen: DividendenKalenderTag[][]
}

export type DividendenKalenderJahrMonat = {
  monatKey: string
  titel: string
  summeEur: number
  anzahl: number
}

function isoTag(jahr: number, monat: number, tag: number): string {
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

export function monatKeyAusIso(iso: string): string {
  return iso.slice(0, 7)
}

export function monatTitel(monatKey: string): string {
  const jahr = Number(monatKey.slice(0, 4))
  const m = Number(monatKey.slice(5, 7))
  const name = MONAT_KURZ[m - 1] ?? monatKey
  return `${name} ${jahr}`
}

export function verschiebeMonat(monatKey: string, delta: number): string {
  const jahr = Number(monatKey.slice(0, 4))
  const monat = Number(monatKey.slice(5, 7))
  const d = new Date(Date.UTC(jahr, monat - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Montag = erste Spalte. */
export function baueKalenderMonat(monatKey: string, eintraege: AnkuendigteDividendeEintrag[]): DividendenKalenderMonat {
  const jahr = Number(monatKey.slice(0, 4))
  const monat = Number(monatKey.slice(5, 7))
  const byTag = new Map<string, AnkuendigteDividendeEintrag[]>()
  for (const e of eintraege) {
    if (!e.zahlungsdatumIso.startsWith(monatKey)) continue
    const list = byTag.get(e.zahlungsdatumIso) ?? []
    list.push(e)
    byTag.set(e.zahlungsdatumIso, list)
  }

  const first = new Date(Date.UTC(jahr, monat - 1, 1))
  const daysInMonth = new Date(Date.UTC(jahr, monat, 0)).getUTCDate()
  const startMo = (first.getUTCDay() + 6) % 7

  const zellen: DividendenKalenderTag[] = []
  for (let i = 0; i < startMo; i++) {
    const prev = new Date(Date.UTC(jahr, monat - 1, -startMo + i + 1))
    const py = prev.getUTCFullYear()
    const pm = prev.getUTCMonth() + 1
    const pt = prev.getUTCDate()
    const iso = isoTag(py, pm, pt)
    zellen.push({ iso, tag: pt, imMonat: false, eintraege: [], summeEur: 0 })
  }
  for (let t = 1; t <= daysInMonth; t++) {
    const iso = isoTag(jahr, monat, t)
    const list = (byTag.get(iso) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'de'))
    const summeEur = Math.round(list.reduce((s, x) => s + x.gesamtEur, 0) * 100) / 100
    zellen.push({ iso, tag: t, imMonat: true, eintraege: list, summeEur })
  }
  let tailTag = 1
  while (zellen.length % 7 !== 0) {
    const next = new Date(Date.UTC(jahr, monat, tailTag))
    const iso = isoTag(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
    zellen.push({ iso, tag: next.getUTCDate(), imMonat: false, eintraege: [], summeEur: 0 })
    tailTag++
  }

  const wochen: DividendenKalenderTag[][] = []
  for (let i = 0; i < zellen.length; i += 7) {
    wochen.push(zellen.slice(i, i + 7))
  }

  const summeEur = Math.round(
    eintraege.filter((e) => e.zahlungsdatumIso.startsWith(monatKey)).reduce((s, x) => s + x.gesamtEur, 0) * 100,
  ) / 100

  return { monatKey, titel: monatTitel(monatKey), summeEur, wochen }
}

export function monateMitEintraegen(eintraege: AnkuendigteDividendeEintrag[]): string[] {
  const keys = new Set<string>()
  for (const e of eintraege) keys.add(monatKeyAusIso(e.zahlungsdatumIso))
  return [...keys].sort()
}

export function defaultMonatKey(eintraege: AnkuendigteDividendeEintrag[], heuteIso: string): string {
  const monate = monateMitEintraegen(eintraege)
  if (monate.length === 0) return heuteIso.slice(0, 7)
  const heuteMonat = heuteIso.slice(0, 7)
  if (monate.includes(heuteMonat)) return heuteMonat
  const zukunft = monate.find((m) => m >= heuteMonat)
  return zukunft ?? monate[monate.length - 1]
}

export function baueKalenderJahr(jahr: number, eintraege: AnkuendigteDividendeEintrag[]): DividendenKalenderJahrMonat[] {
  const out: DividendenKalenderJahrMonat[] = []
  for (let m = 1; m <= 12; m++) {
    const monatKey = `${jahr}-${String(m).padStart(2, '0')}`
    const list = eintraege.filter((e) => e.zahlungsdatumIso.startsWith(monatKey))
    const summeEur = Math.round(list.reduce((s, x) => s + x.gesamtEur, 0) * 100) / 100
    out.push({
      monatKey,
      titel: MONAT_KURZ[m - 1],
      summeEur,
      anzahl: list.length,
    })
  }
  return out
}
