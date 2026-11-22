/**
 * POST { id, aktion }:
 * - hooks: drei Hook-Vorschläge (gesperrte Typen der letzten Videos ausgenommen)
 * - skript { hookIndex }: Skript schreiben, Zahlen prüfen (Code), Behauptungen prüfen (Carbon)
 * - pruefen: Prüfung erneut laufen lassen
 * - chat { abschnittId, satzId?, anweisung }: Abschnitt oder Satz nach Anweisung umschreiben
 */
import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { gesperrteHookTypen } from '@/lib/youtube/longform/longform-abwechslung'
import { ladeProjekt, ladeVerlauf, mitUrls, speichereProjekt } from '@/lib/youtube/longform/longform-db-server'
import { ergaenzeKapitelAusExport, ladeDokumente } from '@/lib/youtube/longform/longform-projekt-server'
import { pruefeSkript } from '@/lib/youtube/longform/longform-pruefung'
import { erzeugeHooks, erzeugeSkript, haengeLikeAnMoat, haengeSchlussAn, logosFuerKonkurrenten, pruefeBehauptungen, setzeFazit, ueberarbeite } from '@/lib/youtube/longform/longform-skript-server'
import {
  LONGFORM_ABSCHNITTE,
  type LongformAbschnittId,
  type LongformProjektZustand,
  type LongformSkript,
} from '@/lib/youtube/longform/longform-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function mitBehauptungen(skript: LongformSkript, probleme: Record<string, string>): LongformSkript {
  return {
    ...skript,
    abschnitte: skript.abschnitte.map((a) => ({
      ...a,
      saetze: a.saetze.map((s) => {
        const ohne = (s.hinweise ?? []).filter((h) => h.art !== 'behauptung')
        const p = probleme[s.id]
        return { ...s, hinweise: p ? [...ohne, { art: 'behauptung' as const, text: p }] : ohne }
      }),
    })),
  }
}

