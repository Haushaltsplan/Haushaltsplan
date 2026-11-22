'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { HOOK_KATALOG } from '@/lib/youtube/longform/longform-abwechslung'
import type { LongformMusikTrack } from '@/lib/youtube/longform/longform-musik'
import { baueAnalyseProps } from '@/lib/youtube/longform/longform-props'
import { rendereAktienAnalyseImBrowser, rendereZusammenschnittImBrowser } from '@/lib/youtube/longform/longform-render-web'
import {
  LONGFORM_ABSCHNITTE,
  LONGFORM_ABSCHNITT_TITEL,
  type LongformAbschnitt,
  type LongformAbschnittId,
  type LongformFakt,
  type LongformHookVorschlag,
  type LongformProjekt,
  type LongformProjektKurz,
  type LongformProjektZustand,
  type LongformSatz,
} from '@/lib/youtube/longform/longform-types'
import { berechneLongTimeline } from '@/remotion/longform/long-timeline'
import { LONG_FPS } from '@/remotion/longform/long-types'
import { LF_FELD, LF_KNOPF, LF_KNOPF_PRIMAER, lfApi, type ZustandAntwort } from './longform-api'
import { LongformSatzEditor, StimmRegler } from './longform-satz.client'

const LongformVorschau = dynamic(() => import('./longform-vorschau.client'), { ssr: false })

type Schritt = 'start' | 'fakten' | 'hooks' | 'skript' | 'stimme' | 'vorschau'

const SCHRITTE: { id: Schritt; label: string }[] = [
  { id: 'start', label: '1 · Export' },
  { id: 'fakten', label: '2 · Fakten' },
  { id: 'hooks', label: '3 · Hook' },
  { id: 'skript', label: '4 · Skript' },
  { id: 'stimme', label: '5 · Stimme' },
  { id: 'vorschau', label: '6 · Video' },
]

const SCHLUSS_SZENEN = new Set(['abo_karte', 'disclaimer', 'schluss'])

/** Like, Disclaimer und Cheers nur am Fazit. Am Moat und davor haben sie nichts zu suchen. */
function ohneSchlussVorFazit(z: LongformProjektZustand): LongformProjektZustand {
  if (!z.skript) return z
  let weg = false
  const abschnitte = z.skript.abschnitte.map((a) => {
    if (a.id === 'fazit') return a
    const saetze = a.saetze.filter((s) => s.visual.fokus !== 'abo' && !SCHLUSS_SZENEN.has(s.visual.szene))
    if (saetze.length === a.saetze.length) return a
    weg = true
    return { ...a, saetze }
  })
  if (!weg) return z
  const ids = new Set(abschnitte.flatMap((a) => a.saetze.map((s) => s.id)))
  return {
    ...z,
    skript: { ...z.skript, abschnitte },
    stimme: { ...z.stimme, saetze: Object.fromEntries(Object.entries(z.stimme.saetze).filter(([k]) => ids.has(k))) },
    bilder: Object.fromEntries(Object.entries(z.bilder).filter(([k]) => ids.has(k))),
  }
}

function videoDauerMs(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      const ms = Math.round(v.duration * 1000)
      URL.revokeObjectURL(url)
      if (!Number.isFinite(ms) || ms < 500) reject(new Error('Länge der Datei nicht lesbar.'))
      else resolve(ms)
    }
    v.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Die Datei ist kein abspielbares Video.'))
    }
    v.src = url
  })
}

/** Frames im fertigen Film vor diesem Kapitel. Hochgeladene Datei zählt, sonst die Länge, die der Export hätte. */
function filmStartFuerKapitel(zustand: LongformProjektZustand, abschnittId: LongformAbschnittId, katalog: LongformMusikTrack[]): number | null {
  const skript = zustand.skript
  if (!skript) return null
  let frames = 0
  for (const id of LONGFORM_ABSCHNITTE) {
    if (id === abschnittId) return frames
    const datei = zustand.kapitelDateien?.[id]
    if (datei?.dauerMs) {
      frames += Math.round((datei.dauerMs / 1000) * LONG_FPS)
      continue
    }
    const abschnitt = skript.abschnitte.find((a) => a.id === id)
    if (!abschnitt?.saetze.length) return null
    const props = baueAnalyseProps({ ...zustand, skript: { ...skript, abschnitte: [abschnitt] } }, katalog)
    if (!props) return null
    frames += berechneLongTimeline(props).durationInFrames
  }
  return frames
}

function formatDauer(ms: number): string {
  const gesamt = Math.round(ms / 1000)
  return `${Math.floor(gesamt / 60)}:${String(gesamt % 60).padStart(2, '0')}`
}

function faktenNachGruppe(fakten: LongformFakt[]): { titel: string; items: LongformFakt[] }[] {
  const gruppen: { titel: string; prefix: string }[] = [
    { titel: '10.000 $', prefix: 'k10.' },
    { titel: 'Burggraben', prefix: 'moat.' },
    { titel: 'Scorecard', prefix: 'score.' },
    { titel: 'Unternehmen', prefix: 'firma.' },
  ]
  const rest: LongformFakt[] = []
  const out = gruppen.map((g) => {
    const items = fakten.filter((f) => f.id.startsWith(g.prefix))
    return { titel: g.titel, items }
  })
  for (const f of fakten) {
    if (!gruppen.some((g) => f.id.startsWith(g.prefix))) rest.push(f)
  }
  if (rest.length) out.push({ titel: 'Weitere', items: rest })
  return out.filter((g) => g.items.length)
}

