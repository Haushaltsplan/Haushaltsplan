'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { DonutChart } from '@/components/finanzen/donut-chart'
import { PageChrome, PageHero, PageSection, PageSectionPanel } from '@/components/page-shell'
import {
  allokationDonutSegmente,
  berechneKennzahlen,
  formatDatumDe,
  formatEur,
  formatProzent,
  sortiereBuchungenNeuesteZuerst,
  sortierePositionenNachWert,
} from '@/lib/portfolio-analyse/berechnung'
import { ladePiiBlockliste, speicherePiiBlockliste } from '@/lib/portfolio-analyse/anonymisierung'
import { dedupliziereGegenBestehend, importiereTradeRepublicCsvText, importiereTradeRepublicPdfBuffer } from '@/lib/portfolio-analyse/import-pipeline'
import { PortfolioAnalyseImportVorschau } from '@/components/portfolio-analyse-import-vorschau'
import {
  ladePortfolioAnalyseDaten,
  loescheAllePortfolioAnalyseDaten,
  speicherePortfolioImport,
} from '@/lib/portfolio-analyse/portfolio-analyse-db'
import type { PortfolioDbBuchung, PortfolioImportErgebnis } from '@/lib/portfolio-analyse/types'
import { ASSET_KLASSE_LABEL, BUCHUNGS_TYP_LABEL } from '@/lib/portfolio-analyse/types'

