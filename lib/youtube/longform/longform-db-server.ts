/** Projekte in youtube_longform_projekt, Dateien im privaten Bucket youtube-longform. */
import 'server-only'

import { requireOwnerUserId } from '@/lib/request-owner'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { LongformVerlaufEintrag } from '@/lib/youtube/longform/longform-abwechslung'
import type {
  LongformProjekt,
  LongformProjektKurz,
  LongformProjektZustand,
} from '@/lib/youtube/longform/longform-types'

const TABELLE = 'youtube_longform_projekt'
export const LONGFORM_BUCKET = 'youtube-longform'
const URL_GUELTIG_S = 6 * 3600

type Zeile = {
  id: string
  ticker: string
  firmenname: string
  titel: string | null
  zustand: LongformProjektZustand
  hook_typ: string | null
  leitfrage: string | null
  varianten: Record<string, unknown> | null
  kernphrasen: string[] | null
  aktualisiert_am: string
}

function kurz(z: Zeile): LongformProjektKurz {
  return { id: z.id, ticker: z.ticker, firmenname: z.firmenname, titel: z.titel, aktualisiertAm: z.aktualisiert_am }
}

export async function listeProjekte(): Promise<LongformProjektKurz[]> {
  const owner = requireOwnerUserId()
  const { data, error } = await createSupabaseAdmin()
    .from(TABELLE)
    .select('id, ticker, firmenname, titel, aktualisiert_am')
    .eq('owner_user_id', owner)
    .order('aktualisiert_am', { ascending: false })
    .limit(30)
  if (error) throw new Error(`Projekte laden: ${error.message}`)
  return ((data ?? []) as Zeile[]).map(kurz)
}

export async function ladeProjekt(id: string): Promise<LongformProjekt | null> {
  const owner = requireOwnerUserId()
  const { data, error } = await createSupabaseAdmin()
    .from(TABELLE)
    .select('id, ticker, firmenname, titel, zustand, aktualisiert_am')
    .eq('owner_user_id', owner)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`Projekt laden: ${error.message}`)
  if (!data) return null
  const z = data as Zeile
  return { ...kurz(z), zustand: z.zustand }
}

export async function legeProjektAn(zustand: LongformProjektZustand): Promise<LongformProjekt> {
  const owner = requireOwnerUserId()
  const fb = zustand.faktenblatt
  const { data, error } = await createSupabaseAdmin()
    .from(TABELLE)
    .insert({
      owner_user_id: owner,
      ticker: fb.ticker,
      firmenname: fb.firmenname,
      zustand,
      varianten: zustand.varianten,
    })
    .select('id, ticker, firmenname, titel, zustand, aktualisiert_am')
    .single()
  if (error) throw new Error(`Projekt anlegen: ${error.message}`)
  const z = data as Zeile
  return { ...kurz(z), zustand: z.zustand }
}

export async function speichereProjekt(id: string, zustand: LongformProjektZustand): Promise<string> {
  const owner = requireOwnerUserId()
  const s = zustand.skript
  const kernphrasen = s?.kernphrasen?.slice(0, 40) ?? []
  const jetzt = new Date().toISOString()
  const { error } = await createSupabaseAdmin()
    .from(TABELLE)
    .update({
      zustand: ohneLaufzeitUrls(zustand),
      hook_typ: s?.hookTyp ?? null,
      leitfrage: s?.leitfrage ?? null,
      varianten: zustand.varianten,
      kernphrasen,
      aktualisiert_am: jetzt,
    })
    .eq('owner_user_id', owner)
    .eq('id', id)
  if (error) throw new Error(`Projekt speichern: ${error.message}`)
  return jetzt
}

export async function loescheProjekt(id: string): Promise<void> {
  const owner = requireOwnerUserId()
  const admin = createSupabaseAdmin()
  const { data: dateien } = await admin.storage.from(LONGFORM_BUCKET).list(`${owner}/${id}`, { limit: 1000 })
  for (const ordner of dateien ?? []) {
    const { data: inhalt } = await admin.storage.from(LONGFORM_BUCKET).list(`${owner}/${id}/${ordner.name}`, { limit: 1000 })
    const pfade = (inhalt ?? []).map((d) => `${owner}/${id}/${ordner.name}/${d.name}`)
    if (pfade.length) await admin.storage.from(LONGFORM_BUCKET).remove(pfade)
  }
  await admin.from(TABELLE).delete().eq('owner_user_id', owner).eq('id', id)
}

/** Die letzten Videos (ohne das aktuelle) für Hook-Sperre, Varianten und Wiederholungscheck. */
export async function ladeVerlauf(ohneId?: string): Promise<LongformVerlaufEintrag[]> {
  const owner = requireOwnerUserId()
  let q = createSupabaseAdmin()
    .from(TABELLE)
    .select('id, hook_typ, leitfrage, varianten, kernphrasen')
    .eq('owner_user_id', owner)
    .not('hook_typ', 'is', null)
    .order('aktualisiert_am', { ascending: false })
    .limit(8)
  if (ohneId) q = q.neq('id', ohneId)
  const { data, error } = await q
  if (error) return []
  return ((data ?? []) as Zeile[]).map((z) => ({
    hookTyp: z.hook_typ,
    leitfrage: z.leitfrage,
    varianten: (z.varianten ?? {}) as LongformVerlaufEintrag['varianten'],
    kernphrasen: z.kernphrasen ?? [],
  }))
}

