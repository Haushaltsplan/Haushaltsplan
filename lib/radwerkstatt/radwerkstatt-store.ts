import { CLIENT_STATE_KEYS } from '@/lib/client-state/client-state-keys'
import { leseClientStateRev } from '@/lib/client-state/client-state-rev'
import type { RadwerkstattArt, RadwerkstattArtikel, RadwerkstattListe } from '@/lib/radwerkstatt/radwerkstatt-types'

export const RADWERKSTATT_STORAGE_KEY = 'mein-haushalt:radwerkstatt-v1'
export const RADWERKSTATT_EVENT = 'radwerkstatt-geaendert'

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function listeAus(v: unknown): RadwerkstattListe | null {
  return v === 'bestand' || v === 'bedarf' ? v : null
}

function artAus(v: unknown): RadwerkstattArt {
  return v === 'verbrauch' ? 'verbrauch' : 'werkzeug'
}

function preisAus(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100000) return null
  return Math.round(v * 100) / 100
}

export function parseRadwerkstattListe(raw: unknown): RadwerkstattArtikel[] {
  if (!Array.isArray(raw)) return []
  const out: RadwerkstattArtikel[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const id = text(r.id, 80)
    const name = text(r.name, 160)
    const liste = listeAus(r.liste)
    if (!id || !name || !liste) continue
    const anzahlRoh = typeof r.anzahl === 'number' ? r.anzahl : Number(r.anzahl)
    const anzahl = Number.isFinite(anzahlRoh) ? Math.min(99, Math.max(1, Math.round(anzahlRoh))) : 1
    out.push({
      id,
      liste,
      art: artAus(r.art),
      name,
      einsatzbereich: text(r.einsatzbereich, 80),
      preisEur: preisAus(r.preisEur),
      preisText: text(r.preisText, 40),
      zusammenfassung: text(r.zusammenfassung, 700),
      produktUrl: text(r.produktUrl, 2000),
      bildUrl: text(r.bildUrl, 2000),
      haltbarkeit: text(r.haltbarkeit, 240),
      verwendungsrhythmus: text(r.verwendungsrhythmus, 240),
      anzahl,
      notiz: text(r.notiz, 2000),
      gekauftAm: text(r.gekauftAm, 10),
      erstelltAm: text(r.erstelltAm, 40) || new Date().toISOString(),
    })
  }
  return out
}

export function ladeRadwerkstatt(): RadwerkstattArtikel[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RADWERKSTATT_STORAGE_KEY)
    if (!raw) return []
    return parseRadwerkstattListe(JSON.parse(raw))
  } catch {
    return []
  }
}

export function schreibeRadwerkstatt(items: RadwerkstattArtikel[], opts?: { mitCloud?: boolean }): void {
  if (typeof window === 'undefined') return
  const liste = parseRadwerkstattListe(items)
  try {
    window.localStorage.setItem(RADWERKSTATT_STORAGE_KEY, JSON.stringify(liste))
  } catch {
    /* Speicher voll */
  }
  window.dispatchEvent(new CustomEvent(RADWERKSTATT_EVENT))
  if (opts?.mitCloud === false) return
  void import('@/lib/client-state/client-state-sync').then(({ pushClientState }) => {
    pushClientState(CLIENT_STATE_KEYS.radwerkstatt, liste)
  })
}

export function radwerkstattLokalFuerUpload(): RadwerkstattArtikel[] | null {
  const liste = ladeRadwerkstatt()
  if (liste.length === 0 && !leseClientStateRev(CLIENT_STATE_KEYS.radwerkstatt)) return null
  return liste
}
