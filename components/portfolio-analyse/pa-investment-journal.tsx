'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PaBadge, PaCard } from '@/components/portfolio-analyse/pa-ui'
import type {
  JournalEintrag,
  JournalGegenpruefung,
  JournalGegenpruefungStatus,
} from '@/lib/portfolio-analyse/investment-journal-types'

type DepotZeile = {
  isin: string
  name: string
  ticker: string
  symbolYahoo: string | null
}

function statusBadgeVariant(
  s: JournalGegenpruefungStatus | null | undefined,
): 'positive' | 'sell' | 'negative' | 'neutral' {
  if (s === 'intakt') return 'positive'
  if (s === 'unter_beobachtung') return 'sell'
  if (s === 'beschaedigt') return 'negative'
  return 'neutral'
}

function statusLabel(s: JournalGegenpruefungStatus | null | undefined): string {
  if (s === 'intakt') return 'Intakt'
  if (s === 'unter_beobachtung') return 'Unter Beobachtung'
  if (s === 'beschaedigt') return 'Beschädigt'
  return '—'
}

function formatDatum(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function felderLeer(e: JournalEintrag | undefined): boolean {
  if (!e) return true
  return !e.these.trim() || !e.kaufgrund.trim() || !e.watchpoints.trim()
}

function Feld({
  label,
  hint,
  value,
  onChange,
  kompakt,
  rows,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  kompakt?: boolean
  rows?: number
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span
          className={`font-semibold tracking-wide text-teal-200/90 ${
            kompakt ? 'text-[10px] uppercase' : 'text-[11px] uppercase'
          }`}
        >
          {label}
        </span>
        {hint ? <span className="text-[10px] text-[var(--app-text-muted)]">{hint}</span> : null}
      </span>
      <textarea
        className={`w-full resize-y rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-[var(--app-text)] outline-none transition focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20 ${
          kompakt ? 'min-h-[4.5rem] text-[12.5px] leading-relaxed' : 'min-h-[4.75rem] text-[13px] leading-relaxed'
        }`}
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        rows={rows ?? (kompakt ? 3 : 4)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
      />
    </label>
  )
}

export function PaInvestmentJournal({
  ticker,
  isin,
  name,
  /** Kompakte Karte unter dem Kurschart in der Übersicht */
  unterChart = false,
}: {
  ticker?: string | null
  isin?: string | null
  name?: string | null
  unterChart?: boolean
}) {
  const scoped = Boolean(ticker?.trim())
  const [eintraege, setEintraege] = useState<JournalEintrag[]>([])
  const [depot, setDepot] = useState<DepotZeile[]>([])
  const [gegenpruefungen, setGegenpruefungen] = useState<JournalGegenpruefung[]>([])
  const [aktivTicker, setAktivTicker] = useState((ticker ?? '').toUpperCase())
  const [these, setThese] = useState('')
  const [kaufgrund, setKaufgrund] = useState('')
  const [watchpoints, setWatchpoints] = useState('')
  const [laden, setLaden] = useState(false)
  const [speichern, setSpeichern] = useState(false)
  const [busyFill, setBusyFill] = useState(false)
  const [busyGp, setBusyGp] = useState(false)
  const [fortschritt, setFortschritt] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const ladenDaten = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const qs = scoped
        ? `?ticker=${encodeURIComponent(ticker!.trim().toUpperCase())}`
        : '?depot=1'
      const res = await fetch(`/api/portfolio-analyse/journal${qs}`, { cache: 'no-store' })
      const j = (await res.json()) as {
        ok?: boolean
        eintraege?: JournalEintrag[]
        depot?: DepotZeile[]
        message?: string
      }
      if (!res.ok || j.ok === false) throw new Error(j.message || 'Laden fehlgeschlagen')
      const list = j.eintraege ?? []
      setEintraege(list)
      setDepot(j.depot ?? [])

      setAktivTicker((prev) => {
        const t = (
          ticker?.trim().toUpperCase() ||
          prev ||
          list.find((e) => e.status === 'aktiv')?.ticker ||
          j.depot?.[0]?.ticker ||
          ''
        )
          .trim()
          .toUpperCase()

        const aktiv =
          list.find((e) => e.status === 'aktiv' && e.ticker === t) ??
          list.find((e) => e.status === 'aktiv') ??
          null
        if (aktiv) {
          setThese(aktiv.these)
          setKaufgrund(aktiv.kaufgrund)
          setWatchpoints(aktiv.watchpoints)
        } else if (scoped) {
          setThese('')
          setKaufgrund('')
          setWatchpoints('')
        }

        void fetch(
          `/api/portfolio-analyse/journal/gegenpruefung${t ? `?ticker=${encodeURIComponent(t)}` : ''}`,
          { cache: 'no-store' },
        )
          .then((r) => r.json())
          .then((gpJ: { eintraege?: JournalGegenpruefung[] }) =>
            setGegenpruefungen(gpJ.eintraege ?? []),
          )
          .catch(() => undefined)

        return t
      })
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
    } finally {
      setLaden(false)
    }
  }, [ticker, scoped])

  useEffect(() => {
    void ladenDaten()
  }, [ticker, ladenDaten])

  const aktivEintrag = useMemo(() => {
    const t = aktivTicker.toUpperCase()
    return (
      eintraege.find((e) => e.status === 'aktiv' && e.ticker === t) ??
      eintraege.find((e) => e.ticker === t) ??
      null
    )
  }, [eintraege, aktivTicker])

  const depotListe = useMemo(() => {
    if (scoped || unterChart) return []
    const byTicker = new Map(eintraege.map((e) => [e.ticker, e]))
    const rows = depot.map((d) => ({
      ...d,
      journal: byTicker.get(d.ticker),
    }))
    for (const e of eintraege) {
      if (!rows.some((r) => r.ticker === e.ticker)) {
        rows.push({
          isin: e.isin ?? '',
          name: e.name,
          ticker: e.ticker,
          symbolYahoo: null,
          journal: e,
        })
      }
    }
    return rows
  }, [depot, eintraege, scoped, unterChart])

  const gpFuerAktiv = useMemo(
    () => gegenpruefungen.filter((g) => g.ticker === aktivTicker),
    [gegenpruefungen, aktivTicker],
  )

  function waehleTicker(t: string, j?: JournalEintrag) {
    setAktivTicker(t)
    if (j) {
      setThese(j.these)
      setKaufgrund(j.kaufgrund)
      setWatchpoints(j.watchpoints)
    } else {
      const hit = eintraege.find((e) => e.ticker === t)
      setThese(hit?.these ?? '')
      setKaufgrund(hit?.kaufgrund ?? '')
      setWatchpoints(hit?.watchpoints ?? '')
    }
    void fetch(`/api/portfolio-analyse/journal/gegenpruefung?ticker=${encodeURIComponent(t)}`, {
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((j: { eintraege?: JournalGegenpruefung[] }) => setGegenpruefungen(j.eintraege ?? []))
      .catch(() => undefined)
  }

  async function speichere() {
    const t = (aktivTicker || ticker || '').trim().toUpperCase()
    if (!t) return
    setSpeichern(true)
    setFehler(null)
    try {
      const depotHit = depot.find((d) => d.ticker === t)
      await fetch('/api/portfolio-analyse/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: aktivEintrag?.id,
          ticker: t,
          isin: isin ?? depotHit?.isin ?? aktivEintrag?.isin,
          name: name ?? depotHit?.name ?? aktivEintrag?.name ?? t,
          these,
          kaufgrund,
          watchpoints,
          status: 'aktiv',
        }),
      })
      await ladenDaten()
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSpeichern(false)
    }
  }

  async function starteAutoFill() {
    setBusyFill(true)
    setFehler(null)
    setFortschritt('Leere Felder werden befüllt …')
    try {
      const res = await fetch('/api/portfolio-analyse/journal/auto-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          scoped && ticker
            ? { ticker, isin: isin ?? undefined, name: name ?? undefined }
            : {},
        ),
        signal: AbortSignal.timeout(290_000),
      })
      const j = (await res.json()) as {
        ok?: boolean
        zusammenfassung?: string
        message?: string
        ergebnisse?: Array<{ ticker?: string; status?: string; message?: string }>
      }
      if (!res.ok || !j.ok) throw new Error(j.message || 'Auto-Fill fehlgeschlagen')
      const fehlerZeilen = (j.ergebnisse ?? []).filter((e) => e.status === 'fehler')
      if (fehlerZeilen.length > 0) {
        const details = fehlerZeilen
          .map((e) => `${e.ticker ?? '?'}: ${e.message || 'unbekannter Fehler'}`)
          .join(' · ')
        setFehler(details)
        setFortschritt(j.zusammenfassung ?? null)
      } else {
        setFortschritt(j.zusammenfassung ?? 'Fertig')
      }
      await ladenDaten()
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Auto-Fill fehlgeschlagen')
      setFortschritt(null)
    } finally {
      setBusyFill(false)
    }
  }

  async function starteGegenpruefung() {
    setBusyGp(true)
    setFehler(null)
    setFortschritt('Quartale werden gegengeprüft …')
    try {
      const res = await fetch('/api/portfolio-analyse/journal/gegenpruefung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scoped && ticker ? { ticker } : {}),
        signal: AbortSignal.timeout(290_000),
      })
      const j = (await res.json()) as {
        ok?: boolean
        zusammenfassung?: string
        message?: string
        ergebnisse?: Array<{ ticker?: string; status?: string; message?: string }>
      }
      if (!res.ok || !j.ok) throw new Error(j.message || 'Gegenprüfung fehlgeschlagen')
      const fehlerZeilen = (j.ergebnisse ?? []).filter((e) => e.status === 'fehler')
      const skipZeilen = (j.ergebnisse ?? []).filter((e) => e.status === 'uebersprungen')
      if (fehlerZeilen.length > 0) {
        setFehler(
          fehlerZeilen.map((e) => `${e.ticker ?? '?'}: ${e.message || 'Fehler'}`).join(' · '),
        )
      } else if (
        skipZeilen.length > 0 &&
        (j.ergebnisse ?? []).every((e) => e.status !== 'geprueft')
      ) {
        setFehler(skipZeilen.map((e) => `${e.ticker ?? '?'}: ${e.message || 'übersprungen'}`).join(' · '))
      }
      setFortschritt(j.zusammenfassung ?? 'Fertig')
      await ladenDaten()
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Gegenprüfung fehlgeschlagen')
      setFortschritt(null)
    } finally {
      setBusyGp(false)
    }
  }

  const aktionen: ReactNode = (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        disabled={busyFill || busyGp}
        onClick={() => void starteAutoFill()}
        className="rounded-lg border border-teal-500/35 bg-teal-500/10 px-2.5 py-1 text-[11px] font-semibold text-teal-100 hover:bg-teal-500/20 disabled:opacity-50"
      >
        {busyFill ? 'Befülle …' : unterChart ? 'Befüllen' : scoped ? 'Leere Felder befüllen' : 'Leere Felder befüllen (Depot)'}
      </button>
      <button
        type="button"
        disabled={busyFill || busyGp}
        onClick={() => void starteGegenpruefung()}
        className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
      >
        {busyGp ? 'Prüfe …' : unterChart ? 'Gegenprüfen' : scoped ? 'Quartal gegenprüfen' : 'Quartale gegenprüfen'}
      </button>
      <button
        type="button"
        className="rounded-lg bg-teal-600/85 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
        disabled={speichern || !(aktivTicker || ticker)}
        onClick={() => void speichere()}
      >
        {speichern ? '…' : 'Speichern'}
      </button>
    </div>
  )

  const gpStrip =
    gpFuerAktiv[0] != null ? (
      <div
        className={`rounded-xl border px-3 py-2.5 ${
          gpFuerAktiv[0].status === 'intakt'
            ? 'border-emerald-500/25 bg-emerald-500/[0.07]'
            : gpFuerAktiv[0].status === 'beschaedigt'
              ? 'border-rose-500/25 bg-rose-500/[0.07]'
              : 'border-amber-500/25 bg-amber-500/[0.07]'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <PaBadge variant={statusBadgeVariant(gpFuerAktiv[0].status)}>
            {statusLabel(gpFuerAktiv[0].status)}
          </PaBadge>
          <span className="text-[10px] text-[var(--app-text-muted)]">
            {gpFuerAktiv[0].quartalLabel} · {formatDatum(gpFuerAktiv[0].erstelltAm)}
          </span>
        </div>
        <p
          className={`mt-1.5 text-[var(--app-text)]/90 ${unterChart ? 'line-clamp-4 text-[12px]' : 'text-[13px]'} leading-relaxed`}
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {gpFuerAktiv[0].fazit}
        </p>
        {!unterChart && Array.isArray(gpFuerAktiv[0].details?.ankerVergleiche) && (gpFuerAktiv[0].details.ankerVergleiche as unknown[]).length > 0 ? (
          <ul className="mt-2 space-y-0.5 border-t border-white/[0.06] pt-2">
            {(gpFuerAktiv[0].details.ankerVergleiche as unknown[]).slice(0, 6).map((a, i) => (
              <li key={i} className="text-[11px] text-[var(--app-text-muted)]">
                · {String(a)}
              </li>
            ))}
          </ul>
        ) : null}
        {!unterChart && Array.isArray(gpFuerAktiv[0].details?.watchpointTreffer) && (gpFuerAktiv[0].details.watchpointTreffer as unknown[]).length > 0 ? (
          <ul className="mt-1.5 space-y-0.5">
            {(gpFuerAktiv[0].details.watchpointTreffer as unknown[]).slice(0, 6).map((a, i) => (
              <li key={`wp-${i}`} className="text-[11px] text-teal-100/80">
                · {String(a)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    ) : (
      <p className="text-[11px] text-[var(--app-text-muted)]">
        Noch keine Gegenprüfung — These mit festen Ankerzahlen befüllen, dann prüfen.
      </p>
    )

  if (unterChart) {
    return (
      <div className="border-t border-[var(--app-border)] bg-gradient-to-b from-white/[0.03] to-transparent px-3 py-3 sm:px-4">
        <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-[12px] font-semibold tracking-tight text-[var(--app-text)]">
              Investment-Journal
            </h3>
            <p className="text-[10px] text-[var(--app-text-muted)]">
              These mit Ankerzahlen · Quartals-Check
            </p>
          </div>
          {aktionen}
        </div>
        {fortschritt ? <p className="mb-2 text-[11px] text-teal-300/90">{fortschritt}</p> : null}
        {fehler ? (
          <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100">
            {fehler}
          </p>
        ) : null}
        {laden ? <p className="text-[11px] text-[var(--app-text-muted)]">Lade…</p> : null}
        <div className="space-y-2.5">
          <Feld
            label="These"
            hint="mit festen Kennzahlen"
            value={these}
            onChange={setThese}
            kompakt
            rows={3}
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Feld label="Kaufgrund" value={kaufgrund} onChange={setKaufgrund} kompakt rows={3} />
            <Feld
              label="Watchpoints"
              hint="prüfbare Schwellen"
              value={watchpoints}
              onChange={setWatchpoints}
              kompakt
              rows={3}
            />
          </div>
          {gpStrip}
        </div>
      </div>
    )
  }

  return (
    <PaCard variant="glass" className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--app-text)]">
            Investment-Journal
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
            These mit festen Ankerzahlen · Kaufgrund · Watchpoints · Quartals-Gegenprüfung
          </p>
        </div>
        {aktionen}
      </div>

      {fortschritt ? <p className="text-xs text-teal-300/90">{fortschritt}</p> : null}
      {fehler ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {fehler}
        </p>
      ) : null}
      {laden ? <p className="text-sm text-[var(--app-text-muted)]">Lade…</p> : null}

      {!scoped && depotListe.length > 0 ? (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-white/[0.06] bg-black/10 p-2">
          {depotListe.map((row) => {
            const aktiv = row.ticker === aktivTicker
            const leer = felderLeer(row.journal)
            return (
              <button
                key={row.ticker}
                type="button"
                onClick={() => waehleTicker(row.ticker, row.journal)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition ${
                  aktiv
                    ? 'bg-teal-500/15 text-teal-50'
                    : 'text-[var(--app-text)] hover:bg-white/[0.04]'
                }`}
              >
                <span className="min-w-0">
                  <span className="font-semibold">{row.ticker}</span>
                  <span className="ml-2 truncate text-[var(--app-text-muted)]">{row.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <PaBadge variant={leer ? 'neutral' : 'positive'}>
                    {leer ? 'leer' : 'befüllt'}
                  </PaBadge>
                  {row.journal?.letzteGegenpruefungStatus ? (
                    <PaBadge variant={statusBadgeVariant(row.journal.letzteGegenpruefungStatus)}>
                      {statusLabel(row.journal.letzteGegenpruefungStatus)}
                    </PaBadge>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="space-y-3">
        {scoped || aktivTicker ? (
          <p className="text-sm text-[var(--app-text)]">
            {name ??
              depot.find((d) => d.ticker === aktivTicker)?.name ??
              aktivEintrag?.name ??
              aktivTicker}{' '}
            <span className="text-[var(--app-text-muted)]">{aktivTicker || ticker}</span>
          </p>
        ) : (
          <input
            className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-sm"
            placeholder="Ticker"
            value={aktivTicker}
            onChange={(e) => setAktivTicker(e.target.value.toUpperCase())}
          />
        )}
        <Feld label="These" hint="mit festen Kennzahlen aus Key Metrics" value={these} onChange={setThese} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label="Kaufgrund" value={kaufgrund} onChange={setKaufgrund} />
          <Feld label="Watchpoints" hint="prüfbare Schwellen" value={watchpoints} onChange={setWatchpoints} />
        </div>
      </div>

      <div className="space-y-2 border-t border-white/[0.06] pt-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
          Gegenprüfung
        </h3>
        {gpStrip}
        {gpFuerAktiv.length > 1 ? (
          <ul className="space-y-1.5">
            {gpFuerAktiv.slice(1, 6).map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                <PaBadge variant={statusBadgeVariant(g.status)}>{statusLabel(g.status)}</PaBadge>
                <span className="text-[var(--app-text-muted)]">
                  {g.quartalLabel} · {formatDatum(g.erstelltAm)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </PaCard>
  )
}
