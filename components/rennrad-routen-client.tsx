'use client'

import {
  PageChrome,
  PageHero,
  pageSectionHeaderClass,
  pageSectionPanelClass,
  pageSectionShellClass,
  pageSectionTitleClass,
} from '@/components/page-shell'
import { useCallback, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

type Treffer = { lat: number; lng: number; display_name: string }
type Wegtyp = 'belag_bevorzugt' | 'bundesstrasse_meiden' | 'beides'
type RoutePreview = {
  id: string
  name: string
  distanceKm: number
  ascentM: number | null
  bundesstrasseHits: number
  unpavedHints: number
  coords: Array<{ lat: number; lng: number }>
}

export function RennradRoutenClient() {
  const [qStart, setQStart] = useState('')
  const [trStart, setTrStart] = useState<Treffer[]>([])
  const [start, setStart] = useState<Treffer | null>(null)

  const [zielKm, setZielKm] = useState('100')
  /** Leer = keine HM-Vorgabe (nur Länge + Wegtyp). */
  const [zielHm, setZielHm] = useState('')

  const [wegtyp, setWegtyp] = useState<Wegtyp>('beides')

  const [sucheBusy, setSucheBusy] = useState(false)
  const [planungBusy, setPlanungBusy] = useState(false)
  const [gpxBusy, setGpxBusy] = useState(false)

  const [routen, setRouten] = useState<RoutePreview[]>([])
  const [routeId, setRouteId] = useState<string | null>(null)
  const [hmHinweis, setHmHinweis] = useState<string | null>(null)

  const aktiveRoute = useMemo(
    () => routen.find((r) => r.id === routeId) || routen[0] || null,
    [routen, routeId],
  )

  const sucheStart = useCallback(async () => {
    const q = qStart.trim()
    if (q.length < 2) {
      toast.error('Bitte einen Ortsnamen eingeben.')
      return
    }
    setSucheBusy(true)
    try {
      const res = await fetch(`/api/radroute/geocode?q=${encodeURIComponent(q)}`)
      const data = (await res.json()) as { treffer?: Treffer[]; error?: string }
      if (!res.ok || typeof data.error === 'string') {
        toast.error(data.error || 'Suche fehlgeschlagen.')
        return
      }
      const t = Array.isArray(data.treffer) ? data.treffer : []
      setTrStart(t)
      setStart(null)
      if (!t.length) toast('Keine Treffer.', { duration: 3000 })
    } catch {
      toast.error('Netzwerkfehler.')
    } finally {
      setSucheBusy(false)
    }
  }, [qStart])

  const routeSuchen = useCallback(async () => {
    if (!start) {
      toast.error('Bitte einen Startort waehlen.')
      return
    }
    const km = Number.parseFloat(zielKm.replace(',', '.'))
    if (!Number.isFinite(km) || km < 8 || km > 400) {
      toast.error('Ziel-Laenge: realistisch zwischen 8 und 400 km.')
      return
    }

    let hmPayload = 0
    const hmTrim = zielHm.trim()
    if (hmTrim.length > 0) {
      const hm = Number.parseFloat(hmTrim.replace(',', '.'))
      if (!Number.isFinite(hm) || hm < 0) {
        toast.error('Hoehenmeter ungueltig oder Feld leer lassen.')
        return
      }
      if (hm > 0 && hm <= 50) {
        toast.error('Fuer HM-Vorgabe mindestens 51 hm eintragen, oder Feld leer lassen.')
        return
      }
      hmPayload = hm
    }

    setPlanungBusy(true)
    try {
      const res = await fetch('/api/radroute/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start,
          zielKm: km,
          zielHm: hmPayload,
          wegtyp,
        }),
      })
      const data = (await res.json()) as {
        routes?: RoutePreview[]
        warnung?: string | null
        hmHinweis?: string | null
        error?: string
      }
      if (!res.ok || typeof data.error === 'string') {
        toast.error(data.error || 'Routenplanung fehlgeschlagen.')
        return
      }
      const list = Array.isArray(data.routes) ? data.routes : []
      setRouten(list)
      setRouteId(list[0]?.id ?? null)
      setHmHinweis(typeof data.hmHinweis === 'string' ? data.hmHinweis : null)
      if (typeof data.warnung === 'string' && data.warnung.length > 0) {
        toast(data.warnung, { duration: 5000 })
      }
      if (list.length === 0) {
        toast.error('Keine passende Route gefunden.')
      } else {
        toast.success(`${list.length} Schleifen-Vorschlag/-Vorschlaege.`)
      }
    } catch {
      toast.error('Netzwerkfehler bei der Routenplanung.')
    } finally {
      setPlanungBusy(false)
    }
  }, [start, zielKm, zielHm, wegtyp])

  const ladeGpx = useCallback(async () => {
    if (!aktiveRoute) {
      toast.error('Bitte erst eine Route berechnen.')
      return
    }
    setGpxBusy(true)
    try {
      const res = await fetch('/api/radroute/gpx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackName: aktiveRoute.name,
          punkte: aktiveRoute.coords,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(err.error || 'GPX konnte nicht erstellt werden.')
        return
      }
      const blob = await res.blob()
      const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'omnia-rennroute.gpx'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
      toast.success('GPX heruntergeladen.')
    } catch {
      toast.error('Download fehlgeschlagen.')
    } finally {
      setGpxBusy(false)
    }
  }, [aktiveRoute])

  return (
    <PageChrome>
      <PageHero
        eyebrow="Rennrad"
        title="Rundstrecke planen"
        description={
          <>
            Du gibst nur <strong className="font-semibold text-zinc-200">Start</strong>,{' '}
            <strong className="font-semibold text-zinc-200">ungefähre Länge</strong> und optional{' '}
            <strong className="font-semibold text-zinc-200">Höhenmeter</strong> sowie den{' '}
            <strong className="font-semibold text-zinc-200">Wegtyp</strong> an — Omnia legt automatisch Schleifen
            (Start → Wendepunkt → Start) in mehreren Himmelsrichtungen und schlägt die bestpassenden vor. GPX für Garmin
            wie gewohnt exportieren. Toleranzen serverseitig etwa ±15 % km und ±35 % HM (wenn HM gesetzt).
          </>
        }
      />

      <section className={pageSectionShellClass}>
        <div className={pageSectionHeaderClass}>
          <h2 className={pageSectionTitleClass}>Planungsparameter</h2>
        </div>
        <div className={pageSectionPanelClass}>
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Start</p>
            <div className="mt-2 flex gap-2">
              <input
                type="search"
                value={qStart}
                onChange={(e) => setQStart(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void sucheStart())}
                placeholder="Ort, PLZ …"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500/30"
              />
              <button
                type="button"
                disabled={sucheBusy}
                onClick={() => void sucheStart()}
                className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
              >
                {sucheBusy ? '…' : 'Suchen'}
              </button>
            </div>
            {start ? (
              <p className="mt-3 text-[12px] leading-snug text-emerald-300/90">
                ✓ {start.display_name}
                <button type="button" className="ml-2 text-rose-400/90 underline" onClick={() => setStart(null)}>
                  ändern
                </button>
              </p>
            ) : trStart.length > 0 ? (
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-left">
                {trStart.map((t, i) => (
                  <li key={`${t.lat},${t.lng},${i}`}>
                    <button
                      type="button"
                      onClick={() => setStart(t)}
                      className="w-full rounded-lg border border-slate-800/90 bg-slate-900/80 px-2 py-1.5 text-left text-[11px] leading-snug text-slate-300 hover:border-rose-900/50 hover:bg-slate-800/80"
                    >
                      {t.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
            <ZahlFeld
              label="Ziel-Länge (km)"
              hint="8–400"
              value={zielKm}
              onChange={setZielKm}
            />
            <ZahlFeld
              label="Ziel-Höhenmeter (optional)"
              hint="Leer = egal; sonst z. B. 1200"
              value={zielHm}
              onChange={setZielHm}
            />
          </div>

          <div className="mt-4 lg:max-w-md">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Wegtyp</label>
            <select
              value={wegtyp}
              onChange={(e) => setWegtyp(e.target.value as Wegtyp)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-rose-500/30 sm:w-auto"
            >
              <option value="belag_bevorzugt">Nur geteerte Straßen bevorzugen</option>
              <option value="bundesstrasse_meiden">Bundesstraßen meiden</option>
              <option value="beides">Geteert bevorzugen + Bundesstraßen meiden</option>
            </select>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void routeSuchen()}
              disabled={planungBusy || !start}
              className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-rose-950/30 transition hover:bg-rose-500 disabled:opacity-40"
            >
              {planungBusy ? 'Berechne Schleifen …' : 'Schleifen vorschlagen'}
            </button>
            {hmHinweis ? <span className="max-w-xl text-xs text-zinc-500">{hmHinweis}</span> : null}
          </div>
        </div>
      </section>

      <section className={pageSectionShellClass}>
        <div className={`${pageSectionHeaderClass} flex flex-wrap items-center justify-between gap-3`}>
          <h2 className={pageSectionTitleClass}>Routen-Vorschau</h2>
          <button
            type="button"
            onClick={() => void ladeGpx()}
            disabled={gpxBusy || !aktiveRoute}
            className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-cyan-950/30 transition hover:bg-cyan-500 disabled:opacity-40"
          >
            {gpxBusy ? 'Export …' : 'GPX herunterladen'}
          </button>
        </div>

        <div className={pageSectionPanelClass}>
          {aktiveRoute ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_1.45fr]">
              <div className="space-y-3">
                {routen.map((r) => {
                  const active = r.id === aktiveRoute.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRouteId(r.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        active ? 'border-rose-700/70 bg-rose-950/20' : 'border-slate-800/90 bg-slate-950/40 hover:bg-slate-900/70'
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-100">{r.name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {r.distanceKm.toFixed(1)} km · {r.ascentM == null ? 'hm n/a' : `${r.ascentM} hm`}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Bundesstraßen: {r.bundesstrasseHits} · Unbefestigt-Hinweise: {r.unpavedHints}
                      </p>
                    </button>
                  )
                })}
              </div>
              <div className="rounded-xl border border-slate-800/90 bg-slate-950/65 p-3">
                <MiniMap coords={aktiveRoute.coords} />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">Noch keine Route berechnet.</p>
          )}
        </div>
      </section>
    </PageChrome>
  )
}

function ZahlFeld({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {hint ? <span className="ml-1.5 font-normal text-slate-600">({hint})</span> : null}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-rose-500/30"
      />
    </div>
  )
}

function MiniMap({ coords }: { coords: Array<{ lat: number; lng: number }> }) {
  const vb = 360
  const pad = 14
  if (coords.length < 2) {
    return <div className="text-sm text-slate-500">Keine Geometrie vorhanden.</div>
  }
  const lats = coords.map((c) => c.lat)
  const lngs = coords.map((c) => c.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const w = Math.max(0.0001, maxLng - minLng)
  const h = Math.max(0.0001, maxLat - minLat)
  const scale = Math.min((vb - pad * 2) / w, (vb - pad * 2) / h)
  const path = coords
    .map((p, i) => {
      const x = pad + (p.lng - minLng) * scale
      const y = vb - (pad + (p.lat - minLat) * scale)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const start = coords[0]
  const end = coords[coords.length - 1]
  const sx = pad + (start.lng - minLng) * scale
  const sy = vb - (pad + (start.lat - minLat) * scale)
  const ex = pad + (end.lng - minLng) * scale
  const ey = vb - (pad + (end.lat - minLat) * scale)

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} className="h-[380px] w-full rounded-lg bg-slate-950/80">
      <rect x="0" y="0" width={vb} height={vb} fill="#020617" />
      <path d={path} fill="none" stroke="#fb7185" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx} cy={sy} r="5.5" fill="#34d399" />
      <circle cx={ex} cy={ey} r="5.5" fill="#38bdf8" />
    </svg>
  )
}
