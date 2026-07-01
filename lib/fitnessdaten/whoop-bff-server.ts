/** WHOOP interne BFF-API — gleiche Werte wie in der WHOOP-App (Server only). */

import type {
  WhoopBffDailyRow,
  WhoopBffMonthlyAvgs,
  WhoopBffSyncPayload,
} from '@/lib/fitnessdaten/whoop-cloud-types'
import {
  heuteIsoInZeitzone,
  isoAddDaysKalender,
  trendTageAusEndDatum,
} from '@/lib/fitnessdaten/iso-date'

const BFF_BASE = 'https://api.prod.whoop.com'

const TREND_METRICS = [
  'STEPS',
  'CALORIES',
  'RHR',
  'AVERAGE_HR',
  'HRV',
  'RESPIRATORY_RATE',
  'VO2_MAX',
] as const

type TrendMetric = (typeof TREND_METRICS)[number]

const MONTHS: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  MÄR: 2,
  APR: 3,
  MAI: 4,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OKT: 9,
  OCT: 9,
  NOV: 10,
  DEZ: 11,
  DEC: 11,
}

export function parseWhoopNumber(label: string | null | undefined): number | null {
  if (!label) return null
  let s = label.replace(/%/g, '').trim()
  if (/^\d+:\d{2}$/.test(s)) return null
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '')
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function heuteIso(endDate?: string): string {
  return endDate ?? heuteIsoInZeitzone()
}

function isoVorTagen(tage: number, endDate: string): string {
  return isoAddDaysKalender(endDate, -tage)
}

