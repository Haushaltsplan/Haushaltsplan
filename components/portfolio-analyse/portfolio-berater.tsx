'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import toast from 'react-hot-toast'
import { appModalBackdropClassName, appModalPanelCoachClassName } from '@/lib/app-modal-overlay'
import { CoachFormattedReply } from '@/components/coach-formatted-reply'
import { KiBrandChip, KiSparklesIcon } from '@/components/ki-brand'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'

type ChatTurn = { role: 'user' | 'assistant'; content: string }

type PortfolioBeraterCtx = {
  setFocus: (focus: { isin?: string | null; ticker?: string | null } | null) => void
}

const PortfolioBeraterContext = createContext<PortfolioBeraterCtx | null>(null)

export function usePortfolioBeraterFocus() {
  return useContext(PortfolioBeraterContext)?.setFocus ?? (() => {})
}

const VORSCHLAEGE = [
  'Wie ist mein Klumpenrisiko und was würdest du optimieren?',
  'Sektoren und Diversifikation — wo bin ich überkonzentriert?',
  'Welche Depot-Titel sind laut Nachkauf-Radar interessant?',
  'Gib mir eine kurze Gesundheitsanalyse meines Portfolios.',
  'Welche Positionen sollte ich genauer prüfen (Trim/Qualität)?',
]

