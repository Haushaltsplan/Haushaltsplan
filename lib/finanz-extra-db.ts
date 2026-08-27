import { supabase } from '@/lib/supabase'
import { effektiveVermoegenKlasse, istVermoegenKlasse, type VermoegenKlasse } from '@/lib/finanz-vermoegen'

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

export type VermoegenRow = { id: string; titel: string; betrag: number; klasse: VermoegenKlasse }

export type LadeVermoegenErgebnis = LadeErgebnis<VermoegenRow> & { klasseSpalteOk: boolean }

function mapVermoegenRow(r: { id?: unknown; titel?: unknown; betrag?: unknown; klasse?: unknown }): VermoegenRow {
  const titel = String(r.titel ?? '')
  return {
    id: String(r.id),
    titel,
    betrag: Number(r.betrag) || 0,
    klasse: effektiveVermoegenKlasse(titel, typeof r.klasse === 'string' ? r.klasse : null),
  }
}

export async function ladeVermoegen(): Promise<LadeVermoegenErgebnis> {
  const mitKlasse = await supabase
    .from('finanz_vermoegen')
    .select('id, titel, betrag, klasse')
    .order('erstellt_am', { ascending: true })
  if (!mitKlasse.error) {
    return {
      schemaOk: true,
      klasseSpalteOk: true,
      rows: (mitKlasse.data || []).map(mapVermoegenRow),
    }
  }
  if (tabelleFehlt(mitKlasse.error)) {
    return { schemaOk: false, klasseSpalteOk: false, rows: [] }
  }
  if (!spalteFehlt(mitKlasse.error, 'klasse')) {
    console.warn('[finanz_vermoegen] laden', mitKlasse.error.message)
    return { schemaOk: false, klasseSpalteOk: false, rows: [] }
  }

  const ohneKlasse = await supabase
    .from('finanz_vermoegen')
    .select('id, titel, betrag')
    .order('erstellt_am', { ascending: true })
  if (ohneKlasse.error) {
    console.warn('[finanz_vermoegen] laden', ohneKlasse.error.message)
    return { schemaOk: false, klasseSpalteOk: false, rows: [] }
  }
  return {
    schemaOk: true,
    klasseSpalteOk: false,
    rows: (ohneKlasse.data || []).map(mapVermoegenRow),
  }
}

export async function speichereVermoegenPosten(input: {
  id?: string
  titel: string
  betrag: number
  klasse?: VermoegenKlasse
}) {
  const klasse: VermoegenKlasse = istVermoegenKlasse(input.klasse)
    ? input.klasse
    : effektiveVermoegenKlasse(input.titel)
  const mitKlasse = input.id
    ? await supabase
        .from('finanz_vermoegen')
        .update({ titel: input.titel, betrag: input.betrag, klasse })
        .eq('id', input.id)
    : await supabase.from('finanz_vermoegen').insert({ titel: input.titel, betrag: input.betrag, klasse })
  if (!mitKlasse.error || !spalteFehlt(mitKlasse.error, 'klasse')) return mitKlasse
  if (input.id) {
    return supabase.from('finanz_vermoegen').update({ titel: input.titel, betrag: input.betrag }).eq('id', input.id)
  }
  return supabase.from('finanz_vermoegen').insert({ titel: input.titel, betrag: input.betrag })
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
