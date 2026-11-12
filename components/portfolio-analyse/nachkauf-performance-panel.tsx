'use client'

import { appTableScrollClassName } from '@/components/page-shell'
import { PaInfoHint } from '@/components/portfolio-analyse/pa-info-hint'
import { PaCard, PaSectionTitle, PA_TABLE_COMPACT } from '@/components/portfolio-analyse/pa-ui'
import type {
  NachkaufPerformanceUebersicht,
  NachkaufScoreBucketStat,
  NachkaufTrackingEintrag,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'

/** Dieselben Fristen wie in `nachkauf-performance-server.ts`. */
const TAGE_6M = 183
const TAGE_12M = 365

const PERFORMANCE_INFO = {
  schauen:
    'Jede Zeile ist eine Kaufempfehlung ab ihrem eigenen Tag, kein gemeinsamer Zeitraum. Der Schnitt gewichtet den empfohlenen Betrag: 260 € zählen mehr als 120 €.',
  gut: 'Positiver Kurs und positiver Vorsprung zum S&P 500. Nach 6 und 12 Monaten wird derselbe Vergleich festgeschrieben.',
  schlecht:
    'Kurs unter null oder hinter dem Index. Solange die Frist nicht um ist, steht in der letzten Spalte die verbleibende Wartezeit.',
}

function ton(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v === 0) return 'text-[var(--app-text)]'
  return v > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
}

function kartenRand(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v === 0) {
    return 'border-[var(--app-border)] bg-[var(--app-surface-muted)]'
  }
  return v > 0
    ? 'border-emerald-500/25 bg-emerald-500/[0.07]'
    : 'border-rose-500/25 bg-rose-500/[0.07]'
}

