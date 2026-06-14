/** Portfolio-KI-Cache in Supabase — geräteübergreifend (Service Role, server-only). */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'

const TABLE_SEC = 'portfolio_sec_bericht_ki' as const
const TABLE_EARNINGS = 'portfolio_earnings_call_ki' as const

export type SecBerichtKiCloudZeile = {
  zusammenfassung: string
  accession: string
  aktualisiertAm: string
}

export type EarningsCallKiCloudZeile = {
  zusammenfassung: string
  transcriptUrl: string
  aktualisiertAm: string
}

function tickerNorm(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function istCloudKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function adminClient() {
  return createSupabaseAdmin()
}

export async function ladeSecBerichtKiAusCloud(ticker: string): Promise<Map<string, SecBerichtKiCloudZeile>> {
  const out = new Map<string, SecBerichtKiCloudZeile>()
  if (!istCloudKonfiguriert()) return out
  try {
    const { data, error } = await adminClient()
      .from(TABLE_SEC)
      .select('bericht_id, accession, zusammenfassung, aktualisiert_am')
      .eq('ticker', tickerNorm(ticker))
    if (error) {
      console.warn('SEC-Berichte-KI-Cloud: Laden', error.message)
      return out
    }
    for (const row of data ?? []) {
      const r = row as {
        bericht_id: string
        accession: string
        zusammenfassung: string
        aktualisiert_am: string
      }
      out.set(r.bericht_id, {
        zusammenfassung: r.zusammenfassung,
        accession: r.accession ?? '',
        aktualisiertAm: r.aktualisiert_am,
      })
    }
  } catch (e) {
    console.warn('SEC-Berichte-KI-Cloud: Laden fehlgeschlagen', e)
  }
  return out
}

export async function ladeSecBerichtKiCloudEintrag(
  ticker: string,
  berichtId: string,
): Promise<SecBerichtKiCloudZeile | null> {
  const map = await ladeSecBerichtKiAusCloud(ticker)
  return map.get(berichtId.trim()) ?? null
}

export async function speichereSecBerichtKiInCloud(eintrag: {
  ticker: string
  berichtId: string
  accession: string
  zusammenfassung: string
}): Promise<void> {
  if (!istCloudKonfiguriert()) return
  try {
    const { error } = await adminClient()
      .from(TABLE_SEC)
      .upsert(
        {
          ticker: tickerNorm(eintrag.ticker),
          bericht_id: eintrag.berichtId.trim(),
          accession: eintrag.accession,
          zusammenfassung: eintrag.zusammenfassung,
          aktualisiert_am: new Date().toISOString(),
        },
        { onConflict: 'ticker,bericht_id' },
      )
    if (error) console.warn('SEC-Berichte-KI-Cloud: Speichern', error.message)
  } catch (e) {
    console.warn('SEC-Berichte-KI-Cloud: Speichern fehlgeschlagen', e)
  }
}

export async function loescheSecBerichtKiCloudEintrag(ticker: string, berichtId: string): Promise<void> {
  if (!istCloudKonfiguriert()) return
  try {
    const { error } = await adminClient()
      .from(TABLE_SEC)
      .delete()
      .eq('ticker', tickerNorm(ticker))
      .eq('bericht_id', berichtId.trim())
    if (error) console.warn('SEC-Berichte-KI-Cloud: Löschen', error.message)
  } catch (e) {
    console.warn('SEC-Berichte-KI-Cloud: Löschen fehlgeschlagen', e)
  }
}

export async function ladeEarningsCallKiAusCloud(
  ticker: string,
): Promise<Map<string, EarningsCallKiCloudZeile>> {
  const out = new Map<string, EarningsCallKiCloudZeile>()
  if (!istCloudKonfiguriert()) return out
  try {
    const { data, error } = await adminClient()
      .from(TABLE_EARNINGS)
      .select('quartal_id, transcript_url, zusammenfassung, aktualisiert_am')
      .eq('ticker', tickerNorm(ticker))
    if (error) {
      console.warn('Earnings-Call-KI-Cloud: Laden', error.message)
      return out
    }
    for (const row of data ?? []) {
      const r = row as {
        quartal_id: string
        transcript_url: string
        zusammenfassung: string
        aktualisiert_am: string
      }
      out.set(r.quartal_id, {
        zusammenfassung: r.zusammenfassung,
        transcriptUrl: r.transcript_url ?? '',
        aktualisiertAm: r.aktualisiert_am,
      })
    }
  } catch (e) {
    console.warn('Earnings-Call-KI-Cloud: Laden fehlgeschlagen', e)
  }
  return out
}

export async function ladeEarningsCallKiCloudEintrag(
  ticker: string,
  quartalId: string,
): Promise<EarningsCallKiCloudZeile | null> {
  const map = await ladeEarningsCallKiAusCloud(ticker)
  return map.get(quartalId.trim()) ?? null
}

export async function speichereEarningsCallKiInCloud(eintrag: {
  ticker: string
  quartalId: string
  transcriptUrl: string
  zusammenfassung: string
}): Promise<void> {
  if (!istCloudKonfiguriert()) return
  try {
    const { error } = await adminClient()
      .from(TABLE_EARNINGS)
      .upsert(
        {
          ticker: tickerNorm(eintrag.ticker),
          quartal_id: eintrag.quartalId.trim(),
          transcript_url: eintrag.transcriptUrl,
          zusammenfassung: eintrag.zusammenfassung,
          aktualisiert_am: new Date().toISOString(),
        },
        { onConflict: 'ticker,quartal_id' },
      )
    if (error) console.warn('Earnings-Call-KI-Cloud: Speichern', error.message)
  } catch (e) {
    console.warn('Earnings-Call-KI-Cloud: Speichern fehlgeschlagen', e)
  }
}

export async function loescheEarningsCallKiCloudEintrag(ticker: string, quartalId: string): Promise<void> {
  if (!istCloudKonfiguriert()) return
  try {
    const { error } = await adminClient()
      .from(TABLE_EARNINGS)
      .delete()
      .eq('ticker', tickerNorm(ticker))
      .eq('quartal_id', quartalId.trim())
    if (error) console.warn('Earnings-Call-KI-Cloud: Löschen', error.message)
  } catch (e) {
    console.warn('Earnings-Call-KI-Cloud: Löschen fehlgeschlagen', e)
  }
}
