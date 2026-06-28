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
import toast from 'react-hot-toast'
import { appModalBackdropClassName, appModalPanelCoachClassName } from '@/lib/app-modal-overlay'
import { CoachFormattedReply } from '@/components/coach-formatted-reply'
import { KiBrandChip, KiSparklesIcon } from '@/components/ki-brand'
import { KI_ASSISTANT_BUBBLE } from '@/lib/ki-ui'

export type FinanceCoachContextSnapshot = {
  saldo: number
  summeEinnahmen: number
  summeAusgaben: number
  einnahmenNachKategorie: Array<{ name: string; betrag: number }>
  ausgabenNachKategorie: Array<{ name: string; betrag: number }>
  anzahlEinnahmen: number
  anzahlAusgaben: number
  anzahlDauerauftraege: number
  /** ISO-Zeitpunkt der letzten Aktualisierung (Client) */
  stand: string
} | null

type ChatTurn = { role: 'user' | 'assistant'; content: string }

const FinanceCoachCtx = createContext<{
  setSnapshot: (s: FinanceCoachContextSnapshot | null) => void
} | null>(null)

export function useFinanceCoachSnapshot() {
  const ctx = useContext(FinanceCoachCtx)
  if (!ctx) {
    throw new Error('useFinanceCoachSnapshot nur innerhalb von FinanceCoachProvider')
  }
  return ctx.setSnapshot
}

function summeJeKategorie(
  rows: Array<{ kategorie?: string; betrag?: number }>,
  limit: number,
): Array<{ name: string; betrag: number }> {
  const m = new Map<string, number>()
  for (const r of rows) {
    const name = String(r.kategorie ?? 'Ohne Bezeichnung').trim() || 'Ohne Bezeichnung'
    const b = Number(r.betrag)
    if (!Number.isFinite(b)) continue
    m.set(name, (m.get(name) || 0) + b)
  }
  return [...m.entries()]
    .map(([name, betrag]) => ({ name, betrag: Math.round(betrag * 100) / 100 }))
    .sort((a, b) => b.betrag - a.betrag)
    .slice(0, limit)
}

export function buildFinanceCoachSnapshot(
  einnahmen: Array<{ kategorie?: string; betrag?: number }>,
  ausgaben: Array<{ kategorie?: string; betrag?: number }>,
  dauerauftraege: unknown[],
): FinanceCoachContextSnapshot {
  const gesEin = einnahmen.reduce((a, r) => a + (Number.isFinite(Number(r.betrag)) ? Number(r.betrag) : 0), 0)
  const gesAus = ausgaben.reduce((a, r) => a + (Number.isFinite(Number(r.betrag)) ? Number(r.betrag) : 0), 0)
  return {
    saldo: Math.round((gesEin - gesAus) * 100) / 100,
    summeEinnahmen: Math.round(gesEin * 100) / 100,
    summeAusgaben: Math.round(gesAus * 100) / 100,
    einnahmenNachKategorie: summeJeKategorie(einnahmen, 18),
    ausgabenNachKategorie: summeJeKategorie(ausgaben, 18),
    anzahlEinnahmen: einnahmen.length,
    anzahlAusgaben: ausgaben.length,
    anzahlDauerauftraege: dauerauftraege.length,
    stand: new Date().toISOString(),
  }
}

