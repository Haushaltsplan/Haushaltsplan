import type { AktienSuchTreffer } from '@/lib/portfolio-analyse/aktien-suche-server'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

export async function sucheAktienClient(query: string): Promise<AktienSuchTreffer[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const res = await fetch('/api/portfolio-analyse/aktien-suche', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  const j = (await res.json()) as { ok?: boolean; treffer?: AktienSuchTreffer[] }
  return j.ok && Array.isArray(j.treffer) ? j.treffer : []
}

export async function loeseAktieAusSucheClient(
  symbol: string,
  name?: string,
): Promise<{ meta: IsinMetadata; isin: string | null } | null> {
  const res = await fetch('/api/portfolio-analyse/aktien-suche', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: symbol.trim(), name: name?.trim() }),
  })
  const j = (await res.json()) as {
    ok?: boolean
    meta?: IsinMetadata
    isin?: string | null
    message?: string
  }
  if (!j.ok || !j.meta) return null
  return { meta: j.meta, isin: j.isin ?? null }
}
