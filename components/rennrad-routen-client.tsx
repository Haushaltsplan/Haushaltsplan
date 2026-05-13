'use client'

import {
  PageChrome,
  PageHero,
  pageSectionHeaderClass,
  pageSectionPanelClass,
  pageSectionShellClass,
  pageSectionTitleClass,
} from '@/components/page-shell'
import { RennradHoehenprofil, type HoehenprofilPunkt } from '@/components/rennrad-hoehenprofil'
import dynamic from 'next/dynamic'
import { useCallback, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

const RennradRouteKarte = dynamic(
  () => import('@/components/rennrad-route-karte').then((m) => m.RennradRouteKarte),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(52vh,440px)] items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-500">
        Karte wird geladen …
      </div>
    ),
  },
)

type Treffer = { lat: number; lng: number; display_name: string }
type RoutenModus = 'runde' | 'strecke'

type RoutePreview = {
  id: string
  name: string
  distanceKm: number
  ascentM: number | null
  bundesstrasseHits: number
  unpavedHints: number
  stadtHits: number
  autobahnHits: number
  landstrasseHits: number
  wiederbesucheOrte?: number
  coords: Array<{ lat: number; lng: number }>
  ortsfolge?: string[]
  hoehenprofil?: HoehenprofilPunkt[] | null
}