function istPdfDatei(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function istCsvDatei(file: File): boolean {
  const n = file.name.toLowerCase()
  return file.type === 'text/csv' || n.endsWith('.csv') || n.endsWith('.txt')
}

function KennzahlKarte({ label, wert, sub }: { label: string; wert: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-white">{wert}</p>
      {sub ? <p className="mt-0.5 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  )
}

export function PortfolioAnalysePageClient() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [laden, setLaden] = useState(true)
  const [schemaFehlt, setSchemaFehlt] = useState(false)
  const [buchungen, setBuchungen] = useState<PortfolioDbBuchung[]>([])
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof ladePortfolioAnalyseDaten>>['snapshot']>(null)

  const [importBusy, setImportBusy] = useState(false)
  const [speichernBusy, setSpeichernBusy] = useState(false)
  const [vorschau, setVorschau] = useState<PortfolioImportErgebnis | null>(null)
  const [vorschauDateiname, setVorschauDateiname] = useState('')
  const [blocklistText, setBlocklistText] = useState('')

  useEffect(() => {
    setBlocklistText(ladePiiBlockliste().join(', '))
  }, [])

  const datenNeuLaden = useCallback(async () => {
    setLaden(true)
    const res = await ladePortfolioAnalyseDaten()
    setSchemaFehlt(res.schemaFehlt)
    if (res.ok) {
      setBuchungen(res.buchungen)
      setSnapshot(res.snapshot)
    } else if (!res.schemaFehlt) {
      toast.error('Daten konnten nicht geladen werden.')
    }
    setLaden(false)
  }, [])

  useEffect(() => {
    void datenNeuLaden()
  }, [datenNeuLaden])

  const kennzahlen = useMemo(() => berechneKennzahlen(buchungen, snapshot), [buchungen, snapshot])
  const positionen = useMemo(
    () => sortierePositionenNachWert(snapshot?.positionen ?? []),
    [snapshot],
  )
  const donutSegmente = useMemo(() => allokationDonutSegmente(positionen), [positionen])
  const buchungenSortiert = useMemo(() => sortiereBuchungenNeuesteZuerst(buchungen).slice(0, 80), [buchungen])

  async function verarbeiteDatei(file: File) {
    setImportBusy(true)
    setVorschau(null)
    try {
      const blocklist = blocklistText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2)
      speicherePiiBlockliste(blocklist)

      let ergebnis: PortfolioImportErgebnis
      if (istPdfDatei(file)) {
        const buffer = await file.arrayBuffer()
        ergebnis = await importiereTradeRepublicPdfBuffer(buffer, blocklist)
      } else if (istCsvDatei(file)) {
        const text = await file.text()
        ergebnis = await importiereTradeRepublicCsvText(text, blocklist)
      } else {
        toast.error('Nur PDF oder CSV (Trade Republic).')
        return
      }

      const bestehend = new Set(buchungen.map((b) => b.buchungsHash))
      const { neu, uebersprungen } = await dedupliziereGegenBestehend(ergebnis.buchungen, bestehend)
      ergebnis = { ...ergebnis, buchungen: neu }
      if (uebersprungen > 0) {
        ergebnis.hinweise.push(`${uebersprungen} Buchung(en) bereits gespeichert — werden übersprungen.`)
      }

      setVorschauDateiname(file.name)
      setVorschau(ergebnis)

      if (neu.length === 0 && ergebnis.positionen.length === 0) {
        toast.error('Keine neuen Daten erkannt.')
      } else {
        toast.success('Vorschau bereit — bitte prüfen und übernehmen.')
      }
    } catch (e) {
      console.error(e)
      toast.error('Import fehlgeschlagen — ist das ein Trade-Republic-Dokument?')
    } finally {
      setImportBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function vorschauUebernehmen(payload: {
    buchungen: PortfolioImportErgebnis['buchungen']
    positionen: PortfolioImportErgebnis['positionen']
    depotwertEur: number | null
    snapshotUebernehmen: boolean
  }) {
    setSpeichernBusy(true)
    try {
      const res = await speicherePortfolioImport(
        payload.buchungen,
        payload.snapshotUebernehmen ? payload.positionen : [],
        payload.snapshotUebernehmen ? payload.depotwertEur : null,
      )
      if (!res.ok) {
        if (res.schemaFehlt) {
          setSchemaFehlt(true)
          toast.error('Datenbank-Tabellen fehlen — Migration ausführen (npm run db:portfolio-analyse).')
        } else {
          toast.error(res.message ?? 'Speichern fehlgeschlagen.')
        }
        return
      }
      toast.success(
        res.eingefuegt > 0
          ? `${res.eingefuegt} Buchung(en) gespeichert.`
          : 'Snapshot aktualisiert (keine neuen Buchungen).',
      )
      setVorschau(null)
      setVorschauDateiname('')
      await datenNeuLaden()
    } finally {
      setSpeichernBusy(false)
    }
  }

  async function alleDatenLoeschen() {
    if (
      !window.confirm(
        'Alle anonymisierten Portfolio-Daten unwiderruflich löschen?\n\nRoh-PDFs/CSVs wurden nie gespeichert.',
      )
    ) {
      return
    }
    const res = await loescheAllePortfolioAnalyseDaten()
    if (!res.ok) {
      toast.error(res.message ?? 'Löschen fehlgeschlagen.')
      return
    }
    toast.success('Portfolio-Daten gelöscht.')
    setVorschau(null)
    await datenNeuLaden()
  }

  return (
    <PageChrome>
      <PageHero
        eyebrow="Portfolioanalyse"
        title="Trade Republic — privat & lokal"
        description={
          <>
            Import läuft <strong className="font-medium text-zinc-200">nur in deinem Browser</strong> — ohne KI, ohne
            Server-Upload der Rohdatei. Vor dem Speichern wählst du Zeilen aus und kannst personenbezogene Einträge
            entfernen — gespeichert werden nur ISIN, Datum, Betrag und geprüfte Wertpapiernamen (kein IBAN, kein Saldo,
            kein Depotinhaber).
          </>
        }
      />

      {schemaFehlt ? (
        <PageSection titleId="pa-schema-heading" title="Datenbank">
          <PageSectionPanel>
            <p className="text-sm leading-relaxed text-amber-100/90">
              Tabellen fehlen noch. Migration einspielen:{' '}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-teal-400">
                npm run db:portfolio-analyse
              </code>{' '}
              oder SQL aus{' '}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
                supabase/migrations/20260601120000_portfolio_analyse.sql
              </code>
            </p>
          </PageSectionPanel>
        </PageSection>
      ) : null}

      <PageSection titleId="pa-import-heading" title="Import">
        <PageSectionPanel>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2 text-sm text-zinc-400">
              <p>
                Trade-Republic-Kontoauszug als <strong className="text-zinc-300">PDF</strong> oder konvertiertes{' '}
                <strong className="text-zinc-300">CSV</strong> wählen. Die Datei verlässt deinen Rechner nicht — Parsing
                per pdf.js im Tab.
              </p>
              <ul className="list-inside list-disc space-y-1 text-xs text-zinc-500">
                <li>Kein Anschluss an Gemini / OpenAI</li>
                <li>Keine Speicherung der Originaldatei</li>
                <li>Getrennt von Besitz- und Rechnungs-Import</li>
              </ul>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              {(buchungen.length > 0 || (snapshot?.positionen.length ?? 0) > 0) && !schemaFehlt ? (
                <button
                  type="button"
                  onClick={() => void alleDatenLoeschen()}
                  className="rounded-lg border border-rose-900/45 bg-rose-950/15 px-4 py-2 text-xs text-rose-200 hover:bg-rose-950/35"
                >
                  Gespeicherte Daten löschen ({buchungen.length} Buchungen)
                </button>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv,.txt,application/pdf,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void verarbeiteDatei(f)
                }}
              />
              <button
                type="button"
                disabled={importBusy || schemaFehlt}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-teal-500/40 bg-teal-950/30 px-5 py-2.5 text-sm font-medium text-teal-100 transition hover:bg-teal-950/50 disabled:opacity-50"
              >
                {importBusy ? 'Wird gelesen …' : 'PDF / CSV wählen'}
              </button>
            </div>
          </div>

          {vorschau ? (
            <PortfolioAnalyseImportVorschau
              ergebnis={vorschau}
              dateiname={vorschauDateiname}
              blocklistText={blocklistText}
              onBlocklistChange={setBlocklistText}
              speichernBusy={speichernBusy}
              onVerwerfen={() => {
                setVorschau(null)
                setVorschauDateiname('')
              }}
              onUebernehmen={(payload) => void vorschauUebernehmen(payload)}
            />
          ) : null}
        </PageSectionPanel>
      </PageSection>

      <PageSection titleId="pa-kennzahlen-heading" title="Übersicht">
        <PageSectionPanel>
          {laden ? (
            <p className="text-sm text-zinc-500">Lade …</p>
          ) : buchungen.length === 0 && positionen.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Noch keine Daten — importiere einen Trade-Republic-Kontoauszug, um Depotwert, Allokation und Buchungen zu
              sehen.
            </p>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <KennzahlKarte label="Depotwert" wert={formatEur(kennzahlen.depotwertEur)} />
                <KennzahlKarte label="Investiert (Käufe − Verkäufe)" wert={formatEur(kennzahlen.investiertEur)} />
                <KennzahlKarte
                  label="Gewinn / Verlust"
                  wert={formatEur(kennzahlen.gewinnVerlustEur)}
                  sub={formatProzent(kennzahlen.gewinnVerlustProzent)}
                />
                <KennzahlKarte label="Dividenden" wert={formatEur(kennzahlen.dividendenEur)} />
                <KennzahlKarte label="Zinsen" wert={formatEur(kennzahlen.zinsenEur)} />
                <KennzahlKarte label="Einzahlungen" wert={formatEur(kennzahlen.einzahlungenEur)} />
                <KennzahlKarte label="Positionen" wert={String(kennzahlen.anzahlPositionen)} />
                <KennzahlKarte label="Buchungen gesamt" wert={String(kennzahlen.anzahlBuchungen)} />
              </div>

              {positionen.length > 0 ? (
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                  <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                    <DonutChart segmente={donutSegmente} groesse={160} />
                    <ul className="space-y-1 text-xs text-zinc-400">
                      {donutSegmente.map((s) => (
                        <li key={s.key} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: s.farbe }} />
                          {s.label}: {formatEur(s.betrag)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="min-w-0 flex-1 overflow-auto rounded-xl border border-zinc-800/80">
                    <table className="w-full min-w-[560px] text-left text-xs">
                      <thead className="bg-zinc-900/80 text-zinc-500">
                        <tr>
                          <th className="px-3 py-2">Wertpapier</th>
                          <th className="px-3 py-2">ISIN</th>
                          <th className="px-3 py-2">Klasse</th>
                          <th className="px-3 py-2 text-right">Stück</th>
                          <th className="px-3 py-2 text-right">Kurs</th>
                          <th className="px-3 py-2 text-right">Wert</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positionen.map((p, i) => (
                          <tr key={`${p.isin ?? p.name}-${i}`} className="border-t border-zinc-800/60">
                            <td className="max-w-[180px] truncate px-3 py-2 text-zinc-200">{p.name}</td>
                            <td className="px-3 py-2 font-mono text-[10px] text-zinc-500">{p.isin ?? '—'}</td>
                            <td className="px-3 py-2 text-zinc-400">{ASSET_KLASSE_LABEL[p.assetKlasse]}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                              {p.stueck.toLocaleString('de-DE', { maximumFractionDigits: 6 })}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                              {p.kursEur != null ? formatEur(p.kursEur) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-zinc-100">
                              {formatEur(p.wertEur)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </PageSectionPanel>
      </PageSection>

      {buchungen.length > 0 ? (
        <PageSection titleId="pa-buchungen-heading" title="Buchungen">
          <PageSectionPanel>
            <div className="max-h-96 overflow-auto rounded-xl border border-zinc-800/80">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Datum</th>
                    <th className="px-3 py-2">Typ</th>
                    <th className="px-3 py-2">Wertpapier</th>
                    <th className="px-3 py-2">ISIN</th>
                    <th className="px-3 py-2 text-right">Stück</th>
                    <th className="px-3 py-2 text-right">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {buchungenSortiert.map((b) => (
                    <tr key={b.id} className="border-t border-zinc-800/60">
                      <td className="px-3 py-1.5 tabular-nums text-zinc-400">{formatDatumDe(b.datum)}</td>
                      <td className="px-3 py-1.5 text-zinc-300">{BUCHUNGS_TYP_LABEL[b.typ]}</td>
                      <td className="max-w-[160px] truncate px-3 py-1.5 text-zinc-300">{b.wertpapierName ?? '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-zinc-500">{b.isin ?? '—'}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">
                        {b.stueck != null
                          ? b.stueck.toLocaleString('de-DE', { maximumFractionDigits: 6 })
                          : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-zinc-200">{formatEur(b.betragEur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {buchungen.length > 80 ? (
              <p className="mt-2 text-xs text-zinc-600">Zeigt die 80 neuesten von {buchungen.length} Buchungen.</p>
            ) : null}
          </PageSectionPanel>
        </PageSection>
      ) : null}

      {(buchungen.length > 0 || positionen.length > 0) && !schemaFehlt ? (
        <PageSection titleId="pa-danger-heading" title="Daten löschen">
          <PageSectionPanel>
            <p className="mb-3 text-sm text-zinc-500">
              Entfernt alle gespeicherten anonymisierten Buchungen und Snapshots aus Supabase. Rohdateien waren nie
              gespeichert.
            </p>
            <button
              type="button"
              onClick={() => void alleDatenLoeschen()}
              className="rounded-lg border border-rose-900/50 bg-rose-950/20 px-4 py-2 text-sm text-rose-200 hover:bg-rose-950/40"
            >
              Alle Portfolio-Daten löschen
            </button>
          </PageSectionPanel>
        </PageSection>
      ) : null}
    </PageChrome>
  )
}
