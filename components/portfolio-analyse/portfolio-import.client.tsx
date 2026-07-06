'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PortfolioAnalyseImportVorschau } from '@/components/portfolio-analyse-import-vorschau'
import { PortfolioImportManuell } from '@/components/portfolio-analyse/portfolio-import-manuell'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import { ladePiiBlockliste, speicherePiiBlockliste } from '@/lib/portfolio-analyse/anonymisierung'
import {
  dedupliziereGegenBestehend,
  importierePortfolioCsvText,
  importiereTradeRepublicPdfBuffer,
  mergeImportErgebnisse,
} from '@/lib/portfolio-analyse/import-pipeline'
import { ermittleCorporateActionBuchungen } from '@/lib/portfolio-analyse/corporate-actions-verbuchung'
import { istParqetPortfolioCsv } from '@/lib/portfolio-analyse/parqet-portfolio-csv'
import { istTradeRepublicCsv } from '@/lib/portfolio-analyse/trade-republic-csv'
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

function istImportDatei(file: File): boolean {
  return istPdfDatei(file) || istCsvDatei(file)
}

export function PortfolioImportClient() {
  const { buchungen, schemaFehlt, neuLaden } = usePortfolioAnalyse()
  const dateiInputRef = useRef<HTMLInputElement>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importFortschritt, setImportFortschritt] = useState<string | null>(null)
  const [speichernBusy, setSpeichernBusy] = useState(false)
  const [vorschau, setVorschau] = useState<PortfolioImportErgebnis | null>(null)
  const [vorschauDateiname, setVorschauDateiname] = useState('')
  const [blocklistText, setBlocklistText] = useState('')
  const [dragAktiv, setDragAktiv] = useState(false)

  useEffect(() => {
    setBlocklistText(ladePiiBlockliste().join(', '))
  }, [])

  const blocklistAusText = useCallback(
    () =>
      blocklistText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2),
    [blocklistText],
  )

  const [corporateBusy, setCorporateBusy] = useState(false)

  async function corporateActionsAnwenden(ergebnis: PortfolioImportErgebnis): Promise<PortfolioImportErgebnis> {
    const bestehendHashes = new Set(buchungen.map((b) => b.buchungsHash))
    const alle = [...buchungen, ...ergebnis.buchungen]
    const ca = await ermittleCorporateActionBuchungen(alle, bestehendHashes)
    const hinweise = [...ergebnis.hinweise, ...ca.hinweise]
    if (ca.zusaetzlicheBuchungen.length === 0) {
      return { ...ergebnis, hinweise }
    }
    return {
      ...ergebnis,
      buchungen: [...ergebnis.buchungen, ...ca.zusaetzlicheBuchungen],
      hinweise,
    }
  }

  async function importAbschliessen(
    label: string,
    ergebnis: PortfolioImportErgebnis,
    opts?: { csvVollstaendigAktualisieren?: boolean },
  ) {
    if (opts?.csvVollstaendigAktualisieren) {
      ergebnis.hinweise.push(
        'Alle Buchungen aus der CSV werden gespeichert bzw. aktualisiert (z. B. realisierte Gewinne aus Parqet).',
      )
    } else {
      const bestehend = new Set(buchungen.map((b) => b.buchungsHash))
      const { neu, uebersprungen } = await dedupliziereGegenBestehend(
        ergebnis.buchungen,
        bestehend,
        buchungen,
      )
      ergebnis = { ...ergebnis, buchungen: neu }
      if (uebersprungen > 0) {
        ergebnis.hinweise.push(`${uebersprungen} Buchung(en) bereits gespeichert — werden übersprungen.`)
      }
    }
    ergebnis = await corporateActionsAnwenden(ergebnis)
    setVorschauDateiname(label)
    setVorschau(ergebnis)
    if (ergebnis.buchungen.length === 0 && ergebnis.positionen.length === 0) {
      toast.error(ergebnis.hinweise[0] ?? 'Keine neuen Daten erkannt.')
    } else {
      toast.success('Vorschau bereit — bitte prüfen und übernehmen.')
    }
  }

  async function verarbeitePdf(file: File, blocklist: string[]): Promise<PortfolioImportErgebnis> {
    const buffer = await file.arrayBuffer()
    return importiereTradeRepublicPdfBuffer(buffer, blocklist)
  }

  async function verarbeiteCsv(file: File, blocklist: string[]): Promise<{
    ergebnis: PortfolioImportErgebnis
    csvVollstaendig: boolean
  }> {
    const text = await file.text()
    const ergebnis = await importierePortfolioCsvText(text, blocklist)
    const csvVoll = istParqetPortfolioCsv(text) || istTradeRepublicCsv(text)
    return { ergebnis, csvVollstaendig: csvVoll }
  }

  async function verarbeiteDateien(files: File[]) {
    const gueltig = files.filter(istImportDatei)
    if (gueltig.length === 0) {
      toast.error('Bitte PDF- oder CSV-Dateien wählen.')
      return
    }
    if (gueltig.length < files.length) {
      toast.error(`${files.length - gueltig.length} Datei(en) übersprungen — nur PDF/CSV.`)
    }

    setImportBusy(true)
    setVorschau(null)
    setImportFortschritt(null)
    try {
      const blocklist = blocklistAusText()
      speicherePiiBlockliste(blocklist)

      const teilErgebnisse: PortfolioImportErgebnis[] = []
      let csvVollstaendig = false
      const fehler: string[] = []

      for (let i = 0; i < gueltig.length; i++) {
        const file = gueltig[i]!
        setImportFortschritt(`${i + 1}/${gueltig.length}: ${file.name}`)
        try {
          if (istPdfDatei(file)) {
            teilErgebnisse.push(await verarbeitePdf(file, blocklist))
          } else {
            const { ergebnis, csvVollstaendig: voll } = await verarbeiteCsv(file, blocklist)
            teilErgebnisse.push(ergebnis)
            csvVollstaendig = csvVollstaendig || voll
          }
        } catch (e) {
          console.error(file.name, e)
          fehler.push(`${file.name}: ${e instanceof Error ? e.message : 'Fehler'}`)
        }
      }

      if (teilErgebnisse.length === 0) {
        toast.error(fehler[0] ?? 'Import fehlgeschlagen.')
        return
      }

      const zusammen = mergeImportErgebnisse(teilErgebnisse)
      if (fehler.length > 0) {
        zusammen.hinweise.push(`${fehler.length} Datei(en) fehlgeschlagen: ${fehler.join(' · ')}`)
      }

      const label =
        gueltig.length === 1
          ? gueltig[0]!.name
          : `${gueltig.length} Dateien (${gueltig.map((f) => f.name).join(', ')})`

      await importAbschliessen(label, zusammen, {
        csvVollstaendigAktualisieren: csvVollstaendig && gueltig.every((f) => istCsvDatei(f)),
      })
    } finally {
      setImportBusy(false)
      setImportFortschritt(null)
      if (dateiInputRef.current) dateiInputRef.current.value = ''
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragAktiv(false)
      if (importBusy || schemaFehlt) return
      const files = [...e.dataTransfer.files]
      if (files.length > 0) void verarbeiteDateien(files)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- verarbeiteDateien stabil genug über State
    [importBusy, schemaFehlt, blocklistText, buchungen],
  )

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
      if (res.hinweis) {
        toast(res.hinweis, { icon: '⚠️', duration: 14000 })
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

  async function corporateActionsNachbuchen() {
    if (buchungen.length === 0 || schemaFehlt) return
    setCorporateBusy(true)
    setVorschau(null)
    try {
      const leer: PortfolioImportErgebnis = {
        buchungen: [],
        positionen: [],
        depotwertEur: null,
        hinweise: [],
        statistik: { cashZeilen: 0, positionen: 0, cryptoPositionen: 0, doppelteHashes: 0 },
      }
      const ergebnis = await corporateActionsAnwenden(leer)
      if (ergebnis.buchungen.length === 0 && ergebnis.hinweise.length === 0) {
        toast('Keine fehlenden Splits oder Spin-offs erkannt.')
        return
      }
      setVorschauDateiname('Corporate Actions')
      setVorschau(ergebnis)
      if (ergebnis.buchungen.length > 0) {
        toast.success('Corporate Actions — bitte Vorschau prüfen und speichern.')
      } else {
        toast.success(ergebnis.hinweise[0] ?? 'Splits registriert.')
      }
    } finally {
      setCorporateBusy(false)
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
          Parqet- oder Trade-Republic-CSV, Kontoauszug-PDF oder Wertpapierabrechnungen — mehrere Dateien per Drag
          &amp; Drop. Oder einzelne Buchungen manuell erfassen. Alles nur im Browser.
        </>
      }
    >
      <PageSection titleId="pa-import-heading" title="Dateien">
        <PageSectionPanel>
          <div className="space-y-8">
            {buchungen.length > 0 && !schemaFehlt ? (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={corporateBusy || importBusy}
                  onClick={() => void corporateActionsNachbuchen()}
                  className="rounded-lg border border-teal-800/45 bg-teal-950/20 px-4 py-2 text-xs text-teal-100 hover:bg-teal-950/35 disabled:opacity-50"
                >
                  {corporateBusy ? 'Prüft Splits …' : 'Splits & Spin-offs nachbuchen'}
                </button>
                <button
                  type="button"
                  onClick={() => void alleDatenLoeschen()}
                  className="rounded-lg border border-rose-900/45 bg-rose-950/15 px-4 py-2 text-xs text-rose-200 hover:bg-rose-950/35"
                >
                  Gespeicherte Daten löschen ({buchungen.length} Buchungen)
                </button>
              </div>
            ) : null}

            <input
              ref={dateiInputRef}
              type="file"
              accept=".pdf,application/pdf,.csv,text/csv,.txt"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])]
                if (files.length > 0) void verarbeiteDateien(files)
              }}
            />

            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') dateiInputRef.current?.click()
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (!importBusy && !schemaFehlt) setDragAktiv(true)
              }}
              onDragLeave={() => setDragAktiv(false)}
              onDrop={onDrop}
              onClick={() => {
                if (!importBusy && !schemaFehlt) dateiInputRef.current?.click()
              }}
              className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
                dragAktiv
                  ? 'border-teal-400/60 bg-teal-950/25'
                  : 'border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-muted)]'
              } ${importBusy || schemaFehlt ? 'pointer-events-none opacity-50' : ''}`}
            >
              <p className="text-base font-medium text-[var(--app-text)]">
                {importBusy ? 'Dateien werden gelesen …' : 'PDFs & CSVs hierher ziehen'}
              </p>
              <p className="mt-2 text-sm text-[var(--app-text-muted)]">oder klicken zum Auswählen · mehrere Dateien gleichzeitig</p>
              {importFortschritt ? (
                <p className="mt-3 text-xs text-teal-300/90">{importFortschritt}</p>
              ) : (
                <p className="mt-4 text-xs leading-relaxed text-[var(--app-text-muted)]">
                  Trade Republic: Transaktionsexport-CSV, Kontoauszug-PDF oder einzelne Wertpapierabrechnungen (Kauf/
                  Verkauf). Parqet: Portfolio-CSV.
                </p>
              )}
            </div>

            <PortfolioImportManuell
              disabled={importBusy || schemaFehlt}
              onErstellt={async (ergebnis, label) => {
                await importAbschliessen(label, ergebnis)
              }}
            />

            <div className="grid gap-4 text-sm text-[var(--app-text-muted)] sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/30 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">CSV</h3>
                <p className="mt-2 leading-relaxed">
                  TR: Profil → Dokumente → Transaktionsexport (
                  <code className="text-teal-400/90">Timestamp, Type, amount</code>). Parqet: Aktien-Portfolio-Export.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/30 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">PDF</h3>
                <p className="mt-2 leading-relaxed">
                  Kontoauszug mit Umsatzübersicht oder einzelne Wertpapierabrechnungen pro Trade — ideal für
                  Massenimport per Drag &amp; Drop.
                </p>
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