function ohneLaufzeitUrls(z: LongformProjektZustand): LongformProjektZustand {
  const saetze = Object.fromEntries(
    Object.entries(z.stimme.saetze).map(([k, v]) => [k, { ...v, takes: v.takes.map(({ url: _u, ...t }) => t) }]),
  )
  const bilder = Object.fromEntries(
    Object.entries(z.bilder).map(([k, b]) => [k, b ? (({ url: _u, ...rest }) => rest)(b) : null]),
  )
  const konkurrentLogos = z.konkurrentLogos
    ? Object.fromEntries(Object.entries(z.konkurrentLogos).map(([k, v]) => [k, { name: v.name, pfad: v.pfad }]))
    : undefined
  const kapitelDateien = z.kapitelDateien
    ? Object.fromEntries(
        Object.entries(z.kapitelDateien).flatMap(([k, v]) => (v ? [[k, { pfad: v.pfad, dauerMs: v.dauerMs }]] : [])),
      )
    : undefined
  return { ...z, stimme: { ...z.stimme, saetze }, bilder, konkurrentLogos, kapitelDateien }
}

export function projektPfad(projektId: string, ordner: 'stimme' | 'quellen' | 'bilder' | 'export' | 'logos', datei: string): string {
  const owner = requireOwnerUserId()
  return `${owner}/${projektId}/${ordner}/${datei}`
}

export async function ladeHoch(pfad: string, inhalt: Buffer | Uint8Array | string, mime: string): Promise<void> {
  const { error } = await createSupabaseAdmin()
    .storage.from(LONGFORM_BUCKET)
    .upload(pfad, inhalt, { contentType: mime, upsert: true })
  if (error) throw new Error(`Upload ${pfad}: ${error.message}`)
}

export async function ladeHerunter(pfad: string): Promise<Buffer | null> {
  const { data, error } = await createSupabaseAdmin().storage.from(LONGFORM_BUCKET).download(pfad)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

const SIGNIER_BATCH = 40

/**
 * Signierte URLs für alle Pfade; nur Pfade des eigenen Kontos.
 * Eine einzige große Anfrage darf nicht alle Stimmen verwerfen: bei Fehler oder
 * fehlender URL wird der Pfad einzeln nachsigniert.
 */
export async function signiereUrls(pfade: string[]): Promise<Record<string, string>> {
  const owner = requireOwnerUserId()
  const eigene = [...new Set(pfade.filter((p) => p.startsWith(`${owner}/`)))]
  if (!eigene.length) return {}
  const admin = createSupabaseAdmin().storage.from(LONGFORM_BUCKET)
  const out: Record<string, string> = {}
  for (let i = 0; i < eigene.length; i += SIGNIER_BATCH) {
    const chunk = eigene.slice(i, i + SIGNIER_BATCH)
    const { data, error } = await admin.createSignedUrls(chunk, URL_GUELTIG_S)
    if (!error && data) {
      data.forEach((d, j) => {
        const key = d.path && chunk.includes(d.path) ? d.path : chunk[j]
        if (key && d.signedUrl) out[key] = d.signedUrl
      })
    }
    for (const pfad of chunk) {
      if (out[pfad]) continue
      const einzeln = await admin.createSignedUrl(pfad, URL_GUELTIG_S)
      if (einzeln.data?.signedUrl) out[pfad] = einzeln.data.signedUrl
    }
  }
  return out
}

/** Hängt frische signierte URLs an Takes und Bilder. */
export async function mitUrls(z: LongformProjektZustand): Promise<LongformProjektZustand> {
  const pfade = [
    ...Object.values(z.stimme.saetze).flatMap((s) => s.takes.map((t) => t.pfad)),
    ...Object.values(z.bilder).flatMap((b) => (b ? [b.pfad] : [])),
    ...Object.values(z.konkurrentLogos ?? {}).map((l) => l.pfad),
    ...Object.values(z.kapitelDateien ?? {}).flatMap((d) => (d ? [d.pfad] : [])),
  ]
  const urls = await signiereUrls(pfade)
  const saetze = Object.fromEntries(
    Object.entries(z.stimme.saetze).map(([k, v]) => [k, { ...v, takes: v.takes.map((t) => ({ ...t, url: urls[t.pfad] })) }]),
  )
  const bilder = Object.fromEntries(Object.entries(z.bilder).map(([k, b]) => [k, b ? { ...b, url: urls[b.pfad] } : null]))
  const konkurrentLogos = z.konkurrentLogos
    ? Object.fromEntries(Object.entries(z.konkurrentLogos).map(([k, l]) => [k, { ...l, url: urls[l.pfad] }]))
    : undefined
  const kapitelDateien = z.kapitelDateien
    ? Object.fromEntries(
        Object.entries(z.kapitelDateien).map(([k, d]) => [k, d ? { ...d, url: urls[d.pfad] } : d]),
      )
    : undefined
  return { ...z, stimme: { ...z.stimme, saetze }, bilder, konkurrentLogos, kapitelDateien }
}

/** Upload-Link für eine Kapitel-MP4. Gilt zwei Stunden, ohne die Datei durch die Server-Route zu schicken. */
export async function signierteKapitelUploadUrl(pfad: string): Promise<{ signedUrl: string; token: string; path: string }> {
  const { data, error } = await createSupabaseAdmin()
    .storage.from(LONGFORM_BUCKET)
    .createSignedUploadUrl(pfad, { upsert: true })
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Upload-Link fehlgeschlagen.')
  return data
}
