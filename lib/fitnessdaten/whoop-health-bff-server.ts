/** WHOOP Health-Tab / Gesundheitsmonitor BFF — inkl. Blutdruck (WHOOP Life). */

import type { WhoopHealthMonitorRow } from '@/lib/fitnessdaten/whoop-cloud-types'
import { parseWhoopNumber } from '@/lib/fitnessdaten/whoop-bff-server'

const BFF_BASE = 'https://api.prod.whoop.com'

export type { WhoopHealthMonitorRow }

function heuteIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function fetchBffJson(accessToken: string, path: string): Promise<unknown | null> {
  const res = await fetch(`${BFF_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Accept-Language': 'de-DE',
    },
  })
  if (!res.ok) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

function parseBpPair(text: string): { bpSystolic: number; bpDiastolic: number } | null {
  const m = text.match(/(\d{2,3})\s*[/\u2013-]\s*(\d{2,3})/)
  if (!m) return null
  const bpSystolic = parseInt(m[1], 10)
  const bpDiastolic = parseInt(m[2], 10)
  if (bpSystolic < 70 || bpSystolic > 250 || bpDiastolic < 40 || bpDiastolic > 150) return null
  return { bpSystolic, bpDiastolic }
}

function bpAusKnoten(o: Record<string, unknown>): { bpSystolic: number; bpDiastolic: number } | null {
  const id = String(o.id ?? '').toUpperCase()
  const title = String(o.title ?? o.label ?? '').toUpperCase()
  const istBp =
    id.includes('BLOOD_PRESSURE') ||
    id.includes('BLOOD PRESSURE') ||
    title.includes('BLUTDRUCK') ||
    title.includes('BLOOD PRESSURE')

  if (!istBp) return null

  for (const key of ['status', 'status_display', 'value_display', 'subtitle', 'status_subtitle', 'value']) {
    const raw = o[key]
    if (typeof raw === 'string') {
      const parsed = parseBpPair(raw)
      if (parsed) return parsed
    }
  }

  const sys = parseWhoopNumber(String(o.systolic ?? o.systolic_display ?? ''))
  const dia = parseWhoopNumber(String(o.diastolic ?? o.diastolic_display ?? ''))
  if (sys != null && dia != null && sys >= 70 && dia >= 40) {
    return { bpSystolic: Math.round(sys), bpDiastolic: Math.round(dia) }
  }

  return null
}

function findeBlutdruckImBaum(root: unknown, depth = 0): { bpSystolic: number; bpDiastolic: number } | null {
  if (depth > 24 || root == null) return null

  if (Array.isArray(root)) {
    for (const item of root) {
      const hit = findeBlutdruckImBaum(item, depth + 1)
      if (hit) return hit
    }
    return null
  }

  if (typeof root !== 'object') return null
  const o = root as Record<string, unknown>

  const direkt = bpAusKnoten(o)
  if (direkt) return direkt

  for (const v of Object.values(o)) {
    const hit = findeBlutdruckImBaum(v, depth + 1)
    if (hit) return hit
  }

  return null
}

/** Liest Blutdruck aus WHOOP-internen Health-BFFs (WHOOP Life / Health Monitor). */
export async function ladeWhoopHealthMonitorBff(accessToken: string): Promise<WhoopHealthMonitorRow | null> {
  const paths = ['/health-tab-bff/v1/health-tab', '/coaching-service/v1/health/bff/monitor']

  for (const path of paths) {
    const data = await fetchBffJson(accessToken, path)
    const bp = findeBlutdruckImBaum(data)
    if (bp) {
      return { date: heuteIso(), ...bp }
    }
  }

  return null
}
