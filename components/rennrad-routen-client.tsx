'use client'

import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'

type Treffer = { lat: number; lng: number; display_name: string }

type PunktSlot = 'start' | 'via' | 'ziel'

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

  const [sucheBusy, setSucheBusy] = useState<PunktSlot | null>(null)
  const [gpxBusy, setGpxBusy] = useState(false)

  const suche = useCallback(async (slot: PunktSlot) => {
    const q =
      slot === 'start' ? qStart.trim() : slot === 'via' ? qVia.trim() : qZiel.trim()
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
      if (!t.length) toast('Keine Treffer.', { duration: 3500 })
    } catch {
      toast.error('Netzwerkfehler.')
    } finally {
      setSucheBusy(null)
    }
  }, [qStart, qVia, qZiel])

  const ladeGpx = useCallback(async () => {
    if (!start || !ziel) {
      toast.error('Start und Ziel aus der Liste wählen.')
      return
    }
    const waypoints: Array<{ lat: number; lng: number }> = [start, ...(via ? [via] : []), ziel]
    const trackName =
      via != null
        ? `Route ${kurzOrt(start.display_name)} — ${kurzOrt(via.display_name)} — ${kurzOrt(ziel.display_name)}`
        : `Route ${kurzOrt(start.display_name)} — ${kurzOrt(ziel.display_name)}`

    setGpxBusy(true)
    try {
      const res = await fetch('/api/radroute/gpx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints, trackName }),
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
      toast.success('GPX heruntergeladen — in Garmin Connect importieren.')
    } catch {
      toast.error('Download fehlgeschlagen.')
    } finally {
      setGpxBusy(false)
    }
  }, [start, via, ziel])

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <header className="rounded-[2rem] border border-rose-900/40 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-xl shadow-black/35 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-400/90">Rennrad</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-100 sm:text-3xl">Routen planen</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          GPX für <strong className="text-slate-300">Garmin Connect</strong> erzeugen (OpenStreetMap-Routing). Climbfinder unten zum
          Entdecken von Anstiegen — dort gibt es <strong className="text-slate-300">keine öffentliche API</strong> für Dritt-Apps.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-6 shadow-lg shadow-black/20 sm:p-8">
        <h2 className="text-lg font-bold text-slate-100">GPX aus Start / Ziel (OSRM Rad)</h2>
        <p className="mt-1.5 text-xs text-slate-500">
          Orte suchen (OpenStreetMap Nominatim), Treffer anklicken, dann GPX laden. Routing über öffentlichen OSRM-Demo-Server —
          nicht für Massenabrufe geeignet.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <PunktBlock
            titel="Start"
            q={qStart}
            setQ={setQStart}
            treffer={trStart}
            gewaehlt={start}
            onWaehlen={setStart}
            onSuchen={() => void suche('start')}
            sucheBusy={sucheBusy === 'start'}
          />
          <PunktBlock
            titel="Zwischenstopp (optional)"
            q={qVia}
            setQ={setQVia}
            treffer={trVia}
            gewaehlt={via}
            onWaehlen={setVia}
            onSuchen={() => void suche('via')}
            sucheBusy={sucheBusy === 'via'}
            optional
          />
          <PunktBlock
            titel="Ziel"
            q={qZiel}
            setQ={setQZiel}
            treffer={trZiel}
            gewaehlt={ziel}
            onWaehlen={setZiel}
            onSuchen={() => void suche('ziel')}
            sucheBusy={sucheBusy === 'ziel'}
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={gpxBusy || !start || !ziel}
            onClick={() => void ladeGpx()}
            className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-rose-950/30 transition hover:bg-rose-500 disabled:opacity-40"
          >
            {gpxBusy ? 'Berechne …' : 'GPX herunterladen'}
          </button>
          {!start || !ziel ? (
            <span className="text-xs text-slate-500">Start und Ziel festlegen.</span>
          ) : (
            <span className="text-xs text-slate-500">
              {via ? '3 Wegpunkte' : '2 Wegpunkte'} · Strecke folgt dem Straßennetz (Rad)
            </span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800/90 bg-slate-900/40 p-6 sm:p-8">
        <h2 className="text-lg font-bold text-slate-100">Climbfinder — Anstiege finden</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          <a
            href="https://climbfinder.com/en/map"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-rose-300 underline decoration-rose-500/40 underline-offset-2 hover:text-rose-200"
          >
            climbfinder.com/map
          </a>{' '}
          zeigt bekannte Rampen und Profile. Für Streckenführung und Export nutzt du dort die Website/App — eine freie API für
          Einbindung in eigene Apps ist <strong className="text-slate-300">nicht dokumentiert</strong>. Nach Export einer GPX (falls
          angeboten) wie unten nach Garmin übernehmen.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800/90 bg-slate-900/40 p-6 sm:p-8">
        <h2 className="text-lg font-bold text-slate-100">GPX in Garmin Connect importieren</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-400">
          <li>GPX-Datei auf dem Computer oder Handy speichern.</li>
          <li>
            Garmin Connect Web:{' '}
            <a
              href="https://connect.garmin.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 underline-offset-2 hover:underline"
            >
              connect.garmin.com
            </a>{' '}
            → Training → Routen → Import bzw. App: „Training &amp; Planung“ → Routen → Import.
          </li>
          <li>Route auf der Uhr öffnen (modellabhängig: Sync, „Navigation“, Kurs laden).</li>
        </ol>
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
          <button
            type="button"
            className="ml-2 text-rose-400/90 underline"
            onClick={() => onWaehlen(null)}
          >
            ändern
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

function kurzOrt(display: string): string {
  const teil = display.split(',').slice(0, 2).join(', ')
  return teil.length > 48 ? `${teil.slice(0, 45)}…` : teil
}
