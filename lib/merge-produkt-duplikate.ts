import type { SupabaseClient } from '@supabase/supabase-js'
import { lagerArtikelSammelSchluessel } from '@/lib/lager-artikel-kanonisch'
import { namenGleichFuerLager, produktNameNormalisieren, waehleCanonicalId } from '@/lib/produkt-name-normalize'

class UnionFind {
  private parent = new Map<string, string>()
  find(x: string): string {
    let p = this.parent.get(x) ?? x
    if (p !== x) {
      p = this.find(p)
      this.parent.set(x, p)
    }
    return p
  }
  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

/**
 * Gruppiert Artikel für „Duplikate zusammenführen“: gleicher Anzeigename **oder**
 * gleicher Lager-Sammel-Schlüssel (z. B. alle Glühwein-Marken → eine Zeile).
 */
export function gruppiereProduktIdsFuerLagerDuplikate(rows: Array<{ id: string; name: string }>): Map<string, string[]> {
  const gueltig = rows.filter((r) => produktNameNormalisieren(r.name) || lagerArtikelSammelSchluessel(r.name))
  const uf = new UnionFind()
  for (let i = 0; i < gueltig.length; i++) {
    for (let j = i + 1; j < gueltig.length; j++) {
      const a = gueltig[i]!.name
      const b = gueltig[j]!.name
      if (namenGleichFuerLager(a, b)) {
        uf.union(gueltig[i]!.id, gueltig[j]!.id)
      } else {
        const sa = lagerArtikelSammelSchluessel(a)
        const sb = lagerArtikelSammelSchluessel(b)
        if (sa && sb && sa === sb) {
          uf.union(gueltig[i]!.id, gueltig[j]!.id)
        }
      }
    }
  }
  const gruppen = new Map<string, string[]>()
  for (const r of gueltig) {
    const root = uf.find(r.id)
    const arr = gruppen.get(root) || []
    arr.push(r.id)
    gruppen.set(root, arr)
  }
  return gruppen
}

function ignoriereFehlendeVerbrauchTabelle(err: { message?: string } | null): boolean {
  const m = (err?.message || '').toLowerCase()
  return m.includes('lager_verbrauch') && (m.includes('schema') || m.includes('not find') || m.includes('does not exist'))
}

/** Alle Zeilen mit gleicher Normalform zu einem Artikel zusammenführen (kleinster Name / UUID bleibt). */
export async function mergeProduktDuplikateFuerSchluessel(
  client: SupabaseClient,
  ids: string[],
): Promise<{ canonicalId: string; entfernt: number }> {
  if (ids.length < 2) {
    return { canonicalId: ids[0]!, entfernt: 0 }
  }
  const { data: rows, error: qErr } = await client.from('produkte').select('id, name').in('id', ids)
  if (qErr) throw new Error(qErr.message)
  const list = (rows || []) as { id: string; name: string }[]
  if (list.length < 2) {
    return { canonicalId: ids[0]!, entfernt: 0 }
  }
  const canonicalId = waehleCanonicalId(list)
  const removeIds = list.map((r) => r.id).filter((id) => id !== canonicalId)
  let entfernt = 0
  for (const oid of removeIds) {
    const { error: e1 } = await client.from('lager_einkauf').update({ produkt_id: canonicalId }).eq('produkt_id', oid)
    if (e1) throw new Error(e1.message)

    const { error: e2 } = await client.from('lager_verbrauch').update({ produkt_id: canonicalId }).eq('produkt_id', oid)
    if (e2 && !ignoriereFehlendeVerbrauchTabelle(e2)) throw new Error(e2.message)

    const { data: c } = await client.from('lagerbestand').select('aktuelle_menge').eq('produkt_id', canonicalId).maybeSingle()
    const { data: o } = await client.from('lagerbestand').select('aktuelle_menge').eq('produkt_id', oid).maybeSingle()
    const sum = (Number(c?.aktuelle_menge) || 0) + (Number(o?.aktuelle_menge) || 0)
    const { error: e3 } = await client.from('lagerbestand').upsert(
      { produkt_id: canonicalId, aktuelle_menge: Math.round(sum * 1000) / 1000 },
      { onConflict: 'produkt_id' },
    )
    if (e3) throw new Error(e3.message)
    await client.from('lagerbestand').delete().eq('produkt_id', oid)

    const { error: e4 } = await client.from('produkte').delete().eq('id', oid)
    if (e4) throw new Error(e4.message)
    entfernt++
  }
  return { canonicalId, entfernt }
}
