import { istSupabaseClientKonfiguriert, supabase } from '@/lib/supabase'
import {
  normalisiereKalenderKategorie,
  type KalenderEintrag,
} from '@/lib/haushalt-kalender'

const TABLE = 'haushalt_kalender_eintrag' as const

type DbRow = {
  id: string
  datum: string
  titel: string
  notiz: string
  uhrzeit: string
  kategorie: string
}

function rowToEintrag(r: DbRow): KalenderEintrag {
  return {
    id: r.id,
    datum: String(r.datum).slice(0, 10),
    titel: (r.titel || '').trim() || 'Ohne Titel',
    notiz: typeof r.notiz === 'string' ? r.notiz : '',
    uhrzeit: typeof r.uhrzeit === 'string' ? r.uhrzeit : '',
    kategorie: normalisiereKalenderKategorie(r.kategorie),
  }
}

function eintragToRow(e: KalenderEintrag) {
  return {
    id: e.id,
    datum: e.datum,
    titel: e.titel,
    notiz: e.notiz,
    uhrzeit: e.uhrzeit,
    kategorie: e.kategorie,
  }
}

/** Lädt alle Einträge aus Supabase oder `null` bei Fehler / nicht konfiguriert. */
export async function ladeKalenderAusCloud(): Promise<KalenderEintrag[] | null> {
  if (!istSupabaseClientKonfiguriert()) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, datum, titel, notiz, uhrzeit, kategorie')
    .order('datum', { ascending: true })
  if (error) {
    console.error('Kalender-Cloud: Laden', error)
    return null
  }
  if (!data?.length) return []
  return (data as DbRow[]).map(rowToEintrag)
}

/**
 * Schreibt die komplette Liste: Upsert aller Zeilen, löscht Einträge, die lokal fehlen.
 * Kein partielles Update — der Kalender-UI-State ist stets die volle Menge.
 */
export async function speichereKalenderInCloud(eintraege: KalenderEintrag[]): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!istSupabaseClientKonfiguriert()) return { ok: true }

  const ids = eintraege.map((e) => e.id)

  const { data: remoteRows, error: errRemote } = await supabase.from(TABLE).select('id')
  if (errRemote) {
    return { ok: false, message: errRemote.message || 'Kalender konnte nicht abgeglichen werden.' }
  }
  const remoteIds = (remoteRows || []).map((r) => (r as { id: string }).id)
  const idSet = new Set(ids)
  const zuLoeschen = remoteIds.filter((id) => !idSet.has(id))
  if (zuLoeschen.length > 0) {
    const { error: delErr } = await supabase.from(TABLE).delete().in('id', zuLoeschen)
    if (delErr) {
      return { ok: false, message: delErr.message || 'Kalendereinträge konnten nicht entfernt werden.' }
    }
  }

  if (eintraege.length > 0) {
    const rows = eintraege.map((e) => eintragToRow(e))
    const { error: upErr } = await supabase.from(TABLE).upsert(rows, { onConflict: 'id' })
    if (upErr) {
      return { ok: false, message: upErr.message || 'Kalender konnte nicht gespeichert werden.' }
    }
  }

  return { ok: true }
}
