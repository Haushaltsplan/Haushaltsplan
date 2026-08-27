import { supabase } from '@/lib/supabase'
import {
  effektiveVermoegenKlasse,
  istGueltigeIsin,
  istVermoegenKlasse,
  naechsterIsoMonat,
  normalisiereIsinEingabe,
  type VermoegenKlasse,
} from '@/lib/finanz-vermoegen'

/** true = Daten geladen, false = Tabelle fehlt/RLS, Daten = Reihen. */
export type LadeErgebnis<T> = { schemaOk: boolean; rows: T[] }

function tabelleFehlt(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false
  const msg = String(error.message || '').toLowerCase()
  return msg.includes('does not exist') || String(error.code || '') === '42P01'
}

function spalteFehlt(error: { message?: string; code?: string } | null | undefined, spalte: string): boolean {
  if (!error) return false
  const msg = String(error.message || '').toLowerCase()
  return msg.includes(spalte.toLowerCase()) && (msg.includes('column') || msg.includes('does not exist'))
}

export type VermoegenRow = {
  id: string
  titel: string
  betrag: number
  klasse: VermoegenKlasse
  isin: string | null
  anzahl: number | null
  kursEur: number | null
  autoAbMonat: string | null
}

export type LadeVermoegenErgebnis = LadeErgebnis<VermoegenRow> & { klasseSpalteOk: boolean; extraSpaltenOk: boolean }

function mapVermoegenRow(r: Record<string, unknown>): VermoegenRow {
  const titel = String(r.titel ?? '')
  const isinRaw = r.isin != null ? String(r.isin).trim().toUpperCase() : ''
  return {
    id: String(r.id),
    titel,
    betrag: Number(r.betrag) || 0,
    klasse: effektiveVermoegenKlasse(titel, typeof r.klasse === 'string' ? r.klasse : null),
    isin: istGueltigeIsin(isinRaw) ? isinRaw : null,
    anzahl: r.anzahl != null && Number.isFinite(Number(r.anzahl)) ? Number(r.anzahl) : null,
    kursEur: r.kurs_eur != null && Number.isFinite(Number(r.kurs_eur)) ? Number(r.kurs_eur) : null,
    autoAbMonat: typeof r.auto_ab_monat === 'string' && /^\d{4}-\d{2}$/.test(r.auto_ab_monat) ? r.auto_ab_monat : null,
  }
}

const SELECT_VOLL = 'id, titel, betrag, klasse, isin, anzahl, kurs_eur, auto_ab_monat'
const SELECT_KLASSE = 'id, titel, betrag, klasse'
const SELECT_BASIS = 'id, titel, betrag'

export async function ladeVermoegen(): Promise<LadeVermoegenErgebnis> {
  const voll = await supabase.from('finanz_vermoegen').select(SELECT_VOLL).order('erstellt_am', { ascending: true })
  if (!voll.error) {
    return {
      schemaOk: true,
      klasseSpalteOk: true,
      extraSpaltenOk: true,
      rows: (voll.data || []).map((r) => mapVermoegenRow(r as Record<string, unknown>)),
    }
  }
  if (tabelleFehlt(voll.error)) {
    return { schemaOk: false, klasseSpalteOk: false, extraSpaltenOk: false, rows: [] }
  }

  const mitKlasse = await supabase.from('finanz_vermoegen').select(SELECT_KLASSE).order('erstellt_am', { ascending: true })
  if (!mitKlasse.error) {
    return {
      schemaOk: true,
      klasseSpalteOk: true,
      extraSpaltenOk: false,
      rows: (mitKlasse.data || []).map((r) => mapVermoegenRow(r as Record<string, unknown>)),
    }
  }

  const basis = await supabase.from('finanz_vermoegen').select(SELECT_BASIS).order('erstellt_am', { ascending: true })
  if (basis.error) {
    console.warn('[finanz_vermoegen] laden', basis.error.message)
    return { schemaOk: false, klasseSpalteOk: false, extraSpaltenOk: false, rows: [] }
  }
  return {
    schemaOk: true,
    klasseSpalteOk: false,
    extraSpaltenOk: false,
    rows: (basis.data || []).map((r) => mapVermoegenRow(r as Record<string, unknown>)),
  }
}

