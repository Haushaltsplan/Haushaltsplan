'use client'

import { useCallback, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

type Treffer = { lat: number; lng: number; display_name: string }
type PunktSlot = 'start' | 'via' | 'ziel'
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
  const [qVia, setQVia] = useState('')
  const [qZiel, setQZiel] = useState('')

  const [trStart, setTrStart] = useState<Treffer[]>([])
  const [trVia, setTrVia] = useState<Treffer[]>([])
  const [trZiel, setTrZiel] = useState<Treffer[]>([])

  const [start, setStart] = useState<Treffer | null>(null)
  const [via, setVia] = useState<Treffer | null>(null)
  const [ziel, setZiel] = useState<Treffer | null>(null)

  const [minKm, setMinKm] = useState('100')
  const [maxKm, setMaxKm] = useState('110')
  const [minHm, setMinHm] = useState('1500')
  const [maxHm, setMaxHm] = useState('2000')
  const [wegtyp, setWegtyp] = useState<Wegtyp>('beides')

  const [sucheBusy, setSucheBusy] = useState<PunktSlot | null>(null)
  const [planungBusy, setPlanungBusy] = useState(false)
  const [gpxBusy, setGpxBusy] = useState(false)

  const [routen, setRouten] = useState<RoutePreview[]>([])
  const [routeId, setRouteId] = useState<string | null>(null)
  const [hmHinweis, setHmHinweis] = useState<string | null>(null)

  const aktiveRoute = useMemo(
    () => routen.find((r) => r.id === routeId) || routen[0] || null,
    [routen, routeId],
  )

  const suche = useCallback(
    async (slot: PunktSlot) => {
      const q = slot === 'start' ? qStart.trim() : slot === 'via' ? qVia.trim() : qZiel.trim()
      if (q.length < 2) {
        toast.error('Bitte einen Ortsnamen eingeben.')
        return
      }
      setSucheBusy(slot)
      try {
        const res = await fetch(`/api/radroute/geocode?q=${encodeURIComponent(q)}`)
        const data = (await res.json()) as { treffer?: Treffer[]; error?: string }
        if (!res.ok || typeof data.error === 'string') {
          toast.error(data.error || 'Suche fehlgeschlagen.')
          return
        }
        const t = Array.isArray(data.treffer) ? data.treffer : []
        if (slot === 'start') {
          setTrStart(t)
          setStart(null)
        } else if (slot === 'via') {
          setTrVia(t)
          setVia(null)
        } else {
          setTrZiel(t)
          setZiel(null)
        }
        if (!t.length) toast('Keine Treffer.', { duration: 3000 })
      } catch {
        toast.error('Netzwerkfehler.')
      } finally {
        setSucheBusy(null)
      }
    },
    [qStart, qVia, qZiel],
  )

  const routeSuchen = useCallback(async () => {
    if (!start || !ziel) {
      toast.error('Start und Ziel auswaehlen.')
      return
    }
    const minKmNum = Number.parseFloat(minKm.replace(',', '.'))
    const maxKmNum = Number.parseFloat(maxKm.replace(',', '.'))
    const minHmNum = Number.parseFloat(minHm.replace(',', '.'))
    const maxHmNum = Number.parseFloat(maxHm.replace(',', '.'))
    if (!Number.isFinite(minKmNum) || !Number.isFinite(maxKmNum) || minKmNum <= 0 || maxKmNum < minKmNum) {
      toast.error('Kilometerbereich ungueltig.')
      return
    }
    if (!Number.isFinite(minHmNum) || !Number.isFinite(maxHmNum) || minHmNum < 0 || maxHmNum < minHmNum) {
      toast.error('Hoehenmeterbereich ungueltig.')
      return
    }

    setPlanungBusy(true)
    try {
      const res = await fetch('/api/radroute/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start,
          via,
          ziel,
          minKm: minKmNum,
          maxKm: maxKmNum,
          minHm: minHmNum,
          maxHm: maxHmNum,
          wegtyp,
        }),
      })
      const data = (await res.json()) as { routes?: RoutePreview[]; warnung?: string | null; hmHinweis?: string | null; error?: string }
      if (!res.ok || typeof data.error === 'string') {
        toast.error(data.error || 'Routenplanung fehlgeschlagen.')
        return
      }
      const list = Array.isArray(data.routes) ? data.routes : []
      setRouten(list)
      setRouteId(list[0]?.id ?? null)
      setHmHinweis(typeof data.hmHinweis === 'string' ? data.hmHinweis : null)
      if (list.length === 0) {
        toast.error(data.warnung || 'Keine passende Route gefunden.')
      } else {
        toast.success(`${list.length} Variante(n) gefunden.`)
      }
    } catch {
      toast.error('Netzwerkfehler bei der Routenplanung.')
    } finally {
      setPlanungBusy(false)
    }
  }, [start, via, ziel, minKm, maxKm, minHm, maxHm, wegtyp])

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
    <div className="space-y-10 animate-in fade-in duration-500">
      <header className="rounded-[2rem] border border-rose-900/40 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-xl shadow-black/35 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-400/90">Rennrad</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-100 sm:text-3xl">Routen planen</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Filterbare Routen mit <strong className="text-slate-300">km-Range</strong>, <strong className="text-slate-300">Hoehenmeter-Range</strong> und
          Wegtyp-Praeferenz. Danach GPX fuer Garmin Connect exportieren.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-6 shadow-lg shadow-black/20 sm:p-8">
        <h2 className="text-lg font-bold text-slate-100">Planungsparameter</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <PunktBlock titel="Start" q={qStart} setQ={setQStart} treffer={trStart} gewaehlt={start} onWaehlen={setStart} onSuchen={() => void suche('start')} sucheBusy={sucheBusy === 'start'} />
          <PunktBlock titel="Via (optional)" q={qVia} setQ={setQVia} treffer={trVia} gewaehlt={via} onWaehlen={setVia} onSuchen={() => void suche('via')} sucheBusy={sucheBusy === 'via'} optional />
          <PunktBlock titel="Ziel" q={qZiel} setQ={setQZiel} treffer={trZiel} gewaehlt={ziel} onWaehlen={setZiel} onSuchen={() => void suche('ziel')} sucheBusy={sucheBusy === 'ziel'} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ZahlFeld label="Min km" value={minKm} onChange={setMinKm} />
          <ZahlFeld label="Max km" value={maxKm} onChange={setMaxKm} />
          <ZahlFeld label="Min hm" value={minHm} onChange={setMinHm} />
          <ZahlFeld label="Max hm" value={maxHm} onChange={setMaxHm} />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Wegtyp</label>
          <select
            value={wegtyp}
            onChange={(e) => setWegtyp(e.target.value as Wegtyp)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-rose-500/30 sm:w-auto"
          >
            <option value="belag_bevorzugt">Nur geteerte Strassen bevorzugen</option>
            <option value="bundesstrasse_meiden">Bundesstrassen meiden</option>
            <option value="beides">Geteert bevorzugen + Bundesstrassen meiden</option>
          </select>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void routeSuchen()}
            disabled={planungBusy || !start || !ziel}
            className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-rose-950/30 transition hover:bg-rose-500 disabled:opacity-40"
          >
            {planungBusy ? 'Suche Routen …' : 'Routen berechnen'}
          </button>
          {hmHinweis ? <span className="text-xs text-slate-500">{hmHinweis}</span> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800/90 bg-slate-900/50 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-100">Routen-Vorschau</h2>
          <button
            type="button"
            onClick={() => void ladeGpx()}
            disabled={gpxBusy || !aktiveRoute}
            className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-cyan-950/30 transition hover:bg-cyan-500 disabled:opacity-40"
          >
            {gpxBusy ? 'Export …' : 'GPX herunterladen'}
          </button>
        </div>

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
                      Bundesstrassen: {r.bundesstrasseHits} · Unbefestigt-Hinweise: {r.unpavedHints}
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
          <p className="mt-4 text-sm text-slate-500">Noch keine Route berechnet.</p>
        )}
      </section>
    </div>
  )
}

