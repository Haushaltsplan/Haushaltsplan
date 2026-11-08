'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { firmenKurzname } from '@/lib/youtube/youtube-keywords'
import {
  beschreibungEntwurf,
  empfohleneTags,
  fuenfTitel,
  hashtagsFuer,
  paketText,
  seoCheckliste,
  tagGruppen,
  tagZeichen,
  type VidiqVideo,
} from '@/lib/youtube/vidiq-engine'

type Nische = {
  haupt: string
  begriffe: string[]
  fragen: string[]
  nachfrage: number
  wettbewerb: number
  chance: number
  stufe: string
  videos: VidiqVideo[]
  luecken: string[]
  ausCache?: boolean
}

type Analytics = {
  verzug: string
  shorts: {
    views: number
    engagedViews: number
    averageViewDuration: number
    averageViewPercentage: number
    likes: number
    comments: number
    shares: number
    subscribersGained: number
    subscribersLost: number
    minutes: number
  }
  quellen: { quelle: string; views: number }[]
  laender: { land: string; views: number }[]
  halte: { bei: number; quote: number }[] | null
  videoId: string | null
  nichtVerfuegbar: string[]
  ausCache?: boolean
}

const SPEICHER = 'youtube-vidiq-paket:'

function zahl(n: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n)
}

function sekunden(n: number): string {
  if (!n) return '—'
  return `${Math.round(n)} s`
}

