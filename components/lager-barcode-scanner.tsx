'use client'

import { appModalBackdropClassName, appModalPanelClassName } from '@/lib/app-modal-overlay'
import { lagerBarcodeNorm, lagerBarcodesGleich } from '@/lib/lager-barcode'
import { bucheSchnellMinus, bucheSchnellPlus } from '@/lib/lager-schnellbuchung'
import { lagerKategorieAusArtikel } from '@/lib/lager-produkt-kategorie'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

type OffVorschlag = {
  anzeigeName: string
  rohName: string
  kategorie: string
  marke?: string
}

export type ScannerProdukt = {
  id: string
  name: string
  barcode?: string | null
  menge: number
  einheit: string
}

type Props = {
  produkte: ScannerProdukt[]
  onClose: () => void
  onAenderung: () => void
}

// BarcodeDetector ist (noch) nicht in den TS-DOM-Typen; minimal selbst deklarieren.
type ErkannterCode = { rawValue: string }
type BarcodeDetectorLike = { detect: (src: CanvasImageSource) => Promise<ErkannterCode[]> }
type BarcodeDetectorCtor = {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

function getDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
  return w.BarcodeDetector ?? null
}

function codeUebernehmen(raw: string, setCode: (c: string) => void, stop: () => void) {
  const norm = lagerBarcodeNorm(raw)
  if (!norm) return
  setCode(norm)
  stop()
}

