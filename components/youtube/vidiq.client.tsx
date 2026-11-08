'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { empfehlungenFuerShort, median, scoreFuerShort, tagZeichen, umstritteneWoerter, type ShortScore } from '@/lib/youtube/vidiq-engine'

type Seite = 'shorts' | 'optimieren' | 'keywords' | 'outlier' | 'konkurrenz' | 'audit'

type ShortZeile = {
  id: string
  titel: string
  beschreibung: string
  tags: string[]
  views: number
  likes: number
  comments: number
  veroeffentlicht: string
  thumbnail: string | null
  gesehenProzent: number | null
  score: ShortScore
  empfehlungen: { stufe: string; text: string }[]
}

type RechercheVideo = {
  id: string
  titel: string
  kanal: string
  views: number
  outlier: number | null
  tempoSeitUpload: number | null
  tempoDelta: number | null
}

type Recherche = {
  phrase: string
  begriffe: string[]
  fragen: string[]
  chance: number
  stufe: string
  videos: RechercheVideo[]
}

type Konkurrent = {
  eingabe: string
  kanal: { id: string; titel: string; abonnenten: number; letzteViews: number }
  videos: { id: string; titel: string; views: number; outlier: number | null; tempoSeitUpload: number | null }[]
}

const SEITEN: { id: Seite; label: string }[] = [
  { id: 'shorts', label: 'Meine Shorts' },
  { id: 'optimieren', label: 'Optimieren' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'outlier', label: 'Outlier' },
  { id: 'konkurrenz', label: 'Konkurrenz' },
  { id: 'audit', label: 'Audit' },
]

const KANAL_KEY = 'youtube-vidiq-kanaele'

function scoreFarbe(score: number): string {
  if (score < 20) return 'text-red-600'
  if (score < 40) return 'text-orange-500'
  if (score < 60) return 'text-amber-500'
  if (score < 80) return 'text-lime-600'
  return 'text-emerald-600'
}

function zahl(n: number): string {
  return new Intl.NumberFormat('de-DE').format(Math.round(n))
}

async function posten(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/youtube/vidiq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok || json.ok === false) {
    const error = new Error(String(json.error || 'Abruf fehlgeschlagen')) as Error & { reconnect?: boolean }
    error.reconnect = Boolean(json.brauchtReconnect)
    throw error
  }
  return json
}

