'use client'

import { DonutChart } from '@/components/finanzen/donut-chart'
import {
  StartLeer,
  StartMiniKachel,
  StartSektion,
  StartSkeleton,
} from '@/components/start-home-ui'
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
import {
  ladeAnkuendigteDividendenDepot,
  ladeAnkuendigteDividendenDepotAusLocalCache,
} from '@/lib/portfolio-analyse/ankuendigte-dividenden-client'
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
import { useEffect, useMemo, useState } from 'react'

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
  const liste = heuteListe.length > 0 ? heuteListe : kommende

  return (
    <StartSektion titel="Kalender" icon="📅" href="/kalender" akzent="rose">
      {laden ? (
        <StartSkeleton zeilen={3} />
      ) : liste.length === 0 ? (
        <StartLeer text="Keine Termine in den nächsten 7 Tagen." />
      ) : (
        <ul className="space-y-2">
          {liste.map((ev) => {
            const kat = kalenderKategorieMeta(ev.kategorie)
            return (
              <li
                key={ev.id}
                className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${kat.listBorder} ${kat.listBg}`}
              >
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${kat.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--app-text)]">{ev.titel || 'Termin'}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
                    {ev.datum === heute ? 'Heute' : ev.datum}
                    {ev.uhrzeit ? ` · ${ev.uhrzeit}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </StartSektion>
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
    <StartSektion
      titel="WHOOP"
      icon="◉"
      href="/fitnessdaten"
      akzent="whoop"
      innerClassName={hasData ? 'bg-[#050505]/80' : undefined}
    >
      {!hasData ? (
        <StartLeer text="Noch keine Daten — WHOOP verbinden oder Cloud-Sync starten." />
      ) : (
        <div className="flex items-end justify-center gap-3 py-1 sm:gap-6">
          <WhoopRing
            value={heute.sleepScore ?? 0}
            label="Schlaf"
            color="#7b61ff"
            size={80}
            stroke={6}
            unavailable={heute.sleepScore == null}
            onPress={() => {}}
          />
          <WhoopRing
            value={heute.recoveryPercent ?? 0}
            label="Erholung"
            color={recoveryColor(heute.recoveryPercent)}
            size={100}
            stroke={8}
            unavailable={heute.recoveryPercent == null}
            onPress={() => {}}
          />
          <WhoopRing
            value={heute.strain ?? 0}
            max={21}
            label="Belastung"
            color="#009dff"
            size={80}
            stroke={6}
            unavailable={heute.strain == null}
            onPress={() => {}}
          />
        </div>
      )}
    </StartSektion>
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
        const divCached = ladeAnkuendigteDividendenDepotAusLocalCache(live.positionen, meta)
        const mapDivRows = (div: NonNullable<typeof divCached>) =>
          div.eintraege
            .sort((a, b) => a.zahlungsdatumIso.localeCompare(b.zahlungsdatumIso))
            .slice(0, 4)
            .map((e) => ({
              label: e.name,
              datum: e.zahlungsdatumIso,
              betrag: formatEur(e.gesamtEur),
            }))
        if (divCached && !cancelled) setDividenden(mapDivRows(divCached))
        try {
          const div = await ladeAnkuendigteDividendenDepot(live.positionen, meta)
          if (!cancelled) setDividenden(div ? mapDivRows(div) : [])
        } catch {
          if (!cancelled && !divCached) setDividenden([])
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
    <StartSektion titel="Portfolio" icon="◎" href="/portfolioanalyse" akzent="violet">
      {laden ? (
        <StartSkeleton zeilen={2} />
      ) : fehler ? (
        <p className="text-xs text-amber-300/90">{fehler}</p>
      ) : depotwert == null ? (
        <StartLeer text="Noch keine Buchungen — Portfolio importieren." />
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center justify-center gap-4">
            {donut.length > 0 ? (
              <DonutChart
                segmente={donut}
                groesse={128}
                dicke={20}
                mitte={{ label: 'Depot', wert: formatEur(depotwert) }}
                interaktiv={false}
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
                Depotwert
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-white">
                {formatEur(depotwert)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
                Nächste Dividenden
              </p>
              {dividenden.length === 0 ? (
                <p className="mt-1 text-xs text-[var(--app-text-muted)]">Keine angekündigt.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {dividenden.map((d) => (
                    <li
                      key={`${d.label}-${d.datum}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-violet-500/5 px-2.5 py-1.5 text-xs"
                    >
                      <span className="truncate font-medium text-[var(--app-text)]">{d.label}</span>
                      <span className="shrink-0 tabular-nums text-[var(--app-text-muted)]">
                        {d.datum.slice(8, 10)}.{d.datum.slice(5, 7)}. · {d.betrag}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/portfolioanalyse/dividenden"
                className="mt-2 inline-block text-[11px] font-medium text-violet-300/90 underline-offset-2 hover:underline"
              >
                Dividendenkalender →
              </Link>
            </div>
          </div>
        </div>
      )}
    </StartSektion>
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
      const gesEin = filterMonat(einnahmen).reduce((s, r) => s + Number(r.betrag || 0), 0)
      const gesAus = filterMonat(ausgaben).reduce((s, r) => s + Number(r.betrag || 0), 0)
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
    <StartSektion titel="Finanzen" icon="€" href="/finanzen" akzent="teal">
      {laden ? (
        <StartSkeleton />
      ) : (
        <>
          <p className="mb-3 text-xs font-medium text-[var(--app-text-muted)]">{monatLabel}</p>
          <div className="grid grid-cols-3 gap-2.5">
            <StartMiniKachel
              label="Saldo"
              value={saldo.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              tone={saldo >= 0 ? 'positive' : 'negative'}
            />
            <StartMiniKachel
              label="Einnahmen"
              value={ein.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              tone="positive"
            />
            <StartMiniKachel
              label="Ausgaben"
              value={aus.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              tone="negative"
            />
          </div>
        </>
      )}
    </StartSektion>
  )
}