export function LagerBarcodeScanner({ produkte, onClose, onAenderung }: Props) {
  const detectorVerfuegbar = useMemo(() => getDetectorCtor() != null, [])
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const loopRef = useRef<number | null>(null)
  const zxingRef = useRef<IScannerControls | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  const [scanAktiv, setScanAktiv] = useState(true)
  const [code, setCode] = useState<string | null>(null)
  const [manuell, setManuell] = useState('')
  const [kameraFehler, setKameraFehler] = useState<string | null>(null)
  const [suche, setSuche] = useState('')
  const [busy, setBusy] = useState(false)
  const [off, setOff] = useState<OffVorschlag | null>(null)
  const [offLaden, setOffLaden] = useState(false)

  const treffer = useMemo(() => {
    if (!code) return null
    return produkte.find((p) => lagerBarcodesGleich(p.barcode ?? '', code)) ?? null
  }, [code, produkte])

  const stopKamera = useCallback(() => {
    if (loopRef.current != null) {
      cancelAnimationFrame(loopRef.current)
      loopRef.current = null
    }
    if (zxingRef.current) {
      void zxingRef.current.stop()
      zxingRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    const video = videoRef.current
    if (video) video.srcObject = null
  }, [])

  const scanStoppen = useCallback(() => {
    stopKamera()
    setScanAktiv(false)
  }, [stopKamera])

  useEffect(() => {
    stopRef.current = scanStoppen
  }, [scanStoppen])

  useEffect(() => {
    if (!scanAktiv) return
    let abbruch = false

    const warteAufVideo = (): Promise<HTMLVideoElement> =>
      new Promise((resolve, reject) => {
        let versuche = 0
        const pruefen = () => {
          if (abbruch) {
            reject(new Error('abgebrochen'))
            return
          }
          const video = videoRef.current
          if (video) {
            resolve(video)
            return
          }
          if (versuche++ > 60) {
            reject(new Error('Video-Element nicht bereit'))
            return
          }
          requestAnimationFrame(pruefen)
        }
        pruefen()
      })

    void (async () => {
      try {
        const video = await warteAufVideo()
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (abbruch) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        await video.play().catch(() => {})

        const stop = () => stopRef.current?.()

        const ctor = getDetectorCtor()
        if (ctor) {
          const detector = new ctor({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          })
          const tick = async () => {
            if (abbruch || !videoRef.current) return
            const v = videoRef.current
            if (v.readyState < 2) {
              loopRef.current = requestAnimationFrame(() => void tick())
              return
            }
            try {
              const codes = await detector.detect(v)
              const erster = codes.find((c) => c.rawValue)?.rawValue
              if (erster) {
                codeUebernehmen(erster, setCode, stop)
                return
              }
            } catch {
              /* einzelne Frames können fehlschlagen — weiter versuchen */
            }
            loopRef.current = requestAnimationFrame(() => void tick())
          }
          loopRef.current = requestAnimationFrame(() => void tick())
          return
        }

        const reader = new BrowserMultiFormatReader()
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (result && !abbruch) codeUebernehmen(result.getText(), setCode, stop)
        })
        if (abbruch) {
          void controls.stop()
          return
        }
        zxingRef.current = controls
      } catch (e) {
        if (abbruch) return
        const msg = e instanceof Error ? e.message : ''
        if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
          setKameraFehler('Kamera-Zugriff verweigert. Code unten manuell eingeben.')
        } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
          setKameraFehler('Keine Kamera gefunden. Code unten manuell eingeben.')
        } else {
          setKameraFehler('Kamera nicht verfügbar. Code unten manuell eingeben.')
        }
        setScanAktiv(false)
      }
    })()

    return () => {
      abbruch = true
      stopKamera()
    }
  }, [scanAktiv, stopKamera])

  useEffect(() => () => stopKamera(), [stopKamera])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!code || treffer) {
      setOff(null)
      return
    }
    let abbruch = false
    setOffLaden(true)
    void fetch(`/api/lager/barcode-lookup?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((data: { gefunden?: boolean; produkt?: OffVorschlag }) => {
        if (abbruch) return
        if (data.gefunden && data.produkt) {
          setOff(data.produkt)
          setSuche(data.produkt.anzeigeName)
        } else setOff(null)
      })
      .catch(() => {
        if (!abbruch) setOff(null)
      })
      .finally(() => {
        if (!abbruch) setOffLaden(false)
      })
    return () => {
      abbruch = true
    }
  }, [code, treffer])

  function neuScannen() {
    setCode(null)
    setSuche('')
    setManuell('')
    setOff(null)
    setKameraFehler(null)
    setScanAktiv(true)
  }

  async function plus(p: ScannerProdukt) {
    setBusy(true)
    const r = await bucheSchnellPlus(p.id, p.menge)
    setBusy(false)
    if (!r.ok) return toast.error(r.fehler || 'Fehlgeschlagen.')
    toast.success(`+1 ${p.einheit} · ${p.name}`)
    onAenderung()
  }

  async function minus(p: ScannerProdukt) {
    setBusy(true)
    const r = await bucheSchnellMinus(p.id, p.menge)
    setBusy(false)
    if (!r.ok) return toast.error(r.fehler || 'Fehlgeschlagen.')
    toast.success(`−1 ${p.einheit} · ${p.name}`)
    onAenderung()
  }

  async function bindeAn(p: ScannerProdukt) {
    if (!code) return
    setBusy(true)
    try {
      const res = await fetch('/api/lager/produkt', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, barcode: code }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(data.error || 'Zuordnen fehlgeschlagen.')
        return
      }
      const kat = lagerKategorieAusArtikel(p.name)
      toast.success(
        kat !== 'Sonstiges'
          ? `„${p.name}" verknüpft · Warengruppe ${kat}.`
          : `Barcode mit „${p.name}" verknüpft.`,
      )
      onAenderung()
    } finally {
      setBusy(false)
    }
  }

  async function legeNeuAn() {
    if (!code) return
    const bez = (off?.anzeigeName || suche.trim()).trim()
    if (!bez) {
      toast.error('Bitte einen Artikelnamen eingeben oder warten, bis der Barcode-Lookup fertig ist.')
      return
    }
    const kat = off?.kategorie || lagerKategorieAusArtikel(bez)
    const heute = new Date()
    const datum = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`
    setBusy(true)
    try {
      const res = await fetch('/api/lager/produkt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bez,
          kauf_menge: 1,
          kauf_einheit: 'Stück',
          basis_einheit: 'Stück',
          gesamtpreis: 0,
          einkaufsdatum: datum,
          kategorie: kat,
          barcode: code,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(data.error || 'Anlegen fehlgeschlagen.')
        return
      }
      toast.success(`„${bez}" angelegt (${kat}) und Barcode gespeichert.`)
      onAenderung()
      neuScannen()
    } finally {
      setBusy(false)
    }
  }

  const sucheTreffer = useMemo(() => {
    const q = suche.trim().toLowerCase()
    let liste = produkte
    if (q) {
      liste = produkte.filter((p) => p.name.toLowerCase().includes(q))
    } else if (off?.anzeigeName) {
      const hint = off.anzeigeName.toLowerCase()
      liste = [...produkte].sort((a, b) => {
        const am = a.name.toLowerCase().includes(hint) ? 0 : 1
        const bm = b.name.toLowerCase().includes(hint) ? 0 : 1
        return am - bm || a.name.localeCompare(b.name, 'de')
      })
    }
    return liste.slice(0, 12)
  }, [suche, produkte, off])

  function manuellUebernehmen() {
    const norm = lagerBarcodeNorm(manuell)
    if (!norm) return
    setCode(norm)
    scanStoppen()
  }

  return (
    <div className={appModalBackdropClassName} role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${appModalPanelClassName} p-5`} role="dialog" aria-modal="true" aria-label="Barcode scannen">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[var(--app-text)]">Barcode scannen</h3>
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--app-border-strong)] px-2.5 py-1 text-sm font-bold text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]">
            Schließen
          </button>
        </div>

        {scanAktiv ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-[var(--app-border-strong)] bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} className="h-56 w-full object-cover" playsInline muted autoPlay />
              <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-rose-500/70" />
            </div>
            <p className="text-center text-[12px] text-[var(--app-text-muted)]">
              Barcode vor die Kamera halten…
              {!detectorVerfuegbar ? ' (Fallback-Scanner)' : ''}
            </p>
          </div>
        ) : null}

        {!code ? (
          <div className={`space-y-3 ${scanAktiv ? 'mt-3 border-t border-[var(--app-border)] pt-3' : ''}`}>
            {kameraFehler ? (
              <p className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-[12px] text-amber-200">{kameraFehler}</p>
            ) : null}
            <div className="flex gap-2">
              <input
                value={manuell}
                onChange={(e) => setManuell(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && manuell.trim() && manuellUebernehmen()}
                inputMode="numeric"
                placeholder="Barcode / EAN eingeben"
                className="min-w-0 flex-1 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-sm font-semibold text-[var(--app-text)] outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button
                type="button"
                disabled={!manuell.trim()}
                onClick={manuellUebernehmen}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"
              >
                OK
              </button>
            </div>
            {!scanAktiv ? (
              <button type="button" onClick={() => setScanAktiv(true)} className="w-full rounded-lg border border-sky-600/55 bg-sky-950/40 py-2.5 text-sm font-bold text-sky-100 hover:bg-sky-900/40">
                Kamera starten
              </button>
            ) : null}
          </div>
        ) : null}

        {code ? (
          <div className="space-y-3">
            <p className="text-[12px] text-[var(--app-text-muted)]">
              Code: <span className="font-mono font-bold text-[var(--app-text)]">{code}</span>
            </p>

            {treffer ? (
              <div className="rounded-xl border border-emerald-800/45 bg-emerald-950/20 p-3">
                <p className="font-bold text-[var(--app-text)]">{treffer.name}</p>
                <p className="mt-0.5 text-[12px] text-[var(--app-text-muted)]">
                  Bestand: <span className="tabular-nums text-emerald-200">{treffer.menge} {treffer.einheit}</span>
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void minus(treffer)} className="flex-1 rounded-lg border border-amber-700/50 bg-amber-900/30 py-2.5 text-sm font-black text-amber-100 hover:bg-amber-800/40 disabled:opacity-40">
                    −1
                  </button>
                  <button type="button" disabled={busy} onClick={() => void plus(treffer)} className="flex-1 rounded-lg border border-emerald-700/50 bg-emerald-900/30 py-2.5 text-sm font-black text-emerald-100 hover:bg-emerald-800/40 disabled:opacity-40">
                    +1
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-sky-800/45 bg-sky-950/20 p-3">
                {offLaden ? (
                  <p className="text-[12px] text-[var(--app-text-muted)]">Produkt wird im Barcode-Verzeichnis gesucht…</p>
                ) : off ? (
                  <div className="mb-3 rounded-lg border border-violet-800/40 bg-violet-950/25 px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-violet-300">Erkannt</p>
                    <p className="mt-1 font-semibold text-[var(--app-text)]">{off.anzeigeName}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--app-text-muted)]">
                      Warengruppe: <span className="font-bold text-emerald-300">{off.kategorie}</span>
                      {off.marke ? ` · ${off.marke}` : ''}
                    </p>
                  </div>
                ) : null}
                <p className="text-[13px] font-semibold text-sky-100">Unbekannter Code — zuordnen oder neu anlegen:</p>
                <input
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                  placeholder="Artikel suchen…"
                  className="mt-2 w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-sky-500/40"
                />
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {sucheTreffer.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void bindeAn(p)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-left text-sm font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:opacity-40"
                    >
                      <span className="min-w-0 truncate">{p.name}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-[var(--app-text-muted)]">{p.menge} {p.einheit}</span>
                    </button>
                  ))}
                  {sucheTreffer.length === 0 ? <p className="px-1 py-2 text-[12px] text-[var(--app-text-muted)]">Kein passender Artikel — unten neu anlegen.</p> : null}
                </div>
                <button
                  type="button"
                  disabled={busy || offLaden}
                  onClick={() => void legeNeuAn()}
                  className="mt-3 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  Neu anlegen{off ? ` (${off.kategorie})` : ''}
                </button>
              </div>
            )}

            <button type="button" onClick={neuScannen} className="w-full rounded-lg border border-[var(--app-border-strong)] py-2.5 text-sm font-bold text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]">
              Weiter scannen
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