export type SpeichereVermoegenInput = {
  id?: string
  titel: string
  betrag: number
  klasse?: VermoegenKlasse
  isin?: string | null
  anzahl?: number | null
  kursEur?: number | null
  autoAbMonat?: string | null
}

function payloadVoll(input: SpeichereVermoegenInput) {
  const klasse: VermoegenKlasse = istVermoegenKlasse(input.klasse)
    ? input.klasse
    : effektiveVermoegenKlasse(input.titel)
  const isin =
    input.isin && istGueltigeIsin(input.isin) ? normalisiereIsinEingabe(input.isin) : null
  return {
    titel: input.titel,
    betrag: input.betrag,
    klasse,
    isin,
    anzahl: input.anzahl ?? null,
    kurs_eur: input.kursEur ?? null,
    auto_ab_monat:
      klasse === 'bausparer' ? input.autoAbMonat || naechsterIsoMonat() : input.autoAbMonat ?? null,
  }
}

export async function speichereVermoegenPosten(input: SpeichereVermoegenInput) {
  const voll = payloadVoll(input)
  const mitExtra = input.id
    ? await supabase.from('finanz_vermoegen').update(voll).eq('id', input.id)
    : await supabase.from('finanz_vermoegen').insert(voll)
  if (!mitExtra.error) return mitExtra

  const mitKlasse = { titel: voll.titel, betrag: voll.betrag, klasse: voll.klasse }
  if (
    spalteFehlt(mitExtra.error, 'isin') ||
    spalteFehlt(mitExtra.error, 'anzahl') ||
    spalteFehlt(mitExtra.error, 'auto_ab_monat') ||
    spalteFehlt(mitExtra.error, 'kurs_eur')
  ) {
    const nurKlasse = input.id
      ? await supabase.from('finanz_vermoegen').update(mitKlasse).eq('id', input.id)
      : await supabase.from('finanz_vermoegen').insert(mitKlasse)
    if (!nurKlasse.error || !spalteFehlt(nurKlasse.error, 'klasse')) return nurKlasse
  }

  const basis = { titel: input.titel, betrag: input.betrag }
  if (input.id) {
    return supabase.from('finanz_vermoegen').update(basis).eq('id', input.id)
  }
  return supabase.from('finanz_vermoegen').insert(basis)
}

export async function loescheVermoegenPosten(id: string) {
  return supabase.from('finanz_vermoegen').delete().eq('id', id)
}

export type DepotSnapshotKurz = {
  ok: boolean
  depotwertEur: number | null
  erfasstAm: string | null
}

function wertAusPositionen(positionen: unknown): number | null {
  if (!Array.isArray(positionen) || positionen.length === 0) return null
  let summe = 0
  let hat = false
  for (const p of positionen) {
    if (!p || typeof p !== 'object') continue
    const r = p as Record<string, unknown>
    const w = Number(r.wertEur ?? r.wert_eur ?? r.wertLiveEur)
    if (Number.isFinite(w)) {
      summe += w
      hat = true
    }
  }
  return hat ? Math.round(summe * 100) / 100 : null
}

