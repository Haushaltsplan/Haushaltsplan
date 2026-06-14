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

type BulkTickerSec = { ticker: string; eintraege: SecSyncEintrag[] }
type BulkTickerEarnings = { ticker: string; eintraege: EarningsSyncEintrag[] }

async function migriereServerDateiCaches(): Promise<{ sec: number; earnings: number }> {
  const { migriereSecBerichtKiDateiNachCloud } = await import(
    '@/lib/portfolio-analyse/sec-berichte-ki-cache-server'
  )
  const { migriereEarningsCallKiDateiNachCloud } = await import(
    '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
  )
  const [sec, earnings] = await Promise.all([
    migriereSecBerichtKiDateiNachCloud(),
    migriereEarningsCallKiDateiNachCloud(),
  ])
  return { sec, earnings }
}

async function speichereSecBulk(eintraege: BulkTickerSec[]): Promise<number> {
  const { speichereSecBerichtKiInCloud } = await import('@/lib/portfolio-analyse/portfolio-ki-cache-cloud-server')
  let hochgeladen = 0
  for (const block of eintraege) {
    const ticker = block.ticker?.trim()
    if (!ticker || !Array.isArray(block.eintraege)) continue
    for (const e of block.eintraege) {
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
  }
  return hochgeladen
}

async function speichereEarningsBulk(eintraege: BulkTickerEarnings[]): Promise<number> {
  const { speichereEarningsCallKiInCloud } = await import(
    '@/lib/portfolio-analyse/portfolio-ki-cache-cloud-server'
  )
  let hochgeladen = 0
  for (const block of eintraege) {
    const ticker = block.ticker?.trim()
    if (!ticker || !Array.isArray(block.eintraege)) continue
    for (const e of block.eintraege) {
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
  }
  return hochgeladen
}

/** Lädt KI-Zusammenfassungen aus localStorage und Server-Dateien in Supabase (Laptop → Handy). */
export async function POST(req: Request) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
    }

    const row = body as Record<string, unknown>

    if (row.bulk === true) {
      const server = await migriereServerDateiCaches()
      const secClient = await speichereSecBulk(Array.isArray(row.sec) ? (row.sec as BulkTickerSec[]) : [])
      const earningsClient = await speichereEarningsBulk(
        Array.isArray(row.earnings) ? (row.earnings as BulkTickerEarnings[]) : [],
      )
      return NextResponse.json({
        ok: true,
        hochgeladen: {
          secClient,
          earningsClient,
          secServer: server.sec,
          earningsServer: server.earnings,
        },
      })
    }

    const typ = row.typ === 'earnings' ? 'earnings' : row.typ === 'sec' ? 'sec' : null
    const ticker = row.ticker != null ? String(row.ticker).trim() : ''
    if (!typ || !ticker) {
      return NextResponse.json({ ok: false, fehler: 'typ (sec|earnings) und ticker erforderlich.' }, { status: 400 })
    }

    if (typ === 'sec') {
      const eintraege = Array.isArray(row.eintraege) ? (row.eintraege as SecSyncEintrag[]) : []
      const hochgeladen = await speichereSecBulk([{ ticker, eintraege }])
      return NextResponse.json({ ok: true, hochgeladen })
    }

    const eintraege = Array.isArray(row.eintraege) ? (row.eintraege as EarningsSyncEintrag[]) : []
    const hochgeladen = await speichereEarningsBulk([{ ticker, eintraege }])
    return NextResponse.json({ ok: true, hochgeladen })
  } catch (e) {
    console.error('ki-cache/sync', e)
    return NextResponse.json(
      { ok: false, fehler: e instanceof Error ? e.message : 'Sync fehlgeschlagen' },
      { status: 500 },
    )
  }
}
