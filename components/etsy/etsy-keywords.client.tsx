'use client'

import { PageSection, PageSectionPanel } from '@/components/page-shell'
import type { EtsyKeywordChance, EtsyKeywordIdee } from '@/lib/etsy/etsy-markt-types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

type Gemerkt = {
  keyword: string
  nachfrage: number | null
  wettbewerb: number | null
  chance: EtsyKeywordChance | null
  saison: string | null
}

type Filter = 'alle' | 'tags' | 'chance'

const QUELLEN_LABEL: Record<EtsyKeywordIdee['quellen'][number], string> = {
  google_de: 'Google',
  amazon_de: 'Amazon',
  etsy_suggest: 'Etsy',
}

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

export function EtsyKeywords() {
  const [suche, setSuche] = useState('')
  const [holz, setHolz] = useState('')
  const [tief, setTief] = useState(true)
  const [laden, setLaden] = useState(false)
  const [ideen, setIdeen] = useState<EtsyKeywordIdee[]>([])
  const [hinweise, setHinweise] = useState<string[]>([])
  const [gesucht, setGesucht] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('alle')
  const [gemerkt, setGemerkt] = useState<Gemerkt[]>([])

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
      const res = await fetch(`/api/etsy/keywords/merkliste?keyword=${encodeURIComponent(i.keyword)}`, {
        method: 'DELETE',
      })
      if (res.ok) setGemerkt((prev) => prev.filter((g) => g.keyword !== i.keyword))
      return
    }
    const res = await fetch('/api/etsy/keywords/merkliste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(i),
    })
    if (!res.ok) {
      toast.error('Merken fehlgeschlagen — Migration eingespielt?')
      return
    }
    setGemerkt((prev) => [
      { keyword: i.keyword, nachfrage: i.nachfrage, wettbewerb: i.wettbewerb, chance: i.chance, saison: i.saison },
      ...prev,
    ])
  }

  async function entfernen(keyword: string) {
    const res = await fetch(`/api/etsy/keywords/merkliste?keyword=${encodeURIComponent(keyword)}`, {
      method: 'DELETE',
    })
    if (res.ok) setGemerkt((prev) => prev.filter((g) => g.keyword !== keyword))
  }

  function kopieren(text: string) {
    void navigator.clipboard.writeText(text).then(
      () => toast.success('Kopiert.'),
      () => toast.error('Kopieren nicht möglich.'),
    )
  }

  const sichtbar = useMemo(() => {
    if (filter === 'tags') return ideen.filter((i) => i.tagTauglich)
    if (filter === 'chance') return ideen.filter((i) => i.chance === 'hoch' || i.chance === 'mittel')
    return ideen
  }, [ideen, filter])

  return (
    <>
      <PageSection titleId="etsy-keywords" title="Keyword-Finder">
        <PageSectionPanel density="compact" className="space-y-3">
          <p className="text-sm text-[var(--app-text-muted)]">
            Findet heraus, wonach deutsche Käufer wirklich suchen — aus den Suchvorschlägen von Google.de,
            Amazon.de und Etsy — und wie viele Etsy-Shops schon dafür ranken.
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--app-border)] text-left text-xs text-[var(--app-text-muted)]">
                      <th className="py-2 pr-2 font-medium">Suchphrase</th>
                      <th className="py-2 pr-2 font-medium" title="Wie häufig und weit oben die Phrase vorgeschlagen wird">
                        Nachfrage
                      </th>
                      <th className="py-2 pr-2 font-medium" title="Aktive Etsy-Listings zu dieser Suche">
                        Wettbewerb
                      </th>
                      <th className="py-2 pr-2 font-medium">Chance</th>
                      <th className="py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {sichtbar.map((i) => (
                      <tr key={i.keyword} className="border-b border-[var(--app-border)]/60 align-middle">
                        <td className="py-2 pr-2">
                          <button
                            type="button"
                            onClick={() => kopieren(i.keyword)}
                            className="text-left font-medium text-[var(--app-text)] hover:underline"
                            title="Kopieren"
                          >
                            {i.keyword}
                          </button>
                          <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-[var(--app-text-muted)]">
                            {i.quellen.map((q) => (
                              <span key={q} className="rounded bg-[var(--app-surface-muted)] px-1.5 py-0.5">
                                {QUELLEN_LABEL[q]}
                              </span>
                            ))}
                            {!i.tagTauglich && <span className="text-amber-300/80">zu lang für Tag → Titel</span>}
                            {i.saison && <span className="text-sky-300/90">📅 {i.saison}</span>}
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
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => void merken(i)}
                            className={`rounded-lg px-2 py-1 text-base ${
                              gemerktSet.has(i.keyword) ? 'text-amber-300' : 'text-[var(--app-text-muted)]'
                            }`}
                            title={gemerktSet.has(i.keyword) ? 'Aus Merkliste entfernen' : 'Merken'}
                          >
                            {gemerktSet.has(i.keyword) ? '★' : '☆'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-[var(--app-text-muted)]">
              Nachfrage ist ein relatives Signal (keine Suchvolumen-Zahl): Phrasen, die Google und Amazon
              gleichzeitig und weit oben vorschlagen, werden am häufigsten gesucht. Wettbewerb wird für die
              Top 12 geprüft.
            </p>
          </PageSectionPanel>
        </PageSection>
      )}

      <PageSection titleId="etsy-keywords-merkliste" title={`Merkliste · ${gemerkt.length}`}>
        <PageSectionPanel density="compact" className="space-y-2">
          {gemerkt.length === 0 ? (
            <p className="text-sm text-[var(--app-text-muted)]">
              Noch leer. Mit ☆ gemerkte Keywords erscheinen hier und lassen sich gesammelt kopieren.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {gemerkt.map((g) => (
                  <span
                    key={g.keyword}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-xs text-[var(--app-text)]"
                  >
                    {g.keyword}
                    {g.chance && <span className="text-[10px] text-[var(--app-text-muted)]">· {g.chance}</span>}
                    <button
                      type="button"
                      onClick={() => void entfernen(g.keyword)}
                      className="ml-0.5 text-[var(--app-text-muted)] hover:text-rose-300"
                      aria-label={`${g.keyword} entfernen`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
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
    </>
  )
}
