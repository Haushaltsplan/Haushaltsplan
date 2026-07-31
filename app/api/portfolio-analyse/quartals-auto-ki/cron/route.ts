/**
 * Vercel Cron: Neue Quartalsberichte & Earnings Calls erkennen und per KI zusammenfassen.
 * Schedule: täglich 05:00 UTC (siehe vercel.json).
 *
 * Bei erschöpftem KI-Kontingent wird der Cursor in Supabase gespeichert und
 * am nächsten Tag exakt dort fortgesetzt.
 *
 * Query: ?reset=1 setzt den Fortschritt zurück. ?offset=&phase= überschreibt einmalig.
 * Gesichert durch CRON_SECRET.
 */
import { NextResponse } from 'next/server'
import { laufeQuartalsAutoKi } from '@/lib/portfolio-analyse/quartals-auto-ki-cron-server'
import {
  ladeQuartalsAutoKiFortschritt,
  speichereQuartalsAutoKiFortschritt,
  type QuartalsAutoKiPhase,
} from '@/lib/portfolio-analyse/quartals-auto-ki-fortschritt-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function cronErlaubt(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || '').trim()
  if (!secret) return true // lokal ohne Secret
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function parsePhase(raw: string | null): QuartalsAutoKiPhase | null {
  if (raw === 'sec' || raw === 'earnings') return raw
  return null
}

export async function GET(req: Request) {
  if (!cronErlaubt(req)) {
    return NextResponse.json({ ok: false, fehler: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const reset = url.searchParams.get('reset') === '1'
  const offsetParam = url.searchParams.get('offset')
  const phaseParam = parsePhase(url.searchParams.get('phase'))

  try {
    if (reset) {
      await speichereQuartalsAutoKiFortschritt({
        resumeOffset: 0,
        resumePhase: 'earnings',
        pauseGrund: null,
      })
    }

    const gespeichert = reset ? null : await ladeQuartalsAutoKiFortschritt()
    let resumeOffset =
      offsetParam != null && offsetParam !== ''
        ? Math.max(0, Number(offsetParam) || 0)
        : (gespeichert?.resumeOffset ?? 0)
    let resumePhase: QuartalsAutoKiPhase =
      phaseParam ?? gespeichert?.resumePhase ?? 'earnings'

    let runden = 0
    const MAX_RUNDEN = 8
    const aggregiert = {
      kandidaten: 0,
      geprueft: 0,
      secNeu: 0,
      earningsNeu: 0,
      diffsNeu: 0,
      uebersprungen: 0,
      fehler: [] as string[],
      details: [] as Awaited<ReturnType<typeof laufeQuartalsAutoKi>>['details'],
      quotaErschoepft: false,
      pauseGrund: null as string | null,
      durchlaufFertig: false,
    }

    while (runden < MAX_RUNDEN) {
      const teil = await laufeQuartalsAutoKi({
        resumeOffset,
        resumePhase,
        maxTicker: 6,
        maxKiJobs: 4,
        zeitBudgetMs: 110_000,
      })
      aggregiert.kandidaten = teil.kandidaten
      aggregiert.geprueft += teil.geprueft
      aggregiert.secNeu += teil.secNeu
      aggregiert.earningsNeu += teil.earningsNeu
      aggregiert.diffsNeu += teil.diffsNeu
      aggregiert.uebersprungen += teil.uebersprungen
      aggregiert.fehler.push(...teil.fehler)
      aggregiert.details.push(...teil.details)
      resumeOffset = teil.resumeOffset
      resumePhase = teil.resumePhase
      runden++

      if (teil.quotaErschoepft) {
        aggregiert.quotaErschoepft = true
        aggregiert.pauseGrund = teil.pauseGrund
        break
      }
      if (teil.durchlaufFertig) {
        aggregiert.durchlaufFertig = true
        break
      }
      if (teil.secNeu + teil.earningsNeu + teil.diffsNeu === 0 && teil.geprueft === 0) break
      if (aggregiert.secNeu + aggregiert.earningsNeu + aggregiert.diffsNeu >= 8) break
    }

    await speichereQuartalsAutoKiFortschritt({
      resumeOffset,
      resumePhase,
      pauseGrund: aggregiert.quotaErschoepft
        ? aggregiert.pauseGrund ?? 'KI-Kontingent erschöpft — morgen weiter'
        : null,
      kandidatenGesamt: aggregiert.kandidaten,
    })

    return NextResponse.json({
      ok: true,
      ...aggregiert,
      runden,
      resumeOffset,
      resumePhase,
      fortgesetztVon: gespeichert
        ? {
            offset: gespeichert.resumeOffset,
            phase: gespeichert.resumePhase,
            pauseGrund: gespeichert.pauseGrund,
          }
        : null,
      zeitstempel: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[quartals-auto-ki-cron]', e)
    return NextResponse.json({ ok: false, fehler: String(e) }, { status: 500 })
  }
}
