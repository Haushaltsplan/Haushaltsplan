'use client'

import type {
  EtsyAufgabeTyp,
  EtsyCockpitAktion,
  EtsyCockpitAufgabe,
  EtsyCockpitErgebnis,
  EtsyCockpitModul,
  EtsyTagTausch,
  EtsyWirkung,
} from '@/lib/etsy/etsy-cockpit-types'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Props = {
  verbunden: boolean
  statusLaedt: boolean
  onOeffnen: (modul: EtsyCockpitModul, listingId?: number, force?: boolean) => void
}

const TYP_STIL: Record<EtsyAufgabeTyp, { label: string; rand: string; badge: string }> = {
  views_einbruch: { label: 'Einbruch', rand: 'border-l-rose-500', badge: 'bg-rose-500/15 text-rose-200' },
  rank_verlust: { label: 'Ranking', rand: 'border-l-rose-400', badge: 'bg-rose-500/15 text-rose-200' },
  vorschlag: { label: 'KI-Vorschlag', rand: 'border-l-emerald-500', badge: 'bg-emerald-500/15 text-emerald-200' },
  hauptbegriff: { label: 'Hauptbegriff', rand: 'border-l-amber-500', badge: 'bg-amber-500/15 text-amber-200' },
  saison: { label: 'Saison', rand: 'border-l-orange-500', badge: 'bg-orange-500/15 text-orange-200' },
  saison_ende: { label: 'Saison vorbei', rand: 'border-l-orange-400', badge: 'bg-orange-500/15 text-orange-200' },
  keyword: { label: 'Merkliste', rand: 'border-l-sky-500', badge: 'bg-sky-500/15 text-sky-200' },
  tag_luecke: { label: 'Konkurrenz-Tag', rand: 'border-l-violet-500', badge: 'bg-violet-500/15 text-violet-200' },
  schwach: { label: 'SEO', rand: 'border-l-teal-500', badge: 'bg-teal-500/15 text-teal-200' },
  kein_audit: { label: 'SEO', rand: 'border-l-teal-400', badge: 'bg-teal-500/15 text-teal-200' },
  keine_favoriten: { label: 'Foto/Preis', rand: 'border-l-pink-500', badge: 'bg-pink-500/15 text-pink-200' },
  konkurrenz: { label: 'Konkurrenz', rand: 'border-l-violet-400', badge: 'bg-violet-500/15 text-violet-200' },
}

const START_ANZAHL = 8

/** alt fehlt = Server wählt den verzichtbarsten Tag (bei manuell gewähltem Listing). */
type TauschPlan = Omit<EtsyTagTausch, 'alt'> & { alt?: string | null }

function zahl(n: number | null | undefined, stellen = 0) {
  return n == null ? '—' : n.toLocaleString('de-DE', { maximumFractionDigits: stellen })
}

