/** Client: Prompt-LS + API für Aktienanalyse. */

import {
  AKTIENANALYSE_DEFAULT_PROMPT,
  AKTIENANALYSE_PROMPT_LS,
  type AktienanalyseEintrag,
} from '@/lib/portfolio-analyse/aktienanalyse-prompt'
import type { FundamentaldatenExportPayload } from '@/lib/portfolio-analyse/fundamentaldaten-export-client'

export function ladeAktienanalysePrompt(): string {
  if (typeof window === 'undefined') return AKTIENANALYSE_DEFAULT_PROMPT
  try {
    const raw = localStorage.getItem(AKTIENANALYSE_PROMPT_LS)
    if (raw && raw.trim().length > 40) return raw
  } catch {
    /* ignore */
  }
  return AKTIENANALYSE_DEFAULT_PROMPT
}

export function speichereAktienanalysePrompt(prompt: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AKTIENANALYSE_PROMPT_LS, prompt)
  } catch {
    /* quota */
  }
}

export function resetAktienanalysePrompt(): string {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(AKTIENANALYSE_PROMPT_LS)
    } catch {
      /* ignore */
    }
  }
  return AKTIENANALYSE_DEFAULT_PROMPT
}

export async function ladeAktienanalyseHistorie(ticker: string): Promise<AktienanalyseEintrag[]> {
  const res = await fetch(
    `/api/portfolio-analyse/aktienanalyse?ticker=${encodeURIComponent(ticker)}`,
    { cache: 'no-store' },
  )
  const j = (await res.json()) as { ok?: boolean; eintraege?: AktienanalyseEintrag[]; message?: string }
  if (!res.ok || !j.ok) throw new Error(j.message || 'Historie laden fehlgeschlagen')
  return j.eintraege ?? []
}

export async function generiereAktienanalyse(opts: {
  ticker: string
  prompt: string
  exportPayload: FundamentaldatenExportPayload
}): Promise<AktienanalyseEintrag> {
  const res = await fetch('/api/portfolio-analyse/aktienanalyse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker: opts.ticker,
      prompt: opts.prompt,
      exportPayload: opts.exportPayload,
    }),
    signal: AbortSignal.timeout(280_000),
  })
  const raw = await res.text()
  let j: {
    ok?: boolean
    eintrag?: AktienanalyseEintrag
    message?: string
    error?: string
  }
  try {
    j = JSON.parse(raw) as typeof j
  } catch {
    throw new Error(
      res.status === 401 || res.status === 403
        ? 'Anmeldung abgelaufen — bitte neu einloggen.'
        : `Server-Antwort kein JSON (HTTP ${res.status}).`,
    )
  }
  if (!res.ok || !j.ok || !j.eintrag) {
    throw new Error(j.message || j.error || 'Analyse fehlgeschlagen')
  }
  return j.eintrag
}
