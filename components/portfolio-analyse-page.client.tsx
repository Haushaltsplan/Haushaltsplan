'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { PortfolioAnalyseDashboard } from '@/components/portfolio-analyse-dashboard.client'
import { PageChrome, PageHero, PageSection, PageSectionPanel } from '@/components/page-shell'
import { ladePiiBlockliste, speicherePiiBlockliste } from '@/lib/portfolio-analyse/anonymisierung'
import { dedupliziereGegenBestehend, importiereTradeRepublicCsvText, importiereTradeRepublicPdfBuffer } from '@/lib/portfolio-analyse/import-pipeline'
import { PortfolioAnalyseImportVorschau } from '@/components/portfolio-analyse-import-vorschau'
import {
  ladePortfolioAnalyseDaten,
  loescheAllePortfolioAnalyseDaten,
  speicherePortfolioImport,
} from '@/lib/portfolio-analyse/portfolio-analyse-db'
import type { PortfolioDbBuchung, PortfolioImportErgebnis } from '@/lib/portfolio-analyse/types'

function istPdfDatei(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function istCsvDatei(file: File): boolean {
  const n = file.name.toLowerCase()
  return file.type === 'text/csv' || n.endsWith('.csv') || n.endsWith('.txt')
}

export function PortfolioAnalysePageClient() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [laden, setLaden] = useState(true)
  const [schemaFehlt, setSchemaFehlt] = useState(false)
  const [dbFehler, setDbFehler] = useState<string | null>(null)
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
    setDbFehler(res.schemaFehlt ? null : res.message ?? null)
    if (res.ok) {
      setBuchungen(res.buchungen)
      setSnapshot(res.snapshot)
      setDbFehler(null)
    } else if (!res.schemaFehlt) {
      toast.error(res.message ?? 'Daten konnten nicht geladen werden.')
    }
    setLaden(false)
  }, [])

  useEffect(() => {
    void datenNeuLaden()
  }, [datenNeuLaden])

  const hatDaten = buchungen.length > 0 || (snapshot?.positionen.length ?? 0) > 0

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
          setDbFehler(null)
          toast.error('Datenbank-Tabellen fehlen — Migration ausführen (npm run db:portfolio-analyse).')
        } else {
          setDbFehler(res.message ?? null)
          toast.error(res.message ?? 'Speichern fehlgeschlagen.')
        }
        return
      }
      setDbFehler(null)
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
        title="Portfolioanalyse"
        description={
          <>
            Import nur im Browser — ohne KI, ohne Rohdatei-Upload. ISINs werden für Anzeigenamen und Logos öffentlich
            aufgelöst (OpenFIGI/Yahoo). Auswertung mit Kennzahlen, Vermögensverlauf, Cashflow, Dividenden und
            Allokation — gespeichert werden nur anonymisierte Buchungsdaten.
          </>
        }
      />

      {schemaFehlt ? (
        <PageSection titleId="pa-schema-heading" title="Datenbank">
          <PageSectionPanel>
            <p className="text-sm leading-relaxed text-amber-100/90">
              Tabellen fehlen noch oder der API-Schema-Cache ist veraltet. Migration einspielen (inkl.{' '}
              <code className="rounded bg-zinc-950 px-1 py-0.5 font-mono text-xs">NOTIFY pgrst</code> am Ende):{' '}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-teal-400">
                npm run db:portfolio-analyse
              </code>{' '}
              oder SQL aus{' '}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
                supabase/migrations/20260601120000_portfolio_analyse.sql
              </code>
              . Wenn die Tabellen schon existieren, im SQL-Editor nur ausführen:{' '}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
                NOTIFY pgrst, &apos;reload schema&apos;;
              </code>
            </p>
          </PageSectionPanel>
        </PageSection>
      ) : null}

      {dbFehler && !schemaFehlt ? (
        <PageSection titleId="pa-dbfehler-heading" title="Datenbank">
          <PageSectionPanel>
            <p className="text-sm leading-relaxed text-red-200/90">
              Speichern/Laden fehlgeschlagen: <span className="font-mono text-xs">{dbFehler}</span>
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
                <li>
                  CSV: <strong className="text-zinc-400">transaktionen_YYYY.csv</strong> (Datum; Typ; ISIN; Betrag_EUR …) oder TR-Transaktionsexport
                </li>
                <li>PDF-Kontoauszug ergänzt Depotpositionen für Allokation & Depotwert</li>
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

      {hatDaten && !schemaFehlt ? (
        <PageSection titleId="pa-auswertung-heading" title="Auswertung">
          <PageSectionPanel>
            {laden ? (
              <p className="text-sm text-zinc-500">Lade …</p>
            ) : (
              <PortfolioAnalyseDashboard buchungen={buchungen} snapshot={snapshot} />
            )}
          </PageSectionPanel>
        </PageSection>
      ) : !laden && !schemaFehlt ? (
        <PageSection titleId="pa-kennzahlen-heading" title="Auswertung">
          <PageSectionPanel>
            <p className="text-sm text-zinc-500">
              Noch keine Daten — importiere einen Trade-Republic-Transaktionsexport (CSV) oder Kontoauszug (PDF).
            </p>
          </PageSectionPanel>
        </PageSection>
      ) : null}

      {hatDaten && !schemaFehlt ? (
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
