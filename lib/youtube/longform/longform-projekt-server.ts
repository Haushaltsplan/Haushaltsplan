/** Neues Projekt: Export lesen, Lücken automatisch schließen, Faktenblatt bauen. */
import 'server-only'

import { ladeDepotRadarAktien } from '@/lib/portfolio-analyse/depot-gewichte-server'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { generiereMoatKiBewertung, ladeMoatKiCache } from '@/lib/portfolio-analyse/moat-ki-server'
import type { MoatKiBewertung } from '@/lib/portfolio-analyse/moat-ki-types'
import { ladeYahooHolders } from '@/lib/portfolio-analyse/yahoo-holders-server'
import { findeMoatShortLogo } from '@/lib/youtube/moat-short-logo-server'
import { pct } from '@/lib/youtube/longform/longform-format'
import { waehleVarianten } from '@/lib/youtube/longform/longform-abwechslung'
import { ladeHerunter, ladeHoch, ladeVerlauf, legeProjektAn, projektPfad, speichereProjekt } from '@/lib/youtube/longform/longform-db-server'
import { baueFaktenblatt, haengeRisikoUndFazit } from '@/lib/youtube/longform/longform-fakten'
import { fuelleJahresluecken } from '@/lib/youtube/longform/longform-reihen-luecken'
import { ladeHookZusatz } from '@/lib/youtube/longform/longform-hook-karten'
import { moatTexteEnglisch } from '@/lib/youtube/longform/longform-moat-en-server'
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
  const [chart, moatKi, logoUrl, depot, verlauf, hook] = await Promise.all([
    paket.symbolYahoo
      ? ladeChart10k(paket.symbolYahoo, 10, paket.sektor).catch(() => null)
      : Promise.resolve(null),
    moatFuer(paket, isin),
    findeMoatShortLogo({ ticker, firmenname: paket.firmenname, isin, website: paket.website, symbolYahoo: paket.symbolYahoo }).catch(() => null),
    imDepot(isin),
    ladeVerlauf(),
    ladeHookZusatz(paket, isin).catch((e) => {
      console.warn('[longform] Hook-Karten:', e)
      return { karten: [], basis: { marketCap: null, wkn: null, isin } }
    }),
  ])
  const faktenblatt = await moatTexteEnglisch(
    baueFaktenblatt({ paket, isin, exportDatum: eingabe.exportDatum, chart, moatKi, logoUrl, imDepot: depot }),
  )
  faktenblatt.hookKarten = hook.karten
  faktenblatt.hookBasis = hook.basis
  haengeRisikoUndFazit(faktenblatt)
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
    musik: { aktiv: false, pegel: 50 },
    denkstufe: 'medium',
    investiert: depot,
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

/**
 * Neue Fundamentaldaten-JSON ins bestehende Projekt.
 * Skript, Stimme und Bilder bleiben. Die Jahrescharts werden neu aus der JSON gebaut.
 */
export async function ersetzeExport(id: string, eingabe: LongformExportEingabe): Promise<LongformProjekt> {
  const alt = await ladeProjekt(id)
  if (!alt) throw new Error('Projekt nicht gefunden.')
  const neuTicker = (eingabe.paket.symbolYahoo?.split('.')[0] || eingabe.paket.ticker || '').trim().toUpperCase()
  if (!neuTicker || neuTicker !== alt.ticker.trim().toUpperCase()) {
    throw new Error(`Die JSON gehört zu ${neuTicker || 'einem anderen Ticker'}, dieses Projekt ist ${alt.ticker}.`)
  }
  await ladeHoch(projektPfad(id, 'export', 'fundamentaldaten.json'), JSON.stringify(eingabe.paket), 'application/json')
  const z = await ergaenzeKapitelAusExport(id, alt.zustand)
  z.faktenblatt.exportDatum = eingabe.exportDatum
  if (eingabe.isin) z.faktenblatt.isin = eingabe.isin
  await speichereProjekt(id, z)
  const neu = await ladeProjekt(id)
  if (!neu) throw new Error('Projekt nicht gefunden.')
  return neu
}

/**
 * 10-Jahres-Chart neu rechnen. Symbol und Sektor kommen aus der gespeicherten JSON,
 * die Kurse sind die aktuellen Yahoo-Tageskurse. Nur dieses Kapitel wird geleert.
 */
