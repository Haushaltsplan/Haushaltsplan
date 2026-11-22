/**
 * Bildmaterial nur aus Quellen mit klarer Lizenz: Wikimedia Commons, Openverse, optional Pixabay.
 * Pixabay erlaubt keine automatisierten Anfragen — die Route ruft es nur auf Knopfdruck auf.
 * Keine Google-Bildersuche, keine KI-Bilder echter Produkte oder Personen.
 */
import 'server-only'

import { randomUUID } from 'node:crypto'
import { resolveCoachProviderFromMode, runCoachCompletion } from '@/lib/ki-coach-backend'
import { ladeHoch, projektPfad } from '@/lib/youtube/longform/longform-db-server'
import type { LongformBild, LongformBildKandidat } from '@/lib/youtube/longform/longform-types'

const UA = 'OmniaHaushalt/1.0 (YouTube long-form stock analysis; contact via app owner)'
const MIN_BREITE_FOTO = 1000

const FREIE_LIZENZ = /^(cc0|public domain|pd|cc[ -]by(?:[ -]sa)?(?:[ -]\d\.\d)?)/i

function ohneHtml(s: string | undefined): string {
  return (s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

export async function sucheWikimedia(q: string): Promise<LongformBildKandidat[]> {
  const u = new URL('https://commons.wikimedia.org/w/api.php')
  u.search = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${q} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata|mime',
    iiurlwidth: '1920',
    format: 'json',
    origin: '*',
  }).toString()
  try {
    const res = await fetch(u, { headers: { 'User-Agent': UA }, next: { revalidate: 86_400 }, signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return []
    const j = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string
            imageinfo?: {
              url?: string
              thumburl?: string
              width?: number
              height?: number
              mime?: string
              descriptionurl?: string
              extmetadata?: Record<string, { value?: string }>
            }[]
          }
        >
      }
    }
    const out: LongformBildKandidat[] = []
    for (const p of Object.values(j.query?.pages ?? {})) {
      const info = p.imageinfo?.[0]
      if (!info?.url || !/image\/(jpeg|png|webp)/.test(info.mime ?? '')) continue
      if ((info.width ?? 0) < MIN_BREITE_FOTO || (info.width ?? 0) < (info.height ?? 0)) continue
      const lizenz = ohneHtml(info.extmetadata?.LicenseShortName?.value)
      if (!FREIE_LIZENZ.test(lizenz)) continue
      const autor = ohneHtml(info.extmetadata?.Artist?.value) || 'Unknown author'
      out.push({
        quelle: 'wikimedia',
        art: 'foto',
        breite: info.width ?? null,
        hoehe: info.height ?? null,
        credit: `${(p.title ?? '').replace(/^File:/, '')} — ${autor}, ${lizenz}, via Wikimedia Commons (${info.descriptionurl ?? ''})`,
        suchbegriff: q,
        vorschauUrl: info.thumburl ?? info.url,
        originalUrl: info.thumburl ?? info.url,
        eignung: null,
        eignungGrund: null,
      })
    }
    return out
  } catch {
    return []
  }
}