export function VidiqClient({ onReconnect }: { onReconnect: () => void }) {
  const [seite, setSeite] = useState<Seite>('shorts')
  const [laedt, setLaedt] = useState(false)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [shorts, setShorts] = useState<ShortZeile[]>([])
  const [schnitt, setSchnitt] = useState<number | null>(null)
  const [aktiv, setAktiv] = useState<ShortZeile | null>(null)
  const [titel, setTitel] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [varianten, setVarianten] = useState<string[]>([])
  const [tagVorschlag, setTagVorschlag] = useState<string[]>([])
  const [phrase, setPhrase] = useState('')
  const [recherche, setRecherche] = useState<Recherche | null>(null)
  const [kanaele, setKanaele] = useState<string[]>([])
  const [konkurrenz, setKonkurrenz] = useState<Konkurrent[]>([])
  const [ideen, setIdeen] = useState<string[]>([])
  const [schreibenGesperrt, setSchreibenGesperrt] = useState(false)
  const [snippetBereit, setSnippetBereit] = useState(false)
  const [kanalEingabe, setKanalEingabe] = useState('')
  const offen = useRef<string | null>(null)

  useEffect(() => {
    try {
      const roh = JSON.parse(localStorage.getItem(KANAL_KEY) || '[]') as unknown
      if (Array.isArray(roh)) setKanaele(roh.map((x) => String(x)).filter(Boolean))
    } catch {
      /* leer */
    }
    void laden()
  }, [])

  function fehler(e: unknown) {
    const err = e as Error & { reconnect?: boolean }
    if (err.reconnect) {
      onReconnect()
      setSchreibenGesperrt(true)
    }
    setHinweis(err.message)
    toast.error(err.message)
  }

  async function laden() {
    setLaedt(true)
    setHinweis(null)
    try {
      const json = await posten({ action: 'liste' })
      setShorts((json.shorts as ShortZeile[]) ?? [])
      setSchnitt(typeof json.schnitt === 'number' ? json.schnitt : null)
      if (typeof json.verzug === 'string') setHinweis(json.verzug)
    } catch (e) {
      fehler(e)
    } finally {
      setLaedt(false)
    }
  }

  async function oeffne(short: ShortZeile) {
    offen.current = short.id
    setAktiv(short)
    setTitel(short.titel)
    setBeschreibung(short.beschreibung ?? '')
    setTagsText((short.tags ?? []).join(', '))
    setVarianten([])
    setTagVorschlag([])
    setSnippetBereit(false)
    setSeite('optimieren')
    try {
      const json = await posten({ action: 'snippet', videoId: short.id })
      if (offen.current !== short.id) return
      if (typeof json.titel === 'string') setTitel(json.titel)
      if (typeof json.beschreibung === 'string') setBeschreibung(json.beschreibung)
      if (Array.isArray(json.tags)) setTagsText(json.tags.map((t) => String(t)).join(', '))
      setSnippetBereit(true)
    } catch (e) {
      if (offen.current === short.id) fehler(e)
    }
  }

  const tags = useMemo(
    () => tagsText.split(',').map((t) => t.trim()).filter(Boolean),
    [tagsText],
  )

  const live = useMemo(() => {
    if (!aktiv) return null
    const andere = shorts.filter((s) => s.id !== aktiv.id).map((s) => s.views)
    return scoreFuerShort({
      titel,
      beschreibung,
      tags,
      views: aktiv.views,
      likes: aktiv.likes,
      comments: aktiv.comments,
      gesehenProzent: aktiv.gesehenProzent,
      vergleichsMedian: andere.length ? median(andere) : null,
    })
  }, [aktiv, titel, beschreibung, tags, shorts])

  const liveEmpfehlungen = useMemo(() => {
    if (!aktiv) return []
    return empfehlungenFuerShort({
      titel,
      beschreibung,
      tags,
      views: aktiv.views,
      likes: aktiv.likes,
      comments: aktiv.comments,
      gesehenProzent: aktiv.gesehenProzent,
    })
  }, [aktiv, titel, beschreibung, tags])

  const warnung = umstritteneWoerter(`${titel} ${tagsText}`)

  async function erzeugen(art: 'titel' | 'tags' | 'beschreibung') {
    setLaedt(true)
    try {
      const json = await posten({ action: 'texte', art, titel, beschreibung, tags })
      if (art === 'titel') setVarianten((json.titel as string[]) ?? [])
      if (art === 'tags') setTagVorschlag((json.tags as string[]) ?? [])
      if (art === 'beschreibung' && typeof json.beschreibung === 'string') setBeschreibung(json.beschreibung)
    } catch (e) {
      fehler(e)
    } finally {
      setLaedt(false)
    }
  }

  async function veroeffentlichen() {
    if (!aktiv) return
    const ok = window.confirm(`Titel, Beschreibung und Tags von „${aktiv.titel}“ werden auf YouTube ersetzt.`)
    if (!ok) return
    setLaedt(true)
    try {
      await posten({ action: 'update', videoId: aktiv.id, title: titel, description: beschreibung, tags })
      toast.success('Auf YouTube veröffentlicht.')
      await laden()
    } catch (e) {
      fehler(e)
    } finally {
      setLaedt(false)
    }
  }

  async function suche(ziel: 'keywords' | 'outlier') {
    if (!phrase.trim()) return
    setSeite(ziel)
    setLaedt(true)
    try {
      const json = await posten({ action: 'keywords', phrase })
      setRecherche({
        phrase: String(json.phrase ?? phrase),
        begriffe: (json.begriffe as string[]) ?? [],
        fragen: (json.fragen as string[]) ?? [],
        chance: Number(json.chance ?? 0),
        stufe: String(json.stufe ?? ''),
        videos: (json.videos as RechercheVideo[]) ?? [],
      })
    } catch (e) {
      fehler(e)
    } finally {
      setLaedt(false)
    }
  }

  function merkeKanal(liste: string[]) {
    setKanaele(liste)
    localStorage.setItem(KANAL_KEY, JSON.stringify(liste))
  }

  async function kanalLaden(eingabe: string) {
    setLaedt(true)
    try {
      const json = await posten({ action: 'konkurrent', eingabe })
      const kanal = json.kanal as Konkurrent['kanal']
      const zeile: Konkurrent = {
        eingabe,
        kanal,
        videos: (json.videos as Konkurrent['videos']) ?? [],
      }
      setKonkurrenz((alt) => [zeile, ...alt.filter((k) => k.kanal.id !== kanal.id)].slice(0, 8))
      if (!kanaele.includes(eingabe)) merkeKanal([eingabe, ...kanaele].slice(0, 12))
    } catch (e) {
      fehler(e)
    } finally {
      setLaedt(false)
    }
  }

  async function ideenLaden() {
    setLaedt(true)
    try {
      const json = await posten({
        action: 'ideen',
        begriffe: recherche?.begriffe ?? [],
        titel: (recherche?.videos ?? []).map((v) => v.titel),
      })
      setIdeen((json.ideen as string[]) ?? [])
    } catch (e) {
      fehler(e)
    } finally {
      setLaedt(false)
    }
  }

  const audit = useMemo(() => {
    const schwach = shorts.filter((s) => s.score.gesamt < 40).length
    const wenigTags = shorts.filter((s) => (s.tags?.length ?? 0) < 5).length
    const kurzerTitel = shorts.filter((s) => s.titel.trim().length < 40).length
    const wenigGesehen = shorts.filter((s) => s.gesehenProzent != null && s.gesehenProzent < 40).length
    return { schwach, wenigTags, kurzerTitel, wenigGesehen }
  }, [shorts])

  return (
    <section className="app-section-shell">
      <div className="grid gap-4 p-4 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col">
          {SEITEN.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeite(s.id)}
              className={`rounded-lg px-3 py-2 text-left text-sm ${
                seite === s.id ? 'bg-emerald-600 text-white' : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          {hinweis ? <p className="text-xs text-[var(--app-text-muted)]">{hinweis}</p> : null}
          {laedt ? <p className="text-sm text-[var(--app-text-muted)]">Lädt …</p> : null}

          {seite === 'shorts' ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold">Meine Shorts</h2>
                {schnitt != null ? <p className={`text-3xl font-semibold tabular-nums ${scoreFarbe(schnitt)}`}>{schnitt}</p> : null}
              </div>
              <p className="text-xs text-[var(--app-text-muted)]">Schwächste zuerst. Unter 20 rot, bis 39 orange, bis 59 gelb, bis 79 lind, ab 80 grün.</p>
              {shorts.map((s) => (
                <button key={s.id} type="button" onClick={() => oeffne(s)} className="flex w-full items-center gap-3 rounded-xl border border-[var(--app-border)] p-3 text-left">
                  <span className={`w-12 text-2xl font-semibold tabular-nums ${scoreFarbe(s.score.gesamt)}`}>{s.score.gesamt}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.titel}</span>
                    <span className="text-xs text-[var(--app-text-muted)]">
                      {zahl(s.views)} Views
                      {s.gesehenProzent != null ? ` · ${Math.round(s.gesehenProzent)} % gesehen` : ' · gesehener Anteil fehlt, Score ist nur SEO'}
                    </span>
                  </span>
                </button>
              ))}
              {!laedt && shorts.length === 0 ? <p className="text-sm text-[var(--app-text-muted)]">Keine Shorts geladen. YouTube verbinden und den Reiter neu öffnen.</p> : null}
            </div>
          ) : null}

          {seite === 'optimieren' ? (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">Optimieren</h2>
              {!aktiv ? <p className="text-sm text-[var(--app-text-muted)]">Zuerst einen Short in der Liste öffnen.</p> : null}
              {aktiv && live ? (
                <>
                  <div className="flex items-baseline gap-4">
                    <p className={`text-4xl font-semibold tabular-nums ${scoreFarbe(live.gesamt)}`}>{live.gesamt}</p>
                    <p className="text-xs text-[var(--app-text-muted)]">
                      SEO {live.seo}
                      {live.leistung == null ? ' · Leistung leer, weil der gesehene Anteil fehlt' : ` · Leistung ${live.leistung}`}
                    </p>
                  </div>
                  <label className="block text-xs text-[var(--app-text-muted)]">
                    Titel
                    <input value={titel} onChange={(e) => setTitel(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-transparent px-3 py-2 text-sm" />
                  </label>
                  <label className="block text-xs text-[var(--app-text-muted)]">
                    Beschreibung
                    <textarea value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-transparent px-3 py-2 text-sm" />
                  </label>
                  <label className="block text-xs text-[var(--app-text-muted)]">
                    Tags
                    <textarea value={tagsText} onChange={(e) => setTagsText(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-transparent px-3 py-2 text-sm" />
                  </label>
                  <p className="text-xs text-[var(--app-text-muted)]">{tagZeichen(tags)} / 500 Zeichen · {tags.length} / 30 Tags</p>
                  {warnung ? <p className="text-xs text-amber-600">Umstrittenes Wort: {warnung}</p> : null}
                  <ul className="space-y-1 text-xs text-[var(--app-text-muted)]">
                    {liveEmpfehlungen.map((e) => (
                      <li key={e.text}>{e.text}</li>
                    ))}
                    {live.teile.filter((t) => t.punkte < t.max).map((t) => (
                      <li key={t.name}>{t.name}: {t.punkte}/{t.max}</li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void erzeugen('titel')} className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm">Titel erzeugen</button>
                    <button type="button" onClick={() => void erzeugen('tags')} className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm">Tags erzeugen</button>
                    <button type="button" onClick={() => void erzeugen('beschreibung')} className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm">Beschreibung erzeugen</button>
                    <button type="button" disabled={schreibenGesperrt || !snippetBereit} onClick={() => void veroeffentlichen()} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-40">Auf YouTube veröffentlichen</button>
                  </div>
                  {schreibenGesperrt ? <p className="text-xs text-amber-600">YouTube erneut verbinden. Der bisherige Zugang darf bestehende Videos nicht ändern. Neue Shorts lassen sich weiter hochladen.</p> : <p className="text-xs text-[var(--app-text-muted)]">Einmal trennen und neu verbinden, damit bestehende Videos geändert werden dürfen. Der Upload neuer Shorts bleibt davon unabhängig.</p>}
                  {varianten.map((v) => (
                    <button key={v} type="button" onClick={() => setTitel(v)} className="block w-full rounded-lg border border-[var(--app-border)] px-3 py-2 text-left text-sm">
                      {v}
                    </button>
                  ))}
                  {tagVorschlag.length ? (
                    <button type="button" onClick={() => setTagsText(tagVorschlag.join(', '))} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-left text-sm">
                      Tags übernehmen: {tagVorschlag.join(', ')}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {seite === 'keywords' || seite === 'outlier' ? (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">{seite === 'keywords' ? 'Keywords' : 'Outlier'}</h2>
              <p className="text-xs text-[var(--app-text-muted)]">
                Chance ist eine Schätzung aus Suchvorschlägen und den Top 10, kein monatliches Suchvolumen. Eine Suche kostet 100 Quota-Einheiten und bleibt 12 Stunden im Cache.
              </p>
              <div className="flex gap-2">
                <input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="Begriff" className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-transparent px-3 py-2 text-sm" />
                <button type="button" onClick={() => void suche(seite)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white">Suchen</button>
              </div>
              {recherche && seite === 'keywords' ? (
                <div className="space-y-2 text-sm">
                  <p className={`text-3xl font-semibold tabular-nums ${scoreFarbe(recherche.chance)}`}>{recherche.chance} <span className="text-base font-medium">{recherche.stufe}</span></p>
                  <p>{recherche.begriffe.join(' · ')}</p>
                  <p className="text-[var(--app-text-muted)]">{recherche.fragen.join(' · ')}</p>
                </div>
              ) : null}
              {recherche && seite === 'outlier'
                ? recherche.videos.map((v) => (
                    <div key={v.id} className="rounded-xl border border-[var(--app-border)] p-3 text-sm">
                      <p className="font-medium">{v.titel}</p>
                      <p className="text-xs text-[var(--app-text-muted)]">
                        {v.kanal} · {zahl(v.views)} Views
                        {v.outlier != null ? ` · ${v.outlier.toFixed(1)}× gegen die letzten 10` : ''}
                        {v.tempoSeitUpload != null ? ` · ${zahl(v.tempoSeitUpload)} Views/Stunde seit Upload` : ''}
                        {v.tempoDelta != null ? ` · ${zahl(v.tempoDelta)} Views/Stunde seit dem letzten Abruf` : ''}
                      </p>
                    </div>
                  ))
                : null}
              <button type="button" onClick={() => void ideenLaden()} className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm">
                Fünf Short-Ideen
              </button>
              {ideen.map((idee) => (
                <p key={idee} className="text-sm">{idee}</p>
              ))}
            </div>
          ) : null}

          {seite === 'konkurrenz' ? (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">Konkurrenz</h2>
              <p className="text-xs text-[var(--app-text-muted)]">Kanäle bleiben in diesem Browser, nicht in der Datenbank.</p>
              <div className="flex gap-2">
                <input value={kanalEingabe} onChange={(e) => setKanalEingabe(e.target.value)} placeholder="@kanal oder Link" className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-transparent px-3 py-2 text-sm" />
                <button type="button" onClick={() => void kanalLaden(kanalEingabe)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white">Merken</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {kanaele.map((k) => (
                  <button key={k} type="button" onClick={() => void kanalLaden(k)} className="rounded-full border border-[var(--app-border)] px-3 py-1 text-xs">
                    {k}
                  </button>
                ))}
              </div>
              {konkurrenz.map((k) => (
                <div key={k.kanal.id} className="space-y-2 rounded-xl border border-[var(--app-border)] p-3">
                  <p className="text-sm font-medium">{k.kanal.titel}</p>
                  <p className="text-xs text-[var(--app-text-muted)]">{zahl(k.kanal.abonnenten)} Abos · mittlere Views der letzten Videos {zahl(k.kanal.letzteViews)}</p>
                  {k.videos.map((v) => (
                    <p key={v.id} className="text-xs">
                      {v.titel} · {zahl(v.views)}
                      {v.outlier != null ? ` · ${v.outlier.toFixed(1)}×` : ''}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ) : null}

          {seite === 'audit' ? (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">Kanal-Audit</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <AuditZahl label="Score unter 40" wert={audit.schwach} />
                <AuditZahl label="Weniger als 5 Tags" wert={audit.wenigTags} />
                <AuditZahl label="Titel unter 40 Zeichen" wert={audit.kurzerTitel} />
                <AuditZahl label="Unter 40 % gesehen" wert={audit.wenigGesehen} />
              </div>
              <p className="text-xs text-[var(--app-text-muted)]">Gezählt über die geladenen eigenen Shorts. Der gesehene Anteil kommt 1–2 Tage später.</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function AuditZahl({ label, wert }: { label: string; wert: number }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] p-3">
      <p className="text-2xl font-semibold tabular-nums">{wert}</p>
      <p className="text-xs text-[var(--app-text-muted)]">{label}</p>
    </div>
  )
}