export async function erneuereChart10k(id: string, z: LongformProjektZustand): Promise<LongformProjektZustand> {
  const buf = await ladeHerunter(projektPfad(id, 'export', 'fundamentaldaten.json'))
  const gelesen = buf ? leseLongformExport(JSON.parse(buf.toString('utf8'))) : 'Keine gespeicherte JSON.'
  if (typeof gelesen === 'string') throw new Error(gelesen)
  const symbol = (gelesen.paket.symbolYahoo || z.faktenblatt.symbolYahoo || '').trim()
  if (!symbol) throw new Error('Kein Yahoo-Symbol für den 10-Jahres-Chart.')
  const chart = await ladeChart10k(symbol, 10, gelesen.paket.sektor ?? z.faktenblatt.sektor)
  if (!chart) throw new Error('Die 10-Jahres-Kurse konnten nicht geladen werden.')
  const probe = baueFaktenblatt({
    paket: gelesen.paket,
    isin: z.faktenblatt.isin,
    exportDatum: gelesen.exportDatum || z.faktenblatt.exportDatum,
    chart,
    moatKi: null,
    logoUrl: z.faktenblatt.logoUrl,
    imDepot: z.faktenblatt.imDepot,
  })
  const weg = new Set(z.skript?.abschnitte.find((a) => a.id === 'chart10k')?.saetze.map((s) => s.id) ?? [])
  const saetze = { ...z.stimme.saetze }
  const bilder = { ...z.bilder }
  for (const sid of weg) {
    delete saetze[sid]
    delete bilder[sid]
  }
  const kapitelDateien = { ...z.kapitelDateien }
  delete kapitelDateien.chart10k
  return {
    ...z,
    faktenblatt: {
      ...z.faktenblatt,
      chart,
      kursDatum: chart.endDatum,
      fakten: [...z.faktenblatt.fakten.filter((f) => !f.id.startsWith('k10.')), ...probe.fakten.filter((f) => f.id.startsWith('k10.'))],
    },
    skript: z.skript ? { ...z.skript, abschnitte: z.skript.abschnitte.filter((a) => a.id !== 'chart10k') } : null,
    stimme: { ...z.stimme, saetze },
    bilder,
    kapitelDateien,
    freigegeben: (z.freigegeben ?? []).filter((kapitel) => kapitel !== 'chart10k'),
  }
}

/** Neue Kapitel-Fakten aus der gespeicherten JSON. Skript, Stimme und Bilder bleiben. */
export async function ergaenzeKapitelAusExport(id: string, z: LongformProjektZustand): Promise<LongformProjektZustand> {
  const buf = await ladeHerunter(projektPfad(id, 'export', 'fundamentaldaten.json'))
  let faktenblatt = z.faktenblatt
  if (buf) {
    try {
      const gelesen = leseLongformExport(JSON.parse(buf.toString('utf8')))
      if (typeof gelesen !== 'string') {
        const gelueckt = await fuelleJahresluecken(gelesen.paket)
        const neu = baueFaktenblatt({
          paket: gelueckt.paket,
          isin: z.faktenblatt.isin,
          exportDatum: z.faktenblatt.exportDatum,
          chart: z.faktenblatt.chart,
          moatKi: null,
          logoUrl: z.faktenblatt.logoUrl,
          imDepot: z.faktenblatt.imDepot,
        })
        if (gelueckt.gefuellt && gelueckt.quelle) {
          const zusatz = `missing years ${gelueckt.quelle}`
          neu.reihen = neu.reihen.map((r) => ({
            ...r,
            quelle: r.quelle.includes('missing years') ? r.quelle : `${r.quelle} · ${zusatz}`,
          }))
        }
        const ohneReihe = z.faktenblatt.fakten.filter((f) => !f.id.startsWith('reihe.'))
        const ids = new Set(ohneReihe.map((f) => f.id))
        faktenblatt = {
          ...z.faktenblatt,
          fakten: [...ohneReihe, ...neu.fakten.filter((f) => f.id.startsWith('reihe.') || !ids.has(f.id))],
          reihen: neu.reihen,
          scorecard: neu.scorecard?.length ? neu.scorecard : z.faktenblatt.scorecard,
        }
      }
    } catch (e) {
      console.warn('[longform] Faktenblatt aus Export:', e)
    }
  }
  faktenblatt = { ...faktenblatt, fakten: [...faktenblatt.fakten] }
  if (faktenblatt.symbolYahoo && !faktenblatt.fakten.some((f) => f.id === 'own.inst1')) {
    const holders = await ladeYahooHolders(faktenblatt.symbolYahoo).catch(() => null)
    holders?.institutionen?.forEach((inst, i) => {
      faktenblatt.fakten.push({
        id: `own.inst${i + 1}`,
        label: inst.name,
        wert: Math.round(inst.anteilPct * 10) / 10,
        text: pct(inst.anteilPct),
        einheit: 'pct',
        stichtag: faktenblatt.exportDatum,
        quelle: 'Yahoo Finance, institution ownership',
      })
    })
  }
  haengeRisikoUndFazit(faktenblatt)
  return { ...z, faktenblatt }
}
