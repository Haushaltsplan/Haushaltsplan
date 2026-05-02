import { istSupabaseClientKonfiguriert, supabase } from '@/lib/supabase'
import type { PortfolioPositionMitNotiz } from '@/lib/investment-portfolio-types'

const TABLE_POS = 'investment_portfolio_position' as const
const TABLE_FLAG = 'investment_portfolio_flag' as const

type DbRowPos = {
  id: string
  name: string
  symbol_yahoo: string
  notierung: string
  notiz: string
  sort_index: number
}

function rowZuPosition(r: DbRowPos): PortfolioPositionMitNotiz {
  return {
    id: String(r.id),
    name: String(r.name ?? '').trim(),
    symbolYahoo: String(r.symbol_yahoo ?? '').trim(),
    notierung: String(r.notierung ?? 'USD').trim() || 'USD',
    notiz: typeof r.notiz === 'string' ? r.notiz : '',
  }
}

export type PortfolioCloudState =
  | { ok: true; nutzerlisteAktiv: boolean; rows: PortfolioPositionMitNotiz[] }
  | { ok: false; message: string }

/** Liest Flag und — nur wenn Nutzerliste aktiv — alle Positionen (sort_index). */
export async function ladePortfolioStateAusCloud(): Promise<PortfolioCloudState> {
  if (!istSupabaseClientKonfiguriert()) {
    return { ok: false, message: 'Supabase nicht konfiguriert.' }
  }
  const { data: flagRow, error: flagErr } = await supabase
    .from(TABLE_FLAG)
    .select('nutzerliste_aktiv')
    .eq('id', 1)
    .maybeSingle()
  if (flagErr) {
    console.error('Portfolio-Cloud: Flag', flagErr)
    return { ok: false, message: flagErr.message }
  }
  const nutzerlisteAktiv = Boolean((flagRow as { nutzerliste_aktiv?: boolean } | null)?.nutzerliste_aktiv)
  if (!nutzerlisteAktiv) {
    return { ok: true, nutzerlisteAktiv: false, rows: [] }
  }
  const { data: posRows, error: posErr } = await supabase
    .from(TABLE_POS)
    .select('id, name, symbol_yahoo, notierung, notiz, sort_index')
    .order('sort_index', { ascending: true })
  if (posErr) {
    console.error('Portfolio-Cloud: Positionen', posErr)
    return { ok: false, message: posErr.message }
  }
  return {
    ok: true,
    nutzerlisteAktiv: true,
    rows: ((posRows ?? []) as DbRowPos[]).map(rowZuPosition),
  }
}

export async function speicherePortfolioInCloud(
  rows: PortfolioPositionMitNotiz[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!istSupabaseClientKonfiguriert()) {
    return { ok: false, message: 'Supabase nicht konfiguriert.' }
  }
  const ids = rows.map((r) => r.id)

  const { data: remoteRows, error: errRemote } = await supabase.from(TABLE_POS).select('id')
  if (errRemote) {
    return { ok: false, message: errRemote.message || 'Portfolio konnte nicht abgeglichen werden.' }
  }
  const remoteIds = ((remoteRows ?? []) as { id: string }[]).map((r) => r.id)
  const idSet = new Set(ids)
  const zuLoeschen = remoteIds.filter((id) => !idSet.has(id))
  if (zuLoeschen.length > 0) {
    const { error: delErr } = await supabase.from(TABLE_POS).delete().in('id', zuLoeschen)
    if (delErr) {
      return { ok: false, message: delErr.message || 'Positionen konnten nicht entfernt werden.' }
    }
  }

  const upsertRows = rows.map((p, sort_index) => ({
    id: p.id.trim(),
    name: p.name.trim(),
    symbol_yahoo: p.symbolYahoo.trim(),
    notierung: (p.notierung || 'USD').trim(),
    notiz: p.notiz ?? '',
    sort_index,
  }))
  if (upsertRows.length > 0) {
    const { error: upErr } = await supabase.from(TABLE_POS).upsert(upsertRows, { onConflict: 'id' })
    if (upErr) {
      return { ok: false, message: upErr.message || 'Portfolio konnte nicht gespeichert werden.' }
    }
  }

  const { error: flagErr } = await supabase
    .from(TABLE_FLAG)
    .update({ nutzerliste_aktiv: true })
    .eq('id', 1)
  if (flagErr) {
    return { ok: false, message: flagErr.message || 'Portfolio-Flag konnte nicht gesetzt werden.' }
  }

  return { ok: true }
}