export function FinanceCoachProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<FinanceCoachContextSnapshot | null>(null)
  const [open, setOpen] = useState(false)
  const [kiConfigured, setKiConfigured] = useState<boolean | null>(null)
  const [, setKiProvider] = useState<'gemini' | 'openai' | null>(null)
  const [kiHostedNote, setKiHostedNote] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setKiConfigured(null)
      setKiProvider(null)
      setKiHostedNote(null)
    })
    void fetch('/api/finance-coach')
      .then((r) => r.json())
      .then((d: { configured?: boolean; provider?: string; hostedNote?: string }) => {
        if (!cancelled) {
          setKiConfigured(d.configured === true)
          setKiProvider(d.provider === 'gemini' || d.provider === 'openai' ? d.provider : null)
          setKiHostedNote(typeof d.hostedNote === 'string' && d.hostedNote.trim() ? d.hostedNote.trim() : null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setKiConfigured(false)
          setKiHostedNote(null)
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

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || kiConfigured !== true) return

    setInput('')
    setLoading(true)

    const userTurn: ChatTurn = { role: 'user', content: text }
    const next: ChatTurn[] = [...messages, userTurn]
    setMessages(next)

    try {
      const res = await fetch('/api/finance-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          context: snapshot,
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
  }, [input, loading, messages, snapshot, kiConfigured])

  const ctxValue = useMemo(() => ({ setSnapshot }), [])

  return (
    <FinanceCoachCtx.Provider value={ctxValue}>
      {children}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[60] flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/50 bg-violet-600 text-white shadow-xl shadow-violet-950/50 transition-transform hover:scale-105 hover:bg-violet-500 active:scale-95 bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.5rem))] right-[max(1rem,env(safe-area-inset-right))] md:bottom-8 md:right-8"
        title="Finanz-Coach: Fragen zu Einnahmen, Ausgaben und Saldo"
        aria-label="Finanz-Coach öffnen"
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
            aria-labelledby="finance-coach-title"
          >
            <div className="flex items-center justify-between border-b border-violet-800/50 bg-violet-950/25 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <KiBrandChip iconSize={14} />
                <h2
                  id="finance-coach-title"
                  className="min-w-0 text-sm font-black uppercase tracking-wide text-violet-200"
                >
                  Finanz-Coach
                </h2>
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
              {kiConfigured === null && open && (
                <p className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-3 text-xs text-[var(--app-text-muted)]">Konfiguration wird geprüft …</p>
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
                      Im Projektordner die Datei <code className="rounded bg-[var(--app-surface-muted)] px-1 py-0.5 text-[11px] text-[var(--app-text)]">.env.local</code>{' '}
                      anlegen (falls nicht vorhanden).
                    </li>
                    <li>
                      <span className="font-semibold text-amber-200">Gemini (Google AI Studio)</span> — eine Zeile:{' '}
                      <code className="mt-1 block rounded bg-[var(--app-surface-muted)] p-2 font-mono text-[11px] text-emerald-300/95">
                        GEMINI_API_KEY=…dein-schlüssel…
                      </code>
                      <span className="mt-1 block text-[11px] text-amber-200/80">Schlüssel: </span>
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-amber-300 underline hover:text-amber-200"
                      >
                        aistudio.google.com/apikey
                      </a>
                      . Wenn du zusätzlich OpenAI nutzt, wählt die App standardmäßig Gemini (oder setze{' '}
                      <code className="rounded bg-[var(--app-surface-muted)] px-1 text-[10px]">FINANCE_COACH_PROVIDER=openai</code>).
                    </li>
                    <li>
                      <span className="font-semibold text-amber-200">OpenAI</span> stattdessen:{' '}
                      <code className="mt-1 block rounded bg-[var(--app-surface-muted)] p-2 font-mono text-[11px] text-[var(--app-text)]">
                        OPENAI_API_KEY=sk-…
                      </code>
                      <span className="mt-1 block text-[11px] text-amber-200/80">Alternativ: </span>
                      <code className="mt-0.5 block rounded bg-[var(--app-surface-muted)] p-2 font-mono text-[11px] text-[var(--app-text-muted)]">AI_API_KEY=sk-…</code>
                      <span className="mt-1 block text-[11px]">
                        Schlüssel:{' '}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-amber-300 underline hover:text-amber-200"
                        >
                          platform.openai.com/api-keys
                        </a>
                        .
                      </span>
                    </li>
                    <li>
                      Datei speichern, <strong>Dev-Server stoppen und neu starten</strong> (<code className="rounded bg-[var(--app-surface-muted)] px-1">npm run dev</code>), dann dieses Panel erneut öffnen.
                    </li>
                    <li>
                      <span className="font-semibold text-amber-200">App online (z. B. Vercel):</span> Die Datei{' '}
                      <code className="rounded bg-[var(--app-surface-muted)] px-1 text-[11px]">.env.local</code> liegt nur auf deinem Rechner — im Vercel-Dashboard unter{' '}
                      <strong className="text-amber-100">Settings → Environment Variables</strong> dieselbe Variable{' '}
                      <code className="rounded bg-[var(--app-surface-muted)] px-1 text-[11px]">GEMINI_API_KEY</code> (oder <code className="rounded bg-[var(--app-surface-muted)] px-1 text-[11px]">OPENAI_API_KEY</code>) für{' '}
                      <strong>Production</strong> setzen und ein <strong>neues Deployment</strong> auslösen.
                    </li>
                  </ol>
                </div>
              )}
              {messages.length === 0 && (
                <p className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-3 text-xs leading-relaxed text-[var(--app-text-muted)]">
                  Stell Fragen zu <strong className="text-[var(--app-text)]">Einnahmen, Ausgaben, Daueraufträgen, Sparzielen</strong> oder
                  deinem Geld-Alltag. Die aktuellen <strong className="text-[var(--app-text)]">Summen und Top-Kategorien</strong> von dieser
                  Seite werden dem Modell mitgegeben, damit Antworten passen.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === 'user'
                      ? 'ml-6 min-w-0 max-w-[min(100%,calc(100%-1.5rem))] rounded-xl border border-emerald-800/50 bg-emerald-950/40 px-3 py-2.5'
                      : `mr-4 min-w-0 max-w-[min(100%,calc(100%-1rem))] px-3 py-3 text-sm ${KI_ASSISTANT_BUBBLE}`
                  }
                >
                  {m.role === 'user' ? (
                    <CoachFormattedReply content={m.content} accent="emerald" />
                  ) : (
                    <CoachFormattedReply content={m.content} accent="violet" />
                  )}
                </div>
              ))}
              {loading && (
                <p className="text-xs font-bold text-violet-400/90">Denkt nach …</p>
              )}
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
                    ? 'Zuerst GEMINI_API_KEY oder OPENAI_API_KEY in .env.local …'
                    : 'Frage zu deinen Finanzen, z. B. größte Kosten, Spar-Tipps …'
                }
                className="mb-2 w-full resize-none rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-3 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMessages([])
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
                  className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-black text-white hover:bg-violet-500 disabled:opacity-40"
                >
                  Senden
                </button>
              </div>
              <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">
                Text und Kennzahlen gehen an den konfigurierten KI-Dienst (Verarbeitung außerhalb der App). Keine
                Rechts- oder Anlageberatung.
              </p>
            </div>
          </div>
        </div>
      )}
    </FinanceCoachCtx.Provider>
  )
}
