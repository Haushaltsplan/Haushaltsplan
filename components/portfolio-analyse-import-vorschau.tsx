'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  bereiteBuchungFuerSpeicherung,
  bereitePositionFuerSpeicherung,
  buchungPiiWarnung,
  positionPiiWarnung,
  positionSchluessel,
  speicherePiiBlockliste,
  validiereSpeicherPayload,
} from '@/lib/portfolio-analyse/anonymisierung'
import { formatDatumDe, formatEur } from '@/lib/portfolio-analyse/berechnung'
import type { PortfolioImportErgebnis } from '@/lib/portfolio-analyse/types'
import { BUCHUNGS_TYP_LABEL } from '@/lib/portfolio-analyse/types'

type Props = {
  ergebnis: PortfolioImportErgebnis
  dateiname: string
  blocklistText: string
  onBlocklistChange: (text: string) => void
  onVerwerfen: () => void
  onUebernehmen: (payload: {
    buchungen: PortfolioImportErgebnis['buchungen']
    positionen: PortfolioImportErgebnis['positionen']
    depotwertEur: number | null
    snapshotUebernehmen: boolean
  }) => void
  speichernBusy: boolean
}

function initSet<T>(items: T[], keyFn: (item: T) => string, aktivWenn: (item: T) => boolean): Set<string> {
  const s = new Set<string>()
  for (const item of items) {
    if (aktivWenn(item)) s.add(keyFn(item))
  }
  return s
}