function zahlDe(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '–'
  const zahl = Math.abs(v).toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const vorzeichen = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${vorzeichen}${zahl}`
}

function pctDe(v: number | null, einheit = '%'): string {
  if (v == null || !Number.isFinite(v)) return '–'
  return `${zahlDe(v)} ${einheit}`
}

function euroBetrag(v: number): string {
  return `${Math.round(v).toLocaleString('de-DE')} €`
}

function euroAenderung(v: number): string {
  const gerundet = Math.round(v)
  const zahl = Math.abs(gerundet).toLocaleString('de-DE')
  if (gerundet > 0) return `+${zahl} €`
  if (gerundet < 0) return `−${zahl} €`
  return `0 €`
}

type EinsatzSumme = { euro: number; gewicht: number; n: number }

/** Summe aus Betrag × Prozent. Dieselbe Gewichtung wie der kapitalgewichtete Schnitt. */
function einsatzSumme(
  zeilen: NachkaufTrackingEintrag[],
  wert: (e: NachkaufTrackingEintrag) => number | null,
): EinsatzSumme | null {
  let euro = 0
  let gewicht = 0
  let n = 0
  for (const e of zeilen) {
    const v = wert(e)
    const w = e.empfohlenBetragEur
    if (v == null || !Number.isFinite(v) || !(w > 0)) continue
    euro += (w * v) / 100
    gewicht += w
    n += 1
  }
  return n > 0 ? { euro, gewicht, n } : null
}

function zaehle(
  zeilen: NachkaufTrackingEintrag[],
  wert: (e: NachkaufTrackingEintrag) => number | null,
  trifft: (v: number) => boolean,
): { treffer: number; basis: number } {
  let treffer = 0
  let basis = 0
  for (const e of zeilen) {
    const v = wert(e)
    if (v == null || !Number.isFinite(v)) continue
    basis += 1
    if (trifft(v)) treffer += 1
  }
  return { treffer, basis }
}

function weichtAb(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return false
  return Math.abs(a - b) >= 0.05
}

function quoteRichtung(treffer: number, basis: number): number | null {
  if (basis <= 0) return null
  if (treffer * 2 > basis) return 1
  if (treffer * 2 < basis) return -1
  return 0
}

const MONAT_KURZ = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.']

function datumKurz(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.slice(0, 10))
  if (!m) return ''
  const monat = MONAT_KURZ[Number(m[2]) - 1]
  if (!monat) return ''
  return `${Number(m[3])}. ${monat}`
}

function dauerText(tage: number | null): string {
  if (tage == null) return ''
  if (tage === 0) return 'heute'
  if (tage === 1) return '1 Tag'
  return `${tage} Tage`
}

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

function monatLabel(monat: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monat)
  if (!m) return monat
  const name = MONATE[Number(m[2]) - 1]
  return name ? `${name} ${m[1]}` : monat
}

function gruppiereNachMonat(eintraege: NachkaufTrackingEintrag[]): {
  monat: string
  zeilen: NachkaufTrackingEintrag[]
}[] {
  const gruppen: { monat: string; zeilen: NachkaufTrackingEintrag[] }[] = []
  for (const e of eintraege) {
    const letzte = gruppen[gruppen.length - 1]
    if (!letzte || letzte.monat !== e.monat) gruppen.push({ monat: e.monat, zeilen: [e] })
    else letzte.zeilen.push(e)
  }
  return gruppen
}

function gewichteNachTicker(eintraege: NachkaufTrackingEintrag[]): [string, number][] {
  const map = new Map<string, number>()
  for (const e of eintraege) {
    if (!(e.empfohlenBetragEur > 0)) continue
    map.set(e.ticker, (map.get(e.ticker) ?? 0) + e.empfohlenBetragEur)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function aeltesteTage(eintraege: NachkaufTrackingEintrag[]): number | null {
  let max: number | null = null
  for (const e of eintraege) {
    if (e.liveTage == null) continue
    if (max == null || e.liveTage > max) max = e.liveTage
  }
  return max
}

function restText(tageAlt: number | null, ziel: number): string {
  if (tageAlt == null) return 'Die Wartezeit ist noch unbekannt'
  const rest = ziel - tageAlt
  if (rest <= 0) return 'Die Frist ist erreicht, der Kurs wird nachgezogen'
  if (rest === 1) return 'Die älteste Empfehlung hat noch 1 Tag'
  return `Die älteste Empfehlung hat noch ${rest} Tage`
}

function Kennzahl({
  label,
  wert,
  einheit,
  wertKlasse,
  zeile,
  fuss,
  rand,
}: {
  label: string
  wert: string
  einheit?: string
  wertKlasse: string
  zeile: string
  fuss?: string
  rand: string
}) {
  return (
    <div className={`min-w-0 rounded-xl border px-4 py-3.5 ${rand}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-[1.65rem] font-semibold leading-none tabular-nums tracking-tight ${wertKlasse}`}>
          {wert}
        </span>
        {einheit ? <span className="text-sm font-medium text-[var(--app-text-muted)]">{einheit}</span> : null}
      </p>
      <p className="mt-2 text-[13px] leading-snug text-[var(--app-text)]">{zeile}</p>
      {fuss ? <p className="mt-1 text-[11px] leading-relaxed text-[var(--app-text-muted)]">{fuss}</p> : null}
    </div>
  )
}

function FristBlock({
  titel,
  wert,
  wertTon,
  text,
  fortschritt,
  fortschrittLabel,
}: {
  titel: string
  wert: string | null
  wertTon: string
  text: string
  fortschritt: number
  fortschrittLabel: string
}) {
  const breite = Math.max(0, Math.min(100, fortschritt * 100))
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-[var(--app-text)]">{titel}</p>
        {wert ? <p className={`text-sm font-semibold tabular-nums ${wertTon}`}>{wert}</p> : (
          <p className="text-[12px] text-[var(--app-text-muted)]">noch offen</p>
        )}
      </div>
      <p className="mt-1 text-[12px] leading-snug text-[var(--app-text-muted)]">{text}</p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--app-chart-track)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(breite)}
        aria-label={titel}
      >
        <div className="h-full rounded-full bg-teal-500/80" style={{ width: `${breite}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] tabular-nums text-[var(--app-text-muted)]">{fortschrittLabel}</p>
    </div>
  )
}

function fristWarteText(e: NachkaufTrackingEintrag, zielTage: number): string {
  if (e.liveTage == null) return 'offen'
  const rest = zielTage - e.liveTage
  if (rest <= 0) return 'wird berechnet'
  if (rest === 1) return 'noch 1 Tag'
  return `noch ${rest} Tage`
}

