'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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

export function PaInvestmentJournal({
  ticker,
  isin,
  name,
}: {
  ticker?: string | null
  isin?: string | null
  name?: string | null
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
        ).trim().toUpperCase()

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei Ticker-Wechsel neu laden
  }, [ticker])

  const aktivEintrag = useMemo(() => {
    const t = aktivTicker.toUpperCase()
    return (
      eintraege.find((e) => e.status === 'aktiv' && e.ticker === t) ??
      eintraege.find((e) => e.ticker === t) ??
      null
    )
  }, [eintraege, aktivTicker])

  const depotListe = useMemo(() => {
    if (scoped) return []
    const byTicker = new Map(eintraege.map((e) => [e.ticker, e]))
    const rows = depot.map((d) => ({
      ...d,
      journal: byTicker.get(d.ticker),
    }))
    // Journal-Einträge ohne Depot-Match hinten anhängen
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
  }, [depot, eintraege, scoped])

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
    setFortschritt('Leere Felder werden befüllt … (kann einige Minuten dauern)')
    try {
      const res = await fetch('/api/portfolio-analyse/journal/auto-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scoped && ticker ? { ticker } : {}),
        signal: AbortSignal.timeout(290_000),
      })
      const j = (await res.json()) as { ok?: boolean; zusammenfassung?: string; message?: string }
      if (!res.ok || !j.ok) throw new Error(j.message || 'Auto-Fill fehlgeschlagen')
      setFortschritt(j.zusammenfassung ?? 'Fertig')
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
    setFortschritt('Quartale werden gegengeprüft … (kann einige Minuten dauern)')
    try {
      const res = await fetch('/api/portfolio-analyse/journal/gegenpruefung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scoped && ticker ? { ticker } : {}),
        signal: AbortSignal.timeout(290_000),
      })
      const j = (await res.json()) as { ok?: boolean; zusammenfassung?: string; message?: string }
      if (!res.ok || !j.ok) throw new Error(j.message || 'Gegenprüfung fehlgeschlagen')
      setFortschritt(j.zusammenfassung ?? 'Fertig')
      await ladenDaten()
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Gegenprüfung fehlgeschlagen')
      setFortschritt(null)
    } finally {
      setBusyGp(false)
    }
  }

  const anzeigeName =
    name ??
    depot.find((d) => d.ticker === aktivTicker)?.name ??
    aktivEintrag?.name ??
    aktivTicker

  return (
    <PaCard className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--app-text)]">
            Investment-Journal
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
            These · Kaufgrund · Review in 6 Monaten · Quartals-Gegenprüfung
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busyFill || busyGp}
            onClick={() => void starteAutoFill()}
            className="rounded-lg border border-teal-500/40 bg-teal-500/15 px-3 py-1.5 text-xs font-semibold text-teal-100 hover:bg-teal-500/25 disabled:opacity-50"
          >
            {busyFill
              ? 'Befülle …'
              : scoped
                ? 'Leere Felder befüllen'
                : 'Leere Felder befüllen (Depot)'}
          </button>
          <button
            type="button"
            disabled={busyFill || busyGp}
            onClick={() => void starteGegenpruefung()}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {busyGp ? 'Prüfe …' : scoped ? 'Quartal gegenprüfen' : 'Quartale gegenprüfen'}
          </button>
        </div>
      </div>

      {fortschritt ? <p className="text-xs text-teal-300/90">{fortschritt}</p> : null}
      {fehler ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {fehler}
        </p>
      ) : null}
      {laden ? <p className="text-sm text-[var(--app-text-muted)]">Lade…</p> : null}

      {!scoped && depotListe.length > 0 ? (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-white/[0.06] p-2">
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
                    : 'hover:bg-white/[0.04] text-[var(--app-text)]'
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

      <div className="space-y-2">
        {scoped || aktivTicker ? (
          <p className="text-sm text-[var(--app-text)]">
            {anzeigeName}{' '}
            <span className="text-[var(--app-text-muted)]">{aktivTicker || ticker}</span>
          </p>
        ) : (
          <input
            className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-sm"
            placeholder="Ticker"
            value={aktivTicker}
            onChange={(e) => setAktivTicker(e.target.value.toUpperCase())}
          />
        )}
        <textarea
          className="min-h-[72px] w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-sm"
          placeholder="These"
          value={these}
          onChange={(e) => setThese(e.target.value)}
        />
        <textarea
          className="min-h-[56px] w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-sm"
          placeholder="Kaufgrund"
          value={kaufgrund}
          onChange={(e) => setKaufgrund(e.target.value)}
        />
        <textarea
          className="min-h-[56px] w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-sm"
          placeholder="Watchpoints"
          value={watchpoints}
          onChange={(e) => setWatchpoints(e.target.value)}
        />
        <button
          type="button"
          className="rounded-md bg-teal-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-50"
          disabled={speichern || !(aktivTicker || ticker)}
          onClick={() => void speichere()}
        >
          {speichern ? 'Speichere…' : 'Speichern'}
        </button>
      </div>

      <div className="space-y-2 border-t border-[var(--app-border)]/50 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
          Gegenprüfung
        </h3>
        {gpFuerAktiv[0] ? (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <PaBadge variant={statusBadgeVariant(gpFuerAktiv[0].status)}>
                {statusLabel(gpFuerAktiv[0].status)}
              </PaBadge>
              <span className="text-[11px] text-[var(--app-text-muted)]">
                {gpFuerAktiv[0].quartalLabel} · {formatDatum(gpFuerAktiv[0].erstelltAm)}
                {gpFuerAktiv[0].kiModell ? ` · ${gpFuerAktiv[0].kiModell}` : ''}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--app-text)]/90">
              {gpFuerAktiv[0].fazit}
            </p>
          </div>
        ) : (
          <p className="text-[12px] text-[var(--app-text-muted)]">
            Noch keine Gegenprüfung. Button „Quartale gegenprüfen“ starten.
          </p>
        )}
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