export function YoutubeVidiq({
  ticker,
  firmenname,
  isin,
  hook,
  kicker,
  metricValue,
  metricLabel,
  verdict,
  score,
  suchphrasen,
  titel,
  beschreibung,
  tags,
  videoId,
  onTitel,
  onBeschreibung,
  onTags,
  onReconnect,
}: {
  ticker: string
  firmenname: string
  isin: string | null
  hook: string
  kicker: string
  metricValue: string
  metricLabel: string
  verdict: string
  score: number
  suchphrasen: string[]
  titel: string
  beschreibung: string
  tags: string[]
  videoId: string | null
  onTitel: (wert: string) => void
  onBeschreibung: (wert: string) => void
  onTags: (tags: string[]) => void
  onReconnect: () => void
}) {
  const haupt = firmenKurzname(firmenname) || ticker
  const gruppen = useMemo(
    () => tagGruppen({ ticker, firmenname, metricLabel, suchphrasen, isin }),
    [ticker, firmenname, metricLabel, suchphrasen, isin],
  )
  const empf = useMemo(() => empfohleneTags(gruppen), [gruppen])
  const zeichen = tagZeichen(empf)
  const titelListe = useMemo(
    () => fuenfTitel({ ticker, firmenname, hook, kicker, metricValue, metricLabel }),
    [ticker, firmenname, hook, kicker, metricValue, metricLabel],
  )
  const entwurf = useMemo(
    () => beschreibungEntwurf({ hook, firmenname, ticker, metricValue, metricLabel }),
    [hook, firmenname, ticker, metricValue, metricLabel],
  )
  const hashes = useMemo(() => hashtagsFuer(ticker, firmenname), [ticker, firmenname])
  const seo = useMemo(() => seoCheckliste({ titel, beschreibung, tags, haupt }), [titel, beschreibung, tags, haupt])

  const [nische, setNische] = useState<Nische | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [inspekt, setInspekt] = useState<{ video: VidiqVideo; kanal: { abonnenten: number; letzteViews: number | null; abstandTage: number | null; letzterUpload: string } } | null>(null)
  const [link, setLink] = useState('')
  const [laedt, setLaedt] = useState<string | null>(null)
  const [ranking, setRanking] = useState<string | null>(null)

  async function posten(action: string, extra: Record<string, unknown>) {
    const res = await fetch('/api/youtube/vidiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    const json = (await res.json()) as { ok?: boolean; error?: string; brauchtReconnect?: boolean }
    if (json.brauchtReconnect) onReconnect()
    if (!res.ok || json.ok === false) throw new Error(json.error || 'Abruf fehlgeschlagen')
    return json
  }

  async function nischeLaden() {
    setLaedt('nische')
    try {
      const json = (await posten('nische', { ticker, firmenname, hook })) as Nische & { ok: boolean }
      setNische(json)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nische fehlgeschlagen')
    } finally {
      setLaedt(null)
    }
  }

  async function videoLaden() {
    setLaedt('video')
    try {
      const json = (await posten('video', { video: link })) as {
        video: VidiqVideo
        kanal: { abonnenten: number; letzteViews: number | null; abstandTage: number | null; letzterUpload: string }
      }
      setInspekt({ video: json.video, kanal: json.kanal })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Video nicht lesbar')
    } finally {
      setLaedt(null)
    }
  }

  async function analyticsLaden() {
    setLaedt('analytics')
    try {
      setAnalytics((await posten('analytics', {})) as Analytics)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Auswertung fehlgeschlagen')
    } finally {
      setLaedt(null)
    }
  }

  async function rankingPruefen() {
    if (!videoId) {
      toast.error('Erst hochladen, dann das Ranking prüfen.')
      return
    }
    setLaedt('ranking')
    try {
      const json = (await posten('ranking', { videoId, phrase: nische?.haupt || `${haupt} moat` })) as { platz: number | null }
      setRanking(json.platz ? `Platz ${json.platz} in den Shorts der letzten 30 Tage` : 'Nicht in den Top 10 dieser Phrase')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ranking fehlgeschlagen')
    } finally {
      setLaedt(null)
    }
  }

  function paketKopieren() {
    const text = paketText({ titel, beschreibung, tags, hashtags: hashes })
    void navigator.clipboard.writeText(text).then(
      () => toast.success('Paket kopiert'),
      () => toast.error('Kopieren fehlgeschlagen.'),
    )
  }

  function merken() {
    localStorage.setItem(`${SPEICHER}${ticker}`, JSON.stringify({ titel, beschreibung, tags }))
    toast.success(`Für ${ticker} gemerkt`)
  }

  function laden() {
    const roh = localStorage.getItem(`${SPEICHER}${ticker}`)
    if (!roh) {
      toast.error(`Für ${ticker} ist nichts gespeichert.`)
      return
    }
    try {
      const paket = JSON.parse(roh) as { titel?: string; beschreibung?: string; tags?: string[] }
      if (paket.titel) onTitel(paket.titel)
      if (paket.beschreibung) onBeschreibung(paket.beschreibung)
      if (paket.tags?.length) onTags(paket.tags)
      toast.success(`Paket für ${ticker} geladen`)
    } catch {
      toast.error('Das gespeicherte Paket ist beschädigt.')
    }
  }

  const urteil = verdict === 'wide' ? 'Wide moat' : verdict === 'narrow' ? 'Narrow moat' : 'No moat'

  return (
    <section className="app-section-shell border-neutral-800 bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-300">VidIQ</h2>
        <span className="font-mono text-[10px] text-neutral-500">{ticker}</span>
      </div>
      <div className="space-y-4 px-4 py-3 text-neutral-200">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={paketKopieren} className="rounded-full border border-neutral-800 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-200 hover:border-neutral-600">
            Paket kopieren
          </button>
          <button type="button" onClick={merken} className="rounded-full border border-neutral-800 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-200 hover:border-neutral-600">
            Für diesen Ticker merken
          </button>
          <button type="button" onClick={laden} className="rounded-full border border-neutral-800 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-200 hover:border-neutral-600">
            Gemerkte laden
          </button>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Feed</p>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {[kicker || 'Hook', metricValue, `${urteil} ${score.toFixed(1)}`].map((zeile) => (
              <div key={zeile} className="flex h-16 items-center justify-center rounded-md bg-black px-1 text-center font-mono text-[10px] text-white">
                {zeile}
              </div>
            ))}
          </div>
          <p className="mt-2 line-clamp-2 text-xs text-neutral-100">{titel || 'Titel fehlt'}</p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Titel</p>
            <span className="font-mono text-[10px] text-cyan-300">SEO {seo.score}</span>
          </div>
          <ul className="mt-2 space-y-1">
            {titelListe.map((t) => (
              <li key={t.text}>
                <button type="button" onClick={() => onTitel(t.text)} className="flex w-full items-start justify-between gap-2 rounded-lg border border-neutral-800 px-2 py-1.5 text-left hover:border-emerald-400/50">
                  <span className="text-xs text-neutral-100">{t.text}</span>
                  <span className="shrink-0 font-mono text-[10px] text-emerald-300">{t.score}</span>
                </button>
              </li>
            ))}
          </ul>
          <ul className="mt-2 space-y-0.5">
            {seo.punkte.map((p) => (
              <li key={p.id} className={`font-mono text-[10px] ${p.ok ? 'text-emerald-300' : 'text-amber-300'}`}>
                {p.ok ? 'OK' : 'Offen'} · {p.label}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onBeschreibung(entwurf)} className="mt-2 font-mono text-[10px] uppercase tracking-wider text-cyan-300">
            Beschreibungsentwurf übernehmen
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Tags</p>
            <span className={`font-mono text-[10px] ${zeichen <= 500 ? 'text-emerald-300' : 'text-red-400'}`}>{zeichen}/500</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-800">
            <div className={`h-full ${zeichen <= 500 ? 'bg-emerald-400' : 'bg-red-500'}`} style={{ width: `${Math.min(100, (zeichen / 500) * 100)}%` }} />
          </div>
          {gruppen.map((g) => (
            <div key={g.gruppe} className="mt-2">
              <p className="font-mono text-[10px] text-neutral-500">{g.gruppe}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {g.tags.map((tag) => (
                  <button key={tag} type="button" onClick={() => onTags([tag])} className="rounded-full border border-neutral-800 px-2 py-0.5 font-mono text-[10px] text-neutral-300 hover:border-neutral-600">
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(empf.join(',')).then(() => toast.success('CSV kopiert'), () => toast.error('Kopieren fehlgeschlagen.'))}
              className="font-mono text-[10px] uppercase tracking-wider text-neutral-400"
            >
              CSV
            </button>
            <button type="button" onClick={() => onTags(empf)} className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">
              Empfohlene übernehmen
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Nische</p>
            <button type="button" disabled={laedt === 'nische'} onClick={() => void nischeLaden()} className="rounded-full border border-emerald-400/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-200 disabled:opacity-50">
              {laedt === 'nische' ? 'Lädt…' : 'Nische laden'}
            </button>
          </div>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-neutral-500">
            Chance aus Suchvorschlägen und den Top 10. Kein monatliches Suchvolumen.
          </p>
          {nische ? (
            <div className="mt-2 space-y-2">
              <p className="font-mono text-sm text-emerald-200">
                {nische.chance} · {nische.stufe}
              </p>
              <p className="font-mono text-[10px] text-neutral-400">
                Nachfrage {nische.nachfrage}/50 · Wettbewerb {nische.wettbewerb}/50
                {nische.ausCache ? ' · aus dem Cache' : ''}
              </p>
              {nische.fragen.length ? <p className="text-[11px] text-neutral-400">Fragen: {nische.fragen.slice(0, 4).join(' · ')}</p> : null}
              <ul className="space-y-1">
                {nische.videos.slice(0, 6).map((v) => (
                  <li key={v.id} className="rounded-lg border border-neutral-800 px-2 py-1">
                    <p className="line-clamp-2 text-[11px] text-neutral-100">{v.titel}</p>
                    <p className="font-mono text-[10px] text-neutral-500">
                      {zahl(v.views)} Views · {zahl(v.tempoSeitUpload)} /h seit Upload
                      {v.tempoDelta != null ? ` · ${zahl(v.tempoDelta)} /h seit letztem Stand` : ''}
                      {v.outlier != null ? ` · ${zahl(v.outlier)}×` : ''}
                    </p>
                  </li>
                ))}
              </ul>
              {nische.luecken.map((l) => (
                <p key={l} className="font-mono text-[10px] text-amber-200/80">{l}</p>
              ))}
            </div>
          ) : null}
          <button type="button" disabled={laedt === 'ranking'} onClick={() => void rankingPruefen()} className="mt-2 font-mono text-[10px] uppercase tracking-wider text-cyan-300 disabled:opacity-50">
            {laedt === 'ranking' ? 'Prüft…' : 'Eigenes Ranking prüfen'}
          </button>
          {ranking ? <p className="mt-1 font-mono text-[10px] text-neutral-300">{ranking}</p> : null}
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Video prüfen</p>
          <div className="mt-1 flex gap-1">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Short-Link oder Video-ID" className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-[11px]" />
            <button type="button" disabled={laedt === 'video'} onClick={() => void videoLaden()} className="rounded-lg border border-neutral-700 px-2 font-mono text-[10px] uppercase text-neutral-200 disabled:opacity-50">
              {laedt === 'video' ? '…' : 'Lesen'}
            </button>
          </div>
          {inspekt ? (
            <div className="mt-2 rounded-lg border border-neutral-800 p-2">
              <p className="text-[11px] text-neutral-100">{inspekt.video.titel}</p>
              <p className="mt-1 font-mono text-[10px] text-neutral-400">
                {zahl(inspekt.video.views)} Views · {zahl(inspekt.kanal.abonnenten)} Abos
                {inspekt.video.outlier != null ? ` · ${zahl(inspekt.video.outlier)}×` : ''}
                {inspekt.video.engagement != null ? ` · ${(inspekt.video.engagement * 100).toFixed(2)} % Reaktion` : ''}
              </p>
              <p className="font-mono text-[10px] text-neutral-500">
                {zahl(inspekt.video.tempoSeitUpload)} /h seit Upload
                {inspekt.kanal.abstandTage != null ? ` · Upload alle ${zahl(inspekt.kanal.abstandTage)} Tage` : ''}
              </p>
              <button type="button" onClick={() => onTags(inspekt.video.tags)} className="mt-1 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                Tags übernehmen
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-neutral-800 p-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Eigene Shorts</p>
            <button type="button" disabled={laedt === 'analytics'} onClick={() => void analyticsLaden()} className="rounded-full border border-cyan-400/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-200 disabled:opacity-50">
              {laedt === 'analytics' ? 'Lädt…' : 'Laden'}
            </button>
          </div>
          {analytics ? (
            <div className="mt-2 space-y-1 font-mono text-[10px] text-neutral-300">
              <p className="text-amber-200/90">{analytics.verzug}{analytics.ausCache ? ' · Cache' : ''}</p>
              <p>{zahl(analytics.shorts.views)} Views · {zahl(analytics.shorts.engagedViews)} engaged · {analytics.shorts.averageViewPercentage.toFixed(1)} % gesehen · {sekunden(analytics.shorts.averageViewDuration)}</p>
              <p>+{zahl(analytics.shorts.subscribersGained)} / −{zahl(analytics.shorts.subscribersLost)} Abos · {zahl(analytics.shorts.minutes)} Minuten</p>
              {analytics.quellen.slice(0, 5).map((q) => (
                <p key={q.quelle}>{q.quelle}: {zahl(q.views)}</p>
              ))}
              {analytics.laender.length ? <p>Länder: {analytics.laender.map((l) => `${l.land} ${zahl(l.views)}`).join(' · ')}</p> : null}
              {analytics.halte ? <p>Halt: {analytics.halte.map((h) => `${h.bei}% ${Math.round(h.quote * 100)}%`).join(' · ')}</p> : null}
              {analytics.nichtVerfuegbar.map((n) => (
                <p key={n} className="text-neutral-500">{n}: nicht verfügbar</p>
              ))}
            </div>
          ) : (
            <p className="mt-2 font-mono text-[10px] text-neutral-500">Nach dem erneuten Verbinden. Der Upload-Token allein reicht für Analytics nicht.</p>
          )}
        </div>
      </div>
    </section>
  )
}
