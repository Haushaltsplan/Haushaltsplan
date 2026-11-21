/** Neues Projekt: Export lesen, Lücken automatisch schließen, Faktenblatt bauen. */
import 'server-only'

import { ladeDepotRadarAktien } from '@/lib/portfolio-analyse/depot-gewichte-server'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { generiereMoatKiBewertung, ladeMoatKiCache } from '@/lib/portfolio-analyse/moat-ki-server'
import type { MoatKiBewertung } from '@/lib/portfolio-analyse/moat-ki-types'
import { findeMoatShortLogo } from '@/lib/youtube/moat-short-logo-server'
import { waehleVarianten } from '@/lib/youtube/longform/longform-abwechslung'
import { ladeHerunter, ladeHoch, ladeVerlauf, legeProjektAn, projektPfad, speichereProjekt } from '@/lib/youtube/longform/longform-db-server'
import { baueFaktenblatt } from '@/lib/youtube/longform/longform-fakten'
import { ladeChart10k } from '@/lib/youtube/longform/longform-kurse-server'
import type { LongformDokument } from '@/lib/youtube/longform/longform-skript-server'
import {
  LONGFORM_STIMME_STANDARD,
  type LongformProjekt,
  type LongformProjektZustand,
  type LongformQuelle,
} from '@/lib/youtube/longform/longform-types'

export type LongformExportEingabe = {
  paket: FundamentaldatenPaket
  isin: string | null
  exportDatum: string
}

/** Akzeptiert den v2-Export (mit fundamentaldatenRoh) oder ein nacktes Paket. */
export function leseLongformExport(j: unknown): LongformExportEingabe | string {
  if (!j || typeof j !== 'object') return 'Kein gültiges JSON.'
  const o = j as Record<string, unknown>
  const paket = (o.fundamentaldatenRoh ?? o) as FundamentaldatenPaket
  if (!paket || !Array.isArray(paket.keyMetrics) || !paket.firmenname) {
    return 'Kein Fundamentaldaten-Export erkannt (fundamentaldatenRoh mit Kennzahlen fehlt).'
  }
  const meta = (o.meta ?? {}) as { isin?: string | null }
  return {
    paket: { ...paket, news: [] },
    isin: typeof meta.isin === 'string' && meta.isin.trim() ? meta.isin.trim().toUpperCase() : null,
    exportDatum: typeof o.exportiertAm === 'string' ? o.exportiertAm : paket.geladenAm || new Date().toISOString(),
  }
}

async function moatFuer(paket: FundamentaldatenPaket, isin: string | null): Promise<MoatKiBewertung | null> {
  const ticker = (paket.symbolYahoo?.split('.')[0] || paket.ticker).trim().toUpperCase()
  try {
    return (await ladeMoatKiCache(ticker)) ?? (await generiereMoatKiBewertung(paket, isin))
  } catch (e) {
    console.warn('[longform] Moat-Check:', e)
    return null
  }
}

async function imDepot(isin: string | null): Promise<boolean | null> {
  if (!isin) return null
  try {
    const depot = await ladeDepotRadarAktien()
    return depot.some((d) => d.isin.toUpperCase() === isin)
  } catch {
    return null
  }
}

export async function erstelleProjekt(eingabe: LongformExportEingabe, thema: string): Promise<LongformProjekt> {
  const { paket, isin } = eingabe
  const ticker = (paket.symbolYahoo?.split('.')[0] || paket.ticker).trim().toUpperCase()
  const [chart, moatKi, logoUrl, depot, verlauf] = await Promise.all([
    paket.symbolYahoo ? ladeChart10k(paket.symbolYahoo).catch(() => null) : Promise.resolve(null),
    moatFuer(paket, isin),
    findeMoatShortLogo({ ticker, firmenname: paket.firmenname, isin, website: paket.website, symbolYahoo: paket.symbolYahoo }).catch(() => null),
    imDepot(isin),
    ladeVerlauf(),
  ])
  const faktenblatt = baueFaktenblatt({ paket, isin, exportDatum: eingabe.exportDatum, chart, moatKi, logoUrl, imDepot: depot })
  const zustand: LongformProjektZustand = {
    version: 1,
    thema: thema.trim(),
    faktenblatt,
    quellen: [],
    hooks: null,
    gewaehlterHook: null,
    skript: null,
    stimme: { global: { ...LONGFORM_STIMME_STANDARD }, saetze: {} },
    bilder: {},
    varianten: waehleVarianten(verlauf),
    musik: { aktiv: true, pegel: 50 },
    denkstufe: 'medium',
  }
  const projekt = await legeProjektAn(zustand)
  await ladeHoch(projektPfad(projekt.id, 'export', 'fundamentaldaten.json'), JSON.stringify(paket), 'application/json')
  return projekt
}

export async function speichereQuelle(projektId: string, zustand: LongformProjektZustand, datei: File): Promise<LongformProjektZustand> {
  const mime = datei.type || 'application/octet-stream'
  const art: LongformQuelle['art'] = mime === 'application/pdf' ? 'pdf' : mime.startsWith('image/') ? 'bild' : 'text'
  if (art === 'text' && !/^text\//.test(mime)) throw new Error('Nur PDF, Bilder oder Textdateien.')
  if (datei.size > 20_000_000) throw new Error('Datei ist größer als 20 MB.')
  const id = `q${zustand.quellen.length + 1}-${Date.now().toString(36)}`
  const sauber = datei.name.replace(/[^\w.\-]+/g, '_').slice(-80)
  const pfad = projektPfad(projektId, 'quellen', `${id}-${sauber}`)
  await ladeHoch(pfad, Buffer.from(await datei.arrayBuffer()), mime)
  const neu: LongformProjektZustand = { ...zustand, quellen: [...zustand.quellen, { id, name: datei.name, art, pfad, mime }] }
  await speichereProjekt(projektId, neu)
  return neu
}

/** PDFs, Bilder und Texte als Gemini-Anhang. Insgesamt höchstens ~18 MB. */
export async function ladeDokumente(zustand: LongformProjektZustand): Promise<LongformDokument[]> {
  const out: LongformDokument[] = []
  let summe = 0
  for (const q of zustand.quellen) {
    const buf = await ladeHerunter(q.pfad)
    if (!buf) continue
    if (summe + buf.length > 18_000_000) break
    summe += buf.length
    out.push({ name: q.name, mime: q.art === 'text' ? 'text/plain' : q.mime, base64: buf.toString('base64') })
  }
  return out
}