function ScoreBuckets({
  titel,
  buckets,
}: {
  titel: string
  buckets: NachkaufScoreBucketStat[]
}) {
  if (buckets.length === 0) return null
  return (
    <div className="mt-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--app-text-muted)]">{titel}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {buckets.map((b) => (
          <div
            key={b.bucket}
            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-xs"
          >
            <span className="font-semibold text-[var(--app-text)]">Score {b.bucket}</span>
            <span className="ml-2 text-[var(--app-text-muted)]">{b.anzahl}×</span>
            <span className={`ml-2 font-medium tabular-nums ${ton(b.avgAlpha6mPct)}`}>
              {b.avgAlpha6mPct != null ? pctDe(b.avgAlpha6mPct, 'Punkte') : '–'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function NachkaufPerformancePanel({ daten }: { daten: NachkaufPerformanceUebersicht }) {
  const eintraege = daten.eintraege
  const gesamtBetrag = eintraege.reduce((s, e) => s + (e.empfohlenBetragEur > 0 ? e.empfohlenBetragEur : 0), 0)
  const live = einsatzSumme(eintraege, (e) => e.liveRenditePct)
  const imPlus = zaehle(eintraege, (e) => e.liveRenditePct, (v) => v > 0)
  const vorIndex = zaehle(eintraege, (e) => e.liveAlphaPct, (v) => v > 0)
  const aelteste = aeltesteTage(eintraege)
  const gewichte = gewichteNachTicker(eintraege)
  const gruppen = gruppiereNachMonat(eintraege)
  const buckets =
    daten.scoreBucketsEmpfehlung.length > 0 ? daten.scoreBucketsEmpfehlung : daten.scoreBucketsSignal
  const bucketTitel =
    daten.scoreBucketsEmpfehlung.length > 0
      ? 'Vorsprung nach 6 Monaten, nach Score'
      : 'Vorsprung nach 6 Monaten aus dem Signal-Backtest'

  const alpha6 = zaehle(eintraege, (e) => e.alpha6mPct, (v) => v > 0)
  const alpha12 = zaehle(eintraege, (e) => e.alpha12mPct, (v) => v > 0)

  const liveHinweis =
    live == null
      ? 'Kurse gerade nicht verfügbar'
      : live.gewicht < gesamtBetrag - 0.5
        ? `etwa ${euroAenderung(live.euro)} auf ${euroBetrag(live.gewicht)} von ${euroBetrag(gesamtBetrag)} mit Kurs`
        : `etwa ${euroAenderung(live.euro)} auf ${euroBetrag(gesamtBetrag)}`

  const ungewichtetKurs = weichtAb(daten.avgLiveRenditePct, daten.avgLiveRenditeUngewichtetPct)
    ? `Jede Empfehlung gleich gezählt: ${pctDe(daten.avgLiveRenditeUngewichtetPct)}`
    : 'Gewichtet nach empfohlenem Betrag'

  const ungewichtetAlpha = weichtAb(daten.avgLiveAlphaPct, daten.avgLiveAlphaUngewichtetPct)
    ? `Jede Empfehlung gleich gezählt: ${pctDe(daten.avgLiveAlphaUngewichtetPct, 'Punkte')}`
    : 'Gleicher Zeitraum je Empfehlung, ohne Dividenden'

  return (
    <PaCard variant="elevated" className="p-5">
      <PaSectionTitle
        title="Radar-Performance"
        description="Was aus den gespeicherten Kaufempfehlungen geworden ist — ab dem jeweiligen Empfehlungstag."
        info={<PaInfoHint info={PERFORMANCE_INFO} label="Erklärung: Radar-Performance" />}
      />

      {daten.anzahlEmpfehlungen === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-[var(--app-text-muted)]">
          Noch keine gespeicherte Empfehlung. Sobald du eine Allokation erzeugen lässt, werden die
          Euro-Beträge hier gegen den S&P 500 verfolgt. Der Vergleich zum Index erscheint sofort, die
          6- und 12-Monats-Werte erst nach der Frist.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Kennzahl
              label="Seit Empfehlung"
              wert={zahlDe(daten.avgLiveRenditePct)}
              einheit={daten.avgLiveRenditePct == null ? undefined : '%'}
              wertKlasse={ton(daten.avgLiveRenditePct)}
              zeile={liveHinweis}
              fuss={ungewichtetKurs}
              rand={kartenRand(daten.avgLiveRenditePct)}
            />
            <Kennzahl
              label="Vorsprung zum S&P 500"
              wert={zahlDe(daten.avgLiveAlphaPct)}
              einheit={daten.avgLiveAlphaPct == null ? undefined : 'Punkte'}
              wertKlasse={ton(daten.avgLiveAlphaPct)}
              zeile={
                vorIndex.basis > 0
                  ? `${vorIndex.treffer} von ${vorIndex.basis} liegen vor dem Index`
                  : 'Vergleich zum Index gerade nicht verfügbar'
              }
              fuss={ungewichtetAlpha}
              rand={kartenRand(daten.avgLiveAlphaPct)}
            />
            <Kennzahl
              label="Im Plus"
              wert={imPlus.basis > 0 ? `${imPlus.treffer} von ${imPlus.basis}` : '–'}
              wertKlasse={ton(quoteRichtung(imPlus.treffer, imPlus.basis))}
              zeile="Empfehlungen mit positivem Kurs"
              fuss="Zählt jede Empfehlung einmal, unabhängig vom Betrag"
              rand={kartenRand(quoteRichtung(imPlus.treffer, imPlus.basis))}
            />
          </div>

          <div className="mt-3 grid gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3.5 sm:grid-cols-2">
            <FristBlock
              titel="Nach 6 Monaten"
              wert={
                daten.ausgewertet6m > 0 && daten.avgAlpha6mPct != null
                  ? pctDe(daten.avgAlpha6mPct, 'Punkte')
                  : null
              }
              wertTon={ton(daten.avgAlpha6mPct)}
              text={
                daten.ausgewertet6m > 0
                  ? `${daten.ausgewertet6m} von ${daten.anzahlEmpfehlungen} ausgewertet${
                      alpha6.basis > 0 ? `, davon ${alpha6.treffer} vor dem Index` : ''
                    }${daten.avgRendite6mPct != null ? `. Kurs im Schnitt ${pctDe(daten.avgRendite6mPct)}` : ''}`
                  : `Noch keine Empfehlung ist ein halbes Jahr alt. ${restText(aelteste, TAGE_6M)}.`
              }
              fortschritt={
                daten.ausgewertet6m > 0
                  ? daten.ausgewertet6m / Math.max(1, daten.anzahlEmpfehlungen)
                  : aelteste == null
                    ? 0
                    : aelteste / TAGE_6M
              }
              fortschrittLabel={
                daten.ausgewertet6m > 0
                  ? `${daten.ausgewertet6m} von ${daten.anzahlEmpfehlungen} Empfehlungen`
                  : aelteste == null
                    ? 'Noch ohne Kurstage'
                    : `${aelteste} von ${TAGE_6M} Tagen`
              }
            />
            <FristBlock
              titel="Nach 12 Monaten"
              wert={
                daten.ausgewertet12m > 0 && daten.avgAlpha12mPct != null
                  ? pctDe(daten.avgAlpha12mPct, 'Punkte')
                  : null
              }
              wertTon={ton(daten.avgAlpha12mPct)}
              text={
                daten.ausgewertet12m > 0
                  ? `${daten.ausgewertet12m} von ${daten.anzahlEmpfehlungen} ausgewertet${
                      alpha12.basis > 0 ? `, davon ${alpha12.treffer} vor dem Index` : ''
                    }${daten.avgRendite12mPct != null ? `. Kurs im Schnitt ${pctDe(daten.avgRendite12mPct)}` : ''}`
                  : `Der Jahresvergleich startet nach 365 Tagen. ${restText(aelteste, TAGE_12M)}.`
              }
              fortschritt={
                daten.ausgewertet12m > 0
                  ? daten.ausgewertet12m / Math.max(1, daten.anzahlEmpfehlungen)
                  : aelteste == null
                    ? 0
                    : aelteste / TAGE_12M
              }
              fortschrittLabel={
                daten.ausgewertet12m > 0
                  ? `${daten.ausgewertet12m} von ${daten.anzahlEmpfehlungen} Empfehlungen`
                  : aelteste == null
                    ? 'Noch ohne Kurstage'
                    : `${aelteste} von ${TAGE_12M} Tagen`
              }
            />
          </div>

          {gewichte.length > 1 && (
            <div className="mt-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--app-text-muted)]">
                Gewichtung im Schnitt
                {gesamtBetrag > 0 ? ` · ${euroBetrag(gesamtBetrag)}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {gewichte.map(([ticker, betrag]) => (
                  <span
                    key={ticker}
                    className="inline-flex items-baseline gap-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1 text-[11px]"
                  >
                    <span className="font-semibold text-[var(--app-text)]">{ticker}</span>
                    <span className="tabular-nums text-[var(--app-text-muted)]">{euroBetrag(betrag)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <ScoreBuckets titel={bucketTitel} buckets={buckets} />

          {eintraege.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--app-border)]">
              <div className={appTableScrollClassName}>
              <table className={`${PA_TABLE_COMPACT} min-w-[760px]`}>
                <caption className="sr-only">
                  Kaufempfehlungen mit Kurs seit dem Empfehlungstag und Vorsprung zum S&P 500
                </caption>
                <thead>
                  <tr>
                    <th>Titel</th>
                    <th className="text-right">Betrag</th>
                    <th className="text-right">Score</th>
                    <th className="text-right">Kurs</th>
                    <th className="text-right">Ergebnis</th>
                    <th className="text-right">Vor S&P 500</th>
                    <th className="text-right">6 Monate</th>
                  </tr>
                </thead>
                {gruppen.map((g) => {
                  const summe = g.zeilen.reduce((s, e) => s + e.empfohlenBetragEur, 0)
                  const kurs = einsatzSumme(g.zeilen, (e) => e.liveRenditePct)
                  const schnitt =
                    kurs != null ? Math.round((kurs.euro / kurs.gewicht) * 1000) / 10 : null
                  return (
                    <tbody key={g.monat}>
                      <tr className="bg-[var(--app-surface-hover)]">
                        <td colSpan={7} className="!py-2">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                            <span className="font-semibold text-[var(--app-text)]">{monatLabel(g.monat)}</span>
                            <span className="text-[11px] tabular-nums text-[var(--app-text-muted)]">
                              {g.zeilen.length} {g.zeilen.length === 1 ? 'Empfehlung' : 'Empfehlungen'}
                              {' · '}
                              {euroBetrag(summe)}
                              {schnitt != null ? ` · ${pctDe(schnitt)}` : ''}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {g.zeilen.map((e) => {
                        const ergebnis =
                          e.liveRenditePct != null && e.empfohlenBetragEur > 0
                            ? (e.empfohlenBetragEur * e.liveRenditePct) / 100
                            : null
                        return (
                          <tr key={`${e.monat}-${e.ticker}`}>
                            <td>
                              <div className="font-semibold text-[var(--app-text)]">{e.ticker}</div>
                              {e.name && e.name.toUpperCase() !== e.ticker.toUpperCase() ? (
                                <div
                                  className="max-w-[11rem] truncate text-[10px] font-normal text-[var(--app-text-muted)]"
                                  title={e.name}
                                >
                                  {e.name}
                                </div>
                              ) : null}
                            </td>
                            <td className="text-right tabular-nums">
                              <span className="text-[var(--app-text-muted)]">{euroBetrag(e.empfohlenBetragEur)}</span>
                            </td>
                            <td className="text-right tabular-nums">
                              {e.score}
                              {e.kaufTrigger ? (
                                <span title="Kaufsignal war an diesem Tag aktiv" className="ml-1 text-amber-500">
                                  ⚡
                                </span>
                              ) : null}
                            </td>
                            <td className="text-right tabular-nums">
                              <div className={`font-medium ${ton(e.liveRenditePct)}`}>{pctDe(e.liveRenditePct)}</div>
                              <div className="text-[10px] font-normal text-[var(--app-text-muted)]">
                                {[dauerText(e.liveTage), datumKurz(e.empfohlenAm)].filter(Boolean).join(' · ')}
                              </div>
                            </td>
                            <td className="text-right font-medium tabular-nums">
                              <span className={ton(ergebnis)}>
                                {ergebnis == null ? '–' : euroAenderung(ergebnis)}
                              </span>
                            </td>
                            <td className="text-right font-medium tabular-nums">
                              <span className={ton(e.liveAlphaPct)}>
                                {e.liveAlphaPct == null ? '–' : pctDe(e.liveAlphaPct, 'Punkte')}
                              </span>
                            </td>
                            <td className="text-right tabular-nums">
                              {e.rendite6mPct != null || e.alpha6mPct != null ? (
                                <>
                                  <div className={`font-medium ${ton(e.rendite6mPct)}`}>{pctDe(e.rendite6mPct)}</div>
                                  <div className={`text-[10px] font-normal ${ton(e.alpha6mPct)}`}>
                                    {e.alpha6mPct == null ? '–' : pctDe(e.alpha6mPct, 'Punkte')}
                                  </div>
                                </>
                              ) : (
                                <span className="text-[var(--app-text-muted)]">{fristWarteText(e, TAGE_6M)}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  )
                })}
              </table>
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
            Die Prozentzahlen sind die Kursänderung seit dem Empfehlungstag, nicht auf ein Jahr
            hochgerechnet und ohne Dividenden. Dieselbe Aktie in mehreren Monaten zählt mehrfach.
            Europäische Titel laufen in ihrer Handelswährung, der S&P 500 (SPY) in Dollar. Das Ergebnis
            in Euro ist der empfohlene Betrag mal dieser Kursänderung, auf ganze Euro gerundet — die
            Summe der Zeilen kann deshalb um ein, zwei Euro vom Schnitt abweichen.
          </p>
        </>
      )}
    </PaCard>
  )
}
