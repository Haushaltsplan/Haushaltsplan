'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PortfolioAnalyseImportVorschau } from '@/components/portfolio-analyse-import-vorschau'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import { ladePiiBlockliste, speicherePiiBlockliste } from '@/lib/portfolio-analyse/anonymisierung'
import {
  dedupliziereGegenBestehend,
  importiereParqetPortfolioCsvText,
  importiereTradeRepublicPdfBuffer,
} from '@/lib/portfolio-analyse/import-pipeline'
import {
  loescheAllePortfolioAnalyseDaten,
  speicherePortfolioImport,
} from '@/lib/portfolio-analyse/portfolio-analyse-db'
import type { PortfolioImportErgebnis } from '@/lib/portfolio-analyse/types'

function istPdfDatei(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function istCsvDatei(file: File): boolean {
  const n = file.name.toLowerCase()
  return file.type === 'text/csv' || n.endsWith('.csv') || n.endsWith('.txt')
}

export function PortfolioImportClient() {
  const { buchungen, schemaFehlt, neuLaden } = usePortfolioAnalyse()
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [speichernBusy, setSpeichernBusy] = useState(false)
  const [vorschau, setVorschau] = useState<PortfolioImportErgebnis | null>(null)
  const [vorschauDateiname, setVorschauDateiname] = useState('')
  const [blocklistText, setBlocklistText] = useState('')

  useEffect(() => {
    setBlocklistText(ladePiiBlockliste().join(', '))
  }, [])

  async function importAbschliessen(
    file: File,
    ergebnis: PortfolioImportErgebnis,
    opts?: { csvVollstaendigAktualisieren?: boolean },
  ) {
    if (opts?.csvVollstaendigAktualisieren) {
      ergebnis.hinweise.push(
        'Alle Buchungen aus der CSV werden gespeichert bzw. aktualisiert (z. B. realisierte Gewinne aus Parqet).',
      )
    } else {
      const bestehend = new Set(buchungen.map((b) => b.buchungsHash))
      const { neu, uebersprungen } = await dedupliziereGegenBestehend(ergebnis.buchungen, bestehend)
      ergebnis = { ...ergebnis, buchungen: neu }
      if (uebersprungen > 0) {
        ergebnis.hinweise.push(`${uebersprungen} Buchung(en) bereits gespeichert — werden übersprungen.`)
      }
    }
    setVorschauDateiname(file.name)
    setVorschau(ergebnis)
    if (ergebnis.buchungen.length === 0 && ergebnis.positionen.length === 0) {
      toast.error(ergebnis.hinweise[0] ?? 'Keine neuen Daten erkannt.')
    } else {
      toast.success('Vorschau bereit — bitte prüfen und übernehmen.')
    }
  }

  async function verarbeitePdf(file: File) {
    if (!istPdfDatei(file)) {
      toast.error('Bitte eine PDF-Datei wählen.')
      return
    }
    setImportBusy(true)
    setVorschau(null)
    try {
      const blocklist = blocklistText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2)
      speicherePiiBlockliste(blocklist)
      const buffer = await file.arrayBuffer()
      const ergebnis = await importiereTradeRepublicPdfBuffer(buffer, blocklist)
      await importAbschliessen(file, ergebnis)
    } catch (e) {
      console.error(e)
      toast.error('PDF-Import fehlgeschlagen — Trade-Republic-Kontoauszug?')
    } finally {
      setImportBusy(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ''
    }
  }

  async function verarbeiteCsv(file: File) {
    if (!istCsvDatei(file)) {
      toast.error('Bitte eine CSV-Datei wählen.')
      return
    }
    setImportBusy(true)
    setVorschau(null)
    try {
      const blocklist = blocklistText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2)
      speicherePiiBlockliste(blocklist)
      const text = await file.text()
      const ergebnis = await importiereParqetPortfolioCsvText(text, blocklist)
      await importAbschliessen(file, ergebnis, { csvVollstaendigAktualisieren: true })
    } catch (e) {
      console.error(e)
      toast.error('CSV-Import fehlgeschlagen.')
    } finally {
      setImportBusy(false)
      if (csvInputRef.current) csvInputRef.current.value = ''
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
        toast.error(res.message ?? 'Speichern fehlgeschlagen.')
        return
      }
      toast.success(
        res.eingefuegt > 0
          ? `${res.eingefuegt} Buchung(en) gespeichert.`
          : 'Snapshot aktualisiert (keine neuen Buchungen).',
      )
      setVorschau(null)
      setVorschauDateiname('')
      await neuLaden()
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
    await neuLaden()
  }

  return (
    <PortfolioAnalyseShell
      title="Import"
      description={
        <>
          Parqet-CSV (<strong className="font-normal text-zinc-300">Aktien Portfolio</strong>) oder optional
          Trade-Republic-PDF — alles nur im Browser, ohne Rohdatei-Upload.
        </>
      }
    >
      <PageSection titleId="pa-import-heading" title="Dateien">
        <PageSectionPanel>
          <div className="space-y-8">
            {buchungen.length > 0 && !schemaFehlt ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void alleDatenLoeschen()}
                  className="rounded-lg border border-rose-900/45 bg-rose-950/15 px-4 py-2 text-xs text-rose-200 hover:bg-rose-950/35"
                >
                  Gespeicherte Daten löschen ({buchungen.length} Buchungen)
                </button>
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                <h3 className="text-sm font-medium text-zinc-200">CSV — Parqet Portfolio</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Export aus Parqet mit Spalten{' '}
                  <code className="text-xs text-teal-400/90">
                    datetime, type, shares, amount, identifier, holdingname
                  </code>
                  .
                </p>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void verarbeiteCsv(f)
                  }}
                />
                <button
                  type="button"
                  disabled={importBusy || schemaFehlt}
                  onClick={() => csvInputRef.current?.click()}
                  className="mt-4 rounded-full border border-teal-500/40 bg-teal-950/30 px-5 py-2.5 text-sm font-medium text-teal-100 transition hover:bg-teal-950/50 disabled:opacity-50"
                >
                  {importBusy ? 'Wird gelesen …' : 'Parqet-CSV wählen'}
                </button>
              </div>

              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                <h3 className="text-sm font-medium text-zinc-200">PDF — Trade Republic</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Optional: Kontoauszug für Depot-Snapshot (Positionen & Depotwert).
                </p>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void verarbeitePdf(f)
                  }}
                />
                <button
                  type="button"
                  disabled={importBusy || schemaFehlt}
                  onClick={() => pdfInputRef.current?.click()}
                  className="mt-4 rounded-full border border-zinc-700/60 bg-zinc-900/50 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800/60 disabled:opacity-50"
                >
                  {importBusy ? 'Wird gelesen …' : 'TR-PDF wählen'}
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
          </div>
        </PageSectionPanel>
      </PageSection>
    </PortfolioAnalyseShell>
  )
}
