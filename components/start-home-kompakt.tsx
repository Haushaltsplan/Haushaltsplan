'use client'

import { DonutChart } from '@/components/finanzen/donut-chart'
import { DetailsDisclosureTriggerEnd } from '@/components/collapsible-ui'
import { PageSectionPanel } from '@/components/page-shell'
import { WhoopRing, recoveryColor } from '@/components/fitnessdaten/whoop-ring'
import { baueWhoopDashboard } from '@/lib/fitnessdaten/metrics-engine'
import { ladeFitnessSnapshot } from '@/lib/fitnessdaten/history-storage'
import { WHOOP_BLE_SNAPSHOT_EVENT } from '@/lib/fitnessdaten/whoop-ble-keepalive'
import { WHOOP_CLOUD_SYNC_EVENT } from '@/lib/fitnessdaten/whoop-cloud-merge'
import {
  KALENDER_SYNC_EVENT,
  filterEintraegeFuerTag,
  heuteAlsIsoDatum,
  kalenderKategorieMeta,
  ladeKalenderEintraegeVonQuelleMitMeta,
  sortiereEintraegeNachUhrzeitDannTitel,
  type KalenderEintrag,
} from '@/lib/haushalt-kalender'
import { ladeAnkuendigteDividendenDepot } from '@/lib/portfolio-analyse/ankuendigte-dividenden-client'
import { positionenFuerBewertung } from '@/lib/portfolio-analyse/bestand'
import { formatEur } from '@/lib/portfolio-analyse/berechnung'
import { eintraegeZuDonut, gewichtungNachAsset } from '@/lib/portfolio-analyse/gewichtung'
import { ladeIsinMetadaten } from '@/lib/portfolio-analyse/isin-metadata-client'
import {
  berechneLivePortfolio,
  ladeLiveKurseClient,
  symboleAusMeta,
} from '@/lib/portfolio-analyse/live-bewertung'
import { ladePortfolioAnalyseDaten } from '@/lib/portfolio-analyse/portfolio-analyse-db'
import { sammleIsins } from '@/lib/portfolio-analyse/auswertungen'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

function StartLink({ href, label }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-zinc-300 transition hover:bg-white/[0.08]"
    >
      {label ?? 'Öffnen →'}
    </Link>
  )
}

function StartKarte({ href, children }: { href: string; children: ReactNode }) {
  return (
    <PageSectionPanel density="compact">
      <div className="flex justify-end">
        <StartLink href={href} />
      </div>
      <div className="mt-2">{children}</div>
    </PageSectionPanel>
  )
}

