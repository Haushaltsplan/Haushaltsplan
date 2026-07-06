import { gezahlteDividendeEur } from '@/lib/portfolio-analyse/dividenden-buchung'
import type { AnkuendigteDividendeEintrag } from '@/lib/portfolio-analyse/ankuendigte-dividenden'
import { isoEndeNaechstesKalenderjahr } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { heuteIso } from '@/lib/portfolio-analyse/wertentwicklung-tage'
import { steuernAufDividendenMonate } from '@/lib/portfolio-analyse/depot-berechnung'
import { anzeigeNameFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

const MONAT_KURZ = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'] as const

const PALETTE = ['#f97316', '#a78bfa', '#f472b6', '#fbbf24', '#22d3ee', '#6366f1', '#94a3b8']

function monatsKey(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}` : ''
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type DividendenKpis = {
  depotwertEur: number
  dividendenBruttoEur: number
  dividendenNettoEur: number
  steuernAufDivEur: number
  jahreseinkommenTtmEur: number
  monatlichDurchschnittTtmEur: number
  persoenlicheRenditeProzent: number | null
  startDatum: string | null
  investiertEur: number
}

export type DividendenHeatmapZeile = {
  jahr: number
  gesamtEur: number | null
  durchschnittEur: number | null
  monate: (number | null)[]
  monatIstPrognose: boolean[]
}

export type DividendenHeatmap = {
  spalten: readonly string[]
  zeilen: DividendenHeatmapZeile[]
  summen: {
    gesamtEur: number | null
    durchschnittEur: number | null
    monate: (number | null)[]
    monatIstPrognose: boolean[]
  } | null
  minEur: number
  maxEur: number
  hatPrognose: boolean
}

export type GestapelterDivSegment = {
  key: string
  label: string
  wert: number
  farbe: string
  istPrognose: boolean
  bestaetigt: boolean
}

export type GestapelterDivMonat = {
  monat: string
  label: string
  tooltipTitel: string
  gesamt: number
  segmente: GestapelterDivSegment[]
  istPrognose: boolean
  ttmMonatlichEur: number | null
}

export type GestapelteDividendenSerie = {
  monate: GestapelterDivMonat[]
  durchschnittIntervallEur: number
  hatPrognose: boolean
}

export type DividendenJahrVergleich = {
  jahr: number
  betragEur: number
  vsVorjahrProzent: number | null
}

export function berechneDividendenKpis(
  buchungen: PortfolioBuchung[],
  depotwertEur: number,
  investiertEur: number,
): DividendenKpis {
  let brutto = 0
  let minDatum: string | null = null

  const divMonate = new Map<string, number>()
  const jetzt = new Date()
  const ttmKeys: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(jetzt.getFullYear(), jetzt.getMonth() - i, 1)
    ttmKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const heute = heuteIso()
  for (const b of buchungen) {
    if (!minDatum || b.datum < minDatum) minDatum = b.datum
    if (b.datum > heute) continue
    const zahlung = gezahlteDividendeEur(b)
    if (zahlung <= 0) continue
    brutto += zahlung
    const k = monatsKey(b.datum)
    if (k) divMonate.set(k, (divMonate.get(k) ?? 0) + zahlung)
  }

  const steuernDiv = steuernAufDividendenMonate(buchungen)

  const ttm = ttmKeys.reduce((s, k) => s + (divMonate.get(k) ?? 0), 0)
  const jahreseinkommenTtmEur = round2(ttm)
  const monatlichDurchschnittTtmEur = round2(ttm / 12)
  const persRendite =
    depotwertEur > 0 ? round2((jahreseinkommenTtmEur / depotwertEur) * 100) : null

  return {
    depotwertEur,
    dividendenBruttoEur: round2(brutto),
    dividendenNettoEur: round2(Math.max(0, brutto - steuernDiv)),
    steuernAufDivEur: round2(steuernDiv),
    jahreseinkommenTtmEur,
    monatlichDurchschnittTtmEur,
    persoenlicheRenditeProzent: persRendite,
    startDatum: minDatum,
    investiertEur,
  }
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}\d$/i
const BROKER_RE =
  /trade\s*republic|smart\s*broker|smartbroker|scalable\s*capital|justtrade|finanzen\.net|comdirect|consorsbank|flatex|lynx|onvista|ing\s*di\s*ba|baader\s*bank/i

function istIsinText(text: string): boolean {
  const t = text.trim().toUpperCase()
  return ISIN_RE.test(t)
}

function istBrokerOderDepotName(text: string): boolean {
  const t = text.trim()
  if (t.length < 2) return true
  if (BROKER_RE.test(t)) return true
  if (/^(trade republic|smartbroker|depot|broker)$/i.test(t)) return true
  return false
}

/** Anzeigename für Dividenden-Chart: Kenntnis/Meta, kein Broker, keine ISIN. */
export function dividendenAnzeigeName(
  isin: string,
  buchungen: PortfolioBuchung[],
  meta: Map<string, IsinMetadata>,
): string {
  const key = isin.toUpperCase()
  const k = isinKenntnis(key)
  if (k?.name && !istBrokerOderDepotName(k.name)) return k.name

  let bestBuchung: string | null = null
  for (const b of buchungen) {
    if (b.isin?.toUpperCase() !== key) continue
    const n = b.wertpapierName?.trim()
    if (!n || istBrokerOderDepotName(n) || istIsinText(n)) continue
    if (!bestBuchung || n.length > bestBuchung.length) bestBuchung = n
  }

  const metaName = anzeigeNameFuerIsin(key, bestBuchung, meta)
  if (!istBrokerOderDepotName(metaName) && !istIsinText(metaName)) return metaName
  if (bestBuchung) return bestBuchung

  const m = meta.get(key)
  if (m?.name && !istIsinText(m.name) && !istBrokerOderDepotName(m.name)) return m.name
  return k?.name ?? bestBuchung ?? 'Wertpapier'
}

/** Prognose-Termine im Horizont (heute … Ende nächstes Kalenderjahr). */
export function filterDividendenPrognoseEintraege(
  eintraege: AnkuendigteDividendeEintrag[] | null | undefined,
): AnkuendigteDividendeEintrag[] {
  if (!eintraege?.length) return []
  const heute = heuteIso()
  const bis = isoEndeNaechstesKalenderjahr()
  return eintraege.filter(
    (e) => e.zahlungsdatumIso > heute && e.zahlungsdatumIso <= bis && e.gesamtEur > 0,
  )
}

export function dividendenPrognoseHorizontLabel(): string {
  const bis = isoEndeNaechstesKalenderjahr()
  return `Ende ${bis.slice(0, 4)}`
}

/** TTM = Ø der Monatssummen im Fenster (M−11 … M); bei &lt;12 Monaten Ø über vorhandene Monate. */
export function ttmMonatlichJeIndex(monatsSummen: number[]): (number | null)[] {
  return monatsSummen.map((_, i) => {
    const von = Math.max(0, i - 11)
    const slice = monatsSummen.slice(von, i + 1)
    if (slice.length === 0) return null
    const sum = slice.reduce((a, b) => a + b, 0)
    return round2(sum / slice.length)
  })
}

/** Gestapelte Monatsdividenden inkl. optionaler Prognose bis Ende nächstes Kalenderjahr. */
export function dividendenGestapeltProMonat(
  buchungen: PortfolioBuchung[],
  meta: Map<string, IsinMetadata> = new Map(),
  prognoseEintraege?: AnkuendigteDividendeEintrag[] | null,
): GestapelteDividendenSerie {
  const byMonat = new Map<string, Map<string, number>>()
  const prognoseByMonat = new Map<string, Map<string, { wert: number; bestaetigt: boolean }>>()
  const namen = new Map<string, string>()

  const heute = heuteIso()
  for (const b of buchungen) {
    if (b.datum > heute) continue
    const zufluss = gezahlteDividendeEur(b)
    if (zufluss <= 0) continue
    const k = monatsKey(b.datum)
    if (!k) continue
    const isin = b.isin?.toUpperCase() ?? 'SONSTIGE'

    if (isin === 'SONSTIGE') {
      if (!namen.has(isin)) namen.set(isin, 'Sonstige')
    } else if (!namen.has(isin)) {
      namen.set(isin, dividendenAnzeigeName(isin, buchungen, meta))
    }

    const mon = byMonat.get(k) ?? new Map()
    mon.set(isin, (mon.get(isin) ?? 0) + zufluss)
    byMonat.set(k, mon)
  }

  for (const e of filterDividendenPrognoseEintraege(prognoseEintraege)) {
    const k = monatsKey(e.zahlungsdatumIso)
    if (!k) continue
    const isin = e.isin?.toUpperCase() ?? e.symbol?.toUpperCase() ?? 'SONSTIGE'
    if (!namen.has(isin)) {
      namen.set(isin, e.name?.trim() || dividendenAnzeigeName(isin, buchungen, meta))
    }
    const mon = prognoseByMonat.get(k) ?? new Map()
    const cur = mon.get(isin) ?? { wert: 0, bestaetigt: true }
    mon.set(isin, {
      wert: round2(cur.wert + e.gesamtEur),
      bestaetigt: cur.bestaetigt && e.bestaetigt,
    })
    prognoseByMonat.set(k, mon)
  }

  const keys = [...new Set([...byMonat.keys(), ...prognoseByMonat.keys()])].sort()
  if (keys.length === 0) {
    return { monate: [], durchschnittIntervallEur: 0, hatPrognose: false }
  }

  const alleIsins = [...namen.keys()].sort()
  const farbeByIsin = new Map(alleIsins.map((isin, i) => [isin, PALETTE[i % PALETTE.length]] as const))

  const monate: GestapelterDivMonat[] = keys.map((monat) => {
    const istMap = byMonat.get(monat) ?? new Map()
    const progMap = prognoseByMonat.get(monat) ?? new Map()
    const segmente: GestapelterDivSegment[] = []

    for (const [isin, wert] of [...istMap.entries()].sort((a, b) => b[1] - a[1])) {
      segmente.push({
        key: isin,
        label: namen.get(isin) ?? isin,
        wert: round2(wert),
        farbe: farbeByIsin.get(isin) ?? PALETTE[0]!,
        istPrognose: false,
        bestaetigt: true,
      })
    }

    for (const [isin, prog] of [...progMap.entries()].sort((a, b) => b[1].wert - a[1].wert)) {
      if (istMap.has(isin)) continue
      segmente.push({
        key: isin,
        label: namen.get(isin) ?? isin,
        wert: round2(prog.wert),
        farbe: farbeByIsin.get(isin) ?? PALETTE[0]!,
        istPrognose: true,
        bestaetigt: prog.bestaetigt,
      })
    }

    segmente.sort((a, b) => b.wert - a.wert)
    const gesamt = round2(segmentsSumme(segmente))
    const [y, mo] = monat.split('-')
    const d = new Date(Number(y), Number(mo) - 1, 1)
    const istPrognose = segmente.length > 0 && segmente.every((s) => s.istPrognose)
    return {
      monat,
      label: d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
      tooltipTitel: d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
      gesamt,
      segmente,
      istPrognose,
      ttmMonatlichEur: null,
    }
  })

  const histSummen = monate.filter((m) => !m.istPrognose).map((m) => m.gesamt)
  const ttmListe = ttmMonatlichJeIndex(histSummen)
  let histIdx = 0
  for (const m of monate) {
    if (m.istPrognose) continue
    const ttm = ttmListe[histIdx]
    m.ttmMonatlichEur = ttm != null && ttm > 0 ? ttm : null
    histIdx++
  }

  const durchschnittIntervallEur =
    histSummen.length > 0
      ? round2(histSummen.reduce((a, b) => a + b, 0) / histSummen.length)
      : 0

  return {
    monate,
    durchschnittIntervallEur,
    hatPrognose: monate.some((m) => m.istPrognose),
  }
}

function segmentsSumme(segmente: { wert: number }[]): number {
  return segmente.reduce((s, x) => s + x.wert, 0)
}

export function berechneDividendenHeatmap(
  buchungen: PortfolioBuchung[],
  prognoseEintraege?: AnkuendigteDividendeEintrag[] | null,
): DividendenHeatmap {
  const map = new Map<string, number>()
  const prognoseMap = new Map<string, number>()
  const heute = heuteIso()

  for (const b of buchungen) {
    if (b.datum > heute) continue
    const zahlung = gezahlteDividendeEur(b)
    if (zahlung <= 0) continue
    const k = monatsKey(b.datum)
    if (!k) continue
    map.set(k, round2((map.get(k) ?? 0) + zahlung))
  }

  for (const e of filterDividendenPrognoseEintraege(prognoseEintraege)) {
    const k = monatsKey(e.zahlungsdatumIso)
    if (!k) continue
    prognoseMap.set(k, round2((prognoseMap.get(k) ?? 0) + e.gesamtEur))
  }

  const prognoseJahre = [...new Set([...prognoseMap.keys()].map((k) => Number(k.slice(0, 4))))]
  const istJahre = [...new Set([...map.keys()].map((k) => Number(k.slice(0, 4))))]
  const bisJahr = Number(isoEndeNaechstesKalenderjahr().slice(0, 4))
  const jahre = [...new Set([...istJahre, ...prognoseJahre])]
    .filter((y) => y <= bisJahr)
    .sort((a, b) => b - a)

  let minEur = 0
  let maxEur = 0
  let hatPrognose = false

  const zeilen: DividendenHeatmapZeile[] = jahre.map((jahr) => {
    const monate: (number | null)[] = []
    const monatIstPrognose: boolean[] = []
    const heuteMonat = heute.slice(0, 7)

    for (let mo = 0; mo < 12; mo++) {
      const key = `${jahr}-${String(mo + 1).padStart(2, '0')}`
      const ist = map.get(key) ?? 0
      const prog = prognoseMap.get(key) ?? 0

      if (key <= heuteMonat) {
        const val = ist > 0 ? round2(ist) : null
        monate.push(val)
        monatIstPrognose.push(false)
        if (val != null && val > 0) {
          minEur = Math.min(minEur, val)
          maxEur = Math.max(maxEur, val)
        }
        continue
      }

      const val = prog > 0 ? round2(prog) : null
      monate.push(val)
      monatIstPrognose.push(val != null)
      if (val != null) {
        hatPrognose = true
        minEur = Math.min(minEur, val)
        maxEur = Math.max(maxEur, val)
      }
    }

    const vals = monate.filter((v): v is number => v != null && v > 0)
    const gesamt = vals.length ? round2(vals.reduce((a, b) => a + b, 0)) : null
    const durchschnitt =
      vals.length ? round2(gesamt! / vals.filter((v) => v > 0).length) : null
    if (gesamt != null) maxEur = Math.max(maxEur, gesamt)
    return { jahr, gesamtEur: gesamt, durchschnittEur: durchschnitt, monate, monatIstPrognose }
  })

  const summen =
    zeilen.length > 0
      ? {
          gesamtEur: round2(zeilen.reduce((s, z) => s + (z.gesamtEur ?? 0), 0)),
          durchschnittEur: round2(
            zeilen.reduce((s, z) => s + (z.durchschnittEur ?? 0), 0) / zeilen.length,
          ),
          monate: MONAT_KURZ.map((_, i) =>
            round2(zeilen.reduce((s, z) => s + (z.monate[i] ?? 0), 0)),
          ),
          monatIstPrognose: MONAT_KURZ.map((_, i) => zeilen.some((z) => z.monatIstPrognose[i])),
        }
      : null

  if (maxEur === 0) maxEur = 1

  return { spalten: ['Gesamt', 'Ø', ...MONAT_KURZ], zeilen, summen, minEur, maxEur, hatPrognose }
}

export function dividendenProJahrMitVergleich(buchungen: PortfolioBuchung[]): DividendenJahrVergleich[] {
  const byYear = new Map<number, number>()
  const heute = heuteIso()
  for (const b of buchungen) {
    if (b.datum > heute) continue
    const zahlung = gezahlteDividendeEur(b)
    if (zahlung <= 0) continue
    const y = Number(b.datum.slice(0, 4))
    if (!Number.isFinite(y)) continue
    byYear.set(y, round2((byYear.get(y) ?? 0) + zahlung))
  }
  const jahre = [...byYear.keys()].sort((a, b) => b - a)
  return jahre.map((jahr, i) => {
    const betrag = byYear.get(jahr)!
    const vor = jahre[i + 1] != null ? byYear.get(jahre[i + 1]!) : null
    const vsVorjahrProzent =
      vor != null && vor > 0 ? round2(((betrag - vor) / vor) * 100) : null
    return { jahr, betragEur: betrag, vsVorjahrProzent }
  })
}
