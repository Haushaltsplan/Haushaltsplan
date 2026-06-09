/** WHOOP interne BFF-API — gleiche Werte wie in der WHOOP-App (Server only). */

import type {
  WhoopBffDailyRow,
  WhoopBffMonthlyAvgs,
  WhoopBffSyncPayload,
} from '@/lib/fitnessdaten/whoop-cloud-types'

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
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
}

export function parseWhoopNumber(label: string | null | undefined): number | null {
  if (!label) return null
  const s = label.replace(/%/g, '').replace(/,/g, '').trim()
  if (/^\d+:\d{2}$/.test(s)) return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function heuteIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseContextDate(display: string, refIso: string): string | null {
  if (!display) return null
  const match = display.match(/([A-Z]{3,9})\s+(\d{1,2})/i)
  if (!match) return null
  const monKey = match[1].slice(0, 3).toUpperCase()
  const day = parseInt(match[2], 10)
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
      }
      const val = parseWhoopNumber(b.top_label?.label)
      if (val == null) continue
      raw.push({
        date: parseContextDate(b.data_scrubber_details?.primary_contextual_display ?? '', endDate),
        value: val,
        x: b.position_x ?? raw.length,
      })
    }
  }

  if (raw.length === 0) return []
  raw.sort((a, b) => a.x - b.x)

  const end = new Date(endDate + 'T12:00:00')
  return raw.map((r, i) => {
    const d = new Date(end)
    d.setDate(d.getDate() - (raw.length - 1 - i))
    return {
      date: r.date ?? d.toISOString().slice(0, 10),
      value: r.value,
    }
  })
}

function segmentAvg(segment: unknown): number | null {
  if (!segment || typeof segment !== 'object') return null
  const metrics = (segment as { metrics?: { current_metric_value?: number }[] }).metrics
  const v = metrics?.[0]?.current_metric_value
  return v != null && Number.isFinite(v) ? Math.round(v * 10) / 10 : null
}

async function fetchBffJson(accessToken: string, path: string): Promise<unknown | null> {
  const res = await fetch(`${BFF_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (res.status === 401 || res.status === 403) return null
  if (!res.ok) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function ladeTrend(
  accessToken: string,
  metric: TrendMetric,
  endDate: string,
): Promise<{ daily: { date: string; value: number }[]; monthlyAvg: number | null }> {
  const data = await fetchBffJson(
    accessToken,
    `/progression-service/v3/trends/${metric}?endDate=${endDate}`,
  )
  if (!data || typeof data !== 'object') return { daily: [], monthlyAvg: null }

  const monthSeg =
    (data as { month_time_segment?: unknown }).month_time_segment ??
    (data as { week_time_segment?: unknown }).week_time_segment

  return {
    daily: extrahiereGraphPunkte(monthSeg, endDate),
    monthlyAvg: segmentAvg(monthSeg),
  }
}

function findeContributorsTile(sections: unknown[], tileId: string): unknown | null {
  for (const section of sections) {
    const items = (section as { items?: unknown[] })?.items ?? []
    for (const item of items) {
      const content = (item as { content?: { id?: string } })?.content
      if (content?.id === tileId) return content
    }
  }
  return null
}

function parseContributorMetric(
  tile: unknown,
  metricId: string,
): { status: number | null; baseline: number | null } {
  const metrics = (tile as { metrics?: { id?: string; status?: string; status_subtitle?: string }[] })
    ?.metrics
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
  const data = await fetchBffJson(
    accessToken,
    `/home-service/v1/deep-dive/strain?date=${date}`,
  )
  if (!data || typeof data !== 'object') return { steps: null }
  const sections = (data as { sections?: unknown[] }).sections ?? []
  const tile = findeContributorsTile(sections, 'STRAIN_CONTRIBUTORS_TILE')
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
  const data = await fetchBffJson(
    accessToken,
    `/home-service/v1/deep-dive/recovery?date=${date}`,
  )
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
  const sections = (data as { sections?: unknown[] }).sections ?? []
  const tile = findeContributorsTile(sections, 'RECOVERY_CONTRIBUTORS_TILE')
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

function mergeDailyRows(
  trends: Partial<Record<TrendMetric, { daily: { date: string; value: number }[] }>>,
  strainToday: { steps: number | null },
  recoveryToday: ReturnType<typeof ladeRecoveryDeepDive> extends Promise<infer T> ? T : never,
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

  const heute = heuteIso()
  if (strainToday.steps != null) {
    set(heute, { steps: strainToday.steps })
  }
  if (recoveryToday.rhr != null) set(heute, { restingHr: Math.round(recoveryToday.rhr) })
  if (recoveryToday.hrv != null) set(heute, { hrvRmssd: Math.round(recoveryToday.hrv * 10) / 10 })
  if (recoveryToday.respiratory != null) {
    set(heute, { respiratoryRate: Math.round(recoveryToday.respiratory * 10) / 10 })
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export async function ladeWhoopBffSync(accessToken: string): Promise<WhoopBffSyncPayload | null> {
  const endDate = heuteIso()

  try {
    const trendResults = await Promise.all(
      TREND_METRICS.map(async (metric) => {
        const result = await ladeTrend(accessToken, metric, endDate)
        return [metric, result] as const
      }),
    )

    const anyData = trendResults.some(([, r]) => r.daily.length > 0 || r.monthlyAvg != null)
    if (!anyData) return null

    const [strainToday, recoveryToday] = await Promise.all([
      ladeStrainDeepDive(accessToken, endDate),
      ladeRecoveryDeepDive(accessToken, endDate),
    ])

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

    const daily = mergeDailyRows(trends, strainToday, recoveryToday)

    return { daily, monthlyAvgs, syncedAt: new Date().toISOString() }
  } catch {
    return null
  }
}
