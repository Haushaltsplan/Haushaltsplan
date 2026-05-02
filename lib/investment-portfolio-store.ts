import 'server-only'

import { promises as fs } from 'fs'
import path from 'path'
import { ladePortfolioStateAusCloud, speicherePortfolioInCloud } from '@/lib/investment-portfolio-cloud'
import { portfolioStandardZeilenMitMeta } from '@/lib/investment-portfolio-standard-zeilen'
import type { PortfolioPositionMitNotiz } from '@/lib/investment-portfolio-types'
import { istSupabaseClientKonfiguriert } from '@/lib/supabase'

const DATEIPFAD = path.join(process.cwd(), 'data', 'investment-portfolio.json')

/** Reproduzierbare Seed-Zeilen aus dem eingebauten Portfolio (bis zur ersten Speicherung). */
export function standardPortfolioPositionenMitMeta(): PortfolioPositionMitNotiz[] {
  return portfolioStandardZeilenMitMeta()
}

export type PortfolioKomplett = {
  /** Für Anzeige & Yahoo — immer aufgelöst (Standard oder gespeichert). */
  positionen: PortfolioPositionMitNotiz[]
  /** true solange keine eigene Liste gespeichert wurde (Supabase-Flag / lokale Datei fehlt). */
  verwendetStandardliste: boolean
}

function istPortfolioZeile(x: unknown): x is PortfolioPositionMitNotiz {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.symbolYahoo === 'string' &&
    typeof o.notierung === 'string' &&
    typeof o.notiz === 'string'
  )
}

async function leseDateiPortfolio(): Promise<{ vorhanden: boolean; rows: PortfolioPositionMitNotiz[] }> {
  try {
    const raw = await fs.readFile(DATEIPFAD, 'utf8')
    const j = JSON.parse(raw) as { positionen?: unknown }
    const arr = Array.isArray(j.positionen) ? j.positionen.filter(istPortfolioZeile) : []
    return { vorhanden: true, rows: arr }
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as NodeJS.ErrnoException).code : ''
    if (code === 'ENOENT') return { vorhanden: false, rows: [] }
    console.error('Portfolio-Datei: Lesen', e)
    return { vorhanden: false, rows: [] }
  }
}

async function schreibeDateiPortfolio(rows: PortfolioPositionMitNotiz[]): Promise<void> {
  await fs.mkdir(path.dirname(DATEIPFAD), { recursive: true })
  await fs.writeFile(DATEIPFAD, `${JSON.stringify({ positionen: rows }, null, 2)}\n`, 'utf8')
}

/** Aufgelöste Liste für Kurse/News plus Hinweis, ob noch die eingebaute Standardliste aktiv ist. */
export async function ladePortfolioKomplett(): Promise<PortfolioKomplett> {
  if (istSupabaseClientKonfiguriert()) {
    const cloud = await ladePortfolioStateAusCloud()
    if (!cloud.ok) {
      console.error(cloud.message)
      const std = standardPortfolioPositionenMitMeta()
      return { positionen: std, verwendetStandardliste: true }
    }
    if (!cloud.nutzerlisteAktiv) {
      return { positionen: standardPortfolioPositionenMitMeta(), verwendetStandardliste: true }
    }
    return { positionen: cloud.rows, verwendetStandardliste: false }
  }

  const datei = await leseDateiPortfolio()
  if (!datei.vorhanden) {
    return { positionen: standardPortfolioPositionenMitMeta(), verwendetStandardliste: true }
  }
  return { positionen: datei.rows, verwendetStandardliste: false }
}

export async function speicherePortfolioPositionen(
  rows: PortfolioPositionMitNotiz[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (istSupabaseClientKonfiguriert()) {
    return speicherePortfolioInCloud(rows)
  }
  try {
    await schreibeDateiPortfolio(rows)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Portfolio konnte nicht geschrieben werden.'
    return { ok: false, message: msg }
  }
}