export function PortfolioBeraterProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { hatDaten, live } = usePortfolioAnalyse()
  const [open, setOpen] = useState(false)
  const [focus, setFocusState] = useState<{ isin?: string | null; ticker?: string | null } | null>(
    null,
  )
  const [kiConfigured, setKiConfigured] = useState<boolean | null>(null)
  const [freeTierKey, setFreeTierKey] = useState<boolean | null>(null)
  const [depotKurz, setDepotKurz] = useState<{ positionen: number; wertEur: number } | null>(null)
  const [kiHostedNote, setKiHostedNote] = useState<string | null>(null)
  const [kiStatusFehler, setKiStatusFehler] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const endRef = useRef<HTMLDivElement | null>(null)

  const setFocus = useCallback((f: { isin?: string | null; ticker?: string | null } | null) => {
    setFocusState(f)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setKiConfigured(null)
      setFreeTierKey(null)
      setDepotKurz(null)
      setKiHostedNote(null)
      setKiStatusFehler(null)
    })
    void fetch('/api/portfolio-berater')
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as {
          configured?: boolean
          freeTierKey?: boolean
          depotKurz?: { positionen: number; wertEur: number } | null
          hostedNote?: string
          error?: string
        }
        if (cancelled) return
        if (!r.ok) {
          setKiConfigured(null)
          setKiStatusFehler(
            typeof d.error === 'string' && d.error.trim()
              ? d.error
              : r.status === 401
                ? 'Anmeldung erforderlich — bitte neu einloggen und das Panel erneut öffnen.'
                : `Statusprüfung fehlgeschlagen (${r.status}).`,
          )
          return
        }
        setKiConfigured(d.configured === true)
        setFreeTierKey(d.freeTierKey === true)
        setDepotKurz(d.depotKurz ?? null)
        setKiHostedNote(typeof d.hostedNote === 'string' && d.hostedNote.trim() ? d.hostedNote.trim() : null)
      })
      .catch(() => {
        if (!cancelled) {
          setKiConfigured(null)
          setKiStatusFehler('Statusprüfung fehlgeschlagen (Netzwerk). Panel schließen und erneut öffnen.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, loading])

  const send = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim()
      if (!text || loading || kiConfigured !== true) return

      if (!textOverride) setInput('')
      setLoading(true)

      const userTurn: ChatTurn = { role: 'user', content: text }
      const next: ChatTurn[] = [...messages, userTurn]
      setMessages(next)

      try {
        const res = await fetch('/api/portfolio-berater', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: next,
            seite: pathname,
            focusIsin: focus?.isin ?? undefined,
            focusTicker: focus?.ticker ?? undefined,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(typeof data.error === 'string' ? data.error : 'KI-Anfrage fehlgeschlagen.')
          setMessages((p) => p.slice(0, -1))
          return
        }
        if (typeof data.reply !== 'string') {
          toast.error('Unerwartete Antwort.')
          setMessages((p) => p.slice(0, -1))
          return
        }
        setMessages((p) => [...p, { role: 'assistant', content: data.reply }])
      } catch {
        toast.error('Netzwerkfehler.')
        setMessages((p) => p.slice(0, -1))
      } finally {
        setLoading(false)
      }
    },
    [input, loading, messages, pathname, focus, kiConfigured],
  )

  const ctxValue = useMemo(() => ({ setFocus }), [setFocus])

  const depotHinweis =
    depotKurz != null
      ? `${depotKurz.positionen} Positionen · ${depotKurz.wertEur.toLocaleString('de-DE')} €`
      : live?.kennzahlen.depotwertEur
        ? `${live.positionen.length} Positionen · ${Math.round(live.kennzahlen.depotwertEur).toLocaleString('de-DE')} €`
        : null

  return (
    <PortfolioBeraterContext.Provider value={ctxValue}>
      {children}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[60] flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-500/50 bg-teal-600 text-white shadow-xl shadow-teal-950/50 transition-transform hover:scale-105 hover:bg-teal-500 active:scale-95 bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.5rem))] right-[max(1rem,env(safe-area-inset-right))] md:bottom-8 md:right-8"
        title="Portfolio-Berater: Depot, Sektoren, Nachkauf-Radar"
        aria-label="Portfolio-Berater öffnen"
      >
        <KiSparklesIcon size={28} className="drop-shadow-sm" />
      </button>

      {open && (
        <div
          className={appModalBackdropClassName}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            className={appModalPanelCoachClassName}
            role="dialog"
            aria-modal="true"
            aria-labelledby="portfolio-berater-title"
          >
            <div className="flex items-center justify-between border-b border-teal-800/50 bg-teal-950/25 px-4 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-2">
                  <KiBrandChip iconSize={14} />
                  <h2
                    id="portfolio-berater-title"
                    className="min-w-0 text-sm font-black uppercase tracking-wide text-teal-200"
                  >
                    Portfolio-Berater
                  </h2>
                </div>
                {depotHinweis && hatDaten ? (
                  <p className="truncate pl-0.5 text-[10px] text-teal-300/80">{depotHinweis} · live Kontext</p>
                ) : null}
                {focus?.ticker || focus?.isin ? (
                  <p className="truncate pl-0.5 text-[10px] font-semibold text-teal-400">
                    Fokus: {focus.ticker ?? focus.isin}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-[var(--app-border-strong)] px-3 py-1.5 text-xs font-bold text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]"
              >
                Schließen
              </button>
            </div>

            <div className="app-scroll-panel min-h-0 flex-1 space-y-3 px-4 py-3">
              {kiConfigured === null && open && !kiStatusFehler && (
                <p className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-3 text-xs text-[var(--app-text-muted)]">
                  Konfiguration wird geprüft …
                </p>
              )}
              {kiStatusFehler && (
                <p className="rounded-xl border border-rose-700/50 bg-rose-950/40 p-3 text-xs leading-relaxed text-rose-100">
                  {kiStatusFehler}
                </p>
              )}
              {kiConfigured === false && (
                <div className="rounded-xl border border-amber-700/60 bg-amber-950/40 p-3 text-xs leading-relaxed text-amber-100">
                  <p className="font-bold text-amber-200">KI ist noch nicht eingerichtet</p>
                  {kiHostedNote ? (
                    <p className="mt-2 rounded-lg border border-amber-600/40 bg-amber-950/70 p-2.5 text-[11px] leading-relaxed text-amber-50">
                      {kiHostedNote}
                    </p>
                  ) : null}
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-amber-100/95">
                    <li>
                      In <code className="rounded bg-[var(--app-surface-muted)] px-1 py-0.5 text-[11px]">.env.local</code>:
                    </li>
                    <li>
                      <span className="font-semibold text-amber-200">Kostenlos (empfohlen)</span>
                      <code className="mt-1 block rounded bg-[var(--app-surface-muted)] p-2 font-mono text-[11px] text-emerald-300/95">
                        GEMINI_API_KEY_FREE=…dein-free-key…
                      </code>
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block font-bold text-amber-300 underline hover:text-amber-200"
                      >
                        aistudio.google.com/apikey
                      </a>
                      <span className="mt-1 block text-[11px] text-amber-200/80">
                        Key aus einem Google-Cloud-Projekt ohne Billing — kostenloses Tageskontingent.
                      </span>
                    </li>
                    <li>
                      Alternativ <code className="rounded bg-[var(--app-surface-muted)] px-1 text-[10px]">GEMINI_API_KEY</code>{' '}
                      (mit Billing).
                    </li>
                    <li>Dev-Server neu starten, Panel erneut öffnen.</li>
                  </ol>
                </div>
              )}
              {kiConfigured === true && freeTierKey === false && (
                <p className="rounded-xl border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-[10px] text-amber-100/90">
                  Tipp: <code className="rounded bg-[var(--app-surface-muted)] px-1">GEMINI_API_KEY_FREE</code> nutzen für
                  kostenloses Kontingent (Google AI Studio ohne Billing).
                </p>
              )}
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-3 text-xs leading-relaxed text-[var(--app-text-muted)]">
                    Stell Fragen zu deinem <strong className="text-[var(--app-text)]">Depot</strong>,{' '}
                    <strong className="text-[var(--app-text)]">Nachkauf-Radar</strong>,{' '}
                    <strong className="text-[var(--app-text)]">Deep Research</strong>, Kaufempfehlung,
                    Earnings/SEC-Zusammenfassungen, Quartals-Diffs, Sektoren, Klumpenrisiko und Performance-Tracking.
                    Bei jeder Frage lädt der Berater den <strong className="text-[var(--app-text)]">vollen App-Kontext</strong> neu.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {VORSCHLAEGE.map((v) => (
                      <button
                        key={v}
                        type="button"
                        disabled={kiConfigured !== true || loading}
                        onClick={() => void send(v)}
                        className="rounded-full border border-teal-700/50 bg-teal-950/30 px-3 py-1.5 text-left text-[11px] leading-snug text-teal-100/95 hover:bg-teal-900/40 disabled:opacity-40"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === 'user'
                      ? 'ml-6 min-w-0 max-w-[min(100%,calc(100%-1.5rem))] rounded-xl border border-emerald-800/50 bg-emerald-950/40 px-3 py-2.5'
                      : 'mr-4 min-w-0 max-w-[min(100%,calc(100%-1rem))] rounded-xl border border-teal-500/30 border-l-[5px] border-l-teal-400 bg-gradient-to-br from-teal-950/45 to-[var(--app-surface-muted)] px-3 py-3 text-sm text-[var(--app-text)] shadow-md shadow-teal-950/20'
                  }
                >
                  {m.role === 'user' ? (
                    <CoachFormattedReply content={m.content} accent="emerald" />
                  ) : (
                    <CoachFormattedReply content={m.content} accent="teal" />
                  )}
                </div>
              ))}
              {loading && <p className="text-xs font-bold text-teal-400/90">Analysiert dein Portfolio …</p>}
              <div ref={endRef} />
            </div>

            <div className="border-t border-[var(--app-border)] p-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (kiConfigured === true && input.trim()) void send()
                  }
                }}
                rows={2}
                disabled={kiConfigured === false}
                placeholder={
                  kiConfigured === false
                    ? 'Zuerst GEMINI_API_KEY_FREE in .env.local …'
                    : 'Frage zu Depot, Sektoren, Nachkäufen, Quartalslage …'
                }
                className="mb-2 w-full resize-none rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-3 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-teal-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMessages([])
                    setFocusState(null)
                    toast('Chat geleert.')
                  }}
                  className="rounded-xl border border-[var(--app-border-strong)] px-3 py-2 text-xs font-bold text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)]"
                >
                  Verlauf leeren
                </button>
                <button
                  type="button"
                  disabled={loading || !input.trim() || kiConfigured === false || kiConfigured === null}
                  onClick={() => void send()}
                  className="flex-1 rounded-xl bg-teal-600 py-2 text-sm font-black text-white hover:bg-teal-500 disabled:opacity-40"
                >
                  Senden
                </button>
              </div>
              <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">
                Depot-Daten und KI-Zusammenfassungen gehen an Gemini (Free-Tier wenn konfiguriert). Keine lizenzierte
                Anlageberatung — eigene Recherche und Risikoabwägung.
              </p>
            </div>
          </div>
        </div>
      )}
    </PortfolioBeraterContext.Provider>
  )
}
