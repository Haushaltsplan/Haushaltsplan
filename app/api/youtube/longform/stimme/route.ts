/**
 * Satzweise Stimme.
 * POST { id, aktion: 'sprechen', satzIds?, erzwingen? } — fehlende/geänderte Sätze sprechen (max. 10 pro Aufruf)
 * POST { id, aktion: 'take', satzId, takeId } — anderen Take aktiv setzen
 * POST { id, aktion: 'einstellungen', satzId?, einstellungen } — global oder pro Satz
 */
import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { elevenLabsKonfiguriert } from '@/lib/youtube/moat-short-voice-server'
import { ladeProjekt, mitUrls, speichereProjekt } from '@/lib/youtube/longform/longform-db-server'
import { normiereEinstellungen, sprichSatz, stimmeFingerprint } from '@/lib/youtube/longform/longform-stimme-server'
import type { LongformProjektZustand, LongformSatzStimme } from '@/lib/youtube/longform/longform-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const PRO_AUFRUF = 10
const MAX_TAKES = 5

export async function GET() {
  return NextResponse.json({ configured: elevenLabsKonfiguriert() })
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
    let z: LongformProjektZustand = p.zustand
    const saetze = z.skript?.abschnitte.flatMap((a) => a.saetze) ?? []
    if (!saetze.length) return { ok: false as const, fehler: 'Noch kein Skript.' }

    try {
      if (body.aktion === 'take') {
        const satzId = String(body.satzId ?? '')
        const s = z.stimme.saetze[satzId]
        if (!s?.takes.some((t) => t.id === body.takeId)) return { ok: false as const, fehler: 'Take nicht gefunden.' }
        z = { ...z, stimme: { ...z.stimme, saetze: { ...z.stimme.saetze, [satzId]: { ...s, aktiv: String(body.takeId) } } } }
        await speichereProjekt(id, z)
        return { ok: true as const, zustand: await mitUrls(z), offen: 0 }
      }

      if (body.aktion === 'einstellungen') {
        const satzId = typeof body.satzId === 'string' ? body.satzId : null
        if (!satzId) {
          z = { ...z, stimme: { ...z.stimme, global: normiereEinstellungen(body.einstellungen as never, z.stimme.global) } }
        } else {
          const alt: LongformSatzStimme = z.stimme.saetze[satzId] ?? { aktiv: null, takes: [] }
          const einstellungen = body.einstellungen ? normiereEinstellungen(body.einstellungen as never, z.stimme.global) : null
          z = { ...z, stimme: { ...z.stimme, saetze: { ...z.stimme.saetze, [satzId]: { ...alt, einstellungen } } } }
        }
        await speichereProjekt(id, z)
        return { ok: true as const, zustand: await mitUrls(z), offen: 0 }
      }

      if (body.aktion !== 'sprechen') return { ok: false as const, fehler: 'Unbekannte Aktion.' }
      if (!elevenLabsKonfiguriert()) return { ok: false as const, fehler: 'ELEVENLABS_API_KEY und ELEVENLABS_VOICE_ID fehlen.' }

      const gewuenscht = Array.isArray(body.satzIds) ? new Set(body.satzIds.map(String)) : null
      const erzwingen = body.erzwingen === true
      const offen = saetze
        .map((s, i) => ({ s, vorher: saetze[i - 1]?.text ?? '', nachher: saetze[i + 1]?.text ?? '' }))
        .filter(({ s, vorher, nachher }) => {
          if (gewuenscht && !gewuenscht.has(s.id)) return false
          if (erzwingen) return true
          const st = z.stimme.saetze[s.id]
          const aktiv = st?.takes.find((t) => t.id === st.aktiv)
          const e = st?.einstellungen ?? z.stimme.global
          return !aktiv || aktiv.fp !== stimmeFingerprint(s.text, e, { vorher, nachher })
        })

      const jetzt = offen.slice(0, PRO_AUFRUF)
      const fehler: string[] = []
      for (const { s, vorher, nachher } of jetzt) {
        const alt: LongformSatzStimme = z.stimme.saetze[s.id] ?? { aktiv: null, takes: [] }
        const einstellungen = alt.einstellungen ?? z.stimme.global
        try {
          const take = await sprichSatz({ projektId: id, satzId: s.id, text: s.text, vorher, nachher, einstellungen })
          const takes = [take, ...alt.takes].slice(0, MAX_TAKES)
          z = { ...z, stimme: { ...z.stimme, saetze: { ...z.stimme.saetze, [s.id]: { ...alt, takes, aktiv: take.id } } } }
        } catch (e) {
          fehler.push(e instanceof Error ? e.message : 'Stimme fehlgeschlagen')
          if (fehler.length >= 2) break
        }
      }
      await speichereProjekt(id, z)
      if (fehler.length && fehler.length >= jetzt.length) return { ok: false as const, fehler: fehler[0]! }
      return { ok: true as const, zustand: await mitUrls(z), offen: Math.max(0, offen.length - jetzt.length), fehler }
    } catch (e) {
      return { ok: false as const, fehler: e instanceof Error ? e.message : 'Stimme fehlgeschlagen.' }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}
