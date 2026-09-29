'use client'

import { PageSection, PageSectionPanel } from '@/components/page-shell'
import type { EtsyTagTausch } from '@/lib/etsy/etsy-cockpit-types'
import type {
  EtsyAutoKeyword,
  EtsyAutoKeywordScan,
  EtsyKeywordChance,
  EtsyKeywordIdee,
} from '@/lib/etsy/etsy-markt-types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

type Gemerkt = {
  keyword: string
  nachfrage: number | null
  wettbewerb: number | null
  chance: EtsyKeywordChance | null
  saison: string | null
}

type Filter = 'alle' | 'etsy' | 'tags' | 'chance'

const QUELLEN_LABEL: Record<EtsyKeywordIdee['quellen'][number], string> = {
  etsy_tags: 'Etsy',
  etsy_suggest: 'Etsy-Suche',
  google_de: 'Google',
  amazon_de: 'Amazon',
}

const QUELLEN_REIHENFOLGE: EtsyKeywordIdee['quellen'][number][] = ['etsy_tags', 'etsy_suggest', 'amazon_de', 'google_de']

const CHANCE_STIL: Record<EtsyKeywordChance, string> = {
  hoch: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  mittel: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  niedrig: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
}

function NachfrageBalken({ wert }: { wert: number }) {
  return (
    <div className="flex items-center gap-2" title={`Nachfrage-Signal ${wert}/100`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
        <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.max(4, wert)}%` }} />
      </div>
      <span className="w-7 text-right text-xs tabular-nums text-[var(--app-text-muted)]">{wert}</span>
    </div>
  )
}

function ChanceBadge({ chance }: { chance: EtsyKeywordChance | null }) {
  if (!chance) return <span className="text-xs text-[var(--app-text-muted)]">—</span>
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${CHANCE_STIL[chance]}`}>
      {chance === 'hoch' ? 'Große Chance' : chance === 'mittel' ? 'Solide' : 'Hart umkämpft'}
    </span>
  )
}

function istAuto(i: EtsyKeywordIdee | EtsyAutoKeyword): i is EtsyAutoKeyword {
  return 'status' in i && 'eigeneListings' in i
}

