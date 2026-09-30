import { NextResponse } from 'next/server'
import {
  erneuereScreenerSnapshot,
  ladeScreenerSnapshot,
} from '@/lib/portfolio-analyse/screener/screener-snapshot-server'

export const dynamic = 'force-dynamic'
/** Volle SEC-Frame-Historie (~17 Jahre × viele Tags) braucht Pacing ≤10/s — Zeitbudget hoch. */
export const maxDuration = 800

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

export async function GET() {
  try {
    const snap = await ladeScreenerSnapshot()
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

export async function POST() {
  try {
    const ergebnis = await erneuereScreenerSnapshot()
    const { cloudGespeichert, cloudWarnung, ...snap } = ergebnis
    return NextResponse.json(paketFuerClient(snap, { cloudGespeichert, cloudWarnung }))
  } catch (e) {
    console.error('[screener] POST', e)
    const msg = e instanceof Error ? e.message : 'Universum konnte nicht geladen werden.'
    const kurz = msg.includes('<!DOCTYPE') ? 'SEC-Universum fehlgeschlagen — unerwartete HTML-Antwort (Netzwerk/Proxy?).' : msg.slice(0, 300)
    return NextResponse.json({ ok: false, message: kurz }, { status: 500 })
  }
}