/** Snapshot, sonst Live-Bewertung wie auf der Startseite. */
export async function ladeDepotwertFuerVermoegen(): Promise<DepotSnapshotKurz> {
  const { data, error } = await supabase
    .from('portfolio_analyse_snapshot')
    .select('depotwert_eur, erfasst_am, positionen')
    .order('erfasst_am', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error && !tabelleFehlt(error)) {
    console.warn('[portfolio_analyse_snapshot] vermoegen', error.message)
  }

  const snapWert =
    data && !error
      ? data.depotwert_eur != null && Number.isFinite(Number(data.depotwert_eur))
        ? Number(data.depotwert_eur)
        : wertAusPositionen(data.positionen)
      : null
  const snapAm = data?.erfasst_am != null ? String(data.erfasst_am) : null
  if (snapWert != null && snapWert !== 0) {
    return { ok: true, depotwertEur: snapWert, erfasstAm: snapAm }
  }

  try {
    const { ladePortfolioAnalyseDaten } = await import('@/lib/portfolio-analyse/portfolio-analyse-db')
    const { sammleIsins } = await import('@/lib/portfolio-analyse/auswertungen')
    const { positionenFuerBewertung } = await import('@/lib/portfolio-analyse/bestand')
    const { ladeIsinMetadaten } = await import('@/lib/portfolio-analyse/isin-metadata-client')
    const { berechneLivePortfolio, ladeLiveKurseClient, symboleAusMeta } = await import(
      '@/lib/portfolio-analyse/live-bewertung'
    )
    const { berechneKennzahlen } = await import('@/lib/portfolio-analyse/berechnung')

    const res = await ladePortfolioAnalyseDaten()
    if (!res.ok || res.buchungen.length === 0) {
      return { ok: true, depotwertEur: snapWert, erfasstAm: snapAm }
    }

    const kz = berechneKennzahlen(res.buchungen, res.snapshot)
    if (kz.depotwertEur > 0) {
      try {
        const isins = sammleIsins(res.buchungen, res.snapshot)
        const meta = isins.length > 0 ? await ladeIsinMetadaten(isins) : new Map()
        const pos = positionenFuerBewertung(res.buchungen, res.snapshot)
        const { kurse, stand, fx, stooqEur } = await ladeLiveKurseClient(symboleAusMeta(pos, meta))
        const live = berechneLivePortfolio(res.buchungen, res.snapshot, meta, kurse, stand, fx, stooqEur)
        if (live.kennzahlen.depotwertEur > 0) {
          return {
            ok: true,
            depotwertEur: live.kennzahlen.depotwertEur,
            erfasstAm: stand ?? res.snapshot?.erfasst_am ?? snapAm,
          }
        }
      } catch (e) {
        console.warn('[vermoegen] live-depot', e)
      }
      return {
        ok: true,
        depotwertEur: kz.depotwertEur,
        erfasstAm: res.snapshot?.erfasst_am ?? snapAm,
      }
    }

    const pos = positionenFuerBewertung(res.buchungen, res.snapshot)
    const einstand = Math.round(pos.reduce((s, p) => s + (Number(p.wertEur) || 0), 0) * 100) / 100
    if (einstand > 0) {
      try {
        const isins = sammleIsins(res.buchungen, res.snapshot)
        const meta = isins.length > 0 ? await ladeIsinMetadaten(isins) : new Map()
        const { kurse, stand, fx, stooqEur } = await ladeLiveKurseClient(symboleAusMeta(pos, meta))
        const live = berechneLivePortfolio(res.buchungen, res.snapshot, meta, kurse, stand, fx, stooqEur)
        if (live.kennzahlen.depotwertEur > 0) {
          return {
            ok: true,
            depotwertEur: live.kennzahlen.depotwertEur,
            erfasstAm: stand ?? res.snapshot?.erfasst_am ?? snapAm,
          }
        }
      } catch (e) {
        console.warn('[vermoegen] live-depot', e)
      }
      return { ok: true, depotwertEur: einstand, erfasstAm: res.snapshot?.erfasst_am ?? snapAm }
    }
  } catch (e) {
    console.warn('[vermoegen] depot laden', e)
  }

  return { ok: true, depotwertEur: snapWert, erfasstAm: snapAm }
}

export type FondsKursClient = {
  isin: string
  name: string | null
  kursEur: number | null
  aenderungTagProzent: number | null
}

export async function ladeFondsKurseClient(isins: string[]): Promise<FondsKursClient[]> {
  const unique = [...new Set(isins.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  if (unique.length === 0) return []
  const res = await fetch('/api/finanzen/fonds-kurs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isins: unique }),
  })
  const j = (await res.json()) as { ok?: boolean; kurse?: FondsKursClient[] }
  if (!j.ok || !Array.isArray(j.kurse)) return []
  return j.kurse
}