function KeywordTabelle({
  ideen,
  gemerktSet,
  busyKeyword,
  onKopieren,
  onMerken,
  onEinbauen,
  extraSpalte,
}: {
  ideen: Array<EtsyKeywordIdee | EtsyAutoKeyword>
  gemerktSet: Set<string>
  busyKeyword?: string | null
  onKopieren: (text: string) => void
  onMerken: (i: EtsyKeywordIdee) => void
  onEinbauen: (keyword: string) => void
  extraSpalte?: 'bei dir'
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-[var(--app-border)] text-left text-xs text-[var(--app-text-muted)]">
            <th className="py-2 pr-2 font-medium">Suchphrase</th>
            <th className="py-2 pr-2 font-medium">Nachfrage</th>
            <th className="py-2 pr-2 font-medium">Wettbewerb</th>
            <th className="py-2 pr-2 font-medium">Chance</th>
            {extraSpalte === 'bei dir' && <th className="py-2 pr-2 font-medium">Bei dir</th>}
            <th className="py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {ideen.map((i) => (
            <tr key={i.keyword} className="border-b border-[var(--app-border)]/60 align-middle">
              <td className="py-2 pr-2">
                <button
                  type="button"
                  onClick={() => onKopieren(i.keyword)}
                  className="text-left font-medium text-[var(--app-text)] hover:underline"
                  title="Kopieren"
                >
                  {i.keyword}
                </button>
                <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-[var(--app-text-muted)]">
                  {QUELLEN_REIHENFOLGE.filter((q) => i.quellen.includes(q)).map((q) => (
                    <span
                      key={q}
                      title={
                        q === 'etsy_tags' && i.etsyNutzung != null
                          ? `${i.etsyNutzung} der Top-100-Etsy-Listings nutzen diesen Tag`
                          : undefined
                      }
                      className={`rounded px-1.5 py-0.5 ${
                        q.startsWith('etsy')
                          ? 'bg-orange-500/15 font-medium text-orange-200'
                          : 'bg-[var(--app-surface-muted)]'
                      }`}
                    >
                      {QUELLEN_LABEL[q]}
                      {q === 'etsy_tags' && i.etsyNutzung != null ? ` · ${i.etsyNutzung}×` : ''}
                    </span>
                  ))}
                  {!i.tagTauglich && <span className="text-amber-300/80">zu lang für Tag → Titel</span>}
                  {i.saison && <span className="text-sky-300/90">{i.saison}</span>}
                </div>
              </td>
              <td className="py-2 pr-2">
                <NachfrageBalken wert={i.nachfrage} />
              </td>
              <td className="py-2 pr-2 text-xs tabular-nums text-[var(--app-text-muted)]">
                {i.wettbewerb != null ? i.wettbewerb.toLocaleString('de-DE') : '—'}
                {i.wettbewerbMarkt === 'DE' ? ' DE' : ''}
              </td>
              <td className="py-2 pr-2">
                <ChanceBadge chance={i.chance} />
              </td>
              {extraSpalte === 'bei dir' && istAuto(i) && (
                <td className="py-2 pr-2 text-xs tabular-nums">
                  {i.status === 'fehlt' ? (
                    <span className="text-amber-200">fehlt</span>
                  ) : i.status === 'selten' ? (
                    <span className="text-sky-200">{i.eigeneListings}×</span>
                  ) : (
                    <span className="text-emerald-200">{i.eigeneListings}×</span>
                  )}
                </td>
              )}
              <td className="whitespace-nowrap py-2 text-right">
                {i.tagTauglich && (
                  <button
                    type="button"
                    onClick={() => onEinbauen(i.keyword)}
                    className="rounded-lg border border-teal-500/40 px-2 py-1 text-[11px] text-teal-200 hover:bg-teal-500/15"
                    title="In das passendste Listing als Tag einbauen"
                  >
                    Einbauen
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyKeyword === i.keyword}
                  onClick={() => onMerken(i)}
                  className={`ml-1 rounded-lg px-2 py-1 text-[11px] font-medium disabled:opacity-60 ${
                    gemerktSet.has(i.keyword)
                      ? 'border border-rose-500/30 text-rose-200 hover:bg-rose-500/10'
                      : 'border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15'
                  }`}
                  title={gemerktSet.has(i.keyword) ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                >
                  {gemerktSet.has(i.keyword) ? 'Entfernen' : 'Merken'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type Einbau = {
  keyword: string
  laden: boolean
  busy: boolean
  plan: EtsyTagTausch | null
  optionen: Array<{ listingId: number; title: string }>
  grund?: string
}

export function EtsyKeywords({ verbunden = false }: { verbunden?: boolean }) {
  const [einbau, setEinbau] = useState<Einbau | null>(null)
  const [suche, setSuche] = useState('')
  const [holz, setHolz] = useState('')
  const [tief, setTief] = useState(true)
  const [laden, setLaden] = useState(false)
  const [ideen, setIdeen] = useState<EtsyKeywordIdee[]>([])
  const [hinweise, setHinweise] = useState<string[]>([])
  const [gesucht, setGesucht] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('alle')
  const [gemerkt, setGemerkt] = useState<Gemerkt[]>([])
  const [autoScan, setAutoScan] = useState<EtsyAutoKeywordScan | null>(null)
  const [autoLaden, setAutoLaden] = useState(false)
  const [autoAnsicht, setAutoAnsicht] = useState<'chancen' | 'alle'>('chancen')
  const [favoritBusy, setFavoritBusy] = useState<string | null>(null)

  const ladeMerkliste = useCallback(async () => {
    try {
      const res = await fetch('/api/etsy/keywords/merkliste', { cache: 'no-store' })
      const j = (await res.json()) as { keywords?: Gemerkt[] }
      if (res.ok) setGemerkt(j.keywords ?? [])
    } catch {
      /* Merkliste optional */
    }
  }, [])

  useEffect(() => {
    void ladeMerkliste()
  }, [ladeMerkliste])

  const ladeAuto = useCallback(
    async (force = false) => {
      if (!verbunden) return
      setAutoLaden(true)
      try {
        const res = await fetch(`/api/etsy/keywords?auto=1${force ? '&force=1' : ''}`, { cache: 'no-store' })
        const j = (await res.json()) as EtsyAutoKeywordScan & { error?: string }
        if (!res.ok) throw new Error(j.error || 'Auto-Scan fehlgeschlagen')
        setAutoScan(j)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Keywords zu deinen Produkten nicht ladbar.')
      } finally {
        setAutoLaden(false)
      }
    },
    [verbunden],
  )

  useEffect(() => {
    void ladeAuto()
  }, [ladeAuto])

  async function erkunden(e?: React.FormEvent) {
    e?.preventDefault()
    const q = suche.trim()
    if (q.length < 3) {
      toast.error('Bitte mindestens 3 Zeichen eingeben.')
      return
    }
    setLaden(true)
    try {
      const p = new URLSearchParams({ q, tief: tief ? '1' : '0' })
      if (holz.trim()) p.set('holz', holz.trim())
      const res = await fetch(`/api/etsy/keywords?${p.toString()}`, { cache: 'no-store' })
      const j = (await res.json()) as { ideen?: EtsyKeywordIdee[]; hinweise?: string[]; error?: string }
      if (!res.ok) {
        toast.error(j.error ?? 'Suche fehlgeschlagen.')
        return
      }
      setIdeen(j.ideen ?? [])
      setHinweise(j.hinweise ?? [])
      setGesucht(q)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Suche fehlgeschlagen.')
    } finally {
      setLaden(false)
    }
  }

  const gemerktSet = useMemo(() => new Set(gemerkt.map((g) => g.keyword)), [gemerkt])

  async function merken(i: EtsyKeywordIdee) {
    if (gemerktSet.has(i.keyword)) {
      await entfernen(i.keyword)
      return
    }
    setFavoritBusy(i.keyword)
    try {
      const res = await fetch('/api/etsy/keywords/merkliste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(i),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(j.error || `Merken fehlgeschlagen (${res.status}).`, { duration: 8000 })
        return
      }
      setGemerkt((prev) => [
        { keyword: i.keyword, nachfrage: i.nachfrage, wettbewerb: i.wettbewerb, chance: i.chance, saison: i.saison },
        ...prev.filter((g) => g.keyword !== i.keyword),
      ])
      toast.success(`„${i.keyword}“ in Favoriten.`)
    } finally {
      setFavoritBusy(null)
    }
  }

  async function entfernen(keyword: string) {
    setFavoritBusy(keyword)
    try {
      const res = await fetch(`/api/etsy/keywords/merkliste?keyword=${encodeURIComponent(keyword)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(j.error || 'Entfernen fehlgeschlagen.')
        return
      }
      setGemerkt((prev) => prev.filter((g) => g.keyword !== keyword))
      toast.success(`„${keyword}“ aus Favoriten entfernt.`)
    } finally {
      setFavoritBusy(null)
    }
  }

  async function planeEinbau(keyword: string, listingId?: number) {
    if (!verbunden) {
      toast.error('Erst oben den Etsy-Shop verbinden.')
      return
    }
    setEinbau((alt) => ({
      keyword,
      laden: true,
      busy: false,
      plan: null,
      optionen: alt?.keyword === keyword ? alt.optionen : [],
    }))
    requestAnimationFrame(() =>
      document.getElementById('etsy-keyword-einbau')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    )
    try {
      const res = await fetch('/api/etsy/cockpit/aktion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ art: 'keyword_plan', keyword, listingId }),
      })
      const j = (await res.json()) as {
        error?: string
        plan?: EtsyTagTausch | null
        optionen?: Einbau['optionen']
        grund?: string
      }
      if (!res.ok) throw new Error(j.error || 'Planung fehlgeschlagen')
      setEinbau({ keyword, laden: false, busy: false, plan: j.plan ?? null, optionen: j.optionen ?? [], grund: j.grund })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
      setEinbau(null)
    }
  }

  async function einbauen() {
    if (!einbau?.plan) return
    setEinbau({ ...einbau, busy: true })
    try {
      const res = await fetch('/api/etsy/cockpit/aktion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          art: 'tag_tausch',
          aufgabeKey: `keyword:${einbau.keyword}`,
          tausch: [{ listingId: einbau.plan.listingId, alt: einbau.plan.alt, neu: einbau.plan.neu }],
        }),
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(j.error || 'Übernehmen fehlgeschlagen')
      toast.success(`„${einbau.plan.neu}“ ist jetzt Tag bei „${einbau.plan.listingTitle.slice(0, 40)}“.`)
      setEinbau(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
      setEinbau((alt) => (alt ? { ...alt, busy: false } : alt))
    }
  }

  function kopieren(text: string) {
    void navigator.clipboard.writeText(text).then(
      () => toast.success('Kopiert.'),
      () => toast.error('Kopieren nicht möglich.'),
    )
  }

  const sichtbar = useMemo(() => {
    if (filter === 'etsy') return ideen.filter((i) => i.quellen.some((q) => q.startsWith('etsy')))
    if (filter === 'tags') return ideen.filter((i) => i.tagTauglich)
    if (filter === 'chance') return ideen.filter((i) => i.chance === 'hoch' || i.chance === 'mittel')
    return ideen
  }, [ideen, filter])

  const autoListe = autoAnsicht === 'chancen' ? (autoScan?.chancen ?? []) : (autoScan?.alle ?? [])

  return (
    <>
      <PageSection titleId="etsy-keywords-merkliste" title={`Favoriten · ${gemerkt.length}`}>
        <PageSectionPanel density="compact" className="space-y-2">
          {gemerkt.length === 0 ? (
            <p className="text-sm text-[var(--app-text-muted)]">
              Noch leer. Unten bei den gefundenen Keywords auf <strong>Merken</strong> — nur diese kommen ins Cockpit
              und in die KI. Hier kannst du sie jederzeit wieder entfernen.
            </p>
          ) : (
            <>
              <p className="text-xs text-[var(--app-text-muted)]">
                Das Cockpit schlägt vor, wo sie als Tag hinpassen. Entfernen nimmt sie aus der Liste, nicht von Etsy.
              </p>
              <ul className="divide-y divide-[var(--app-border)]/60">
                {gemerkt.map((g) => (
                  <li key={g.keyword} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 font-medium text-[var(--app-text)]">{g.keyword}</span>
                    {g.chance && (
                      <span className="text-[10px] text-[var(--app-text-muted)]">{g.chance}</span>
                    )}
                    {g.keyword.length <= 20 && (
                      <button
                        type="button"
                        onClick={() => void planeEinbau(g.keyword)}
                        className="rounded-lg border border-teal-500/40 px-2 py-1 text-[11px] text-teal-200 hover:bg-teal-500/15"
                      >
                        Einbauen
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={favoritBusy === g.keyword}
                      onClick={() => void entfernen(g.keyword)}
                      className="rounded-lg border border-rose-500/30 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"
                    >
                      {favoritBusy === g.keyword ? '…' : 'Entfernen'}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => kopieren(gemerkt.map((g) => g.keyword).join(', '))}
                className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text-muted)]"
              >
                Alle kopieren (kommagetrennt)
              </button>
            </>
          )}
        </PageSectionPanel>
      </PageSection>

      <PageSection titleId="etsy-keywords-auto" title="Für deine Produkte">
        <PageSectionPanel density="compact" className="space-y-3">
          {!verbunden ? (
            <p className="text-sm text-[var(--app-text-muted)]">
              Shop oben verbinden — dann prüft der Finder selbst, wonach Käufer bei Sortimenten wie deinem suchen,
              und zeigt was bei dir noch fehlt.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm text-[var(--app-text-muted)]">
                  Vorschläge aus deinem Sortiment (Etsy-Top-Tags, Google.de, Amazon.de). Nichts wird von allein
                  gemerkt — mit <strong>Merken</strong> wählst du aus, was in die Favoriten soll.
                </p>
                <button
                  type="button"
                  disabled={autoLaden}
                  onClick={() => void ladeAuto(true)}
                  className="shrink-0 rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:opacity-60"
                >
                  {autoLaden ? 'Prüft… (20–40 Sek.)' : autoScan ? 'Neu prüfen' : 'Jetzt finden'}
                </button>
              </div>
              {autoScan?.seeds.length ? (
                <p className="text-[11px] text-[var(--app-text-muted)]">
                  Suchfelder aus {autoScan.listings} Listings
                  {autoScan.ausCache ? ' · gespeichert (24 Std.)' : ''}:{' '}
                  {autoScan.seeds.map((s) => s.seed).join(' · ')}
                </p>
              ) : null}
              {autoLaden && !autoScan ? (
                <p className="text-sm text-[var(--app-text-muted)]">
                  Gleicht dein Sortiment mit Etsy, Google und Amazon ab…
                </p>
              ) : autoScan ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ['chancen', `Chancen · ${autoScan.chancen.length}`],
                        ['alle', `Alle Treffer · ${autoScan.alle.length}`],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setAutoAnsicht(id)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          autoAnsicht === id
                            ? 'border-teal-500/60 bg-teal-500/15 text-teal-200'
                            : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {autoScan.hinweise.length > 0 && (
                    <p className="text-xs text-amber-200/80">{autoScan.hinweise.slice(0, 3).join(' ')}</p>
                  )}
                  {autoListe.length === 0 ? (
                    <p className="text-sm text-emerald-200/90">
                      Keine offenen Lücken in diesem Filter — deine Tags decken die häufigsten Suchen schon.
                    </p>
                  ) : (
                    <KeywordTabelle
                      ideen={autoListe}
                      gemerktSet={gemerktSet}
                      busyKeyword={favoritBusy}
                      onKopieren={kopieren}
                      onMerken={(i) => void merken(i)}
                      onEinbauen={(kw) => void planeEinbau(kw)}
                      extraSpalte="bei dir"
                    />
                  )}
                </>
              ) : null}
            </>
          )}
        </PageSectionPanel>
      </PageSection>

      <PageSection titleId="etsy-keywords" title="Einzelne Suche">
        <PageSectionPanel density="compact" className="space-y-3">
          <p className="text-sm text-[var(--app-text-muted)]">
            Findet Phrasen zu einem freien Suchbegriff — zusätzlich zum automatischen Scan oben.
          </p>
          <form onSubmit={(e) => void erkunden(e)} className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
            <input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="z. B. holzschale, obstschale, holzgeschenk"
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)]"
            />
            <input
              value={holz}
              onChange={(e) => setHolz(e.target.value)}
              placeholder="Holzart (optional)"
              title="Filtert Vorschläge mit anderer Holzart heraus"
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)]"
            />
            <button
              type="submit"
              disabled={laden}
              className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60"
            >
              {laden ? 'Suche läuft…' : 'Keywords finden'}
            </button>
          </form>
          <label className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
            <input type="checkbox" checked={tief} onChange={(e) => setTief(e.target.checked)} />
            Tiefensuche (A–Z-Varianten, ca. 20–40 Sek., danach 7 Tage gespeichert)
          </label>
        </PageSectionPanel>
      </PageSection>

      {gesucht && (
        <PageSection titleId="etsy-keywords-ergebnis" title={`Ergebnisse für „${gesucht}“ · ${ideen.length}`}>
          <PageSectionPanel density="compact" className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['alle', 'Alle'],
                  ['etsy', 'Auf Etsy bewährt'],
                  ['tags', 'Als Tag nutzbar (≤20 Zeichen)'],
                  ['chance', 'Nur gute Chancen'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    filter === id
                      ? 'border-teal-500/60 bg-teal-500/15 text-teal-200'
                      : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {hinweise.length > 0 && <p className="text-xs text-amber-200/80">{hinweise.join(' ')}</p>}

            {sichtbar.length === 0 ? (
              <p className="text-sm text-[var(--app-text-muted)]">Keine Treffer für diesen Filter.</p>
            ) : (
              <KeywordTabelle
                ideen={sichtbar}
                gemerktSet={gemerktSet}
                busyKeyword={favoritBusy}
                onKopieren={kopieren}
                onMerken={(i) => void merken(i)}
                onEinbauen={(kw) => void planeEinbau(kw)}
              />
            )}
            <p className="text-[11px] text-[var(--app-text-muted)]">
              Nachfrage ist ein relatives Signal (keine Suchvolumen-Zahl). Am stärksten zählt „Etsy · 14×“: so
              viele der 100 von Etsy am besten platzierten deutschen Listings nutzen die Phrase als Tag —
              Listings mit vielen Favoriten zählen mehr. Phrasen, die zusätzlich Google oder Amazon vorschlagen,
              werden auch außerhalb von Etsy gesucht. Wettbewerb wird für die Top 12 geprüft.
            </p>
          </PageSectionPanel>
        </PageSection>
      )}

      {einbau && (
        <div
          id="etsy-keyword-einbau"
          className="rounded-2xl border border-teal-500/50 bg-teal-500/10 p-4 text-sm text-[var(--app-text)]"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">„{einbau.keyword}“ einbauen</p>
            <button
              type="button"
              onClick={() => setEinbau(null)}
              className="text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
            >
              Schließen
            </button>
          </div>
          {einbau.optionen.length > 0 && (
            <label className="mt-2 block text-xs text-[var(--app-text-muted)]">
              Listing
              <select
                value={einbau.plan?.listingId ?? ''}
                disabled={einbau.laden || einbau.busy}
                onChange={(e) => void planeEinbau(einbau.keyword, Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-sm text-[var(--app-text)]"
              >
                {!einbau.plan && <option value="">— wählen —</option>}
                {einbau.optionen.map((o) => (
                  <option key={o.listingId} value={o.listingId}>
                    {o.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {einbau.laden ? (
            <p className="mt-2 text-xs text-[var(--app-text-muted)]">Suche das passendste Listing und den schwächsten Tag…</p>
          ) : einbau.plan ? (
            <>
              <p className="mt-2 text-xs">
                {einbau.plan.alt ? (
                  <>
                    Ersetzt <span className="text-rose-200 line-through">{einbau.plan.alt}</span>{' '}
                    <span className="text-[var(--app-text-muted)]">({einbau.plan.altGrund})</span> durch{' '}
                  </>
                ) : (
                  <>Nutzt einen freien Tag-Platz: </>
                )}
                <span className="font-medium text-emerald-200">{einbau.plan.neu}</span>
              </p>
              <button
                type="button"
                disabled={einbau.busy}
                onClick={() => void einbauen()}
                className="mt-3 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-60"
              >
                {einbau.busy ? 'Wird übernommen…' : 'Auf Etsy übernehmen'}
              </button>
            </>
          ) : (
            <p className="mt-2 text-xs text-amber-200">{einbau.grund ?? 'Kein passender Platz gefunden.'}</p>
          )}
        </div>
      )}
    </>
  )
}