function parseContextDate(display: string, refIso: string): string | null {
  if (!display) return null

  const deMatch = display.match(/(\d{1,2})\.\s*([A-ZÄÖÜ]{3,4})\.?/i)
  if (deMatch) {
    const day = parseInt(deMatch[1], 10)
    const monKey = deMatch[2].slice(0, 3).toUpperCase().replace('Ä', 'A')
    const month = MONTHS[monKey]
    if (month != null && Number.isFinite(day)) {
      const ref = new Date(refIso + 'T12:00:00')
      let year = ref.getFullYear()
      const refMonth = ref.getMonth()
      if (month > refMonth + 2) year -= 1
      if (month < refMonth - 10) year += 1
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  const enMatch = display.match(/([A-Z]{3,9})\s+(\d{1,2})/i)
  if (!enMatch) return null
  const monKey = enMatch[1].slice(0, 3).toUpperCase()
  const day = parseInt(enMatch[2], 10)
  const month = MONTHS[monKey]
  if (month == null || !Number.isFinite(day)) return null
  const ref = new Date(refIso + 'T12:00:00')
  let year = ref.getFullYear()
  const refMonth = ref.getMonth()
  if (month > refMonth + 2) year -= 1
  if (month < refMonth - 10) year += 1
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

type RawPoint = { date: string | null; value: number; x: number }

function extrahiereGraphPunkte(segment: unknown, endDate: string): { date: string; value: number }[] {
  if (!segment || typeof segment !== 'object') return []
  const graph = (segment as { graph?: { plots?: unknown[] } }).graph
  const plots = graph?.plots ?? []
  const raw: RawPoint[] = []

  for (const plotWrap of plots) {
    const plot = (plotWrap as { plot?: Record<string, unknown> })?.plot
    if (!plot) continue

    const segments = (plot.segments as { points?: unknown[] }[]) ?? []
    for (const seg of segments) {
      for (const pt of seg.points ?? []) {
        const p = pt as {
          data_scrubber_details?: { primary_contextual_display?: string; value_display?: string }
          graph_label?: { label?: string }
          position_x?: number
        }
        const val = parseWhoopNumber(
          p.data_scrubber_details?.value_display ?? p.graph_label?.label,
        )
        if (val == null) continue
        raw.push({
          date: parseContextDate(p.data_scrubber_details?.primary_contextual_display ?? '', endDate),
          value: val,
          x: p.position_x ?? raw.length,
        })
      }
    }

    const barGroups = (plot.bar_groups as unknown[]) ?? []
    for (const bg of barGroups) {
      const b = bg as {
        top_label?: { label?: string }
        position_x?: number
        data_scrubber_details?: { primary_contextual_display?: string }
        bottom_label?: { label?: string }
      }
      const val = parseWhoopNumber(b.top_label?.label)
      if (val == null) continue
      raw.push({
        date: parseContextDate(
          b.data_scrubber_details?.primary_contextual_display ?? b.bottom_label?.label ?? '',
          endDate,
        ),
        value: val,
        x: b.position_x ?? raw.length,
      })
    }
  }

  if (raw.length === 0) return []
  return trendTageAusEndDatum(
    raw.map((r) => ({ value: r.value, x: r.x })),
    endDate,
  )
}

function segmentAvg(segment: unknown): number | null {
  if (!segment || typeof segment !== 'object') return null
  const metrics = (segment as { metrics?: { current_metric_value?: number }[] }).metrics
  const v = metrics?.[0]?.current_metric_value
  return v != null && Number.isFinite(v) ? Math.round(v * 10) / 10 : null
}

async function fetchBffJson(accessToken: string, path: string): Promise<{ data: unknown | null; status: number }> {
  const res = await fetch(`${BFF_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Accept-Language': 'de-DE',
    },
  })
  if (!res.ok) return { data: null, status: res.status }
  try {
    return { data: await res.json(), status: res.status }
  } catch {
    return { data: null, status: res.status }
  }
}

async function ladeTrend(
  accessToken: string,
  metric: TrendMetric,
  endDate: string,
): Promise<{ daily: { date: string; value: number }[]; monthlyAvg: number | null; ok: boolean }> {
  const { data, status } = await fetchBffJson(
    accessToken,
    `/progression-service/v3/trends/${metric}?endDate=${endDate}`,
  )
  if (!data || typeof data !== 'object') return { daily: [], monthlyAvg: null, ok: status === 200 }

  const d = data as {
    month_time_segment?: unknown
    week_time_segment?: unknown
    six_month_time_segment?: unknown
  }
  const monthSeg = d.month_time_segment ?? d.week_time_segment
  const daily = extrahiereGraphPunkte(monthSeg, endDate)

  return {
    daily,
    monthlyAvg: segmentAvg(monthSeg),
    ok: status === 200 && (daily.length > 0 || segmentAvg(monthSeg) != null),
  }
}

/** Rekursiv im WHOOP-BFF-Baum nach `content.id` suchen. */
function findeKnotenMitId(root: unknown, id: string): Record<string, unknown> | null {
  if (!root || typeof root !== 'object') return null
  const o = root as Record<string, unknown>

  if (o.id === id) return o

  const content = o.content
  if (content && typeof content === 'object' && (content as { id?: string }).id === id) {
    return content as Record<string, unknown>
  }

  for (const key of ['sections', 'items', 'sub_items', 'subsections', 'pillars']) {
    const child = o[key]
    if (Array.isArray(child)) {
      for (const c of child) {
        const found = findeKnotenMitId(c, id)
        if (found) return found
      }
    } else if (child && typeof child === 'object') {
      const found = findeKnotenMitId(child, id)
      if (found) return found
    }
  }

  for (const v of Object.values(o)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const found = findeKnotenMitId(v, id)
      if (found) return found
    }
  }

  return null
}

function parseContributorMetric(
  tile: Record<string, unknown> | null,
  metricId: string,
): { status: number | null; baseline: number | null } {
  const metrics = tile?.metrics as { id?: string; status?: string; status_subtitle?: string }[] | undefined
  const m = metrics?.find((x) => x.id === metricId)
  if (!m) return { status: null, baseline: null }
  return {
    status: parseWhoopNumber(m.status),
    baseline: parseWhoopNumber(m.status_subtitle),
  }
}

async function ladeStrainDeepDive(
  accessToken: string,
  date: string,
): Promise<{ steps: number | null }> {
  const { data } = await fetchBffJson(accessToken, `/home-service/v1/deep-dive/strain?date=${date}`)
  if (!data || typeof data !== 'object') return { steps: null }
  const tile = findeKnotenMitId(data, 'STRAIN_CONTRIBUTORS_TILE')
  const steps = parseContributorMetric(tile, 'CONTRIBUTORS_TILE_STEPS').status
  return { steps: steps != null ? Math.round(steps) : null }
}

async function ladeRecoveryDeepDive(
  accessToken: string,
  date: string,
): Promise<{
  rhr: number | null
  hrv: number | null
  respiratory: number | null
  rhrBaseline: number | null
  hrvBaseline: number | null
  respiratoryBaseline: number | null
}> {
  const { data } = await fetchBffJson(accessToken, `/home-service/v1/deep-dive/recovery?date=${date}`)
  if (!data || typeof data !== 'object') {
    return {
      rhr: null,
      hrv: null,
      respiratory: null,
      rhrBaseline: null,
      hrvBaseline: null,
      respiratoryBaseline: null,
    }
  }
  const tile = findeKnotenMitId(data, 'RECOVERY_CONTRIBUTORS_TILE')
  const hrv = parseContributorMetric(tile, 'CONTRIBUTORS_TILE_HRV')
  const rhr = parseContributorMetric(tile, 'CONTRIBUTORS_TILE_RHR')
  const resp = parseContributorMetric(tile, 'CONTRIBUTORS_TILE_RESPIRATORY_RATE')
  return {
    hrv: hrv.status,
    hrvBaseline: hrv.baseline,
    rhr: rhr.status,
    rhrBaseline: rhr.baseline,
    respiratory: resp.status,
    respiratoryBaseline: resp.baseline,
  }
}

async function ladeSchritteHistorie(
  accessToken: string,
  endDate: string,
  tage = 35,
): Promise<{ date: string; steps: number }[]> {
  const out: { date: string; steps: number }[] = []
  for (let offset = 0; offset < tage; offset += 6) {
    const batch = Array.from({ length: Math.min(6, tage - offset) }, (_, i) =>
      isoVorTagen(offset + i, endDate),
    )
    const results = await Promise.all(batch.map((date) => ladeStrainDeepDive(accessToken, date)))
    batch.forEach((date, j) => {
      const steps = results[j]?.steps
      if (steps != null && steps > 0) out.push({ date, steps })
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

function mergeDailyRows(
  trends: Partial<Record<TrendMetric, { daily: { date: string; value: number }[] }>>,
  strainHistorie: { date: string; steps: number }[],
  strainToday: { steps: number | null },
  recoveryToday: Awaited<ReturnType<typeof ladeRecoveryDeepDive>>,
  endDate: string,
): WhoopBffDailyRow[] {
  const byDate = new Map<string, WhoopBffDailyRow>()

  const set = (date: string, patch: Partial<WhoopBffDailyRow>) => {
    const prev = byDate.get(date) ?? { date }
    byDate.set(date, { ...prev, ...patch, date })
  }

  for (const [metric, data] of Object.entries(trends) as [TrendMetric, { daily: { date: string; value: number }[] }][]) {
    for (const { date, value } of data?.daily ?? []) {
      switch (metric) {
        case 'STEPS':
          set(date, { steps: Math.round(value) })
          break
        case 'CALORIES':
          set(date, { calories: Math.round(value) })
          break
        case 'RHR':
          set(date, { restingHr: Math.round(value) })
          break
        case 'AVERAGE_HR':
          set(date, { avgHr: Math.round(value) })
          break
        case 'HRV':
          set(date, { hrvRmssd: Math.round(value * 10) / 10 })
          break
        case 'RESPIRATORY_RATE':
          set(date, { respiratoryRate: Math.round(value * 10) / 10 })
          break
        case 'VO2_MAX':
          set(date, { vo2Max: Math.round(value) })
          break
      }
    }
  }

  for (const { date, steps } of strainHistorie) {
    set(date, { steps })
  }

  const heute = endDate
  if (strainToday.steps != null) set(heute, { steps: strainToday.steps })
  if (recoveryToday.rhr != null) set(heute, { restingHr: Math.round(recoveryToday.rhr) })
  if (recoveryToday.hrv != null) set(heute, { hrvRmssd: Math.round(recoveryToday.hrv * 10) / 10 })
  if (recoveryToday.respiratory != null) {
    set(heute, { respiratoryRate: Math.round(recoveryToday.respiratory * 10) / 10 })
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export async function ladeWhoopBffSync(
  accessToken: string,
  endDate?: string,
): Promise<WhoopBffSyncPayload | null> {
  const tag = heuteIso(endDate)

  try {
    const trendResults = await Promise.all(
      TREND_METRICS.map(async (metric) => {
        const result = await ladeTrend(accessToken, metric, tag)
        return [metric, result] as const
      }),
    )

    const [strainHistorie, strainToday, recoveryToday] = await Promise.all([
      ladeSchritteHistorie(accessToken, tag, 35),
      ladeStrainDeepDive(accessToken, tag),
      ladeRecoveryDeepDive(accessToken, tag),
    ])

    const trendsOk = trendResults.filter(([, r]) => r.ok).length
    const hatSchritte = strainHistorie.length > 0 || strainToday.steps != null
    const hatTrendDaten = trendResults.some(([, r]) => r.daily.length > 0)

    if (!hatSchritte && !hatTrendDaten && trendsOk === 0) return null

    const trends: Partial<
      Record<TrendMetric, { daily: { date: string; value: number }[]; monthlyAvg: number | null }>
    > = {}
    const monthlyAvgs: WhoopBffMonthlyAvgs = {
      steps: null,
      calories: null,
      rhr: null,
      avgHr: null,
      hrv: null,
      respiratory: null,
      vo2Max: null,
    }

    for (const [metric, result] of trendResults) {
      trends[metric] = result
      const avg = result.monthlyAvg
      if (avg == null) continue
      switch (metric) {
        case 'STEPS':
          monthlyAvgs.steps = Math.round(avg)
          break
        case 'CALORIES':
          monthlyAvgs.calories = Math.round(avg)
          break
        case 'RHR':
          monthlyAvgs.rhr = Math.round(avg)
          break
        case 'AVERAGE_HR':
          monthlyAvgs.avgHr = Math.round(avg)
          break
        case 'HRV':
          monthlyAvgs.hrv = Math.round(avg)
          break
        case 'RESPIRATORY_RATE':
          monthlyAvgs.respiratory = Math.round(avg * 10) / 10
          break
        case 'VO2_MAX':
          monthlyAvgs.vo2Max = Math.round(avg)
          break
      }
    }

    if (recoveryToday.rhrBaseline != null) monthlyAvgs.rhr = Math.round(recoveryToday.rhrBaseline)
    if (recoveryToday.hrvBaseline != null) monthlyAvgs.hrv = Math.round(recoveryToday.hrvBaseline)
    if (recoveryToday.respiratoryBaseline != null) {
      monthlyAvgs.respiratory = Math.round(recoveryToday.respiratoryBaseline * 10) / 10
    }

    const daily = mergeDailyRows(trends, strainHistorie, strainToday, recoveryToday, tag)

    return {
      daily,
      monthlyAvgs,
      syncedAt: new Date().toISOString(),
      debug: {
        trendsOk,
        strainDays: strainHistorie.length,
        dailyRows: daily.length,
      },
    }
  } catch {
    return null
  }
}
