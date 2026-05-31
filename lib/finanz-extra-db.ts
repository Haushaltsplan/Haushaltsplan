import { supabase } from '@/lib/supabase'

export type BudgetRow = { id: string; kategorie_key: string; monatslimit: number }
export type SparzielRow = {
  id: string
  titel: string
  zielbetrag: number
  aktuell: number
  zieldatum: string | null
}

/** true = Daten geladen, false = Tabelle fehlt/RLS, Daten = Reihen. */
export type LadeErgebnis<T> = { schemaOk: boolean; rows: T[] }

function tabelleFehlt(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false
  const msg = String(error.message || '').toLowerCase()
  return msg.includes('does not exist') || String(error.code || '') === '42P01'
}

export async function ladeBudgets(): Promise<LadeErgebnis<BudgetRow>> {
  const { data, error } = await supabase
    .from('finanz_budget')
    .select('id, kategorie_key, monatslimit')
    .order('kategorie_key', { ascending: true })
  if (error) {
    if (tabelleFehlt(error)) return { schemaOk: false, rows: [] }
    console.warn('[finanz_budget] laden', error.message)
    return { schemaOk: false, rows: [] }
  }
  return {
    schemaOk: true,
    rows: (data || []).map((r) => ({
      id: String(r.id),
      kategorie_key: String(r.kategorie_key),
      monatslimit: Number(r.monatslimit) || 0,
    })),
  }
}

export async function setzeBudget(kategorieKey: string, monatslimit: number) {
  return supabase
    .from('finanz_budget')
    .upsert({ kategorie_key: kategorieKey, monatslimit }, { onConflict: 'owner_user_id,kategorie_key' })
}

export async function loescheBudget(id: string) {
  return supabase.from('finanz_budget').delete().eq('id', id)
}

export async function ladeSparziele(): Promise<LadeErgebnis<SparzielRow>> {
  const { data, error } = await supabase
    .from('finanz_sparziel')
    .select('id, titel, zielbetrag, aktuell, zieldatum')
    .order('erstellt_am', { ascending: true })
  if (error) {
    if (tabelleFehlt(error)) return { schemaOk: false, rows: [] }
    console.warn('[finanz_sparziel] laden', error.message)
    return { schemaOk: false, rows: [] }
  }
  return {
    schemaOk: true,
    rows: (data || []).map((r) => ({
      id: String(r.id),
      titel: String(r.titel),
      zielbetrag: Number(r.zielbetrag) || 0,
      aktuell: Number(r.aktuell) || 0,
      zieldatum: r.zieldatum ? String(r.zieldatum) : null,
    })),
  }
}

export async function speichereSparziel(input: {
  id?: string
  titel: string
  zielbetrag: number
  aktuell: number
  zieldatum: string | null
}) {
  if (input.id) {
    return supabase
      .from('finanz_sparziel')
      .update({
        titel: input.titel,
        zielbetrag: input.zielbetrag,
        aktuell: input.aktuell,
        zieldatum: input.zieldatum,
      })
      .eq('id', input.id)
  }
  return supabase.from('finanz_sparziel').insert({
    titel: input.titel,
    zielbetrag: input.zielbetrag,
    aktuell: input.aktuell,
    zieldatum: input.zieldatum,
  })
}

export async function loescheSparziel(id: string) {
  return supabase.from('finanz_sparziel').delete().eq('id', id)
}
