import { after, NextResponse } from 'next/server'
import {
  fuehreReserviertenScreenerBuildAus,
  ladeScreenerSnapshot,
  leseScreenerBuildStatus,
  reserviereScreenerBuild,
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
    const build = leseScreenerBuildStatus()
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
        build,
      })
    }
    return NextResponse.json({ ...paketFuerClient(snap), build })
  } catch (e) {
    console.error('[screener] GET', e)
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'Screener konnte nicht geladen werden.' },
      { status: 500 },
    )
  }
}

/**
 * Sofort JSON zurück (kein Browser-/Proxy-Timeout).
 * Der schwere SEC-Build läuft in next/after bis maxDuration.
 * Client pollt GET bis build.laeuft === false.
 */
export async function POST() {
  try {
    const reserviert = reserviereScreenerBuild()
    if (reserviert.ok) {
      after(async () => {
        await fuehreReserviertenScreenerBuildAus()
      })
    }
    const schonAktiv = !reserviert.ok
    return NextResponse.json({
      ok: true,
      gestartet: true,
      schonAktiv,
      message: schonAktiv
        ? 'Universum-Aufbau läuft bereits — bitte warten.'
        : 'Universum-Aufbau gestartet (SEC Frames, kann einige Minuten dauern).',
      build: leseScreenerBuildStatus(),
    })
  } catch (e) {
    console.error('[screener] POST', e)
    const msg = e instanceof Error ? e.message : 'Universum konnte nicht gestartet werden.'
    const kurz = msg.includes('<!DOCTYPE')
      ? 'SEC-Universum fehlgeschlagen — unerwartete HTML-Antwort (Netzwerk/Proxy?).'
      : msg.slice(0, 300)
    return NextResponse.json({ ok: false, message: kurz }, { status: 500 })
  }
}
