'use client'

import { appConfirm } from '@/components/app-confirm'
import { PageChrome, PageHero, PageSubTabs } from '@/components/page-shell'
import {
  appCardClass,
  appEmptyClass,
  appGhostBtnClass,
  appInputClass,
  appLabelClass,
  appSecondaryBtnClass,
} from '@/lib/app-ui'
import type { RadwerkstattArt, RadwerkstattArtikel, RadwerkstattEntwurf, RadwerkstattListe } from '@/lib/radwerkstatt/radwerkstatt-types'
import { ladeRadwerkstatt, RADWERKSTATT_EVENT, schreibeRadwerkstatt } from '@/lib/radwerkstatt/radwerkstatt-store'
import { normalisiereProduktUrl, pruefeHttpUrlForm } from '@/lib/radwerkstatt/radwerkstatt-url'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import toast from 'react-hot-toast'

type ArtFilter = 'alle' | RadwerkstattArt

type Entwurf = {
  id: string | null
  liste: RadwerkstattListe
  art: RadwerkstattArt
  name: string
  einsatzbereich: string
  preisEingabe: string
  /** Shop-Preis, wenn er nicht in Euro vorliegt. */
  preisHinweis: string
  zusammenfassung: string
  produktUrl: string
  bildUrl: string
  haltbarkeit: string
  verwendungsrhythmus: string
  anzahl: string
  notiz: string
  gekauftAm: string
}

const primaerBtn =
  'app-touch-target app-press rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-semibold text-[#041016] disabled:opacity-50'

function heuteIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

function parsePreisEingabe(s: string): number | null {
  const t = s.trim().replace(/\s/g, '').replace(/€/g, '').replace(/eur/gi, '')
  if (!t) return null
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(norm)
  if (!Number.isFinite(n) || n < 0 || n > 100000) return null
  return Math.round(n * 100) / 100
}

function leererEntwurf(liste: RadwerkstattListe): Entwurf {
  return {
    id: null,
    liste,
    art: 'werkzeug',
    name: '',
    einsatzbereich: '',
    preisEingabe: '',
    preisHinweis: '',
    zusammenfassung: '',
    produktUrl: '',
    bildUrl: '',
    haltbarkeit: '',
    verwendungsrhythmus: '',
    anzahl: '1',
    notiz: '',
    gekauftAm: liste === 'bestand' ? heuteIso() : '',
  }
}

function entwurfAusArtikel(a: RadwerkstattArtikel): Entwurf {
  return {
    id: a.id,
    liste: a.liste,
    art: a.art,
    name: a.name,
    einsatzbereich: a.einsatzbereich,
    preisEingabe: a.preisEur != null ? a.preisEur.toFixed(2).replace('.', ',') : '',
    preisHinweis: a.preisEur == null ? a.preisText : '',
    zusammenfassung: a.zusammenfassung,
    produktUrl: a.produktUrl,
    bildUrl: a.bildUrl,
    haltbarkeit: a.haltbarkeit,
    verwendungsrhythmus: a.verwendungsrhythmus,
    anzahl: String(a.anzahl || 1),
    notiz: a.notiz,
    gekauftAm: a.gekauftAm,
  }
}

function entwurfAusLink(basis: Entwurf, e: RadwerkstattEntwurf): Entwurf {
  return {
    ...basis,
    art: e.art,
    name: e.name,
    einsatzbereich: e.einsatzbereich,
    preisEingabe: e.preisEur != null ? e.preisEur.toFixed(2).replace('.', ',') : '',
    preisHinweis: e.preisEur == null ? e.preisText : '',
    zusammenfassung: e.zusammenfassung,
    produktUrl: e.produktUrl,
    bildUrl: e.bildUrl,
    haltbarkeit: e.haltbarkeit,
    verwendungsrhythmus: e.verwendungsrhythmus,
    gekauftAm: basis.liste === 'bestand' ? basis.gekauftAm || heuteIso() : '',
  }
}

function httpsUrlOderLeer(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  const u = pruefeHttpUrlForm(t)
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
  return u.toString()
}

