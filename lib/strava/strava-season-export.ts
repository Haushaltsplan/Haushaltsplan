/** Strava — Saison-Review als druckbares HTML (Browser → PDF). */

import { istRadAktivitaet, leistungWatts, wattProKg } from '@/lib/strava/strava-auswertung'
import type { StravaExtendedAnalytics } from '@/lib/strava/strava-extended-analytics'
import type { StravaActivityRow, StravaAthleteProfile } from '@/lib/strava/strava-types'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildSeasonReviewHtml(
  activities: StravaActivityRow[],
  athlete: StravaAthleteProfile | null,
  analytics: StravaExtendedAnalytics,
): string {
  const name =
    [athlete?.firstname, athlete?.lastname].filter(Boolean).join(' ') || 'Athlet'
  const year = new Date().getFullYear()
  const rides = activities.filter(istRadAktivitaet)
  const km = Math.round(rides.reduce((s, a) => s + a.distance_m, 0) / 1000)
  const hm = Math.round(rides.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0))
  const tss = Math.round(rides.reduce((s, a) => s + (a.estimated_tss ?? 0), 0))
  const weight = athlete?.omnia_weight_kg ?? null

  const topRides = [...rides]
    .filter((a) => leistungWatts(a) != null && a.moving_time_s >= 20 * 60)
    .sort((a, b) => (leistungWatts(b) ?? 0) - (leistungWatts(a) ?? 0))
    .slice(0, 8)

  const goalRows = analytics.goals
    .map(
      (g) =>
        `<tr><td>${esc(g.label)}</td><td>${esc(g.detail ?? '')}</td><td>${Math.round(g.pct)}%</td></tr>`,
    )
    .join('')

  const prRows = analytics.progress.prTimeline
    .slice(0, 8)
    .map(
      (p) =>
        `<tr><td>${esc(p.label)}</td><td>${p.watts} W</td><td>${p.wkg != null ? p.wkg.toFixed(2) : '—'}</td><td>${esc(p.dateLabel)}</td></tr>`,
    )
    .join('')

  const rideRows = topRides
    .map((a) => {
      const w = leistungWatts(a)!
      const wkg = wattProKg(w, weight)
      return `<tr><td>${esc(a.start_date.slice(0, 10))}</td><td>${esc(a.name)}</td><td>${(a.distance_m / 1000).toFixed(1)} km</td><td>${w} W</td><td>${wkg != null ? wkg.toFixed(2) : '—'}</td><td>${a.estimated_tss != null ? Math.round(a.estimated_tss) : '—'}</td></tr>`
    })
    .join('')

  const form = analytics.currentForm
  const ctl = form?.ctl ?? '—'
  const atl = form?.atl ?? '—'
  const tsb = form?.tsb ?? '—'

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>Strava Saison-Review ${year}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; color: #111; margin: 24px; font-size: 12px; line-height: 1.45; }
    h1 { font-size: 22px; margin: 0 0 4px; color: #fc4c02; }
    h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 2px solid #fc4c02; padding-bottom: 4px; }
    .meta { color: #666; margin-bottom: 16px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
    .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
    .kpi strong { display: block; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
    th { font-size: 10px; text-transform: uppercase; color: #666; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>Strava Saison-Review ${year}</h1>
  <p class="meta">${esc(name)} · erstellt ${new Date().toLocaleDateString('de-DE')}</p>

  <div class="kpis">
    <div class="kpi"><span>Fahrten</span><strong>${rides.length}</strong></div>
    <div class="kpi"><span>Kilometer</span><strong>${km.toLocaleString('de-DE')}</strong></div>
    <div class="kpi"><span>Höhenmeter</span><strong>${hm.toLocaleString('de-DE')}</strong></div>
    <div class="kpi"><span>TSS gesamt</span><strong>${tss.toLocaleString('de-DE')}</strong></div>
  </div>

  <h2>Form (CTL / ATL / TSB)</h2>
  <p>CTL ${ctl} · ATL ${atl} · TSB ${tsb}${analytics.eftp ? ` · eFTP ${analytics.eftp} W` : ''}${athlete?.ftp ? ` · Strava FTP ${athlete.ftp} W` : ''}</p>

  ${goalRows ? `<h2>Saisonziele</h2><table><thead><tr><th>Ziel</th><th>Stand</th><th>%</th></tr></thead><tbody>${goalRows}</tbody></table>` : ''}

  ${prRows ? `<h2>Power-Rekorde</h2><table><thead><tr><th>Dauer</th><th>Watt</th><th>W/kg</th><th>Datum</th></tr></thead><tbody>${prRows}</tbody></table>` : ''}

  ${rideRows ? `<h2>Top-Fahrten (Ø Leistung)</h2><table><thead><tr><th>Datum</th><th>Name</th><th>Distanz</th><th>W</th><th>W/kg</th><th>TSS</th></tr></thead><tbody>${rideRows}</tbody></table>` : ''}

  <p class="meta" style="margin-top:24px">Powered by Strava · Mein Haushalt Athletic Analytics</p>
</body>
</html>`
}

export function printSeasonReview(
  activities: StravaActivityRow[],
  athlete: StravaAthleteProfile | null,
  analytics: StravaExtendedAnalytics,
): void {
  const html = buildSeasonReviewHtml(activities, athlete, analytics)
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}
