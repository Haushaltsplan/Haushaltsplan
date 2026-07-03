import { supabase } from '@/lib/supabase'

/** true = Daten geladen, false = Tabelle fehlt/RLS, Daten = Reihen. */
export type LadeErgebnis<T> = { schemaOk: boolean; rows: T[] }

function tabelleFehlt(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false
  const msg = String(error.message || '').toLowerCase()
  return msg.includes('does not exist') || String(error.code || '') === '42P01'
}

export type VermoegenRow = { id: string; titel: string; betrag: number }

export async function ladeVermoegen(): Promise<LadeErgebnis<VermoegenRow>> {
  const { data, error } = await supabase
    .from('finanz_vermoegen')
    .select('id, titel, betrag')
    .order('erstellt_am', { ascending: true })
  if (error) {
    if (tabelleFehlt(error)) return { schemaOk: false, rows: [] }
    console.warn('[finanz_vermoegen] laden', error.message)
    return { schemaOk: false, rows: [] }
  }
  return {
    schemaOk: true,
    rows: (data || []).map((r) => ({
      id: String(r.id),
      titel: String(r.titel),
      betrag: Number(r.betrag) || 0,
    })),
  }
}

export async function speichereVermoegenPosten(input: { id?: string; titel: string; betrag: number }) {
  if (input.id) {
    return supabase.from('finanz_vermoegen').update({ titel: input.titel, betrag: input.betrag }).eq('id', input.id)
  }
  return supabase.from('finanz_vermoegen').insert({ titel: input.titel, betrag: input.betrag })
}

export async function loescheVermoegenPosten(id: string) {
  return supabase.from('finanz_vermoegen').delete().eq('id', id)
}