export function PortfolioAnalyseImportVorschau({
  ergebnis,
  dateiname,
  blocklistText,
  onBlocklistChange,
  onVerwerfen,
  onUebernehmen,
  speichernBusy,
}: Props) {
  const blocklist = useMemo(
    () =>
      blocklistText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2),
    [blocklistText],
  )

  const [buchungenListe, setBuchungenListe] = useState(ergebnis.buchungen)
  const [positionenListe, setPositionenListe] = useState(ergebnis.positionen)

  useEffect(() => {
    setBuchungenListe(ergebnis.buchungen)
    setPositionenListe(ergebnis.positionen)
  }, [ergebnis])

  const [buchungAktiv, setBuchungAktiv] = useState<Set<string>>(new Set())
  const [positionAktiv, setPositionAktiv] = useState<Set<string>>(new Set())
  const [snapshotAktiv, setSnapshotAktiv] = useState(ergebnis.positionen.length > 0)

  function aktivierungNeuBerechnen(listeBlocklist = blocklist) {
    setBuchungAktiv(
      initSet(
        buchungenListe,
        (b) => b.buchungsHash,
        (b) => !buchungPiiWarnung(b, listeBlocklist),
      ),
    )
    setPositionAktiv(
      initSet(
        positionenListe,
        positionSchluessel,
        (p) => !positionPiiWarnung(p, listeBlocklist),
      ),
    )
  }

  useEffect(() => {
    aktivierungNeuBerechnen()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei neuer Importliste
  }, [buchungenListe, positionenListe])

  const buchungenMitWarnung = useMemo(
    () =>
      buchungenListe.map((b) => ({
        b,
        warnung: buchungPiiWarnung(b, blocklist),
      })),
    [buchungenListe, blocklist],
  )

  const positionenMitWarnung = useMemo(
    () =>
      positionenListe.map((p) => ({
        p,
        key: positionSchluessel(p),
        warnung: positionPiiWarnung(p, blocklist),
      })),
    [positionenListe, blocklist],
  )

  const ausgewaehlteBuchungen = buchungenMitWarnung.filter((x) => buchungAktiv.has(x.b.buchungsHash))
  const ausgewaehltePositionen = positionenMitWarnung.filter((x) => positionAktiv.has(x.key))

  function toggleBuchung(hash: string) {
    setBuchungAktiv((prev) => {
      const next = new Set(prev)
      if (next.has(hash)) next.delete(hash)
      else next.add(hash)
      return next
    })
  }

  function togglePosition(key: string) {
    setPositionAktiv((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function alleBuchungenAbwaehlen() {
    setBuchungAktiv(new Set())
  }

  function alleBuchungenAnwaehlen() {
    setBuchungAktiv(new Set(buchungenListe.map((b) => b.buchungsHash)))
  }

  function buchungAusListeEntfernen(hash: string) {
    setBuchungenListe((prev) => prev.filter((b) => b.buchungsHash !== hash))
    setBuchungAktiv((prev) => {
      const next = new Set(prev)
      next.delete(hash)
      return next
    })
  }

  function positionAusListeEntfernen(key: string) {
    setPositionenListe((prev) => prev.filter((p) => positionSchluessel(p) !== key))
    setPositionAktiv((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  function ausgewaehlteBuchungenEntfernen() {
    const hashes = new Set(ausgewaehlteBuchungen.map((x) => x.b.buchungsHash))
    setBuchungenListe((prev) => prev.filter((b) => !hashes.has(b.buchungsHash)))
    setBuchungAktiv((prev) => {
      const next = new Set(prev)
      for (const h of hashes) next.delete(h)
      return next
    })
  }

  function ausgewaehltePositionenEntfernen() {
    const keys = new Set(ausgewaehltePositionen.map((x) => x.key))
    setPositionenListe((prev) => prev.filter((p) => !keys.has(positionSchluessel(p))))
    setPositionAktiv((prev) => {
      const next = new Set(prev)
      for (const k of keys) next.delete(k)
      return next
    })
  }

  function blocklistSpeichern() {
    speicherePiiBlockliste(blocklist)
    onBlocklistChange(blocklistText)
    aktivierungNeuBerechnen(blocklist)
  }

  function handleUebernehmen() {
    const rohBuchungen = buchungenListe.filter((b) => buchungAktiv.has(b.buchungsHash))
    const rohPositionen = positionenListe.filter((p) => positionAktiv.has(positionSchluessel(p)))

    const buchungen = rohBuchungen
      .map((b) => bereiteBuchungFuerSpeicherung(b, blocklist))
      .filter((b): b is NonNullable<typeof b> => b != null)

    const positionen = rohPositionen
      .map((p) => bereitePositionFuerSpeicherung(p, blocklist))
      .filter((p): p is NonNullable<typeof p> => p != null)

    const check = validiereSpeicherPayload(buchungen, positionen, blocklist)
    if (!check.ok) {
      window.alert(check.grund)
      return
    }

    const depotwertEur =
      snapshotAktiv && positionen.length > 0
        ? Math.round(positionen.reduce((s, p) => s + p.wertEur, 0) * 100) / 100
        : null

    onUebernehmen({
      buchungen,
      positionen: snapshotAktiv ? positionen : [],
      depotwertEur,
      snapshotUebernehmen: snapshotAktiv,
    })
  }

  const kannSpeichern =
    (buchungAktiv.size > 0 || (snapshotAktiv && positionAktiv.size > 0)) &&
    !buchungenMitWarnung.some((x) => buchungAktiv.has(x.b.buchungsHash) && x.warnung) &&
    !positionenMitWarnung.some((x) => positionAktiv.has(x.key) && x.warnung)

  return (
    <div className="mt-5 space-y-4 rounded-xl border border-zinc-700/50 bg-zinc-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">
          Vorschau{' '}
          <span className="font-normal text-zinc-500">({dateiname} — Datei wird nicht gespeichert)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
            onClick={onVerwerfen}
          >
            Verwerfen
          </button>
          <button
            type="button"
            disabled={speichernBusy || !kannSpeichern}
            onClick={handleUebernehmen}
            className="rounded-lg border border-emerald-600/50 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-950/60 disabled:opacity-50"
            title={
              !kannSpeichern
                ? 'Auswahl prüfen — markierte PII-Zeilen abwählen oder Blockliste nutzen'
                : undefined
            }
          >
            {speichernBusy ? 'Speichert …' : 'Auswahl speichern'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2.5 text-xs leading-relaxed text-amber-100/90">
        <strong className="font-medium">Privatsphäre:</strong> Vor dem Speichern kannst du Zeilen abwählen oder
        entfernen. Unter „Namen blockieren“ trägst du deinen Namen (und ggf. weitere Begriffe) ein — diese Strings
        werden weder gespeichert noch angezeigt. Gelb markierte Zeilen sind standardmäßig abgewählt.
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-zinc-400">Namen blockieren (lokal im Browser, kommagetrennt)</span>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={blocklistText}
            onChange={(e) => onBlocklistChange(e.target.value)}
            onBlur={blocklistSpeichern}
            placeholder="z. B. Max, Mustermann"
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={blocklistSpeichern}
            className="shrink-0 rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Blockliste anwenden
          </button>
        </div>
      </label>

      {ergebnis.hinweise.map((h) => (
        <p key={h} className="text-xs text-zinc-500">
          {h}
        </p>
      ))}

      <p className="text-xs text-zinc-500">
        {buchungAktiv.size} von {buchungenListe.length} Buchung(en) ausgewählt · {positionAktiv.size} von{' '}
        {positionenListe.length} Position(en)
        {positionenListe.length > 0 ? (
          <label className="ml-2 inline-flex items-center gap-1.5 text-zinc-400">
            <input
              type="checkbox"
              checked={snapshotAktiv}
              onChange={(e) => setSnapshotAktiv(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Depot-Snapshot übernehmen
          </label>
        ) : null}
      </p>

      {buchungenListe.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={alleBuchungenAnwaehlen}
              className="text-[11px] text-zinc-500 underline hover:text-zinc-300"
            >
              Alle Buchungen
            </button>
            <button
              type="button"
              onClick={alleBuchungenAbwaehlen}
              className="text-[11px] text-zinc-500 underline hover:text-zinc-300"
            >
              Keine Buchungen
            </button>
            <button
              type="button"
              onClick={ausgewaehlteBuchungenEntfernen}
              disabled={ausgewaehlteBuchungen.length === 0}
              className="text-[11px] text-rose-400/90 underline hover:text-rose-300 disabled:opacity-40"
            >
              Ausgewählte aus Liste entfernen
            </button>
          </div>
          <div className="max-h-64 overflow-auto rounded-lg border border-zinc-800/80">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-2 py-2">Datum</th>
                  <th className="px-2 py-2">Typ</th>
                  <th className="px-2 py-2">Bezeichnung</th>
                  <th className="px-2 py-2 text-right">Betrag</th>
                  <th className="w-8 px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {buchungenMitWarnung.map(({ b, warnung }) => {
                  const aktiv = buchungAktiv.has(b.buchungsHash)
                  return (
                    <tr
                      key={b.buchungsHash}
                      className={`border-t border-zinc-800/60 ${warnung ? 'bg-amber-950/25' : ''} ${!aktiv ? 'opacity-45' : ''}`}
                    >
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={aktiv}
                          onChange={() => toggleBuchung(b.buchungsHash)}
                          aria-label="Buchung übernehmen"
                        />
                      </td>
                      <td className="px-2 py-1.5 tabular-nums text-zinc-400">{formatDatumDe(b.datum)}</td>
                      <td className="px-2 py-1.5 text-zinc-300">{BUCHUNGS_TYP_LABEL[b.typ]}</td>
                      <td className="max-w-[200px] px-2 py-1.5">
                        <span className="block truncate text-zinc-300">{b.wertpapierName ?? b.isin ?? '—'}</span>
                        {warnung ? <span className="mt-0.5 block text-[10px] text-amber-400">{warnung}</span> : null}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-200">{formatEur(b.betragEur)}</td>
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          title="Aus Importliste entfernen"
                          className="text-zinc-600 hover:text-rose-400"
                          onClick={() => buchungAusListeEntfernen(b.buchungsHash)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {positionenListe.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPositionAktiv(new Set(positionenListe.map(positionSchluessel)))}
              className="text-[11px] text-zinc-500 underline hover:text-zinc-300"
            >
              Alle Positionen
            </button>
            <button
              type="button"
              onClick={() => setPositionAktiv(new Set())}
              className="text-[11px] text-zinc-500 underline hover:text-zinc-300"
            >
              Keine Positionen
            </button>
            <button
              type="button"
              onClick={ausgewaehltePositionenEntfernen}
              disabled={ausgewaehltePositionen.length === 0}
              className="text-[11px] text-rose-400/90 underline hover:text-rose-300 disabled:opacity-40"
            >
              Ausgewählte Positionen entfernen
            </button>
          </div>
          <div className="max-h-48 overflow-auto rounded-lg border border-zinc-800/80">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-2 py-2">Name / ISIN</th>
                  <th className="px-2 py-2 text-right">Wert</th>
                  <th className="w-8 px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {positionenMitWarnung.map(({ p, key, warnung }) => {
                  const aktiv = positionAktiv.has(key)
                  return (
                    <tr
                      key={key}
                      className={`border-t border-zinc-800/60 ${warnung ? 'bg-amber-950/25' : ''} ${!aktiv ? 'opacity-45' : ''}`}
                    >
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={aktiv}
                          onChange={() => togglePosition(key)}
                          aria-label="Position übernehmen"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-zinc-300">{p.name}</span>
                        {p.isin ? <span className="ml-1 font-mono text-[10px] text-zinc-500">{p.isin}</span> : null}
                        {warnung ? <span className="mt-0.5 block text-[10px] text-amber-400">{warnung}</span> : null}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-200">{formatEur(p.wertEur)}</td>
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          className="text-zinc-600 hover:text-rose-400"
                          onClick={() => positionAusListeEntfernen(key)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