function delta(jetzt: number | null, vorher: number | null): { text: string; stil: string } | null {
  if (jetzt == null || vorher == null) return null
  if (vorher === 0) return jetzt > 0 ? { text: 'neu', stil: 'text-emerald-300' } : null
  const p = Math.round(((jetzt - vorher) / vorher) * 100)
  return {
    text: `${p > 0 ? '+' : ''}${p} % vs. Vorwoche`,
    stil: p >= 5 ? 'text-emerald-300' : p <= -5 ? 'text-rose-300' : 'text-[var(--app-text-muted)]',
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T & { error?: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(j.error || `Fehler ${res.status}`)
  return j
}

export function EtsyCockpit({ verbunden, statusLaedt, onOeffnen }: Props) {
  const [daten, setDaten] = useState<EtsyCockpitErgebnis | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [alleZeigen, setAlleZeigen] = useState(false)
  const [erledigt, setErledigt] = useState<Set<string>>(new Set())

  const lade = useCallback(async () => {
    if (!verbunden) return
    setLaden(true)
    setFehler(null)
    try {
      const res = await fetch('/api/etsy/cockpit', { cache: 'no-store' })
      const j = (await res.json()) as EtsyCockpitErgebnis & { error?: string }
      if (!res.ok) throw new Error(j.error || 'Cockpit konnte nicht geladen werden')
      setDaten(j)
      setErledigt(new Set())
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setLaden(false)
    }
  }, [verbunden])

  useEffect(() => {
    void lade()
  }, [lade])

  function markiereErledigt(key: string) {
    setErledigt((alt) => new Set(alt).add(key))
  }

  async function ausfuehren(a: EtsyCockpitAufgabe, aktion: EtsyCockpitAktion, tauschOverride?: TauschPlan[]) {
    switch (aktion.art) {
      case 'oeffnen':
        onOeffnen(aktion.modul, aktion.listingId)
        return
      case 'audit':
        onOeffnen('seo', aktion.listingId, true)
        return
    }
    setBusyKey(a.key)
    try {
      if (aktion.art === 'tag_tausch') {
        const tausch: TauschPlan[] = tauschOverride ?? aktion.tausch
        if (
          tausch.length > 3 &&
          !window.confirm(`${tausch.length} Listings auf Etsy ändern? Jeweils wird ein Tag ersetzt (siehe Liste).`)
        ) {
          return
        }
        const j = await postJson<{ erfolgreich: number; ergebnisse: Array<{ ok: boolean; fehler?: string }> }>(
          '/api/etsy/cockpit/aktion',
          {
            art: 'tag_tausch',
            aufgabeKey: a.key,
            tausch: tausch.map((t) => ({ listingId: t.listingId, alt: t.alt, neu: t.neu })),
          },
        )
        const fehlgeschlagen = j.ergebnisse.filter((e) => !e.ok)
        toast.success(
          `${j.erfolgreich} Listing${j.erfolgreich === 1 ? '' : 's'} auf Etsy aktualisiert` +
            (fehlgeschlagen.length ? ` · ${fehlgeschlagen.length} übersprungen` : ''),
        )
        markiereErledigt(a.key)
      } else if (aktion.art === 'vorschlag') {
        await postJson(`/api/etsy/vorschlaege/${aktion.listingId}`, { aktion: 'uebernehmen' })
        toast.success('KI-Vorschlag auf Etsy übernommen — Wirkung wird gemessen.')
        markiereErledigt(a.key)
      } else if (aktion.art === 'batch_audit') {
        toast('SEO-Check läuft — dauert bis zu 3 Minuten.')
        const j = await postJson<{ results?: unknown[] }>('/api/etsy/listings/batch-audit', {
          state: 'active',
          limit: aktion.anzahl,
        })
        toast.success(`${j.results?.length ?? 0} Listings geprüft.`)
        await lade()
      } else if (aktion.art === 'merken') {
        await postJson('/api/etsy/keywords/merkliste', { keyword: aktion.keyword })
        toast.success(`„${aktion.keyword}“ gemerkt.`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Aktion fehlgeschlagen')
    } finally {
      setBusyKey(null)
    }
  }

  async function verwerfen(a: EtsyCockpitAufgabe) {
    setBusyKey(a.key)
    try {
      if (a.typ === 'vorschlag' && a.listingId) {
        await postJson(`/api/etsy/vorschlaege/${a.listingId}`, { aktion: 'verwerfen' })
      } else {
        await postJson('/api/etsy/cockpit/aktion', { art: 'ausblenden', aufgabeKey: a.key, tage: 14 })
      }
      markiereErledigt(a.key)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusyKey(null)
    }
  }

  if (!verbunden) {
    return (
      <section className="app-section-shell">
        <div className="px-4 py-4 text-sm text-[var(--app-text-muted)] sm:px-5">
          {statusLaedt ? 'Lade…' : 'Verbinde oben deinen Etsy-Shop — dann zeigt das Cockpit, was sich heute lohnt.'}
        </div>
      </section>
    )
  }

  const offene = (daten?.aufgaben ?? []).filter((a) => !erledigt.has(a.key))
  const sichtbar = alleZeigen ? offene : offene.slice(0, START_ANZAHL)
  const k = daten?.kpis

  return (
    <div className="space-y-4">
      <section className="app-section-shell">
        <div className="app-surface-card-header flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">Cockpit</h2>
            <p className="text-xs text-[var(--app-text-muted)]">
              {daten
                ? `Stand ${new Date(daten.stand).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · ${k?.aktiveListings ?? 0} aktive Listings`
                : 'Alle Tools auf einen Blick'}
            </p>
          </div>
          <button
            type="button"
            disabled={laden}
            onClick={() => void lade()}
            className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:opacity-60"
          >
            {laden ? 'Lädt…' : 'Aktualisieren'}
          </button>
        </div>

        <div className="space-y-3 px-4 py-3 sm:px-5 sm:py-4">
          {fehler && (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">{fehler}</p>
          )}
          {laden && !daten ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--app-surface-muted)]" />
              ))}
            </div>
          ) : k ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Kpi titel="Aufrufe (7 Tage)" wert={zahl(k.views7)} unter={delta(k.views7, k.views7Vorher)} leer={k.views7 == null ? 'Messung läuft' : undefined} />
              <Kpi titel="Favoriten (7 Tage)" wert={zahl(k.favoriten7)} unter={delta(k.favoriten7, k.favoriten7Vorher)} leer={k.favoriten7 == null ? 'Messung läuft' : undefined} />
              <Kpi
                titel="Verkäufe (30 Tage)"
                wert={zahl(k.verkaeufe30)}
                unter={k.umsatz30 != null ? { text: `${zahl(k.umsatz30)} € Umsatz`, stil: 'text-[var(--app-text-muted)]' } : null}
              />
              <Kpi
                titel="Ø SEO-Score"
                wert={k.scoreSchnitt != null ? `${k.scoreSchnitt}` : '—'}
                unter={{ text: `${k.auditiert} von ${k.aktiveListings} geprüft`, stil: 'text-[var(--app-text-muted)]' }}
                farbe={k.scoreSchnitt == null ? undefined : k.scoreSchnitt >= 80 ? 'text-emerald-300' : k.scoreSchnitt >= 60 ? 'text-amber-300' : 'text-rose-300'}
              />
              <Kpi
                titel="Rang Top-Drechsler"
                wert={k.konkurrenzRang != null ? `#${k.konkurrenzRang}` : '—'}
                unter={{
                  text: k.konkurrenzRang != null ? `von ${k.konkurrenzAnzahl} nach Verkäufen (30 T.)` : 'nach 2 Messungen',
                  stil: 'text-[var(--app-text-muted)]',
                }}
                onClick={() => onOeffnen('konkurrenz')}
              />
              <Kpi
                titel="Offene Aufgaben"
                wert={zahl(offene.length)}
                unter={{
                  text: daten?.ausgeblendet ? `${daten.ausgeblendet} ausgeblendet` : 'automatisch erkannt',
                  stil: 'text-[var(--app-text-muted)]',
                }}
              />
            </div>
          ) : null}

          {daten?.hinweise.length ? (
            <ul className="space-y-1 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-100">
              {daten.hinweise.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="app-section-shell">
        <div className="app-surface-card-header px-4 py-2.5 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">Heute zu tun</h2>
          <p className="text-xs text-[var(--app-text-muted)]">
            Nach Wirkung sortiert. Tag-Änderungen gehen mit einem Klick direkt zu Etsy und werden gemessen.
          </p>
        </div>
        <div className="space-y-2 px-4 py-3 sm:px-5 sm:py-4">
          {daten && offene.length === 0 ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              Alles erledigt. Das Cockpit prüft jeden Morgen neu — Aufrufe, Rankings, Saison und Konkurrenz.
            </p>
          ) : null}
          {sichtbar.map((a) => (
            <AufgabeKarte
              key={a.key}
              aufgabe={a}
              busy={busyKey === a.key}
              gesperrt={busyKey != null && busyKey !== a.key}
              onAktion={(aktion, tausch) => void ausfuehren(a, aktion, tausch)}
              onVerwerfen={() => void verwerfen(a)}
            />
          ))}
          {offene.length > START_ANZAHL && (
            <button
              type="button"
              onClick={() => setAlleZeigen((v) => !v)}
              className="w-full rounded-lg border border-dashed border-[var(--app-border)] py-2 text-xs text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]"
            >
              {alleZeigen ? 'Weniger anzeigen' : `Alle ${offene.length} Aufgaben anzeigen`}
            </button>
          )}
        </div>
      </section>

      {daten && daten.wirkung.length > 0 && <WirkungListe wirkung={daten.wirkung} onOeffnen={onOeffnen} />}

      {daten && daten.topListings.length > 0 && (
        <section className="app-section-shell">
          <div className="app-surface-card-header px-4 py-2.5 sm:px-5">
            <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">Deine stärksten Listings</h2>
          </div>
          <div className="overflow-x-auto px-4 py-3 sm:px-5">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-[var(--app-border)] text-left text-xs text-[var(--app-text-muted)]">
                  <th className="py-1.5 pr-2 font-medium">Listing</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Aufrufe 7 T.</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Fav. 7 T.</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Verk. 30 T.</th>
                  <th className="py-1.5 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {daten.topListings.map((l) => (
                  <tr
                    key={l.listingId}
                    onClick={() => onOeffnen('seo', l.listingId)}
                    className="cursor-pointer border-b border-[var(--app-border)]/60 hover:bg-[var(--app-surface-muted)]"
                  >
                    <td className="max-w-[260px] truncate py-1.5 pr-2 text-[var(--app-text)]">{l.title}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{zahl(l.views7)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{zahl(l.favoriten7)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{zahl(l.verkaeufe30)}</td>
                    <td className="py-1.5 text-right tabular-nums">{zahl(l.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
        Läuft automatisch: jeden Morgen um 6 Uhr Aufrufe, Favoriten, Verkäufe und Konkurrenz messen · montags
        KI-Vorschläge für Listings mit Einbruch, Ranking-Verlust oder schwachem Score vorbereiten. Gemerkte
        Keywords und die Tags der Top-Drechsler fließen automatisch in jeden KI-Check und jedes neue Listing ein.
      </p>
    </div>
  )
}

function Kpi({
  titel,
  wert,
  unter,
  leer,
  farbe,
  onClick,
}: {
  titel: string
  wert: string
  unter?: { text: string; stil: string } | null
  leer?: string
  farbe?: string
  onClick?: () => void
}) {
  const inhalt = (
    <>
      <p className="text-[11px] text-[var(--app-text-muted)]">{titel}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${farbe ?? 'text-[var(--app-text)]'}`}>
        {leer && wert === '—' ? <span className="text-sm font-normal text-[var(--app-text-muted)]">{leer}</span> : wert}
      </p>
      {unter && <p className={`mt-0.5 text-[11px] ${unter.stil}`}>{unter.text}</p>}
    </>
  )
  const stil = 'rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-left'
  return onClick ? (
    <button type="button" onClick={onClick} className={`${stil} transition hover:bg-[var(--app-surface-muted)]`}>
      {inhalt}
    </button>
  ) : (
    <div className={stil}>{inhalt}</div>
  )
}

function AufgabeKarte({
  aufgabe: a,
  busy,
  gesperrt,
  onAktion,
  onVerwerfen,
}: {
  aufgabe: EtsyCockpitAufgabe
  busy: boolean
  gesperrt: boolean
  onAktion: (aktion: EtsyCockpitAktion, tausch?: TauschPlan[]) => void
  onVerwerfen: () => void
}) {
  const stil = TYP_STIL[a.typ]
  const aktion = a.aktion
  const [gewaehlt, setGewaehlt] = useState<number | null>(null)
  const [mehr, setMehr] = useState(false)

  const tausch: TauschPlan[] | null =
    aktion.art === 'tag_tausch'
      ? gewaehlt != null && gewaehlt !== aktion.tausch[0]?.listingId
        ? [
            {
              listingId: gewaehlt,
              listingTitle: aktion.listingOptionen?.find((o) => o.listingId === gewaehlt)?.title ?? '',
              altGrund: 'schwächster Tag wird automatisch ersetzt',
              neu: aktion.tausch[0]!.neu,
            },
          ]
        : aktion.tausch
      : null

  const primaerText =
    aktion.art === 'tag_tausch'
      ? aktion.tausch.length > 1
        ? `Alle ${aktion.tausch.length} übernehmen`
        : 'Übernehmen'
      : aktion.art === 'vorschlag'
        ? 'Auf Etsy übernehmen'
        : aktion.art === 'audit'
          ? 'KI-Check starten'
          : aktion.art === 'batch_audit'
            ? `${aktion.anzahl} jetzt prüfen`
            : aktion.art === 'merken'
              ? 'Merken'
              : aktion.modul === 'konkurrenz'
                ? 'Konkurrenz ansehen'
                : 'Listing öffnen'

  const zweitText = a.zweitAktion
    ? a.zweitAktion.art === 'merken'
      ? 'Nur merken'
      : a.zweitAktion.art === 'oeffnen'
        ? 'Details'
        : 'Mehr'
    : null

  const tauschSichtbar = tausch ? (mehr ? tausch : tausch.slice(0, 4)) : []

  return (
    <div
      className={`rounded-xl border border-[var(--app-border)] border-l-4 ${stil.rand} bg-[var(--app-surface)] p-3 ${
        gesperrt ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${stil.badge}`}>{stil.label}</span>
          <p className="mt-1 text-sm font-medium text-[var(--app-text)]">{a.titel}</p>
          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{a.detail}</p>
        </div>
      </div>

      {a.diff && (
        <div className="mt-2 space-y-1 text-xs">
          {a.diff.titelNeu && (
            <p className="text-[var(--app-text)]">
              <span className="text-[var(--app-text-muted)]">Neuer Titel: </span>
              {a.diff.titelNeu}
            </p>
          )}
          {(a.diff.plus.length > 0 || a.diff.minus.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {a.diff.plus.map((t) => (
                <span key={`+${t}`} className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                  +{t}
                </span>
              ))}
              {a.diff.minus.map((t) => (
                <span key={`-${t}`} className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-200 line-through">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {tausch && (
        <div className="mt-2 space-y-1">
          {aktion.art === 'tag_tausch' && (aktion.listingOptionen?.length ?? 0) > 1 && (
            <select
              value={gewaehlt ?? aktion.tausch[0]?.listingId}
              onChange={(e) => setGewaehlt(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs text-[var(--app-text)]"
            >
              {aktion.listingOptionen!.map((o) => (
                <option key={o.listingId} value={o.listingId}>
                  {o.title}
                </option>
              ))}
            </select>
          )}
          {tauschSichtbar.map((t) => (
            <p key={`${t.listingId}-${t.neu}`} className="text-xs text-[var(--app-text-muted)]">
              {tausch.length > 1 && <span className="text-[var(--app-text)]">{t.listingTitle.slice(0, 40)}: </span>}
              {t.alt ? (
                <>
                  <span className="text-rose-200 line-through">{t.alt}</span>{' '}
                  <span className="text-[10px]">({t.altGrund})</span> →{' '}
                </>
              ) : (
                <span className="text-[10px]">({t.altGrund}) </span>
              )}
              <span className="font-medium text-emerald-200">{t.neu}</span>
            </p>
          ))}
          {tausch.length > 4 && (
            <button type="button" onClick={() => setMehr((v) => !v)} className="text-[11px] text-sky-300 hover:underline">
              {mehr ? 'weniger' : `+${tausch.length - 4} weitere anzeigen`}
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || gesperrt}
          onClick={() => onAktion(aktion, tausch ?? undefined)}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          {busy ? 'Läuft…' : primaerText}
        </button>
        {a.zweitAktion && zweitText && (
          <button
            type="button"
            disabled={busy || gesperrt}
            onClick={() => onAktion(a.zweitAktion!)}
            className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:opacity-60"
          >
            {zweitText}
          </button>
        )}
        <button
          type="button"
          disabled={busy || gesperrt}
          onClick={onVerwerfen}
          className="ml-auto rounded-lg px-2 py-1.5 text-xs text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] disabled:opacity-60"
          title={a.typ === 'vorschlag' ? 'Vorschlag verwerfen' : '14 Tage ausblenden'}
        >
          {a.typ === 'vorschlag' ? 'Verwerfen' : 'Später'}
        </button>
      </div>
    </div>
  )
}

const URTEIL: Record<EtsyWirkung['urteil'], { text: string; stil: string }> = {
  besser: { text: 'wirkt', stil: 'bg-emerald-500/15 text-emerald-200' },
  schlechter: { text: 'schlechter', stil: 'bg-rose-500/15 text-rose-200' },
  gleich: { text: 'neutral', stil: 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]' },
  messung: { text: 'wird gemessen', stil: 'bg-sky-500/15 text-sky-200' },
}

function WirkungListe({
  wirkung,
  onOeffnen,
}: {
  wirkung: EtsyWirkung[]
  onOeffnen: (modul: EtsyCockpitModul, listingId?: number) => void
}) {
  return (
    <section className="app-section-shell">
      <div className="app-surface-card-header px-4 py-2.5 sm:px-5">
        <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">Wirkung deiner Änderungen</h2>
        <p className="text-xs text-[var(--app-text-muted)]">Aufrufe pro Tag vor vs. nach der Änderung (Urteil ab 7 Tagen).</p>
      </div>
      <ul className="divide-y divide-[var(--app-border)]/60 px-4 sm:px-5">
        {wirkung.map((w) => {
          const u = URTEIL[w.urteil]
          return (
            <li key={w.id} className="py-2.5">
              <button type="button" onClick={() => onOeffnen('seo', w.listingId)} className="w-full text-left">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm text-[var(--app-text)]">{w.listingTitle || `Listing ${w.listingId}`}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${u.stil}`}>{u.text}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[var(--app-text-muted)]">
                  {new Date(w.am).toLocaleDateString('de-DE')} · {w.beschreibung}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-[var(--app-text)]">
                  Aufrufe/Tag {zahl(w.viewsProTagVorher, 1)} → {zahl(w.viewsProTagNachher, 1)}
                  <span className="text-[var(--app-text-muted)]">
                    {' '}
                    · Fav./Tag {zahl(w.favProTagVorher, 1)} → {zahl(w.favProTagNachher, 1)} · Verkäufe {w.verkaeufeVorher} →{' '}
                    {w.verkaeufeNachher}
                  </span>
                </p>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