/** Stimmen gelöschter Sätze fliegen raus, damit das Projekt nicht wächst. */
function aufraeumen(z: LongformProjektZustand): LongformProjektZustand {
  const ids = new Set(z.skript?.abschnitte.flatMap((a) => a.saetze.map((s) => s.id)) ?? [])
  return {
    ...z,
    stimme: { ...z.stimme, saetze: Object.fromEntries(Object.entries(z.stimme.saetze).filter(([k]) => ids.has(k))) },
    bilder: Object.fromEntries(Object.entries(z.bilder).filter(([k]) => ids.has(k))),
  }
}

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return { ok: false as const, fehler: 'Kein gültiges JSON.' }
    }
    const id = typeof body.id === 'string' ? body.id : ''
    const p = id ? await ladeProjekt(id) : null
    if (!p) return { ok: false as const, fehler: 'Projekt nicht gefunden.' }
    let z = p.zustand
    if (typeof body.thema === 'string') z = { ...z, thema: body.thema }
    if (typeof body.hookHinweis === 'string') z = { ...z, hookHinweis: body.hookHinweis.slice(0, 2000) }
    if (body.denkstufe === 'low' || body.denkstufe === 'medium' || body.denkstufe === 'high') z = { ...z, denkstufe: body.denkstufe }

    try {
      const verlauf = await ladeVerlauf(id)
      const frueher = verlauf.flatMap((v) => v.kernphrasen)
      const ctx = { faktenblatt: z.faktenblatt, frueher }

      switch (body.aktion) {
        case 'hooks': {
          const hooks = await erzeugeHooks({
            zustand: z,
            gesperrt: gesperrteHookTypen(verlauf),
            fruehereLeitfragen: verlauf.map((v) => v.leitfrage).filter((x): x is string => Boolean(x)),
            dokumente: await ladeDokumente(z),
          })
          if (!hooks.length) return { ok: false as const, fehler: 'Gemini hat keine Hooks geliefert.' }
          z = { ...z, hooks, gewaehlterHook: null }
          break
        }
        case 'skript': {
          const idx = Number(body.hookIndex)
          const hook = z.hooks?.[idx]
          if (!hook) return { ok: false as const, fehler: 'Bitte zuerst einen Hook wählen.' }
          const dokumente = await ladeDokumente(z)
          const neu = await erzeugeSkript({ zustand: z, hook, dokumente, nur: 'hook' })
          const behalten = (z.skript?.abschnitte ?? []).filter((a) => a.id !== 'hook')
          let skript = pruefeSkript({ ...neu, abschnitte: [...neu.abschnitte, ...behalten] }, ctx)
          const probleme = await pruefeBehauptungen({ zustand: z, skript, dokumente }).catch(() => ({}))
          skript = mitBehauptungen(skript, probleme)
          z = aufraeumen({ ...z, gewaehlterHook: idx, skript })
          break
        }
        case 'kapitel': {
          const abschnittId = String(body.abschnittId) as LongformAbschnittId
          if (!(LONGFORM_ABSCHNITTE as readonly string[]).includes(abschnittId)) return { ok: false as const, fehler: 'Unbekannter Abschnitt.' }
          const idx = z.gewaehlterHook
          const hook = idx != null ? z.hooks?.[idx] : null
          if (!hook) return { ok: false as const, fehler: 'Bitte zuerst einen Hook wählen.' }
          z = await ergaenzeKapitelAusExport(id, z)
          const kontext = { faktenblatt: z.faktenblatt, frueher }
          const dokumente = await ladeDokumente(z)
          const teil = await erzeugeSkript({ zustand: z, hook, dokumente, nur: abschnittId })
          const stueck = teil.abschnitte[0]
          if (!stueck?.saetze.length) return { ok: false as const, fehler: 'Das Kapitel ist leer.' }
          const bisher = (z.skript?.abschnitte ?? []).filter((a) => a.id !== abschnittId)
          let abschnitte = LONGFORM_ABSCHNITTE.flatMap((kapitel) => {
            if (kapitel === abschnittId) return [stueck]
            const alt = bisher.find((a) => a.id === kapitel)
            return alt ? [alt] : []
          })
          if (abschnittId === 'fazit') {
            setzeFazit(abschnitte, z.faktenblatt)
            haengeSchlussAn(abschnitte, z.faktenblatt, z.investiert)
          }
          let skript = pruefeSkript(
            { leitfrage: z.skript?.leitfrage ?? hook.leitfrage, hookTyp: z.skript?.hookTyp ?? hook.typ, abschnitte, kernphrasen: teil.kernphrasen },
            kontext,
          )
          const probleme = await pruefeBehauptungen({ zustand: z, skript, dokumente }).catch(() => ({}))
          skript = mitBehauptungen(skript, probleme)
          z = aufraeumen({ ...z, skript })
          break
        }
        case 'pruefen': {
          if (!z.skript) return { ok: false as const, fehler: 'Noch kein Skript.' }
          let skript = pruefeSkript(z.skript, ctx)
          const probleme = await pruefeBehauptungen({ zustand: z, skript, dokumente: await ladeDokumente(z) })
          skript = mitBehauptungen(skript, probleme)
          z = { ...z, skript }
          break
        }
        case 'chat': {
          if (!z.skript) return { ok: false as const, fehler: 'Noch kein Skript.' }
          const abschnittId = String(body.abschnittId) as LongformAbschnittId
          if (!(LONGFORM_ABSCHNITTE as readonly string[]).includes(abschnittId)) return { ok: false as const, fehler: 'Unbekannter Abschnitt.' }
          const satzId = typeof body.satzId === 'string' && body.satzId ? body.satzId : null
          const anweisung = String(body.anweisung ?? '').trim()
          if (anweisung.length < 3) return { ok: false as const, fehler: 'Anweisung fehlt.' }
          const neu = await ueberarbeite({
            zustand: z,
            skript: z.skript,
            abschnittId,
            satzId,
            anweisung,
            dokumente: satzId ? [] : await ladeDokumente(z),
          })
          const abschnitte = z.skript.abschnitte.map((a) => {
            if (a.id !== abschnittId) return a
            if (!satzId) return { ...a, saetze: neu }
            const i = a.saetze.findIndex((s) => s.id === satzId)
            return { ...a, saetze: [...a.saetze.slice(0, i), ...neu, ...a.saetze.slice(i + 1)] }
          })
          haengeSchlussAn(abschnitte, z.faktenblatt, z.investiert)
          await logosFuerKonkurrenten(abschnitte)
          z = aufraeumen({ ...z, skript: pruefeSkript({ ...z.skript, abschnitte }, ctx) })
          break
        }
        default:
          return { ok: false as const, fehler: 'Unbekannte Aktion.' }
      }
      if (z.skript) haengeLikeAnMoat(z.skript.abschnitte)
      await speichereProjekt(id, z)
      return { ok: true as const, zustand: await mitUrls(z) }
    } catch (e) {
      return { ok: false as const, fehler: e instanceof Error ? e.message : 'Skript fehlgeschlagen.' }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}