export async function sucheOpenverse(q: string): Promise<LongformBildKandidat[]> {
  const u = new URL('https://api.openverse.org/v1/images/')
  u.search = new URLSearchParams({ q, license_type: 'commercial', aspect_ratio: 'wide', size: 'large', page_size: '12', mature: 'false' }).toString()
  try {
    const res = await fetch(u, { headers: { 'User-Agent': UA }, next: { revalidate: 86_400 }, signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return []
    const j = (await res.json()) as {
      results?: {
        url?: string
        thumbnail?: string
        width?: number
        height?: number
        creator?: string
        license?: string
        license_version?: string
        foreign_landing_url?: string
        title?: string
        source?: string
      }[]
    }
    return (j.results ?? [])
      .filter((r) => r.url && (r.width ?? 0) >= MIN_BREITE_FOTO)
      .map((r) => ({
        quelle: 'openverse' as const,
        art: 'foto' as const,
        breite: r.width ?? null,
        hoehe: r.height ?? null,
        credit: `${r.title ?? 'Photo'} — ${r.creator ?? 'Unknown author'}, ${String(r.license ?? '').toUpperCase()} ${r.license_version ?? ''} (${r.foreign_landing_url ?? r.source ?? ''})`.trim(),
        suchbegriff: q,
        vorschauUrl: r.thumbnail ?? r.url!,
        originalUrl: r.url!,
        eignung: null,
        eignungGrund: null,
      }))
  } catch {
    return []
  }
}

export function pixabayKonfiguriert(): boolean {
  return Boolean(process.env.PIXABAY_API_KEY?.trim())
}

/** Nur aus einer Nutzeraktion aufrufen (Pixabay-Bedingungen). */
export async function suchePixabay(q: string): Promise<LongformBildKandidat[]> {
  const key = process.env.PIXABAY_API_KEY?.trim()
  if (!key) return []
  const basis = { key, q: q.slice(0, 100), safesearch: 'true', per_page: '12' }
  const [fotos, videos] = await Promise.all([
    fetch(`https://pixabay.com/api/?${new URLSearchParams({ ...basis, image_type: 'photo', orientation: 'horizontal', min_width: '1280' })}`, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(12_000),
    })
      .then((r) => (r.ok ? r.json() : { hits: [] }))
      .catch(() => ({ hits: [] })),
    fetch(`https://pixabay.com/api/videos/?${new URLSearchParams({ ...basis, video_type: 'film', min_width: '1920' })}`, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(12_000),
    })
      .then((r) => (r.ok ? r.json() : { hits: [] }))
      .catch(() => ({ hits: [] })),
  ])
  type FotoHit = { largeImageURL?: string; webformatURL?: string; imageWidth?: number; imageHeight?: number; user?: string; pageURL?: string }
  type VideoHit = {
    user?: string
    pageURL?: string
    duration?: number
    videos?: Record<string, { url?: string; width?: number; height?: number; thumbnail?: string }>
  }
  const out: LongformBildKandidat[] = []
  for (const h of (videos as { hits?: VideoHit[] }).hits ?? []) {
    const v = h.videos?.large?.url ? h.videos.large : h.videos?.medium
    if (!v?.url || (v.width ?? 0) < 1280) continue
    out.push({
      quelle: 'pixabay',
      art: 'video',
      breite: v.width ?? null,
      hoehe: v.height ?? null,
      credit: `Video by ${h.user ?? 'Pixabay user'} on Pixabay (${h.pageURL ?? 'pixabay.com'})`,
      suchbegriff: q,
      vorschauUrl: v.thumbnail ?? '',
      originalUrl: v.url,
      eignung: null,
      eignungGrund: null,
    })
  }
  for (const h of (fotos as { hits?: FotoHit[] }).hits ?? []) {
    // Ohne Full Access liefert largeImageURL höchstens 1280 px — reicht nur knapp für 1080p.
    if (!h.largeImageURL) continue
    out.push({
      quelle: 'pixabay',
      art: 'foto',
      breite: Math.min(h.imageWidth ?? 1280, 1280),
      hoehe: null,
      credit: `Image by ${h.user ?? 'Pixabay user'} on Pixabay (${h.pageURL ?? 'pixabay.com'})`,
      suchbegriff: q,
      vorschauUrl: h.webformatURL ?? h.largeImageURL,
      originalUrl: h.largeImageURL,
      eignung: null,
      eignungGrund: null,
    })
  }
  return out
}

async function alsBase64(url: string): Promise<{ mime: string; base64: string } | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const mime = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0]!.trim()
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 2_500_000) return null
    return { mime, base64: buf.toString('base64') }
  } catch {
    return null
  }
}