export function LongformStudio() {
  const [projekte, setProjekte] = useState<LongformProjektKurz[]>([])
  const [projekt, setProjekt] = useState<LongformProjekt | null>(null)
  const [schritt, setSchritt] = useState<Schritt>('start')
  const [thema, setThema] = useState('')
  const [rohText, setRohText] = useState('')
  const [laeuft, setLaeuft] = useState<string | null>(null)
  const [pixabay, setPixabay] = useState(false)
  const [katalog, setKatalog] = useState<LongformMusikTrack[]>([])
  const [abschnittChat, setAbschnittChat] = useState<Record<string, string>>({})
  const [renderProzent, setRenderProzent] = useState<number | null>(null)
  const [renderId, setRenderId] = useState<LongformAbschnittId | null>(null)
  const [dirty, setDirty] = useState(false)
  const uploadZiel = useRef<LongformAbschnittId | null>(null)
  const dateiEingabe = useRef<HTMLInputElement>(null)

  const z = projekt?.zustand ?? null

  useEffect(() => {
    if (!projekt) return
    const neu = ohneSchlussVorFazit(projekt.zustand)
    if (neu === projekt.zustand) return
    const id = projekt.id
    setProjekt({ ...projekt, zustand: neu })
    setDirty(false)
    void lfApi('/api/youtube/longform', { method: 'PATCH', json: { id, zustand: neu } }).catch(() => undefined)
  }, [projekt])
  const naechstesKapitel: LongformAbschnittId | null = z
    ? (LONGFORM_ABSCHNITTE.find((id) => !(z.freigegeben ?? []).includes(id)) ?? null)
    : null
  const alleFrei = z != null && naechstesKapitel == null
  const sichtZustand = useMemo(() => {
    if (!z?.skript || alleFrei || !naechstesKapitel) return z
    return {
      ...z,
      skript: { ...z.skript, abschnitte: z.skript.abschnitte.filter((a) => a.id === naechstesKapitel) },
    }
  }, [z, alleFrei, naechstesKapitel])

  const ladeListe = useCallback(async () => {
    try {
      const r = await lfApi<{ projekte: LongformProjektKurz[] }>('/api/youtube/longform')
      setProjekte(r.projekte)
    } catch {
      /* Liste ist optional beim ersten Besuch */
    }
  }, [])

  useEffect(() => {
    void ladeListe()
    void fetch('/api/youtube/longform/bilder', { method: 'GET', cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return
        const j = (await res.json()) as { pixabay?: boolean }
        if (typeof j.pixabay === 'boolean') setPixabay(j.pixabay)
      })
      .catch(() => undefined)
    void lfApi<{ katalog: LongformMusikTrack[] }>('/api/youtube/longform/render', { method: 'GET' })
      .then((r) => setKatalog(r.katalog ?? []))
      .catch(() => undefined)
  }, [ladeListe])

  async function aktion<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
    setLaeuft(name)
    try {
      return await fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehlgeschlagen')
      return null
    } finally {
      setLaeuft(null)
    }
  }

  async function speichereLokal(): Promise<void> {
    if (!projekt || !dirty) return
    await lfApi('/api/youtube/longform', { method: 'PATCH', json: { id: projekt.id, zustand: projekt.zustand } })
    setDirty(false)
  }

  const oeffne = (id: string) =>
    aktion('laden', async () => {
      const r = await lfApi<{ projekt: LongformProjekt }>(`/api/youtube/longform?id=${encodeURIComponent(id)}`)
      setProjekt(r.projekt)
      setThema(r.projekt.zustand.thema)
      setDirty(false)
      setSchritt(r.projekt.zustand.skript ? 'skript' : r.projekt.zustand.hooks?.length ? 'hooks' : 'fakten')
    })

  const anlegen = () =>
    aktion('anlegen', async () => {
      let exportJson: unknown
      try {
        exportJson = JSON.parse(rohText)
      } catch {
        throw new Error('Kein gültiges JSON. Bitte Fundamentaldaten → Export JSON einfügen.')
      }
      const r = await lfApi<{ projekt: LongformProjekt }>('/api/youtube/longform', {
        json: { export: exportJson, thema },
      })
      setProjekt(r.projekt)
      setThema(r.projekt.zustand.thema)
      setDirty(false)
      setSchritt('fakten')
      await ladeListe()
      toast.success(`${r.projekt.ticker} geladen.`)
    })

  const quelleHochladen = (datei: File | undefined) => {
    if (!projekt || !datei) return
    void aktion('quelle', async () => {
      const form = new FormData()
      form.set('id', projekt.id)
      form.set('datei', datei)
      const r = await lfApi<{ quellen: LongformProjektZustand['quellen'] }>('/api/youtube/longform/quelle', {
        method: 'POST',
        body: form,
      })
      setProjekt({ ...projekt, zustand: { ...projekt.zustand, quellen: r.quellen } })
      toast.success(`${datei.name} hinzugefügt.`)
    })
  }

  const hooksErzeugen = () =>
    aktion('hooks', async () => {
      await speichereLokal()
      const r = await lfApi<ZustandAntwort>('/api/youtube/longform/skript', {
        json: { id: projekt!.id, aktion: 'hooks', thema, hookHinweis: z!.hookHinweis ?? '', denkstufe: z!.denkstufe },
      })
      setProjekt({ ...projekt!, zustand: r.zustand })
      setDirty(false)
      setSchritt('hooks')
    })

  const brollLaden = async (projektId: string) => {
    const r = await lfApi<ZustandAntwort & { gefuellt?: number }>('/api/youtube/longform/bilder', {
      json: { id: projektId, aktion: 'auto' },
    })
    setProjekt((p) => (p ? { ...p, zustand: r.zustand } : p))
    setDirty(false)
    return r.gefuellt ?? 0
  }

  const brollAuto = () =>
    aktion('broll', async () => {
      if (!projekt) return
      const n = await brollLaden(projekt.id)
      toast.success(n ? `${n} B-Roll-Bilder geladen.` : 'Keine offenen B-Roll-Sätze.')
    })

  const skriptErzeugen = (hookIndex: number) =>
    aktion('skript', async () => {
      await speichereLokal()
      const r = await lfApi<ZustandAntwort>('/api/youtube/longform/skript', {
        json: { id: projekt!.id, aktion: 'skript', hookIndex, thema, hookHinweis: z!.hookHinweis ?? '', denkstufe: z!.denkstufe },
      })
      setProjekt({ ...projekt!, zustand: r.zustand })
      setDirty(false)
      setSchritt('skript')
      toast.success('Skript fertig — optionale B-Roll-Vorschläge…')
      try {
        const n = await brollLaden(projekt!.id)
        toast.success(
          n
            ? `${n} Vorschläge vorbelegt — Bildbrief prüfen und bei Bedarf am Satz hochladen.`
            : 'Skript ok — Bildbriefe am Satz prüfen / hochladen.',
        )
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'B-Roll-Vorschläge fehlgeschlagen — am Satz hochladen.')
      }
    })

  const abschnittUmschreiben = (abschnittId: string) =>
    aktion(`chat-${abschnittId}`, async () => {
      const anweisung = (abschnittChat[abschnittId] ?? '').trim()
      if (anweisung.length < 3) throw new Error('Anweisung fehlt.')
      await speichereLokal()
      const r = await lfApi<ZustandAntwort>('/api/youtube/longform/skript', {
        json: { id: projekt!.id, aktion: 'chat', abschnittId, anweisung, denkstufe: z!.denkstufe },
      })
      setProjekt({ ...projekt!, zustand: r.zustand })
      setAbschnittChat((m) => ({ ...m, [abschnittId]: '' }))
      setDirty(false)
    })

  const erneutPruefen = () =>
    aktion('pruefen', async () => {
      await speichereLokal()
      const r = await lfApi<ZustandAntwort>('/api/youtube/longform/skript', {
        json: { id: projekt!.id, aktion: 'pruefen', denkstufe: z!.denkstufe },
      })
      setProjekt({ ...projekt!, zustand: r.zustand })
      setDirty(false)
      toast.success('Prüfung aktualisiert.')
    })

  const alleSprechen = async () => {
    if (!projekt) return
    const id = projekt.id
    const satzIds = (sichtZustand?.skript?.abschnitte ?? []).flatMap((a) => a.saetze.map((s) => s.id))
    await speichereLokal()
    let offen = 1
    while (offen > 0) {
      const r = await aktion('stimme-all', async () =>
        lfApi<ZustandAntwort & { offen?: number }>('/api/youtube/longform/stimme', {
          json: { id, aktion: 'sprechen', satzIds },
        }),
      )
      if (!r) break
      setProjekt((p) => (p ? { ...p, zustand: r.zustand } : p))
      setDirty(false)
      offen = r.offen ?? 0
      if (offen > 0) toast(`${offen} Sätze noch offen…`)
    }
    toast.success('Stimme fertig.')
  }

  const setzeZustand = (zustand: LongformProjektZustand) => {
    if (!projekt) return
    setProjekt({ ...projekt, zustand })
    setDirty(false)
  }

  const setzeSatzLokal = (abschnittId: string, satzId: string, satz: LongformSatz) => {
    if (!projekt?.zustand.skript) return
    const abschnitte = projekt.zustand.skript.abschnitte.map((a) =>
      a.id !== abschnittId ? a : { ...a, saetze: a.saetze.map((s) => (s.id === satzId ? satz : s)) },
    )
    setProjekt({
      ...projekt,
      zustand: { ...projekt.zustand, skript: { ...projekt.zustand.skript, abschnitte } },
    })
    setDirty(true)
  }

  const speichereDatei = (blob: Blob, dateiname: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = dateiname
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Nur dieses Kapitel. Stimme und Bilder bleiben, es wird nichts neu geschrieben. */
  const ladeKapitelHerunter = (abschnittId: LongformAbschnittId) =>
    aktion('render', async () => {
      await speichereLokal()
      if (!projekt) throw new Error('Kein Projekt.')
      if (abschnittId === 'fazit' && projekt.zustand.investiert == null) {
        throw new Error('Vor dem Fazit die Disclosure wählen. Sie wird in diese Datei gesprochen.')
      }
      const frisch = await lfApi<{ projekt: LongformProjekt }>(`/api/youtube/longform?id=${encodeURIComponent(projekt.id)}`)
      setProjekt(frisch.projekt)
      const skript = frisch.projekt.zustand.skript
      const abschnitt = skript?.abschnitte.find((a) => a.id === abschnittId)
      if (!abschnitt?.saetze.length || !skript) throw new Error('Dieses Kapitel hat noch kein Skript.')
      if (abschnitt.saetze.some((s) => !frisch.projekt.zustand.stimme.saetze[s.id]?.aktiv)) {
        throw new Error('Erst alle Sätze dieses Kapitels sprechen.')
      }
      const roh = baueAnalyseProps({ ...frisch.projekt.zustand, skript: { ...skript, abschnitte: [abschnitt] } }, katalog)
      if (!roh) throw new Error('Kapitel lässt sich nicht bauen.')
      const start = filmStartFuerKapitel(frisch.projekt.zustand, abschnittId, katalog)
      const props = { ...roh, filmStartFrame: start ?? -1 }
      const hatAbo = berechneLongTimeline(props).abo != null
      const ticker = frisch.projekt.ticker.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'LF'
      const dateiname = `${ticker}-${abschnittId}.mp4`
      setRenderId(abschnittId)
      setRenderProzent(0)
      try {
        const blob = await rendereAktienAnalyseImBrowser(props, (p) => {
          if (Number.isFinite(p)) setRenderProzent(Math.max(0, Math.min(100, Math.round(p * 100))))
        })
        speichereDatei(blob, dateiname)
        setRenderProzent(100)
        toast.success(
          hatAbo
            ? `${dateiname} heruntergeladen. Die Like-und-Abo-Animation steckt in dieser Datei.`
            : start == null
              ? `${dateiname} heruntergeladen. Die Abo-Animation fehlt, weil ein früheres Kapitel noch keine Länge hat.`
              : `${dateiname} heruntergeladen. Prüf die Datei, dann lad sie hier hoch.`,
        )
      } finally {
        setRenderId(null)
      }
    })

  const ladeKapitelHoch = (abschnittId: LongformAbschnittId, file: File) =>
    aktion('hochladen', async () => {
      await speichereLokal()
      if (!projekt) return
      if (file.size > 180 * 1024 * 1024) throw new Error('Die Datei ist größer als 180 MB.')
      if (file.type && !file.type.includes('mp4')) throw new Error('Nur MP4.')
      const dauerMs = await videoDauerMs(file)
      const link = await lfApi<{ signedUrl: string }>('/api/youtube/longform/kapitel-datei', {
        json: { id: projekt.id, aktion: 'link', abschnittId },
      })
      const body = new FormData()
      body.append('cacheControl', '3600')
      body.append('', file)
      const put = await fetch(link.signedUrl, { method: 'PUT', body, headers: { 'x-upsert': 'true' } })
      if (!put.ok) throw new Error(`Upload abgelehnt (${put.status}).`)
      const r = await lfApi<ZustandAntwort>('/api/youtube/longform/kapitel-datei', {
        json: { id: projekt.id, aktion: 'merken', abschnittId, dauerMs },
      })
      setProjekt({ ...projekt, zustand: r.zustand })
      setDirty(false)
      toast.success(`${LONGFORM_ABSCHNITT_TITEL[abschnittId]} liegt bereit.`)
    })

  const entferneKapitelDatei = (abschnittId: LongformAbschnittId) =>
    aktion('hochladen', async () => {
      await speichereLokal()
      if (!projekt) return
      const r = await lfApi<ZustandAntwort>('/api/youtube/longform/kapitel-datei', {
        json: { id: projekt.id, aktion: 'entfernen', abschnittId },
      })
      setProjekt({ ...projekt, zustand: r.zustand })
      setDirty(false)
    })

  /** Legt die hochgeladenen Kapitel aneinander. Keine neue Stimme, kein neues Skript. */
  const setzeFilmZusammen = () =>
    aktion('film', async () => {
      await speichereLokal()
      if (!projekt) throw new Error('Kein Projekt.')
      const frisch = await lfApi<{ projekt: LongformProjekt }>(`/api/youtube/longform?id=${encodeURIComponent(projekt.id)}`)
      setProjekt(frisch.projekt)
      const stand = frisch.projekt.zustand
      if (!stand.skript) throw new Error('Noch kein Skript.')
      const fehlt = LONGFORM_ABSCHNITTE.filter((id) => !stand.kapitelDateien?.[id]?.url)
      if (fehlt.length) throw new Error(`Es fehlt noch: ${fehlt.map((id) => LONGFORM_ABSCHNITT_TITEL[id]).join(', ')}.`)
      const teile = LONGFORM_ABSCHNITTE.map((id) => {
        const datei = stand.kapitelDateien?.[id]
        if (!datei?.url) throw new Error('Kapiteldatei fehlt.')
        return { src: datei.url, dauerMs: datei.dauerMs }
      })
      const ticker = frisch.projekt.ticker.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'LF'
      setRenderProzent(0)
      const blob = await rendereZusammenschnittImBrowser({ teile }, (p) => {
        if (Number.isFinite(p)) setRenderProzent(Math.max(0, Math.min(100, Math.round(p * 100))))
      })
      speichereDatei(blob, `${ticker}-LF.mp4`)
      setRenderProzent(100)
      toast.success(`${ticker}-LF.mp4 heruntergeladen.`)
    })

  const loeschen = () =>
    aktion('loeschen', async () => {
      if (!projekt) return
      if (!window.confirm(`${projekt.ticker} wirklich löschen?`)) return
      await lfApi(`/api/youtube/longform?id=${encodeURIComponent(projekt.id)}`, { method: 'DELETE' })
      setProjekt(null)
      setSchritt('start')
      await ladeListe()
    })

  const vorschauProps = useMemo(() => {
    if (!z?.skript || !naechstesKapitel) return null
    const abschnitt = z.skript.abschnitte.find((a) => a.id === naechstesKapitel)
    if (!abschnitt?.saetze.length) return null
    const props = baueAnalyseProps({ ...z, skript: { ...z.skript, abschnitte: [abschnitt] } }, katalog)
    if (!props) return null
    const start = filmStartFuerKapitel(z, naechstesKapitel, katalog)
    return { ...props, filmStartFrame: start ?? -1 }
  }, [z, naechstesKapitel, katalog])

  const kapitelSchreiben = () =>
    aktion('kapitel', async () => {
      if (!projekt || !naechstesKapitel) return
      await speichereLokal()
      const r = await lfApi<ZustandAntwort>('/api/youtube/longform/skript', {
        json: { id: projekt.id, aktion: 'kapitel', abschnittId: naechstesKapitel, denkstufe: z?.denkstufe },
      })
      setProjekt({ ...projekt, zustand: r.zustand })
      setDirty(false)
      toast.success('Kapitel geschrieben.')
    })

  const speichereZustand = (zustand: LongformProjektZustand) =>
    aktion('speichern', async () => {
      if (!projekt) return
      await lfApi('/api/youtube/longform', { method: 'PATCH', json: { id: projekt.id, zustand } })
      setProjekt({ ...projekt, zustand })
      setDirty(false)
    })

  const gibFrei = () => {
    if (!projekt || !z || !naechstesKapitel) return
    const da = z.skript?.abschnitte.some((a) => a.id === naechstesKapitel && a.saetze.length)
    if (!da) return
    void speichereZustand({ ...z, freigegeben: [...(z.freigegeben ?? []), naechstesKapitel] })
  }

  const nimmZurueck = () => {
    if (!projekt || !z || !(z.freigegeben ?? []).length) return
    void speichereZustand({ ...z, freigegeben: (z.freigegeben ?? []).slice(0, -1) })
  }

  /** Fertige Kapitel bis einschließlich `bis` ausblenden, damit das nächste direkt dran ist. */
  const ueberspringe = (bis: LongformAbschnittId) => {
    if (!projekt || !z?.skript) return
    const ende = LONGFORM_ABSCHNITTE.indexOf(bis)
    const ids: LongformAbschnittId[] = []
    for (let i = 0; i <= ende; i++) {
      const id = LONGFORM_ABSCHNITTE[i]!
      const hat = z.skript.abschnitte.some((a) => a.id === id && a.saetze.length > 0)
      if (!hat) return
      ids.push(id)
    }
    void speichereZustand({ ...z, freigegeben: ids })
  }

  const satzAnzahl = z?.skript?.abschnitte.reduce((n, a) => n + a.saetze.length, 0) ?? 0
  const stimmeFertig =
    z?.skript?.abschnitte.every((a) => a.saetze.every((s) => z.stimme.saetze[s.id]?.aktiv)) ?? false

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SCHRITTE.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={!projekt && s.id !== 'start'}
            onClick={() => setSchritt(s.id)}
            className={`rounded-xl px-3 py-1.5 text-sm ${
              schritt === s.id
                ? 'bg-red-600 text-white'
                : 'border border-[var(--app-border)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] disabled:opacity-40'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {schritt === 'start' ? (
        <section className="app-section-shell">
          <div className="app-surface-card-header px-4 py-2.5 sm:px-5">
            <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">Export + Thema</h2>
          </div>
          <div className="space-y-3 px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-sm text-[var(--app-text-muted)]">
              Testausbau: Hook, 10.000-$-Chart und Burggraben (~3–4 Min). Die restlichen Abschnitte folgen später, die Architektur ist schon dafür ausgelegt.
            </p>
            <textarea
              value={rohText}
              onChange={(e) => setRohText(e.target.value)}
              placeholder="JSON aus Fundamentaldaten → Export JSON hier einfügen"
              rows={7}
              spellCheck={false}
              className={`${LF_FELD} font-mono text-xs`}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className={`${LF_KNOPF} cursor-pointer`}>
                JSON-Datei wählen
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    void f.text().then(setRohText)
                  }}
                />
              </label>
            </div>
            <label className="block text-sm text-[var(--app-text-muted)]">
              Worum soll es in diesem Video gehen?
              <textarea
                value={thema}
                onChange={(e) => setThema(e.target.value)}
                rows={3}
                placeholder="z. B. Focus on ASML’s pricing power and whether the AI wafer fab boom is already priced in."
                className={`${LF_FELD} mt-1`}
              />
            </label>
            <button type="button" className={LF_KNOPF_PRIMAER} disabled={!rohText.trim() || laeuft != null} onClick={() => void anlegen()}>
              {laeuft === 'anlegen' ? 'Lädt Kurse + Fakten…' : 'Projekt anlegen'}
            </button>

            {projekte.length ? (
              <div className="border-t border-[var(--app-border)] pt-3">
                <h3 className="mb-2 text-sm font-medium text-[var(--app-text)]">Letzte Projekte</h3>
                <ul className="space-y-1">
                  {projekte.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="text-sm text-red-400 hover:underline" onClick={() => void oeffne(p.id)}>
                        {p.ticker} · {p.firmenname}
                        <span className="ml-2 text-[var(--app-text-muted)]">{new Date(p.aktualisiertAm).toLocaleString('de-DE')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {projekt && z && schritt !== 'start' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm">
          <span className="font-semibold text-[var(--app-text)]">
            {projekt.ticker} · {projekt.firmenname}
          </span>
          <span className="text-[var(--app-text-muted)]">
            {alleFrei ? 'Alle Kapitel frei' : `Kapitel: ${naechstesKapitel ? LONGFORM_ABSCHNITT_TITEL[naechstesKapitel] : ''}`}
          </span>
          {naechstesKapitel && !z.skript?.abschnitte.some((a) => a.id === naechstesKapitel && a.saetze.length) ? (
            <button type="button" className={LF_KNOPF_PRIMAER} disabled={laeuft != null || z.gewaehlterHook == null} onClick={() => void kapitelSchreiben()}>
              {laeuft === 'kapitel' ? 'Schreibt…' : 'Kapitel schreiben'}
            </button>
          ) : naechstesKapitel ? (
            <button type="button" className={LF_KNOPF_PRIMAER} disabled={laeuft != null} onClick={gibFrei}>
              Kapitel freigeben
            </button>
          ) : null}
          {(z.freigegeben ?? []).length ? (
            <button type="button" className={LF_KNOPF} disabled={laeuft != null} onClick={nimmZurueck}>
              Freigabe zurück
            </button>
          ) : null}
          {LONGFORM_ABSCHNITTE.flatMap((id, index) => {
            if ((z.freigegeben ?? []).includes(id)) return []
            const erreichbar = LONGFORM_ABSCHNITTE.slice(0, index + 1).every((vorher) =>
              z.skript?.abschnitte.some((a) => a.id === vorher && a.saetze.length > 0),
            )
            if (!erreichbar) return []
            return [
              <button key={id} type="button" className={LF_KNOPF} disabled={laeuft != null} onClick={() => ueberspringe(id)}>
                {LONGFORM_ABSCHNITT_TITEL[id]} überspringen
              </button>,
            ]
          })}
          <label className="ml-auto flex items-center gap-2 text-[var(--app-text-muted)]">
            Denkstufe
            <select
              value={z.denkstufe}
              onChange={(e) => {
                const denkstufe = e.target.value as LongformProjektZustand['denkstufe']
                setProjekt({ ...projekt, zustand: { ...z, denkstufe } })
                setDirty(true)
              }}
              className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-[var(--app-text)]"
            >
              <option value="low">low (günstig)</option>
              <option value="medium">medium</option>
              <option value="high">high (teurer)</option>
            </select>
          </label>
          <button type="button" className={LF_KNOPF} disabled={!dirty || laeuft != null} onClick={() => void aktion('speichern', speichereLokal)}>
            {dirty ? 'Speichern' : 'Gespeichert'}
          </button>
          <button type="button" className={LF_KNOPF} disabled={laeuft != null} onClick={() => void loeschen()}>
            Löschen
          </button>
        </div>
      ) : null}

      {projekt && z && schritt === 'fakten' ? (
        <section className="app-section-shell">
          <div className="app-surface-card-header flex items-center justify-between px-4 py-2.5 sm:px-5">
            <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">Faktenblatt</h2>
            <button type="button" className={LF_KNOPF_PRIMAER} disabled={laeuft != null} onClick={() => void hooksErzeugen()}>
              {laeuft === 'hooks' ? 'Schreibt Hooks…' : '3 Hooks erzeugen'}
            </button>
          </div>
          <div className="space-y-4 px-4 py-3 sm:px-5 sm:py-4">
            {z.faktenblatt.hinweise.length ? (
              <ul className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {z.faktenblatt.hinweise.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <Meta label="Export" wert={z.faktenblatt.exportDatum.slice(0, 10)} />
              <Meta label="Kursdatum" wert={z.faktenblatt.kursDatum?.slice(0, 10) ?? '—'} />
              <Meta label="Im Depot" wert={z.faktenblatt.imDepot == null ? 'unbekannt' : z.faktenblatt.imDepot ? 'ja' : 'nein'} />
            </div>
            {z.faktenblatt.chart ? (
              <p className="text-sm text-[var(--app-text)]">
                10.000 $ → <strong>{z.faktenblatt.chart.endwertGesamt.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</strong>
                {z.faktenblatt.chart.endwertSpy != null ? (
                  <>
                    {' '}
                    · S&P 500 → {z.faktenblatt.chart.endwertSpy.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                  </>
                ) : null}
              </p>
            ) : null}
            {faktenNachGruppe(z.faktenblatt.fakten).map((g) => (
              <div key={g.titel}>
                <h3 className="mb-1 text-sm font-medium text-[var(--app-text)]">{g.titel}</h3>
                <div className="overflow-x-auto rounded-lg border border-[var(--app-border)]">
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {g.items.map((f) => (
                        <tr key={f.id} className="border-t border-[var(--app-border)] first:border-0">
                          <td className="px-2 py-1.5 font-mono text-[var(--app-text-muted)]">{f.id}</td>
                          <td className="px-2 py-1.5 text-[var(--app-text)]">{f.label}</td>
                          <td className="px-2 py-1.5 font-medium text-[var(--app-text)]">{f.text}</td>
                          <td className="px-2 py-1.5 text-[var(--app-text-muted)]">{f.stichtag.slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <div>
              <h3 className="mb-2 text-sm font-medium text-[var(--app-text)]">Zusatzquellen</h3>
              <div className="flex flex-wrap items-center gap-2">
                <label className={`${LF_KNOPF} cursor-pointer`}>
                  PDF / Bild / Text hochladen
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp,text/plain,.md"
                    className="hidden"
                    onChange={(e) => quelleHochladen(e.target.files?.[0])}
                  />
                </label>
                {z.quellen.map((q) => (
                  <span key={q.id} className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-muted)]">
                    {q.name}
                  </span>
                ))}
              </div>
            </div>
            <label className="block text-sm text-[var(--app-text-muted)]">
              Thema (kannst du noch ändern)
              <textarea
                value={thema}
                onChange={(e) => {
                  setThema(e.target.value)
                  setProjekt({ ...projekt, zustand: { ...z, thema: e.target.value } })
                  setDirty(true)
                }}
                rows={2}
                className={`${LF_FELD} mt-1`}
              />
            </label>
            <HookHinweisFeld
              wert={z.hookHinweis ?? ''}
              onChange={(hookHinweis) => {
                setProjekt({ ...projekt, zustand: { ...z, hookHinweis } })
                setDirty(true)
              }}
            />
          </div>
        </section>
      ) : null}

      {projekt && z && schritt === 'hooks' ? (
        <section className="app-section-shell">
          <div className="app-surface-card-header flex items-center justify-between px-4 py-2.5 sm:px-5">
            <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">Hook wählen</h2>
            <button type="button" className={LF_KNOPF} disabled={laeuft != null} onClick={() => void hooksErzeugen()}>
              {laeuft === 'hooks' ? 'Neu…' : 'Neu erzeugen'}
            </button>
          </div>
          <div className="space-y-3 px-4 py-3 sm:px-5 sm:py-4">
            <HookHinweisFeld
              wert={z.hookHinweis ?? ''}
              onChange={(hookHinweis) => {
                setProjekt({ ...projekt, zustand: { ...z, hookHinweis } })
                setDirty(true)
              }}
            />
            {!z.hooks?.length ? (
              <p className="text-sm text-[var(--app-text-muted)]">Noch keine Hooks. Zurück zu Fakten und erzeugen.</p>
            ) : (
              z.hooks.map((h, i) => <HookKarte key={i} hook={h} index={i} gewaehlt={z.gewaehlterHook === i} busy={laeuft != null} onWaehlen={() => void skriptErzeugen(i)} />)
            )}
          </div>
        </section>
      ) : null}

      {projekt && z?.skript && schritt === 'skript' ? (
        <section className="app-section-shell">
          <div className="app-surface-card-header flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5">
            <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">Skript</h2>
            <span className="text-xs text-[var(--app-text-muted)]">
              {satzAnzahl} Sätze · Leitfrage: {z.skript.leitfrage}
            </span>
            <button type="button" className={`${LF_KNOPF} ml-auto`} disabled={laeuft != null} onClick={() => void erneutPruefen()}>
              {laeuft === 'pruefen' ? 'Prüft…' : 'Erneut prüfen'}
            </button>
            <button type="button" className={LF_KNOPF} disabled={laeuft != null} onClick={() => void brollAuto()}>
              {laeuft === 'broll' ? 'Vorschläge…' : 'B-Roll-Vorschläge'}
            </button>
            <button type="button" className={LF_KNOPF_PRIMAER} onClick={() => setSchritt('stimme')}>
              Weiter zur Stimme
            </button>
          </div>
          <div className="space-y-6 px-4 py-3 sm:px-5 sm:py-4">
            {(sichtZustand?.skript?.abschnitte ?? []).map((a) => (
              <AbschnittBlock
                key={a.id}
                abschnitt={a}
                projektId={projekt.id}
                zustand={z}
                pixabay={pixabay}
                chat={abschnittChat[a.id] ?? ''}
                onChat={(t) => setAbschnittChat((m) => ({ ...m, [a.id]: t }))}
                onChatLos={() => void abschnittUmschreiben(a.id)}
                chatBusy={laeuft === `chat-${a.id}`}
                onLokal={(satzId, satz) => setzeSatzLokal(a.id, satzId, satz)}
                onZustand={setzeZustand}
                vorAktion={speichereLokal}
              />
            ))}
          </div>
        </section>
      ) : null}

      {projekt && z?.skript && schritt === 'stimme' ? (
        <section className="app-section-shell">
          <div className="app-surface-card-header flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5">
            <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">Stimme</h2>
            <span className="text-xs text-[var(--app-text-muted)]">{stimmeFertig ? 'Alle Sätze vertont' : 'Einzelne Sätze können neu gesprochen werden'}</span>
            <button
              type="button"
              className={`${LF_KNOPF_PRIMAER} ml-auto`}
              disabled={laeuft != null}
              onClick={() =>
                void aktion('stimme-settings', async () => {
                  await lfApi('/api/youtube/longform/stimme', {
                    json: { id: projekt.id, aktion: 'einstellungen', einstellungen: z.stimme.global },
                  })
                  await alleSprechen()
                  setSchritt('vorschau')
                })
              }
            >
              {laeuft?.startsWith('stimme') ? 'Spricht…' : 'Alle fehlenden sprechen'}
            </button>
          </div>
          <div className="space-y-4 px-4 py-3 sm:px-5 sm:py-4">
            <StimmRegler
              wert={z.stimme.global}
              onChange={(global) => {
                setProjekt({ ...projekt, zustand: { ...z, stimme: { ...z.stimme, global } } })
                setDirty(true)
              }}
            />
            {(sichtZustand?.skript?.abschnitte ?? []).map((a) => (
              <div key={a.id} className="space-y-2">
                <h3 className="text-sm font-medium text-[var(--app-text)]">{a.titel}</h3>
                {a.saetze.map((s) => (
                  <LongformSatzEditor
                    key={s.id}
                    projektId={projekt.id}
                    abschnittId={a.id}
                    satz={s}
                    zustand={z}
                    pixabay={pixabay}
                    onLokal={(ns) => setzeSatzLokal(a.id, s.id, ns)}
                    onZustand={setzeZustand}
                    vorAktion={speichereLokal}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {projekt && z?.skript && schritt === 'vorschau' ? (
        <section className="app-section-shell">
          <div className="app-surface-card-header flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5">
            <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">Vorschau & Render</h2>
            <label className="ml-auto flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
              Disclosure
              <select
                value={z.investiert === true ? 'ja' : z.investiert === false ? 'nein' : ''}
                onChange={(e) => {
                  const investiert = e.target.value === 'ja' ? true : e.target.value === 'nein' ? false : null
                  setProjekt({ ...projekt, zustand: { ...z, investiert } })
                  setDirty(true)
                }}
                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-[var(--app-text)]"
              >
                <option value="">Noch nicht gewählt</option>
                <option value="ja">Ich bin investiert</option>
                <option value="nein">Ich bin nicht investiert</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
              <input
                type="checkbox"
                checked={z.musik.aktiv}
                onChange={(e) => {
                  setProjekt({ ...projekt, zustand: { ...z, musik: { ...z.musik, aktiv: e.target.checked } } })
                  setDirty(true)
                }}
              />
              Musik
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
              Pegel
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(z.musik.pegel * 100)}
                onChange={(e) => {
                  setProjekt({ ...projekt, zustand: { ...z, musik: { ...z.musik, pegel: Number(e.target.value) / 100 } } })
                  setDirty(true)
                }}
              />
            </label>
            <button
              type="button"
              className={LF_KNOPF_PRIMAER}
              disabled={laeuft != null || !LONGFORM_ABSCHNITTE.every((id) => z.kapitelDateien?.[id]?.url)}
              onClick={() => void setzeFilmZusammen()}
            >
              {laeuft === 'film' ? `Setzt zusammen… ${renderProzent ?? 0}%` : 'Film aus den Kapiteln'}
            </button>
          </div>
          <div className="space-y-3 px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-sm text-[var(--app-text-muted)]">
              Lade jedes Kapitel als MP4, prüf die Datei, und lad sie danach hier hoch. Der Schlussfilm legt nur diese Dateien aneinander. Stimme und Bilder werden nicht neu erzeugt. Die Like-und-Abo-Animation steckt in dem Kapitel, durch das Minute 4 bis 5 des ganzen Films läuft.
            </p>
            <p className="text-sm text-[var(--app-text-muted)]">
              Musik und Disclosure stecken in der Kapiteldatei. Stell sie ein, bevor du das Kapitel lädst. Das Fazit erst laden, wenn die Disclosure gewählt ist.
            </p>
            <input
              ref={dateiEingabe}
              type="file"
              accept="video/mp4"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                const ziel = uploadZiel.current
                e.target.value = ''
                if (file && ziel) void ladeKapitelHoch(ziel, file)
              }}
            />
            <div className="space-y-2">
              {LONGFORM_ABSCHNITTE.map((id) => {
                const abschnitt = z.skript?.abschnitte.find((a) => a.id === id)
                const stimmeDa = !!abschnitt?.saetze.length && abschnitt.saetze.every((s) => z.stimme.saetze[s.id]?.aktiv)
                const datei = z.kapitelDateien?.[id]
                const dran = id === naechstesKapitel
                return (
                  <div
                    key={id}
                    className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${dran ? 'border-red-600' : 'border-[var(--app-border)]'}`}
                  >
                    <div className="min-w-40 text-sm text-[var(--app-text)]">
                      {LONGFORM_ABSCHNITT_TITEL[id]}
                      {dran ? <span className="ml-2 text-xs text-red-400">dran</span> : null}
                    </div>
                    <div className="text-xs text-[var(--app-text-muted)]">
                      {datei ? `hochgeladen · ${formatDauer(datei.dauerMs)}` : stimmeDa ? 'bereit zum Laden' : 'noch keine Stimme'}
                    </div>
                    <button
                      type="button"
                      className={`${LF_KNOPF} ml-auto`}
                      disabled={laeuft != null || !stimmeDa || (id === 'fazit' && z.investiert == null)}
                      onClick={() => void ladeKapitelHerunter(id)}
                    >
                      {laeuft === 'render' && renderId === id ? `Lädt… ${renderProzent ?? 0}%` : 'MP4 laden'}
                    </button>
                    <button
                      type="button"
                      className={LF_KNOPF}
                      disabled={laeuft != null}
                      onClick={() => {
                        uploadZiel.current = id
                        dateiEingabe.current?.click()
                      }}
                    >
                      Hochladen
                    </button>
                    {datei ? (
                      <button type="button" className={LF_KNOPF} disabled={laeuft != null} onClick={() => void entferneKapitelDatei(id)}>
                        Entfernen
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
            {(laeuft === 'render' || laeuft === 'film') && renderProzent != null ? (
              <div className="h-2 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
                <div className="h-full bg-red-600 transition-[width]" style={{ width: `${renderProzent}%` }} />
              </div>
            ) : null}
            {vorschauProps ? <LongformVorschau props={vorschauProps} /> : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function HookHinweisFeld({ wert, onChange }: { wert: string; onChange: (wert: string) => void }) {
  return (
    <label className="block text-sm text-[var(--app-text-muted)]">
      So soll der Hook sein
      <textarea
        value={wert}
        onChange={(e) => onChange(e.target.value.slice(0, 2000))}
        rows={3}
        maxLength={2000}
        placeholder="z. B. kalt mit der Rendite starten, keine Frage, maximal drei Sätze, Micron gegen den Speicherzyklus."
        className={`${LF_FELD} mt-1`}
      />
    </label>
  )
}

function Meta({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="rounded-lg border border-[var(--app-border)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">{label}</div>
      <div className="text-sm text-[var(--app-text)]">{wert}</div>
    </div>
  )
}

function HookKarte({
  hook,
  index,
  gewaehlt,
  busy,
  onWaehlen,
}: {
  hook: LongformHookVorschlag
  index: number
  gewaehlt: boolean
  busy: boolean
  onWaehlen: () => void
}) {
  return (
    <div className={`rounded-xl border p-4 ${gewaehlt ? 'border-red-500/60 bg-red-500/5' : 'border-[var(--app-border)]'}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-[var(--app-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--app-text)]">{hook.typ}</span>
        <span className="text-xs text-[var(--app-text-muted)]">{HOOK_KATALOG[hook.typ]}</span>
      </div>
      <p className="mb-2 text-sm font-medium text-[var(--app-text)]">{hook.leitfrage}</p>
      <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-[var(--app-text-muted)]">
        {hook.saetze.map((s, i) => (
          <li key={i}>{s.text}</li>
        ))}
      </ol>
      <p className="mb-3 text-xs text-[var(--app-text-muted)]">{hook.begruendung}</p>
      <button type="button" className={LF_KNOPF_PRIMAER} disabled={busy} onClick={onWaehlen}>
        {busy ? 'Schreibt Skript…' : `Hook ${index + 1} wählen & Skript schreiben`}
      </button>
    </div>
  )
}

function AbschnittBlock({
  abschnitt,
  projektId,
  zustand,
  pixabay,
  chat,
  onChat,
  onChatLos,
  chatBusy,
  onLokal,
  onZustand,
  vorAktion,
}: {
  abschnitt: LongformAbschnitt
  projektId: string
  zustand: LongformProjektZustand
  pixabay: boolean
  chat: string
  onChat: (t: string) => void
  onChatLos: () => void
  chatBusy: boolean
  onLokal: (satzId: string, satz: LongformSatz) => void
  onZustand: (z: LongformProjektZustand) => void
  vorAktion: () => Promise<void>
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <h3 className="text-sm font-semibold text-[var(--app-text)]">{abschnitt.titel}</h3>
        <input
          value={chat}
          onChange={(e) => onChat(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && chat.trim() && onChatLos()}
          placeholder="Abschnitt per Chat ändern…"
          className={`${LF_FELD} max-w-md`}
        />
        <button type="button" className={LF_KNOPF} disabled={chatBusy || chat.trim().length < 3} onClick={onChatLos}>
          {chatBusy ? '…' : 'Umschreiben'}
        </button>
      </div>
      {abschnitt.saetze.map((s) => (
        <LongformSatzEditor
          key={s.id}
          projektId={projektId}
          abschnittId={abschnitt.id}
          satz={s}
          zustand={zustand}
          pixabay={pixabay}
          onLokal={(ns) => onLokal(s.id, ns)}
          onZustand={onZustand}
          vorAktion={vorAktion}
        />
      ))}
    </div>
  )
}
