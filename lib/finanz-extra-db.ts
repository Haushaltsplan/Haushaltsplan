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

/** Letzter gespeicherter Depotwert aus der Portfolio-Analyse (ohne alle Buchungen zu laden). */
export async function ladeLetztesDepotSnapshot(): Promise<DepotSnapshotKurz> {
  const { data, error } = await supabase
    .from('portfolio_analyse_snapshot')
    .select('depotwert_eur, erfasst_am')
    .order('erfasst_am', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    if (!tabelleFehlt(error)) console.warn('[portfolio_analyse_snapshot] vermoegen', error.message)
    return { ok: false, depotwertEur: null, erfasstAm: null }
  }
  if (!data) return { ok: true, depotwertEur: null, erfasstAm: null }
  const wert = data.depotwert_eur != null ? Number(data.depotwert_eur) : null
  return {
    ok: true,
    depotwertEur: wert != null && Number.isFinite(wert) ? wert : null,
    erfasstAm: data.erfasst_am != null ? String(data.erfasst_am) : null,
  }
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