export function StartKalenderKompakt() {
  const [eintraege, setEintraege] = useState<KalenderEintrag[]>([])
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      void ladeKalenderEintraegeVonQuelleMitMeta().then(({ eintraege: e }) => {
        if (!cancelled) {
          setEintraege(e)
          setLaden(false)
        }
      })
    }
    load()
    const onSync = () => load()
    window.addEventListener(KALENDER_SYNC_EVENT, onSync)
    return () => {
      cancelled = true
      window.removeEventListener(KALENDER_SYNC_EVENT, onSync)
    }
  }, [])

  const kommende = useMemo(() => {
    const heute = heuteAlsIsoDatum()
    const in7 = new Date()
    in7.setDate(in7.getDate() + 7)
    const ende = in7.toISOString().slice(0, 10)
    return [...eintraege]
      .filter((e) => e.datum >= heute && e.datum <= ende)
      .sort((a, b) => a.datum.localeCompare(b.datum) || a.uhrzeit.localeCompare(b.uhrzeit))
      .slice(0, 5)
  }, [eintraege])

  const heute = heuteAlsIsoDatum()
  const heuteListe = filterEintraegeFuerTag(eintraege, heute).sort(
    sortiereEintraegeNachUhrzeitDannTitel,
  )

  return (
    <StartKarte href="/kalender">
      {laden ? (
        <p className="text-xs text-zinc-500">Lade Termine …</p>
      ) : heuteListe.length === 0 && kommende.length === 0 ? (
        <p className="text-xs text-zinc-500">Keine Termine in den nächsten 7 Tagen.</p>
      ) : (
        <ul className="space-y-2">
          {(heuteListe.length > 0 ? heuteListe : kommende).map((ev) => {
            const kat = kalenderKategorieMeta(ev.kategorie)
            return (
              <li
                key={ev.id}
                className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-2"
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${kat.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{ev.titel || 'Termin'}</p>
                  <p className="text-[11px] text-zinc-500">
                    {ev.datum === heute ? 'Heute' : ev.datum}
                    {ev.uhrzeit ? ` · ${ev.uhrzeit}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </StartKarte>
  )
}

export function StartWhoopKompakt() {
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const bump = () => setRevision((r) => r + 1)
    window.addEventListener(WHOOP_CLOUD_SYNC_EVENT, bump)
    window.addEventListener(WHOOP_BLE_SNAPSHOT_EVENT, bump)
    return () => {
      window.removeEventListener(WHOOP_CLOUD_SYNC_EVENT, bump)
      window.removeEventListener(WHOOP_BLE_SNAPSHOT_EVENT, bump)
    }
  }, [])

  const { heute } = useMemo(() => baueWhoopDashboard(ladeFitnessSnapshot()), [revision])
  const hasData =
    heute.sleepScore != null || heute.recoveryPercent != null || heute.strain != null

  return (
    <StartKarte href="/fitnessdaten">
      {!hasData ? (
        <p className="text-xs leading-relaxed text-zinc-500">
          Noch keine Daten — WHOOP verbinden oder Cloud-Sync starten.
        </p>
      ) : (
        <div className="flex items-end justify-center gap-4 sm:gap-6">
          <WhoopRing
            value={heute.sleepScore ?? 0}
            label="Schlaf"
            color="#7b61ff"
            size={76}
            stroke={5}
            unavailable={heute.sleepScore == null}
            onPress={() => {}}
          />
          <WhoopRing
            value={heute.recoveryPercent ?? 0}
            label="Erholung"
            color={recoveryColor(heute.recoveryPercent)}
            size={96}
            stroke={7}
            unavailable={heute.recoveryPercent == null}
            onPress={() => {}}
          />
          <WhoopRing
            value={heute.strain ?? 0}
            max={21}
            label="Belastung"
            color="#009dff"
            size={76}
            stroke={5}
            unavailable={heute.strain == null}
            onPress={() => {}}
          />
        </div>
      )}
    </StartKarte>
  )
}

export function StartPortfolioKompakt() {
  const [laden, setLaden] = useState(true)
  const [depotwert, setDepotwert] = useState<number | null>(null)
  const [donut, setDonut] = useState<ReturnType<typeof eintraegeZuDonut>>([])
  const [dividenden, setDividenden] = useState<
    Array<{ label: string; datum: string; betrag: string }>
  >([])
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLaden(true)
      setFehler(null)
      try {
        const res = await ladePortfolioAnalyseDaten()
        if (!res.ok || res.buchungen.length === 0) {
          if (!cancelled) {
            setDepotwert(null)
            setDonut([])
            setDividenden([])
          }
          return
        }
        const isins = sammleIsins(res.buchungen, res.snapshot)
        const meta = isins.length > 0 ? await ladeIsinMetadaten(isins) : new Map()
        const pos = positionenFuerBewertung(res.buchungen, res.snapshot)
        const sym = symboleAusMeta(pos, meta)
        const { kurse, stand, fx, stooqEur } = await ladeLiveKurseClient(sym)
        const live = berechneLivePortfolio(res.buchungen, res.snapshot, meta, kurse, stand, fx, stooqEur)
        if (cancelled) return
        setDepotwert(live.kennzahlen.depotwertEur)
        setDonut(eintraegeZuDonut(gewichtungNachAsset(live.positionen), 8))
        try {
          const div = await ladeAnkuendigteDividendenDepot(live.positionen, meta)
          const rows =
            div?.eintraege
              .sort((a, b) => a.zahlungsdatumIso.localeCompare(b.zahlungsdatumIso))
              .slice(0, 4)
              .map((e) => ({
                label: e.name,
                datum: e.zahlungsdatumIso,
                betrag: formatEur(e.gesamtEur),
              })) ?? []
          if (!cancelled) setDividenden(rows)
        } catch {
          if (!cancelled) setDividenden([])
        }
      } catch (e) {
        if (!cancelled) setFehler(e instanceof Error ? e.message : 'Portfolio nicht geladen')
      } finally {
        if (!cancelled) setLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <StartKarte href="/portfolioanalyse">
      {laden ? (
        <p className="text-xs text-zinc-500">Lade Depot …</p>
      ) : fehler ? (
        <p className="text-xs text-amber-300/90">{fehler}</p>
      ) : depotwert == null ? (
        <p className="text-xs text-zinc-500">Noch keine Buchungen — Portfolio importieren.</p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex shrink-0 items-center gap-3">
            {donut.length > 0 ? (
              <DonutChart
                segmente={donut}
                groesse={120}
                dicke={18}
                mitte={{ label: 'Depot', wert: formatEur(depotwert) }}
                interaktiv={false}
              />
            ) : null}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Depotwert</p>
              <p className="text-2xl font-bold tabular-nums text-white">{formatEur(depotwert)}</p>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Nächste Dividenden
            </p>
            {dividenden.length === 0 ? (
              <p className="mt-1 text-xs text-zinc-600">Keine angekündigt.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {dividenden.map((d) => (
                  <li
                    key={`${d.label}-${d.datum}`}
                    className="flex items-baseline justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-zinc-300">{d.label}</span>
                    <span className="shrink-0 tabular-nums text-zinc-500">
                      {d.datum.slice(8, 10)}.{d.datum.slice(5, 7)}. · {d.betrag}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/portfolioanalyse/dividenden"
              className="mt-2 inline-block text-[11px] text-violet-300/90 underline-offset-2 hover:underline"
            >
              Dividendenkalender →
            </Link>
          </div>
        </div>
      )}
    </StartKarte>
  )
}

function aktuellerMonatSchluessel(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function StartFinanzenKompakt() {
  const [laden, setLaden] = useState(true)
  const [saldo, setSaldo] = useState(0)
  const [ein, setEin] = useState(0)
  const [aus, setAus] = useState(0)
  const monat = aktuellerMonatSchluessel()

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLaden(true)
      const [{ data: einnahmen }, { data: ausgaben }] = await Promise.all([
        supabase.from('einnahmen').select('betrag, datum'),
        supabase.from('ausgaben').select('betrag, datum'),
      ])
      if (cancelled) return
      const filterMonat = (rows: Array<{ betrag?: number; datum?: string }> | null) =>
        (rows ?? []).filter((r) => (r.datum ?? '').slice(0, 7) === monat)
      const einRows = filterMonat(einnahmen)
      const ausRows = filterMonat(ausgaben)
      const gesEin = einRows.reduce((s, r) => s + Number(r.betrag || 0), 0)
      const gesAus = ausRows.reduce((s, r) => s + Number(r.betrag || 0), 0)
      setEin(gesEin)
      setAus(gesAus)
      setSaldo(gesEin - gesAus)
      setLaden(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [monat])

  const monatLabel = new Date(`${monat}-01`).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <StartKarte href="/finanzen">
      {laden ? (
        <p className="text-xs text-zinc-500">Lade Buchungen …</p>
      ) : (
        <>
          <p className="text-[11px] text-zinc-500">{monatLabel}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">Saldo</p>
              <p
                className={`mt-1 text-lg font-bold tabular-nums ${saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {saldo.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">Einnahmen</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-emerald-300/90">
                {ein.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">Ausgaben</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-rose-300/90">
                {aus.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
          </div>
        </>
      )}
    </StartKarte>
  )
}