/** Günstiges Modell mit Bildverständnis: Passgenauigkeit, Wasserzeichen, fremde Logos. */
export async function bewerteKandidaten(kandidaten: LongformBildKandidat[], kontextSatz: string): Promise<LongformBildKandidat[]> {
  const provider = resolveCoachProviderFromMode('gemini')
  const auswahl = kandidaten.slice(0, 4)
  if (!provider || !auswahl.length) return kandidaten
  const bilder = await Promise.all(auswahl.map((k) => (k.vorschauUrl ? alsBase64(k.vorschauUrl) : Promise.resolve(null))))
  const mitBild = auswahl.map((k, i) => ({ k, b: bilder[i] })).filter((x) => x.b)
  if (!mitBild.length) return kandidaten
  const r = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    'You pick b-roll images for a premium, calm stock analysis video. Be strict.',
    [
      {
        role: 'user',
        content: `Narration at this moment: "${kontextSatz}"\nRate each of the ${mitBild.length} images (in order, index from 0) from 0 to 10 for this moment. Give 0 for visible watermarks, text overlays, logos of other companies, memes, low quality, or anything that looks AI-generated. grund: one short English sentence.`,
        images: mitBild.map((x) => ({ mimeType: x.b!.mime, base64: x.b!.base64 })),
      },
    ],
    {
      geminiModels: ['gemini-4-hydrogen', 'gemini-3.8-flash'],
      geminiForcePaidApiKey: true,
      geminiServiceTier: 'flex',
      skipMessageTrim: true,
      thinkingLevel: 'low',
      timeoutMs: 90_000,
      geminiTotalBudgetMs: 120_000,
      jsonResponse: {
        schema: {
          type: 'object',
          properties: {
            bewertungen: {
              type: 'array',
              items: { type: 'object', properties: { index: { type: 'integer' }, eignung: { type: 'number' }, grund: { type: 'string' } }, required: ['index', 'eignung', 'grund'] },
            },
          },
          required: ['bewertungen'],
        },
      },
    },
  )
  if (!r.ok) return kandidaten
  try {
    const j = JSON.parse(r.reply) as { bewertungen?: { index: number; eignung: number; grund: string }[] }
    const bewertet = mitBild.map((x, i) => {
      const b = j.bewertungen?.find((y) => y.index === i)
      return { ...x.k, eignung: b ? Math.max(0, Math.min(10, b.eignung)) : null, eignungGrund: b?.grund ?? null }
    })
    const rest = kandidaten.filter((k) => !bewertet.some((b) => b.originalUrl === k.originalUrl))
    return [...bewertet.sort((a, b) => (b.eignung ?? -1) - (a.eignung ?? -1)), ...rest]
  } catch {
    return kandidaten
  }
}

/** Openverse verweist auf viele Hosts; gesperrt sind nur interne Adressen. */
function istOeffentlicheUrl(roh: string): boolean {
  try {
    const u = new URL(roh)
    if (u.protocol !== 'https:') return false
    const h = u.hostname.toLowerCase()
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':')) return false
    return h.includes('.')
  } catch {
    return false
  }
}

/** Lädt den gewählten Kandidaten ins Projekt (kein Hotlinking). */
export async function uebernimmKandidat(projektId: string, satzId: string, k: LongformBildKandidat): Promise<LongformBild> {
  if (!istOeffentlicheUrl(k.originalUrl)) throw new Error('Unerwartete Bildquelle.')
  const res = await fetch(k.originalUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`Bild laden: HTTP ${res.status}`)
  const mime = (res.headers.get('content-type') ?? (k.art === 'video' ? 'video/mp4' : 'image/jpeg')).split(';')[0]!.trim()
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > 60_000_000) throw new Error('Datei ist größer als 60 MB.')
  const endung = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('mp4') ? 'mp4' : 'jpg'
  const id = randomUUID()
  const pfad = projektPfad(projektId, 'bilder', `${satzId}-${id}.${endung}`)
  await ladeHoch(pfad, buf, mime)
  return { id, quelle: k.quelle, art: k.art, pfad, breite: k.breite, hoehe: k.hoehe, credit: k.credit, suchbegriff: k.suchbegriff }
}

export type AutoBildAuftrag = { satzId: string; text: string; begriff: string }

/**
 * Füllt fehlende B-Roll für bild/hook_bild-Sätze (Wikimedia + Openverse, bestes Scoring).
 * Pixabay bewusst nicht — nur manuell laut Nutzungsbedingungen.
 */
export async function fuelleBrollAutomatisch(
  projektId: string,
  auftraege: AutoBildAuftrag[],
): Promise<Record<string, LongformBild>> {
  const out: Record<string, LongformBild> = {}
  const gesehen = new Set<string>()
  for (const a of auftraege) {
    const begriff = a.begriff.trim().slice(0, 100)
    if (begriff.length < 2) continue
    const [wiki, ov] = await Promise.all([sucheWikimedia(begriff), sucheOpenverse(begriff)])
    const roh = [...wiki, ...ov].filter((k) => !gesehen.has(k.originalUrl))
    if (!roh.length) continue
    const bewertet = await bewerteKandidaten(roh, a.text)
    const pick = bewertet.find((k) => (k.eignung ?? 7) >= 5) ?? bewertet[0]
    if (!pick) continue
    try {
      const bild = await uebernimmKandidat(projektId, a.satzId, pick)
      out[a.satzId] = bild
      gesehen.add(pick.originalUrl)
    } catch {
      /* nächster Auftrag */
    }
  }
  return out
}
