import type { AnkuendigtesEarningsEintrag } from '@/lib/portfolio-analyse/ankuendigte-earnings'

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

export type EarningsKalenderTag = {
  iso: string
  tag: number
  imMonat: boolean
  eintraege: AnkuendigtesEarningsEintrag[]
  anzahl: number
}

export type EarningsKalenderMonat = {
  monatKey: string
  titel: string
  anzahl: number
  wochen: EarningsKalenderTag[][]
}

export type EarningsKalenderJahrMonat = {
  monatKey: string
  titel: string
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

export function baueEarningsKalenderMonat(
  monatKey: string,
  eintraege: AnkuendigtesEarningsEintrag[],
): EarningsKalenderMonat {
  const jahr = Number(monatKey.slice(0, 4))
  const monat = Number(monatKey.slice(5, 7))
  const byTag = new Map<string, AnkuendigtesEarningsEintrag[]>()
  for (const e of eintraege) {
    if (!e.terminDatumIso.startsWith(monatKey)) continue
    const list = byTag.get(e.terminDatumIso) ?? []
    list.push(e)
    byTag.set(e.terminDatumIso, list)
  }

  const first = new Date(Date.UTC(jahr, monat - 1, 1))
  const daysInMonth = new Date(Date.UTC(jahr, monat, 0)).getUTCDate()
  const startMo = (first.getUTCDay() + 6) % 7

  const zellen: EarningsKalenderTag[] = []
  for (let i = 0; i < startMo; i++) {
    const prev = new Date(Date.UTC(jahr, monat - 1, -startMo + i + 1))
    const iso = isoTag(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate())
    zellen.push({ iso, tag: prev.getUTCDate(), imMonat: false, eintraege: [], anzahl: 0 })
  }
  for (let t = 1; t <= daysInMonth; t++) {
    const iso = isoTag(jahr, monat, t)
    const list = (byTag.get(iso) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'de'))
    zellen.push({ iso, tag: t, imMonat: true, eintraege: list, anzahl: list.length })
  }
  let tailTag = 1
  while (zellen.length % 7 !== 0) {
    const next = new Date(Date.UTC(jahr, monat, tailTag))
    const iso = isoTag(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
    zellen.push({ iso, tag: next.getUTCDate(), imMonat: false, eintraege: [], anzahl: 0 })
    tailTag++
  }

  const wochen: EarningsKalenderTag[][] = []
  for (let i = 0; i < zellen.length; i += 7) {
    wochen.push(zellen.slice(i, i + 7))
  }

  const anzahl = eintraege.filter((e) => e.terminDatumIso.startsWith(monatKey)).length

  return { monatKey, titel: monatTitel(monatKey), anzahl, wochen }
}

export function monateMitEarningsEintraegen(eintraege: AnkuendigtesEarningsEintrag[]): string[] {
  const keys = new Set<string>()
  for (const e of eintraege) keys.add(monatKeyAusIso(e.terminDatumIso))
  return [...keys].sort()
}

export function defaultEarningsMonatKey(eintraege: AnkuendigtesEarningsEintrag[], heuteIso: string): string {
  const monate = monateMitEarningsEintraegen(eintraege)
  if (monate.length === 0) return heuteIso.slice(0, 7)
  const heuteMonat = heuteIso.slice(0, 7)
  if (monate.includes(heuteMonat)) return heuteMonat
  const zukunft = monate.find((m) => m >= heuteMonat)
  return zukunft ?? monate[monate.length - 1]
}

export function baueEarningsKalenderJahr(
  jahr: number,
  eintraege: AnkuendigtesEarningsEintrag[],
): EarningsKalenderJahrMonat[] {
  const out: EarningsKalenderJahrMonat[] = []
  for (let m = 1; m <= 12; m++) {
    const monatKey = `${jahr}-${String(m).padStart(2, '0')}`
    const list = eintraege.filter((e) => e.terminDatumIso.startsWith(monatKey))
    out.push({
      monatKey,
      titel: MONAT_KURZ[m - 1],
      anzahl: list.length,
    })
  }
  return out
}
