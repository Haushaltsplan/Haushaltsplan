'use client'

import {
  finanzEmptyClass,
  finanzInputClass,
  finanzKpiCardCompactClass,
  finanzLabelMutedClass,
  finanzListItemClass,
  finanzSecondaryBtnClass,
  finanzTitleClass,
} from '@/components/finanzen/finanzen-ui'
import { DonutChart } from '@/components/finanzen/donut-chart'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import { KategorieMark } from '@/lib/kategorie-icon'
import {
  ladeVermoegen,
  speichereVermoegenPosten,
  loescheVermoegenPosten,
  ladeLetztesDepotSnapshot,
  ladeFondsKurseClient,
  type VermoegenRow,
} from '@/lib/finanz-extra-db'
import {
  MANUELLE_VERMOEGEN_KLASSEN,
  brauchtFondsIsin,
  effektiveVermoegenKlasse,
  fondsWertEur,
  formatIsoMonatKurz,
  gruppiereVermoegen,
  inferiereVermoegenKlasse,
  istGueltigeIsin,
  naechsterIsoMonat,
  normalisiereIsinEingabe,
  summeBausparerAusgabenAbMonat,
  type BausparerAusgabe,
  type VermoegenAnzeigePosten,
  type VermoegenKlasse,
} from '@/lib/finanz-vermoegen'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatSnapshotDatum(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function parseDeZahl(s: string): number | null {
  const n = Number.parseFloat(s.trim().replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

type FormState = {
  id?: string
  titel: string
  betrag: string
  klasse: VermoegenKlasse
  isin: string
  anzahl: string
  autoAbMonat: string | null
}

const LEER: FormState = { titel: '', betrag: '', klasse: 'bank', isin: '', anzahl: '', autoAbMonat: null }

const SCHNELL: Array<{ titel: string; klasse: VermoegenKlasse; isin?: string }> = [
  { titel: 'Girokonto', klasse: 'bank' },
  { titel: 'Tagesgeld', klasse: 'bank' },
  { titel: 'Mintos', klasse: 'p2p' },
  { titel: 'Schwäbisch Hall Bausparer', klasse: 'bausparer' },
  { titel: 'UniGlobal', klasse: 'fonds', isin: 'DE0008491051' },
  { titel: 'Allianz Lebensversicherung', klasse: 'rente' },
]

type LiveKurs = { name: string | null; kursEur: number | null; aenderungTagProzent: number | null }

/**
 * Gesamtvermögen: Depot aus der Portfolio-Analyse, restliche Klassen manuell.
 * Fonds mit ISIN werden live bewertet; Bausparer-Ausgaben ab dem Folgemonat addiert.
 */
export function VermoegenSection({ ausgaben = [] }: { ausgaben?: BausparerAusgabe[] }) {
  const [schemaOk, setSchemaOk] = useState<boolean | null>(null)
  const [posten, setPosten] = useState<VermoegenRow[]>([])
  const [form, setForm] = useState<FormState>(LEER)
  const [formOffen, setFormOffen] = useState(false)
  const [speichert, setSpeichert] = useState(false)
  const [isinSucht, setIsinSucht] = useState(false)
  const [depot, setDepot] = useState<{ wert: number | null; erfasstAm: string | null }>({
    wert: null,
    erfasstAm: null,
  })
  const [liveKurse, setLiveKurse] = useState<Record<string, LiveKurs>>({})

  async function laden() {
    const [v, snap] = await Promise.all([ladeVermoegen(), ladeLetztesDepotSnapshot()])
    setSchemaOk(v.schemaOk)
    setPosten(v.rows)
    setDepot({ wert: snap.depotwertEur, erfasstAm: snap.erfasstAm })
    const isins = v.rows.map((r) => r.isin).filter((x): x is string => Boolean(x))
    if (isins.length === 0) {
      setLiveKurse({})
      return
    }
    const kurse = await ladeFondsKurseClient(isins)
    const map: Record<string, LiveKurs> = {}
    for (const k of kurse) {
      map[k.isin] = {
        name: k.name,
        kursEur: k.kursEur,
        aenderungTagProzent: k.aenderungTagProzent,
      }
    }
    setLiveKurse(map)
    const updates = v.rows.filter((r) => {
      if (!r.isin) return false
      const live = map[r.isin]?.kursEur
      return live != null && live > 0 && (r.kursEur == null || Math.abs(live - r.kursEur) / live > 0.001)
    })
    await Promise.all(
      updates.map((r) =>
        speichereVermoegenPosten({
          id: r.id,
          titel: r.titel,
          betrag: r.betrag,
          klasse: r.klasse,
          isin: r.isin,
          anzahl: r.anzahl,
          kursEur: map[r.isin!]?.kursEur ?? r.kursEur,
          autoAbMonat: r.autoAbMonat,
        }),
      ),
    )
  }

  useEffect(() => {
    void laden()
  }, [])

  const anzeigePosten = useMemo<VermoegenAnzeigePosten[]>(() => {
    const bausparerTitel = posten
      .filter((p) => effektiveVermoegenKlasse(p.titel, p.klasse) === 'bausparer')
      .map((p) => p.titel)
    const rows: VermoegenAnzeigePosten[] = posten.map((p) => {
      const klasse = effektiveVermoegenKlasse(p.titel, p.klasse)
      const live = p.isin ? liveKurse[p.isin] : undefined
      const kurs = live?.kursEur ?? p.kursEur
      let betrag = Number(p.betrag) || 0
      let hinweis: string | null = null
      let sparrate = 0
      if (klasse === 'fonds' && p.isin) {
        betrag = fondsWertEur(p.anzahl, kurs, p.betrag)
        const anteile =
          p.anzahl != null
            ? p.anzahl.toLocaleString('de-DE', { maximumFractionDigits: 4 })
            : null
        const kursTxt = kurs != null ? `${eur(kurs)}/Anteil` : 'Kurs wird geladen …'
        hinweis = [p.isin, anteile ? `${anteile} Anteile` : null, kursTxt].filter(Boolean).join(' · ')
      }
      if (klasse === 'bausparer') {
        const ab = p.autoAbMonat || naechsterIsoMonat()
        sparrate = summeBausparerAusgabenAbMonat(ausgaben, ab, p.titel, bausparerTitel)
        betrag = Math.round((betrag + sparrate) * 100) / 100
        hinweis =
          sparrate > 0
            ? `Start ${eur(Number(p.betrag) || 0)} + ${eur(sparrate)} Sparrate ab ${formatIsoMonatKurz(ab)}`
            : `Ab ${formatIsoMonatKurz(ab)} werden Bausparer-Ausgaben automatisch addiert`
      }
      return {
        id: p.id,
        titel: p.titel,
        betrag,
        klasse,
        quelle: 'manuell' as const,
        isin: p.isin,
        anzahl: p.anzahl,
        kursEur: kurs,
        kursAenderungTagProzent: live?.aenderungTagProzent ?? null,
        autoAbMonat: p.autoAbMonat,
        bausparerSparrateEur: sparrate,
        hinweis,
      }
    })
    if (depot.wert != null && depot.wert !== 0) {
      rows.push({
        id: '__depot',
        titel: 'Depot (Portfolio-Analyse)',
        betrag: depot.wert,
        klasse: 'aktien',
        quelle: 'depot',
        hinweis: formatSnapshotDatum(depot.erfasstAm)
          ? `Stand ${formatSnapshotDatum(depot.erfasstAm)}`
          : 'Aktueller Depotwert aus dem Projekt',
      })
    }
    return rows
  }, [posten, depot, liveKurse, ausgaben])

  const { gesamt, klassenMitWert } = useMemo(() => gruppiereVermoegen(anzeigePosten), [anzeigePosten])

  const donutSegmente = useMemo(
    () =>
      klassenMitWert
        .filter((k) => k.betrag > 0)
        .map((k) => ({ key: k.key, label: k.kurz, farbe: k.farbe, betrag: k.betrag })),
    [klassenMitWert],
  )

  const naechsterMonatLabel = formatIsoMonatKurz(naechsterIsoMonat())

  function startNeu(vorgabe?: { titel: string; klasse: VermoegenKlasse; isin?: string }) {
    const klasse = vorgabe?.klasse && vorgabe.klasse !== 'aktien' ? vorgabe.klasse : 'bank'
    setForm({
      ...LEER,
      titel: vorgabe?.titel ?? '',
      klasse,
      isin: vorgabe?.isin ?? '',
    })
    setFormOffen(true)
    if (vorgabe?.isin) void holeIsinKurs(vorgabe.isin, false)
  }

  function startBearbeiten(p: VermoegenAnzeigePosten) {
    if (p.quelle !== 'manuell') return
    const raw = posten.find((r) => r.id === p.id)
    setForm({
      id: p.id,
      titel: p.titel,
      betrag: String(raw?.betrag ?? p.betrag).replace('.', ','),
      klasse: p.klasse === 'aktien' ? 'sonstiges' : p.klasse,
      isin: p.isin ?? '',
      anzahl: p.anzahl != null ? String(p.anzahl).replace('.', ',') : '',
      autoAbMonat: p.autoAbMonat ?? null,
    })
    setFormOffen(true)
  }

  async function holeIsinKurs(isinRoh: string, titelFallsLeer: boolean) {
    const isin = normalisiereIsinEingabe(isinRoh)
    if (!istGueltigeIsin(isin)) return
    setIsinSucht(true)
    try {
      const [k] = await ladeFondsKurseClient([isin])
      if (!k) {
        toast.error('ISIN nicht gefunden oder kein Kurs verfügbar.')
        return
      }
      setLiveKurse((prev) => ({
        ...prev,
        [isin]: { name: k.name, kursEur: k.kursEur, aenderungTagProzent: k.aenderungTagProzent },
      }))
      setForm((p) => ({
        ...p,
        isin,
        titel: titelFallsLeer && !p.titel.trim() && k.name ? k.name : p.titel,
      }))
      if (k.kursEur == null) toast.error('Fonds gefunden, aber kein aktueller Kurs.')
    } finally {
      setIsinSucht(false)
    }
  }

  async function speichern() {
    const titel = form.titel.trim()
    const klasse = form.klasse === 'aktien' ? 'sonstiges' : form.klasse
    if (!titel) return toast.error('Bitte eine Bezeichnung eingeben.')

    const isin = brauchtFondsIsin(klasse) ? normalisiereIsinEingabe(form.isin) : ''
    if (brauchtFondsIsin(klasse) && !istGueltigeIsin(isin)) {
      return toast.error('Für Fonds eine gültige 12-stellige ISIN angeben.')
    }

    let anzahl = brauchtFondsIsin(klasse) ? parseDeZahl(form.anzahl) : null
    let betrag = parseDeZahl(form.betrag)
    const live = istGueltigeIsin(isin) ? liveKurse[isin] : undefined
    const kurs = live?.kursEur ?? null

    if (brauchtFondsIsin(klasse)) {
      if ((anzahl == null || anzahl <= 0) && betrag != null && betrag > 0 && kurs != null && kurs > 0) {
        anzahl = Math.round((betrag / kurs) * 1e6) / 1e6
      }
      if (anzahl == null || anzahl <= 0) {
        return toast.error('Bitte die Anzahl der Fondsanteile angeben (oder einen aktuellen Wert, dann rechnen wir die Anteile).')
      }
      if (kurs != null && kurs > 0) {
        betrag = fondsWertEur(anzahl, kurs, 0)
      } else if (betrag == null) {
        return toast.error('Kein aktueller Kurs — bitte den aktuellen Wert in Euro eingeben.')
      }
    } else if (betrag == null) {
      return toast.error('Bitte einen gültigen Betrag eingeben.')
    }

    setSpeichert(true)
    try {
      const { error } = await speichereVermoegenPosten({
        id: form.id,
        titel,
        betrag: Math.round(betrag * 100) / 100,
        klasse,
        isin: brauchtFondsIsin(klasse) ? isin : null,
        anzahl: brauchtFondsIsin(klasse) ? anzahl : null,
        kursEur: brauchtFondsIsin(klasse) ? kurs : null,
        autoAbMonat: klasse === 'bausparer' ? form.autoAbMonat || naechsterIsoMonat() : null,
      })
      if (error) {
        toast.error(error.message || 'Posten konnte nicht gespeichert werden.')
        return
      }
      toast.success(form.id ? 'Posten aktualisiert.' : 'Posten angelegt.')
      setForm(LEER)
      setFormOffen(false)
      await laden()
    } finally {
      setSpeichert(false)
    }
  }

  async function entfernen(p: VermoegenAnzeigePosten) {
    if (p.quelle !== 'manuell') return
    if (!window.confirm(`Posten wirklich löschen?\n\n${p.titel}`)) return
    const { error } = await loescheVermoegenPosten(p.id)
    if (error) {
      toast.error('Löschen fehlgeschlagen.')
      return
    }
    toast.success('Posten gelöscht.')
    await laden()
  }

  const formLive = brauchtFondsIsin(form.klasse) ? liveKurse[normalisiereIsinEingabe(form.isin)] : undefined
  const formAnzahl = parseDeZahl(form.anzahl)
  const formBetrag = parseDeZahl(form.betrag)
  const formVorschau =
    brauchtFondsIsin(form.klasse) && formAnzahl != null && formLive?.kursEur
      ? fondsWertEur(formAnzahl, formLive.kursEur, 0)
      : brauchtFondsIsin(form.klasse) && formBetrag != null && formLive?.kursEur
        ? formBetrag
        : null

  return (
    <PageSection titleId="finanzen-vermoegen-heading" title="Gesamtvermögen" density="compact">
      <PageSectionPanel density="compact">
        {schemaOk === null ? (
          <p className="text-sm text-[var(--app-text-muted)]">Wird geladen …</p>
        ) : schemaOk === false ? (
          <div className="rounded-xl border border-amber-700/50 bg-amber-950/25 p-4 text-[13px] leading-relaxed text-amber-200/90">
            Vermögens-Tabelle fehlt. In Supabase einmal die Migration ausführen:
            <code className="mt-1.5 block rounded bg-[var(--app-surface-muted)] px-1.5 py-1 text-[11px] text-[var(--app-text)]">
              supabase/migrations/20260531130100_finanz_vermoegen.sql
            </code>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-indigo-800/50 bg-indigo-950/25 p-4 shadow-inner">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300/90">Gesamtvermögen</p>
              <p className={`mt-1 text-3xl font-bold tabular-nums ${gesamt >= 0 ? 'text-indigo-100' : 'text-rose-300'}`}>
                {eur(gesamt)}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                Aktien aus der Portfolio-Analyse, Fonds per ISIN-Kurs, Bausparer-Sparrate ab {naechsterMonatLabel}. Bank,
                P2P und Rest trägst du selbst ein.
              </p>

              {donutSegmente.length > 0 && (
                <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <DonutChart
                    segmente={donutSegmente}
                    groesse={152}
                    dicke={20}
                    mitte={{ wert: eur(gesamt), label: 'GESAMT' }}
                  />
                  <ul className="w-full min-w-0 flex-1 space-y-1.5">
                    {klassenMitWert.map((k) => (
                      <li key={k.key} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: k.farbe }} />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--app-text)]">{k.label}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-[var(--app-text-muted)]">
                          {Math.round(k.anteil * 100)} %
                        </span>
                        <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${k.textClass}`}>
                          {eur(k.betrag)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {klassenMitWert.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {klassenMitWert.map((k) => (
                    <div key={`kpi-${k.key}`} className={finanzKpiCardCompactClass}>
                      <p className={finanzLabelMutedClass}>{k.label}</p>
                      <p className={`mt-0.5 text-base font-semibold tabular-nums ${k.textClass}`}>{eur(k.betrag)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {depot.wert == null && (
              <p className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-[12px] text-[var(--app-text-muted)]">
                Noch kein Depotwert.{' '}
                <Link href="/portfolioanalyse" className="font-semibold text-indigo-300 hover:text-indigo-200">
                  Portfolio-Analyse öffnen
                </Link>
                , damit das Aktienvermögen hier erscheint.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--app-text-muted)]">
                Bank, P2P, Bausparer und Fonds hier anlegen — Aktien kommen automatisch.
              </p>
              {!formOffen && (
                <button
                  type="button"
                  onClick={() => startNeu()}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-950/30 transition hover:bg-indigo-500"
                >
                  Posten hinzufügen
                </button>
              )}
            </div>

            {!formOffen && (
              <div className="flex flex-wrap gap-1.5">
                {SCHNELL.map((s) => (
                  <button
                    key={s.titel}
                    type="button"
                    onClick={() => startNeu(s)}
                    className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--app-text-muted)] transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)]"
                  >
                    {s.titel}
                  </button>
                ))}
              </div>
            )}

            {!formOffen && anzeigePosten.length === 0 && (
              <p className={finanzEmptyClass}>
                Noch keine Posten. Lege Bankguthaben, P2P, Bausparer oder einen Fonds mit ISIN an.
              </p>
            )}

            {formOffen && (
              <div className={`space-y-3 ${finanzListItemClass} flex-col items-stretch`}>
                <p className={finanzLabelMutedClass}>{form.id ? 'Posten bearbeiten' : 'Neuer Posten'}</p>
                <input
                  type="text"
                  value={form.titel}
                  onChange={(e) => {
                    const titel = e.target.value
                    const inferiert = inferiereVermoegenKlasse(titel)
                    setForm((p) => ({
                      ...p,
                      titel,
                      klasse:
                        Boolean(p.id) || inferiert === 'sonstiges' || inferiert === 'aktien' ? p.klasse : inferiert,
                    }))
                  }}
                  placeholder="Bezeichnung (z. B. Giro Sparkasse, Mintos, Schwäbisch Hall)"
                  className={finanzInputClass}
                />
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                    Anlageklasse
                  </label>
                  <select
                    value={form.klasse}
                    onChange={(e) => setForm((p) => ({ ...p, klasse: e.target.value as VermoegenKlasse }))}
                    className={finanzInputClass}
                  >
                    {MANUELLE_VERMOEGEN_KLASSEN.map((k) => (
                      <option key={k.key} value={k.key}>
                        {k.label} — {k.beispiele}
                      </option>
                    ))}
                  </select>
                </div>

                {brauchtFondsIsin(form.klasse) ? (
                  <>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                        ISIN
                      </label>
                      <input
                        type="text"
                        value={form.isin}
                        onChange={(e) => setForm((p) => ({ ...p, isin: e.target.value.toUpperCase() }))}
                        onBlur={() => void holeIsinKurs(form.isin, !form.id)}
                        placeholder="z. B. DE0008491051"
                        className={`${finanzInputClass} font-mono uppercase`}
                        autoCapitalize="characters"
                      />
                      {isinSucht ? (
                        <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">Kurs wird geladen …</p>
                      ) : formLive?.kursEur != null ? (
                        <p className="mt-1 text-[11px] text-teal-300">
                          Aktueller Kurs {eur(formLive.kursEur)}
                          {formLive.aenderungTagProzent != null
                            ? ` (${formLive.aenderungTagProzent >= 0 ? '+' : ''}${formLive.aenderungTagProzent.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %)`
                            : ''}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                        Anteile
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form.anzahl}
                        onChange={(e) => setForm((p) => ({ ...p, anzahl: e.target.value }))}
                        placeholder="z. B. 12,5"
                        className={`${finanzInputClass} tabular-nums`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                        Oder aktueller Wert € (wird in Anteile umgerechnet)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form.betrag}
                        onChange={(e) => setForm((p) => ({ ...p, betrag: e.target.value }))}
                        placeholder="z. B. 8500"
                        className={`${finanzInputClass} tabular-nums`}
                      />
                    </div>
                    {formVorschau != null && (
                      <p className="text-[12px] font-semibold tabular-nums text-teal-200">Aktueller Wert {eur(formVorschau)}</p>
                    )}
                  </>
                ) : (
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                      Aktueller Wert €
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.betrag}
                      onChange={(e) => setForm((p) => ({ ...p, betrag: e.target.value }))}
                      placeholder="z. B. 12500"
                      className={`${finanzInputClass} tabular-nums`}
                    />
                    {form.klasse === 'bausparer' && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                        Das ist der Stand heute. Ab {formatIsoMonatKurz(form.autoAbMonat || naechsterIsoMonat())} werden
                        alle Bausparer-Ausgaben (z. B. Schwäbisch Hall) automatisch draufgerechnet.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(LEER)
                      setFormOffen(false)
                    }}
                    className={`flex-1 ${finanzSecondaryBtnClass}`}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    disabled={speichert || isinSucht}
                    onClick={() => void speichern()}
                    className="flex-[2] rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-950/25 transition hover:bg-indigo-500 disabled:opacity-40"
                  >
                    {speichert ? '…' : form.id ? 'Änderungen speichern' : 'Posten speichern'}
                  </button>
                </div>
              </div>
            )}

            {klassenMitWert.map((k) => (
              <div key={`grp-${k.key}`} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 px-0.5">
                  <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${k.textClass}`}>{k.label}</p>
                  <p className="text-[12px] font-semibold tabular-nums text-[var(--app-text-muted)]">{eur(k.betrag)}</p>
                </div>
                <ul className="space-y-2">
                  {k.posten.map((p) => (
                    <li key={p.id} className={finanzListItemClass}>
                      <KategorieMark kategorie={p.titel} groesse="sm" className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate ${finanzTitleClass}`}>{p.titel}</p>
                        {p.quelle === 'depot' ? (
                          <p className="text-[11px] text-[var(--app-text-muted)]">
                            {p.hinweis ? `${p.hinweis} · ` : ''}
                            <Link href="/portfolioanalyse" className="font-semibold text-indigo-300 hover:text-indigo-200">
                              Portfolio-Analyse
                            </Link>
                          </p>
                        ) : p.hinweis ? (
                          <p className="text-[11px] text-[var(--app-text-muted)]">{p.hinweis}</p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-[14px] font-bold tabular-nums text-sky-200">{eur(p.betrag)}</p>
                      {p.quelle === 'manuell' ? (
                        <span className="flex shrink-0 gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => startBearbeiten(p)}
                            className="font-semibold text-sky-300 hover:text-sky-200"
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            onClick={() => void entfernen(p)}
                            className="font-semibold text-rose-300/90 hover:text-rose-200"
                          >
                            Löschen
                          </button>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </PageSectionPanel>
    </PageSection>
  )
}