function summeEur(items: RadwerkstattArtikel[], liste: RadwerkstattListe): number {
  return items
    .filter((a) => a.liste === liste && a.preisEur != null)
    .reduce((s, a) => s + (a.preisEur ?? 0) * (a.anzahl || 1), 0)
}

export function RadwerkstattSeite() {
  const [items, setItems] = useState<RadwerkstattArtikel[]>([])
  const [liste, setListe] = useState<RadwerkstattListe>('bestand')
  const [artFilter, setArtFilter] = useState<ArtFilter>('alle')
  const [suche, setSuche] = useState('')
  const [link, setLink] = useState('')
  const [lese, setLese] = useState(false)
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null)
  const [scrollTicket, setScrollTicket] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const laden = () => setItems(ladeRadwerkstatt())
    laden()
    window.addEventListener(RADWERKSTATT_EVENT, laden)
    return () => window.removeEventListener(RADWERKSTATT_EVENT, laden)
  }, [])

  useEffect(() => {
    if (scrollTicket === 0) return
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scrollTicket])

  const sichtbar = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return items
      .filter((a) => a.liste === liste)
      .filter((a) => artFilter === 'alle' || a.art === artFilter)
      .filter((a) => {
        if (!q) return true
        return [a.name, a.einsatzbereich, a.zusammenfassung, a.notiz, a.haltbarkeit, a.verwendungsrhythmus]
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm))
  }, [items, liste, artFilter, suche])

  const summeBestand = summeEur(items, 'bestand')
  const summeBedarf = summeEur(items, 'bedarf')
  const anzahlBestand = items.filter((a) => a.liste === 'bestand').length
  const anzahlBedarf = items.filter((a) => a.liste === 'bedarf').length

  function oeffneLeer() {
    setEntwurf(leererEntwurf(liste))
    setScrollTicket((n) => n + 1)
  }

  function oeffneArtikel(a: RadwerkstattArtikel) {
    setListe(a.liste)
    setEntwurf(entwurfAusArtikel(a))
    setScrollTicket((n) => n + 1)
  }

  async function uebernehmen() {
    const url = link.trim()
    if (!url) {
      toast.error('Zuerst den Produktlink einfügen.')
      return
    }
    try {
      pruefeHttpUrlForm(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ungültiger Link.')
      return
    }
    const schluessel = normalisiereProduktUrl(url)
    const vorhanden = ladeRadwerkstatt().find((a) => a.produktUrl && normalisiereProduktUrl(a.produktUrl) === schluessel)
    if (vorhanden) {
      toast(`„${vorhanden.name}“ steht schon in ${vorhanden.liste === 'bestand' ? 'deinem Bestand' : 'der Bedarfsliste'}.`)
      oeffneArtikel(vorhanden)
      return
    }
    setLese(true)
    try {
      const res = await fetch('/api/radwerkstatt/produkt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = (await res.json()) as { entwurf?: RadwerkstattEntwurf; error?: string }
      if (!res.ok || !data.entwurf) {
        toast.error(data.error || 'Der Link konnte nicht gelesen werden.')
        setEntwurf({ ...leererEntwurf(liste), produktUrl: url })
        setScrollTicket((n) => n + 1)
        return
      }
      setEntwurf(entwurfAusLink(entwurf ?? leererEntwurf(liste), data.entwurf))
      setScrollTicket((n) => n + 1)
      setLink('')
      if (data.entwurf.hinweis) toast(data.entwurf.hinweis)
    } catch {
      toast.error('Der Link konnte nicht gelesen werden.')
      setEntwurf({ ...leererEntwurf(liste), produktUrl: url })
      setScrollTicket((n) => n + 1)
    } finally {
      setLese(false)
    }
  }

  function speichern(e: FormEvent) {
    e.preventDefault()
    if (!entwurf) return
    const name = entwurf.name.trim()
    if (!name) {
      toast.error('Name fehlt.')
      return
    }
    let produktUrl = ''
    let bildUrl = ''
    try {
      produktUrl = entwurf.produktUrl.trim() ? httpsUrlOderLeer(entwurf.produktUrl) : ''
      if (entwurf.produktUrl.trim() && !produktUrl) throw new Error('Der Produktlink ist ungültig.')
      bildUrl = entwurf.bildUrl.trim() ? httpsUrlOderLeer(entwurf.bildUrl) : ''
      if (entwurf.bildUrl.trim() && !bildUrl) throw new Error('Der Bildlink ist ungültig.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ungültiger Link.')
      return
    }
    const preisEur = parsePreisEingabe(entwurf.preisEingabe)
    if (entwurf.preisEingabe.trim() && preisEur == null) {
      toast.error('Den Preis als Zahl eintragen, z. B. 24,99.')
      return
    }
    const anzahlRoh = Number(entwurf.anzahl.replace(',', '.'))
    const anzahl = Number.isFinite(anzahlRoh) ? Math.min(99, Math.max(1, Math.round(anzahlRoh))) : 1
    const art = entwurf.art
    const jetzt = new Date().toISOString()
    const basis = ladeRadwerkstatt()
    const alt = entwurf.id ? basis.find((a) => a.id === entwurf.id) : undefined
    const zeile: RadwerkstattArtikel = {
      id: entwurf.id || crypto.randomUUID(),
      liste: entwurf.liste,
      art,
      name,
      einsatzbereich: entwurf.einsatzbereich.trim(),
      preisEur,
      preisText: preisEur != null ? formatEur(preisEur) : entwurf.preisHinweis.trim(),
      zusammenfassung: entwurf.zusammenfassung.trim(),
      produktUrl,
      bildUrl,
      haltbarkeit: art === 'verbrauch' ? entwurf.haltbarkeit.trim() : '',
      verwendungsrhythmus: art === 'verbrauch' ? entwurf.verwendungsrhythmus.trim() : '',
      anzahl,
      notiz: entwurf.notiz.trim(),
      gekauftAm: entwurf.liste === 'bestand' ? entwurf.gekauftAm || heuteIso() : '',
      erstelltAm: alt?.erstelltAm || jetzt,
    }
    if (art === 'verbrauch' && !zeile.haltbarkeit && !zeile.verwendungsrhythmus) {
      toast('Bei Verbrauchsgütern Haltbarkeit und Rhythmus eintragen, wenn du sie kennst.')
    }
    if (produktUrl) {
      const schluessel = normalisiereProduktUrl(produktUrl)
      const doppelt = basis.find(
        (a) => a.id !== zeile.id && a.produktUrl && normalisiereProduktUrl(a.produktUrl) === schluessel,
      )
      if (doppelt) {
        toast.error(`„${doppelt.name}“ hat schon diesen Link.`)
        oeffneArtikel(doppelt)
        return
      }
    }
    const next = alt ? basis.map((a) => (a.id === zeile.id ? zeile : a)) : [zeile, ...basis]
    schreibeRadwerkstatt(next)
    setItems(next)
    setEntwurf(null)
    setListe(zeile.liste)
    toast.success(alt ? 'Gespeichert.' : zeile.liste === 'bestand' ? 'Im Bestand.' : 'Auf der Bedarfsliste.')
  }

  function verschiebe(a: RadwerkstattArtikel, ziel: RadwerkstattListe) {
    const next = ladeRadwerkstatt().map((x) =>
      x.id === a.id
        ? { ...x, liste: ziel, gekauftAm: ziel === 'bestand' ? x.gekauftAm || heuteIso() : x.gekauftAm }
        : x,
    )
    schreibeRadwerkstatt(next)
    setItems(next)
    toast.success(ziel === 'bestand' ? 'In den Bestand gelegt.' : 'Zurück auf die Bedarfsliste.')
  }

  async function loeschen(a: RadwerkstattArtikel) {
    const ok = await appConfirm({
      title: 'Eintrag löschen?',
      message: a.name,
      confirmLabel: 'Löschen',
      danger: true,
    })
    if (!ok) return
    const next = ladeRadwerkstatt().filter((x) => x.id !== a.id)
    schreibeRadwerkstatt(next)
    setItems(next)
    if (entwurf?.id === a.id) setEntwurf(null)
  }

  return (
    <PageChrome>
      <PageHero
        eyebrow="Rennrad"
        title="Radwerkstatt"
        description="Werkzeug und Verbrauchsmaterial, das du fürs Rad kaufst — mit Preis und Bild. Auf der Bedarfsliste stehen Dinge, die noch fehlen. Einen Produktlink einfügen, dann werden Name, Einsatzbereich, Preis und eine kurze Beschreibung übernommen. Bei Verbrauchsgütern steht dazu, wie lange sie halten und wie oft sie drankommen."
        actions={
          <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-[16rem]">
            <SummenKachel label="Bestand" betrag={summeBestand} anzahl={anzahlBestand} />
            <SummenKachel label="Bedarf" betrag={summeBedarf} anzahl={anzahlBedarf} />
          </div>
        }
      />

      <PageSubTabs
        selectId="radwerkstatt-liste"
        ariaLabel="Bestand oder Bedarf"
        active={liste}
        onChange={(id) => {
          setListe(id)
          setArtFilter('alle')
        }}
        tabs={[
          { id: 'bestand', label: 'Bestand', shortLabel: 'Bestand', accent: 'emerald' },
          { id: 'bedarf', label: 'Wunsch & Bedarf', shortLabel: 'Bedarf', accent: 'violet' },
        ]}
      />

      <section className={`${appCardClass} space-y-3 p-4 sm:p-5`}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Produktlink</span>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void uebernehmen()
                }
              }}
              placeholder="Produktlink einfügen"
              inputMode="url"
              className={appInputClass}
            />
          </label>
          <button type="button" className={primaerBtn} disabled={lese} onClick={() => void uebernehmen()}>
            {lese ? 'Lese Produkt… etwa eine Minute' : 'Aus Link übernehmen'}
          </button>
          <button type="button" className={appSecondaryBtnClass} onClick={oeffneLeer}>
            Manuell
          </button>
        </div>

        {entwurf ? (
          <form ref={formRef} onSubmit={speichern} className="space-y-4 border-t border-[var(--app-border)] pt-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <ProduktBild url={entwurf.bildUrl} name={entwurf.name || 'Produkt'} className="sm:w-48" />
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                <Feld label="Name" className="sm:col-span-2">
                  <input
                    required
                    value={entwurf.name}
                    onChange={(e) => setEntwurf({ ...entwurf, name: e.target.value })}
                    className={appInputClass}
                  />
                </Feld>
                <Feld label="Einsatzbereich">
                  <input
                    value={entwurf.einsatzbereich}
                    onChange={(e) => setEntwurf({ ...entwurf, einsatzbereich: e.target.value })}
                    placeholder="z. B. Kette reinigen"
                    className={appInputClass}
                  />
                </Feld>
                <Feld label="Preis in €">
                  <input
                    value={entwurf.preisEingabe}
                    onChange={(e) => setEntwurf({ ...entwurf, preisEingabe: e.target.value })}
                    inputMode="decimal"
                    placeholder="24,99"
                    className={appInputClass}
                  />
                  {entwurf.preisHinweis ? (
                    <span className="mt-1 block text-xs text-[var(--app-text-muted)]">Auf der Seite: {entwurf.preisHinweis}</span>
                  ) : null}
                </Feld>
                <Feld label="Anzahl">
                  <input
                    value={entwurf.anzahl}
                    onChange={(e) => setEntwurf({ ...entwurf, anzahl: e.target.value })}
                    inputMode="numeric"
                    className={appInputClass}
                  />
                </Feld>
                <Feld label="Liste">
                  <select
                    value={entwurf.liste}
                    onChange={(e) => setEntwurf({ ...entwurf, liste: e.target.value as RadwerkstattListe })}
                    className={appInputClass}
                  >
                    <option value="bestand">Bestand</option>
                    <option value="bedarf">Wunsch & Bedarf</option>
                  </select>
                </Feld>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <ArtWahl
                aktiv={entwurf.art === 'werkzeug'}
                onClick={() => setEntwurf({ ...entwurf, art: 'werkzeug' })}
              >
                Werkzeug
              </ArtWahl>
              <ArtWahl
                aktiv={entwurf.art === 'verbrauch'}
                onClick={() => setEntwurf({ ...entwurf, art: 'verbrauch' })}
              >
                Verbrauchsgut
              </ArtWahl>
            </div>

            <Feld label="Was es kann">
              <textarea
                value={entwurf.zusammenfassung}
                onChange={(e) => setEntwurf({ ...entwurf, zusammenfassung: e.target.value })}
                rows={3}
                className={appInputClass}
              />
            </Feld>

            {entwurf.art === 'verbrauch' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Feld label="Wie lange es hält">
                  <textarea
                    value={entwurf.haltbarkeit}
                    onChange={(e) => setEntwurf({ ...entwurf, haltbarkeit: e.target.value })}
                    rows={2}
                    placeholder="z. B. eine Flasche ≈ 20 Kettenpflegen"
                    className={appInputClass}
                  />
                </Feld>
                <Feld label="Wie oft es drankommt">
                  <textarea
                    value={entwurf.verwendungsrhythmus}
                    onChange={(e) => setEntwurf({ ...entwurf, verwendungsrhythmus: e.target.value })}
                    rows={2}
                    placeholder="z. B. nach jeder nassen Fahrt, sonst alle 200 km"
                    className={appInputClass}
                  />
                </Feld>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Feld label="Produktlink">
                <input
                  value={entwurf.produktUrl}
                  onChange={(e) => setEntwurf({ ...entwurf, produktUrl: e.target.value })}
                  inputMode="url"
                  className={appInputClass}
                />
              </Feld>
              <Feld label="Bildlink">
                <input
                  value={entwurf.bildUrl}
                  onChange={(e) => setEntwurf({ ...entwurf, bildUrl: e.target.value })}
                  inputMode="url"
                  className={appInputClass}
                />
              </Feld>
              {entwurf.liste === 'bestand' ? (
                <Feld label="Gekauft am">
                  <input
                    type="date"
                    value={entwurf.gekauftAm}
                    onChange={(e) => setEntwurf({ ...entwurf, gekauftAm: e.target.value })}
                    className={appInputClass}
                  />
                </Feld>
              ) : null}
              <Feld label="Notiz" className={entwurf.liste === 'bestand' ? '' : 'sm:col-span-2'}>
                <input
                  value={entwurf.notiz}
                  onChange={(e) => setEntwurf({ ...entwurf, notiz: e.target.value })}
                  className={appInputClass}
                />
              </Feld>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" className={primaerBtn}>
                Speichern
              </button>
              <button type="button" className={appGhostBtnClass} onClick={() => setEntwurf(null)}>
                Abbrechen
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Suchen"
          className={appInputClass}
        />
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['alle', 'Alles'],
              ['werkzeug', 'Werkzeug'],
              ['verbrauch', 'Verbrauch'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setArtFilter(id)}
              className={artFilter === id ? primaerBtn : appGhostBtnClass}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {sichtbar.length === 0 ? (
        <p className={appEmptyClass}>
          {items.some((a) => a.liste === liste)
            ? 'Nichts passt zur Suche.'
            : liste === 'bestand'
              ? 'Noch nichts im Bestand. Link einfügen oder manuell eintragen.'
              : 'Die Bedarfsliste ist leer. Trag ein, was du noch brauchst.'}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sichtbar.map((a) => (
            <li key={a.id} className={`${appCardClass} flex flex-col overflow-hidden`}>
              <ProduktBild url={a.bildUrl} name={a.name} />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">{a.name}</h2>
                  <p className="shrink-0 text-sm font-semibold text-[var(--app-text)]">
                    {a.preisEur != null
                      ? a.anzahl > 1
                        ? `${a.anzahl} × ${formatEur(a.preisEur)}`
                        : formatEur(a.preisEur)
                      : a.preisText || 'Preis offen'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--app-text-muted)]">
                    {a.art === 'verbrauch' ? 'Verbrauch' : 'Werkzeug'}
                  </span>
                  {a.einsatzbereich ? (
                    <span className="rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--app-text)]">
                      {a.einsatzbereich}
                    </span>
                  ) : null}
                </div>
                {a.zusammenfassung ? (
                  <p className="text-sm leading-relaxed text-[var(--app-text-muted)]">{a.zusammenfassung}</p>
                ) : null}
                {a.art === 'verbrauch' ? (
                  <dl className="space-y-1 rounded-[var(--app-radius-lg)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm">
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Hält</dt>
                      <dd>{a.haltbarkeit || 'noch nicht eingetragen'}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Drankommt</dt>
                      <dd>{a.verwendungsrhythmus || 'noch nicht eingetragen'}</dd>
                    </div>
                  </dl>
                ) : null}
                {a.notiz ? <p className="text-xs text-[var(--app-text-muted)]">{a.notiz}</p> : null}
                {a.produktUrl ? (
                  <a
                    href={a.produktUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="truncate text-xs font-medium text-[var(--app-accent)] underline-offset-2 hover:underline"
                  >
                    Produktseite
                  </a>
                ) : null}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <button type="button" className={appGhostBtnClass} onClick={() => oeffneArtikel(a)}>
                    Bearbeiten
                  </button>
                  {a.liste === 'bedarf' ? (
                    <button type="button" className={appSecondaryBtnClass} onClick={() => verschiebe(a, 'bestand')}>
                      Gekauft
                    </button>
                  ) : (
                    <button type="button" className={appGhostBtnClass} onClick={() => verschiebe(a, 'bedarf')}>
                      Auf Bedarf
                    </button>
                  )}
                  <button type="button" className={appGhostBtnClass} onClick={() => void loeschen(a)}>
                    Löschen
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageChrome>
  )
}

function SummenKachel({ label, betrag, anzahl }: { label: string; betrag: number; anzahl: number }) {
  return (
    <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">{label}</p>
      <p className="text-base font-semibold text-[var(--app-text)]">{formatEur(betrag)}</p>
      <p className="text-[11px] text-[var(--app-text-muted)]">
        {anzahl} {anzahl === 1 ? 'Teil' : 'Teile'}
      </p>
    </div>
  )
}

function Feld({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={appLabelClass}>{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  )
}

function ArtWahl({ aktiv, onClick, children }: { aktiv: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={aktiv ? primaerBtn : appSecondaryBtnClass} aria-pressed={aktiv}>
      {children}
    </button>
  )
}

function ProduktBild({ url, name, className = '' }: { url: string; name: string; className?: string }) {
  const [src, setSrc] = useState('')
  const [ok, setOk] = useState(true)
  useEffect(() => {
    setOk(true)
    if (!url) {
      setSrc('')
      return
    }
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      setSrc(url)
      return
    }
    let aktiv = true
    let blob = ''
    const ctrl = new AbortController()
    fetch(`/api/radwerkstatt/bild?url=${encodeURIComponent(url)}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('bild')
        const datei = await res.blob()
        if (!datei.type.startsWith('image/') || datei.size < 32) throw new Error('bild')
        const objekt = URL.createObjectURL(datei)
        if (!aktiv) {
          URL.revokeObjectURL(objekt)
          return
        }
        blob = objekt
        setSrc(objekt)
      })
      .catch(() => {
        if (aktiv) setSrc(url)
      })
    return () => {
      aktiv = false
      ctrl.abort()
      if (blob) URL.revokeObjectURL(blob)
    }
  }, [url])
  if (!url || !ok) {
    return (
      <div
        className={`flex aspect-[4/3] items-center justify-center bg-[var(--app-surface-muted)] text-3xl ${className}`}
        aria-hidden
      >
        🔧
      </div>
    )
  }
  if (!src) {
    return <div className={`aspect-[4/3] bg-[var(--app-surface-muted)] ${className}`} aria-hidden />
  }
  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setOk(false)}
      className={`aspect-[4/3] w-full object-contain bg-[var(--app-surface-muted)] ${className}`}
    />
  )
}
