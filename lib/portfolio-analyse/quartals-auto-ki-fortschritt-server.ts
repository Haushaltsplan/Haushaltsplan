/** Persistierter Cursor für den Quartals-Auto-KI-Cron (Supabase, Service Role). */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const QUARTALS_AUTO_KI_JOB_ID = 'quartals-auto-ki' as const

export type QuartalsAutoKiPhase = 'earnings' | 'sec'

export type QuartalsAutoKiFortschritt = {
  resumeOffset: number
  resumePhase: QuartalsAutoKiPhase
  pauseGrund: string | null
  kandidatenGesamt: number | null
  aktualisiertAm: string | null
}

const TABLE = 'portfolio_cron_fortschritt' as const

function istCloudKonfiguriert(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

function parsePhase(raw: unknown): QuartalsAutoKiPhase {
  return raw === 'sec' ? 'sec' : 'earnings'
}

export async function ladeQuartalsAutoKiFortschritt(): Promise<QuartalsAutoKiFortschritt | null> {
  if (!istCloudKonfiguriert()) return null
  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select('resume_offset, resume_phase, pause_grund, kandidaten_gesamt, aktualisiert_am')
      .eq('job_id', QUARTALS_AUTO_KI_JOB_ID)
      .maybeSingle()
    if (error) {
      console.warn('Quartals-Auto-KI Fortschritt: laden', error.message)
      return null
    }
    if (!data) return null
    const row = data as {
      resume_offset: number
      resume_phase: string
      pause_grund: string | null
      kandidaten_gesamt: number | null
      aktualisiert_am: string
    }
    return {
      resumeOffset: Math.max(0, Number(row.resume_offset) || 0),
      resumePhase: parsePhase(row.resume_phase),
      pauseGrund: row.pause_grund,
      kandidatenGesamt: row.kandidaten_gesamt,
      aktualisiertAm: row.aktualisiert_am ?? null,
    }
  } catch (e) {
    console.warn('Quartals-Auto-KI Fortschritt: laden fehlgeschlagen', e)
    return null
  }
}

export async function speichereQuartalsAutoKiFortschritt(opts: {
  resumeOffset: number
  resumePhase: QuartalsAutoKiPhase
  pauseGrund?: string | null
  kandidatenGesamt?: number | null
}): Promise<void> {
  if (!istCloudKonfiguriert()) return
  try {
    const { error } = await createSupabaseAdmin().from(TABLE).upsert(
      {
        job_id: QUARTALS_AUTO_KI_JOB_ID,
        resume_offset: Math.max(0, opts.resumeOffset),
        resume_phase: opts.resumePhase,
        pause_grund: opts.pauseGrund ?? null,
        kandidaten_gesamt: opts.kandidatenGesamt ?? null,
        aktualisiert_am: new Date().toISOString(),
      },
      { onConflict: 'job_id' },
    )
    if (error) console.warn('Quartals-Auto-KI Fortschritt: speichern', error.message)
  } catch (e) {
    console.warn('Quartals-Auto-KI Fortschritt: speichern fehlgeschlagen', e)
  }
}
