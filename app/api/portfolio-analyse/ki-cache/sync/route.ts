import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SecSyncEintrag = {
  berichtId: string
  accession?: string
  zusammenfassung: string
}

type EarningsSyncEintrag = {
  quartalId: string
  transcriptUrl?: string
  zusammenfassung: string
}

/** Lädt KI-Zusammenfassungen aus dem Browser-localStorage in Supabase (Laptop → Handy). */
export async function POST(req: Request) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
    }

    const row = body as Record<string, unknown>
    const typ = row.typ === 'earnings' ? 'earnings' : row.typ === 'sec' ? 'sec' : null
    const ticker = row.ticker != null ? String(row.ticker).trim() : ''
    if (!typ || !ticker) {
      return NextResponse.json({ ok: false, fehler: 'typ (sec|earnings) und ticker erforderlich.' }, { status: 400 })
    }

    const {
      speichereSecBerichtKiInCloud,
      speichereEarningsCallKiInCloud,
    } = await import('@/lib/portfolio-analyse/portfolio-ki-cache-cloud-server')

    if (typ === 'sec') {
      const eintraege = Array.isArray(row.eintraege) ? (row.eintraege as SecSyncEintrag[]) : []
      let hochgeladen = 0
      for (const e of eintraege) {
        const berichtId = e?.berichtId != null ? String(e.berichtId).trim() : ''
        const zusammenfassung = e?.zusammenfassung != null ? String(e.zusammenfassung).trim() : ''
        if (!berichtId || !zusammenfassung) continue
        await speichereSecBerichtKiInCloud({
          ticker,
          berichtId,
          accession: e.accession != null ? String(e.accession) : '',
          zusammenfassung,
        })
        hochgeladen += 1
      }
      return NextResponse.json({ ok: true, hochgeladen })
    }

    const eintraege = Array.isArray(row.eintraege) ? (row.eintraege as EarningsSyncEintrag[]) : []
    let hochgeladen = 0
    for (const e of eintraege) {
      const quartalId = e?.quartalId != null ? String(e.quartalId).trim() : ''
      const zusammenfassung = e?.zusammenfassung != null ? String(e.zusammenfassung).trim() : ''
      if (!quartalId || !zusammenfassung) continue
      await speichereEarningsCallKiInCloud({
        ticker,
        quartalId,
        transcriptUrl: e.transcriptUrl != null ? String(e.transcriptUrl) : '',
        zusammenfassung,
      })
      hochgeladen += 1
    }
    return NextResponse.json({ ok: true, hochgeladen })
  } catch (e) {
    console.error('ki-cache/sync', e)
    return NextResponse.json(
      { ok: false, fehler: e instanceof Error ? e.message : 'Sync fehlgeschlagen' },
      { status: 500 },
    )
  }
}