export function RennradRoutenClient() {
  const [modus, setModus] = useState<RoutenModus>('runde')

  const [qStart, setQStart] = useState('')
  const [trStart, setTrStart] = useState<Treffer[]>([])
  const [start, setStart] = useState<Treffer | null>(null)

  const [qZiel, setQZiel] = useState('')
  const [trZiel, setTrZiel] = useState<Treffer[]>([])
  const [ziel, setZiel] = useState<Treffer | null>(null)

  const [zielKm, setZielKm] = useState('100')
  const [zielHm, setZielHm] = useState('')

  const [optBundes, setOptBundes] = useState(false)
  const [optBelag, setOptBelag] = useState(false)
  const [optStadt, setOptStadt] = useState(false)
  const [optLand, setOptLand] = useState(false)

  const [sucheBusy, setSucheBusy] = useState<'start' | 'ziel' | null>(null)
  const [planungBusy, setPlanungBusy] = useState(false)
  const [gpxBusy, setGpxBusy] = useState(false)

  const [routen, setRouten] = useState<RoutePreview[]>([])
  const [routeId, setRouteId] = useState<string | null>(null)
  const [hmHinweis, setHmHinweis] = useState<string | null>(null)

  const aktiveRoute = useMemo(
    () => routen.find((r) => r.id === routeId) || routen[0] || null,
    [routen, routeId],
  )

  const sucheOrt = useCallback(
    async (slot: 'start' | 'ziel') => {
      const q = slot === 'start' ? qStart.trim() : qZiel.trim()
      if (q.length < 2) {
        toast.error('Bitte mindestens zwei Zeichen eingeben.')
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
    [qStart, qZiel],
  )

  const modusWechseln = useCallback((m: RoutenModus) => {
    setModus(m)
    if (m === 'runde') {
      setZiel(null)
      setTrZiel([])
      setQZiel('')
    }
  }, [])

  const routeSuchen = useCallback(async () => {
    if (!start) {
      toast.error('Bitte einen Startort waehlen.')
      return
    }
    if (modus === 'strecke' && !ziel) {
      toast.error('Bitte einen Zielort waehlen (Streckenmodus).')
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
          ziel: modus === 'strecke' && ziel ? ziel : undefined,
          zielKm: km,
          zielHm: hmPayload,
          bundesstrassenMeiden: optBundes,
          nurBelagGeteert: optBelag,
          staedteMeiden: optStadt,
          landstrassenBevorzugen: optLand,
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
        toast.success(
          modus === 'strecke' ? `${list.length} Strecken-Vorschlag/-Vorschlaege.` : `${list.length} Rundkurs-Vorschlag/-Vorschlaege.`,
        )
      }
    } catch {
      toast.error('Netzwerkfehler bei der Routenplanung.')
    } finally {
      setPlanungBusy(false)
    }
  }, [start, ziel, zielKm, zielHm, modus, optBundes, optBelag, optStadt, optLand])

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
        title="Route planen"
        description={
          <>
            <strong className="font-semibold text-zinc-200">Rundkurs</strong>: Start, Ziel-Länge und optional HM — die
            App plant eine <strong className="font-semibold text-zinc-200">Dreiecksrunde</strong> (Start → Ecke A → Ecke
            B → Start), damit du nicht dieselbe Strecke hin und zurück fährst.{' '}
            <strong className="font-semibold text-zinc-200">Strecke</strong>: zusätzlich Zielort — Route von Start zum
            Ziel mit Umwegen, damit die Gesamtlänge zu deiner Vorgabe passt. Karte mit OpenStreetMap, Streckenführung aus
            OSRM-Schritten. <strong className="font-semibold text-zinc-200">Höhenmeter</strong>: bei Eingabe gilt{' '}
            <strong className="font-semibold text-zinc-200">±10 %</strong> zur Vorgabe (kein größeres Abweichen).
            Rennrad: <strong className="font-semibold text-zinc-200">Autobahn/BAB nie</strong> (StVO). GPX für Garmin wie gewohnt.
          </>
        }
      />

      <section className={pageSectionShellClass}>
        <div className={pageSectionHeaderClass}>
          <h2 className={pageSectionTitleClass}>Planungsparameter</h2>
        </div>
        <div className={pageSectionPanelClass}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => modusWechseln('runde')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                modus === 'runde'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/25'
                  : 'border border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              Rundkurs
            </button>
            <button
              type="button"
              onClick={() => modusWechseln('strecke')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                modus === 'strecke'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/25'
                  : 'border border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              Strecke (Start → Ziel)
            </button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <OrtSuchBlock
              titel="Start"
              q={qStart}
              setQ={setQStart}
              treffer={trStart}
              gewaehlt={start}
              onWaehlen={setStart}
              onSuchen={() => void sucheOrt('start')}
              sucheBusy={sucheBusy === 'start'}
            />
            {modus === 'strecke' ? (
              <OrtSuchBlock
                titel="Ziel"
                q={qZiel}
                setQ={setQZiel}
                treffer={trZiel}
                gewaehlt={ziel}
                onWaehlen={setZiel}
                onSuchen={() => void sucheOrt('ziel')}
                sucheBusy={sucheBusy === 'ziel'}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800/90 bg-slate-950/30 p-4 text-sm text-slate-500">
                Im Modus <span className="font-medium text-slate-400">Rundkurs</span> endet die Route wieder am
                Start. Für eine Strecke mit anderem Ende den Modus „Strecke“ wählen.
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
            <ZahlFeld
              label={modus === 'strecke' ? 'Ziel-Gesamtlänge (km)' : 'Ziel-Länge Rundkurs (km)'}
              hint="8–400"
              value={zielKm}
              onChange={setZielKm}
            />
            <ZahlFeld
              label="Ziel-Höhenmeter (optional)"
              hint="Leer = egal; sonst ±10 % zur Vorgabe"
              value={zielHm}
              onChange={setZielHm}
            />
          </div>

          <div className="mt-6 max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Weg (Checkboxen)</p>
            <p className="mt-1 text-xs text-slate-600">
              Filter nutzen OSRM-/OSM-Schrittnamen — keine Garantie. Rennrad: Autobahn/BAB werden nie genutzt.
            </p>
            <ul className="mt-3 space-y-2.5">
              <WegCheckbox
                checked={optBundes}
                onChange={setOptBundes}
                id="weg-bundes"
                label="Bundesstraßen meiden"
              />
              <WegCheckbox
                checked={optBelag}
                onChange={setOptBelag}
                id="weg-belag"
                label="Nur geteerte / gepflasterte Straßen (unbefestigt meiden)"
              />
              <WegCheckbox
                checked={optStadt}
                onChange={setOptStadt}
                id="weg-stadt"
                label="Städte meiden (Innenstadt, Zentrum, Hbf, …)"
              />
              <WegCheckbox
                checked={optLand}
                onChange={setOptLand}
                id="weg-land"
                label="Landstraßen bevorzugen (Autobahn-/A-Strecken schlechter bewerten)"
              />
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void routeSuchen()}
              disabled={planungBusy || !start || (modus === 'strecke' && !ziel)}
              className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-rose-950/30 transition hover:bg-rose-500 disabled:opacity-40"
            >
              {planungBusy ? 'Berechne …' : modus === 'strecke' ? 'Strecken vorschlagen' : 'Rundkurse vorschlagen'}
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
                        B-Straße: {r.bundesstrasseHits ?? 0} · unbefestigt: {r.unpavedHints ?? 0} · Stadt:{' '}
                        {r.stadtHits ?? 0} · BAB/A: {r.autobahnHits ?? 0} · Land/Kreis: {r.landstrasseHits ?? 0} ·
                        Wiederbesuche: {r.wiederbesucheOrte ?? 0}
                      </p>
                    </button>
                  )
                })}
              </div>
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/65">
                  <RennradRouteKarte key={aktiveRoute.id} coords={aktiveRoute.coords} />
                </div>
                <RennradHoehenprofil key={`${aktiveRoute.id}-prof`} profil={aktiveRoute.hoehenprofil} />
                <StreckenfolgePanel ortsfolge={aktiveRoute.ortsfolge} />
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

function WegCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <li className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-950 text-rose-600 focus:ring-rose-500/40"
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-snug text-slate-300">
        {label}
      </label>
    </li>
  )
}

function OrtSuchBlock({
  titel,
  q,
  setQ,
  treffer,
  gewaehlt,
  onWaehlen,
  onSuchen,
  sucheBusy,
}: {
  titel: string
  q: string
  setQ: (s: string) => void
  treffer: Treffer[]
  gewaehlt: Treffer | null
  onWaehlen: (t: Treffer | null) => void
  onSuchen: () => void
  sucheBusy: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titel}</p>
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

function StreckenfolgePanel({ ortsfolge }: { ortsfolge?: string[] }) {
  if (!ortsfolge?.length) {
    return (
      <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-3 text-xs text-slate-500">
        Keine Straßen-/Ortsnamen aus dem Routing — ggf. andere Variante wählen oder später erneut versuchen.
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 px-3 py-3 sm:px-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Streckenführung (OSRM / OSM)</p>
      <p className="mt-2 max-h-48 overflow-y-auto text-sm leading-relaxed text-slate-300">{ortsfolge.join(' → ')}</p>
    </div>
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
