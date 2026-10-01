import { NextResponse } from 'next/server'
import {
  erneuereScreenerSnapshot,
  ladeScreenerSnapshot,
} from '@/lib/portfolio-analyse/screener/screener-snapshot-server'

export const dynamic = 'force-dynamic'
/** SEC-Frame-Historie braucht Pacing — Pro-Plan-Maximum. */
export const maxDuration = 300

function paketFuerClient(
  snap: NonNullable<Awaited<ReturnType<typeof ladeScreenerSnapshot>>>,
  extra?: { cloudGespeichert?: boolean; cloudWarnung?: string | null },
) {
  return {
    ok: true as const,
    leer: false as const,
    periode: snap.periode,
    aktualisiertAm: snap.aktualisiertAm,
    n: snap.n,
    schemaVersion: snap.schemaVersion ?? 1,
    zeilen: snap.zeilen.map(({ hist: _hist, ...z }) => z),
    cloudGespeichert: extra?.cloudGespeichert ?? true,
    cloudWarnung: extra?.cloudWarnung ?? null,
  }
}

export async function GET(req: Request) {
  try {
    const frisch = new URL(req.url).searchParams.get('frisch') === '1'
    const snap = await ladeScreenerSnapshot({ frisch })
    if (!snap) {
      return NextResponse.json({
        ok: true,
        leer: true,
        periode: null,
        aktualisiertAm: null,
        n: 0,
        schemaVersion: 1,
        zeilen: [],
      })
    }
    return NextResponse.json(paketFuerClient(snap))
  } catch (e) {
    console.error('[screener] GET', e)
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'Screener konnte nicht geladen werden.' },
      { status: 500 },
    )
  }
}

/**
 * Synchroner Build, kurze JSON-Antwort (ohne Zeilen-Blob).
 * Client lädt danach GET ?frisch=1 — vermeidet Stream-/Network-Abbruch bei Multi-MB-Payload.
 * budgetMs hält den Lauf unter typischen Proxy-Limits; neueste Jahre zuerst.
 */
export async function POST() {
  try {
    const ergebnis = await erneuereScreenerSnapshot({ budgetMs: 100_000 })
    return NextResponse.json({
      ok: true,
      phase: 'done',
      periode: ergebnis.periode,
      aktualisiertAm: ergebnis.aktualisiertAm,
      n: ergebnis.n,
      schemaVersion: ergebnis.schemaVersion ?? 1,
      cloudGespeichert: ergebnis.cloudGespeichert,
      cloudWarnung: ergebnis.cloudWarnung,
      message: `Fertig: ${ergebnis.n.toLocaleString('de-DE')} Titel (${ergebnis.periode}).`,
    })
  } catch (e) {
    console.error('[screener] POST', e)
    const msg = e instanceof Error ? e.message : 'Universum konnte nicht geladen werden.'
    const kurz = msg.includes('<!DOCTYPE')
      ? 'SEC-Universum fehlgeschlagen — unerwartete HTML-Antwort (Netzwerk/Proxy?).'
      : msg.slice(0, 300)
    return NextResponse.json({ ok: false, message: kurz }, { status: 500 })
  }
}