function PunktBlock({
  titel,
  q,
  setQ,
  treffer,
  gewaehlt,
  onWaehlen,
  onSuchen,
  sucheBusy,
  optional,
}: {
  titel: string
  q: string
  setQ: (s: string) => void
  treffer: Treffer[]
  gewaehlt: Treffer | null
  onWaehlen: (t: Treffer | null) => void
  onSuchen: () => void
  sucheBusy: boolean
  optional?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {titel}
        {optional ? <span className="font-normal text-slate-600"> — optional</span> : null}
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onSuchen())}
          placeholder="Ort, PLZ …"
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500/30"
        />
        <button
          type="button"
          disabled={sucheBusy}
          onClick={onSuchen}
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
        >
          {sucheBusy ? '…' : 'Suchen'}
        </button>
      </div>
      {gewaehlt ? (
        <p className="mt-3 text-[12px] leading-snug text-emerald-300/90">
          ✓ {gewaehlt.display_name}
          <button type="button" className="ml-2 text-rose-400/90 underline" onClick={() => onWaehlen(null)}>
            aendern
          </button>
        </p>
      ) : treffer.length > 0 ? (
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-left">
          {treffer.map((t, i) => (
            <li key={`${t.lat},${t.lng},${i}`}>
              <button
                type="button"
                onClick={() => onWaehlen(t)}
                className="w-full rounded-lg border border-slate-800/90 bg-slate-900/80 px-2 py-1.5 text-left text-[11px] leading-snug text-slate-300 hover:border-rose-900/50 hover:bg-slate-800/80"
              >
                {t.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ZahlFeld({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</label>
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
