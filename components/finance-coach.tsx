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
import {
  COACH_MAX_IMAGES_PER_SEND,
  coachImageDataUrl,
  compressImageFileForCoach,
  type CoachImagePart,
} from '@/lib/finance-coach-images'
import { appModalBackdropClassName, appModalPanelCoachClassName } from '@/lib/app-modal-overlay'

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

type ChatTurn = { role: 'user' | 'assistant'; content: string; images?: CoachImagePart[] }

function stripEarlierUserImagesForApi(msgs: ChatTurn[]): ChatTurn[] {
  let lastUser = -1
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') {
      lastUser = i
      break
    }
  }
  return msgs.map((m, i) =>
    m.role === 'user' && m.images?.length && i !== lastUser ? { role: 'user', content: m.content } : m,
  )
}

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
  const [kiProvider, setKiProvider] = useState<'gemini' | 'openai' | null>(null)
  const [kiHostedNote, setKiHostedNote] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [draftImages, setDraftImages] = useState<CoachImagePart[]>([])
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const endRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

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
    const hasImg = draftImages.length > 0
    if ((!text && !hasImg) || loading || kiConfigured !== true) return

    const defaultReceiptPrompt =
      'Bitte diesen Supermarkt-Kassenbon auswerten: erkennbare Artikel mit Menge und Preis, Rabatte, Gesamtsumme; falls unleserlich, kurz sagen was fehlt.'
    const caption = text || (hasImg ? defaultReceiptPrompt : '')

    setInput('')
    const attached = hasImg ? draftImages.map((p) => ({ ...p })) : undefined
    setDraftImages([])
    setLoading(true)

    const userTurn: ChatTurn = attached?.length
      ? { role: 'user', content: caption, images: attached }
      : { role: 'user', content: caption }
    const next: ChatTurn[] = [...messages, userTurn]
    setMessages(next)
    const payloadMessages = stripEarlierUserImagesForApi(next)

    try {
      const res = await fetch('/api/finance-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
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
  }, [draftImages, input, loading, messages, snapshot, kiConfigured])

  const ctxValue = useMemo(() => ({ setSnapshot }), [])

  return (
    <FinanceCoachCtx.Provider value={ctxValue}>
      {children}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[60] flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/50 bg-violet-600 text-xl font-black text-white shadow-xl shadow-violet-950/50 transition-transform hover:scale-105 hover:bg-violet-500 active:scale-95 bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] md:bottom-8 md:right-8"
        title="KI-Coach: Fragen zu deinem Haushalt & Verhalten"
        aria-label="KI-Coach öffnen"
      >
        KI
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
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <h2 id="finance-coach-title" className="text-sm font-black uppercase tracking-wide text-violet-300">
                  KI-Coach
                </h2>
                <p className="text-[11px] text-slate-500">
                  Finanzen, Kassenbons — optional Fotos vom Beleg; Kennzahlen von der Finanzen-Seite. Rezepte und Vorrat: eigener Bereich auf der Speisekammer-Seite.
                  {kiConfigured === true && kiProvider && (
                    <span className="mt-0.5 block text-[10px] text-slate-600">
                      Verbunden: {kiProvider === 'gemini' ? 'Gemini' : 'OpenAI'}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-600 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                Schließen
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {kiConfigured === null && open && (
                <p className="rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-xs text-slate-400">Konfiguration wird geprüft …</p>
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
                      Im Projektordner die Datei <code className="rounded bg-slate-950 px-1 py-0.5 text-[11px] text-slate-300">.env.local</code>{' '}
                      anlegen (falls nicht vorhanden).
                    </li>
                    <li>
                      <span className="font-semibold text-amber-200">Gemini (Google AI Studio)</span> — eine Zeile:{' '}
                      <code className="mt-1 block rounded bg-slate-950 p-2 font-mono text-[11px] text-emerald-300/95">
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
                      <code className="rounded bg-slate-950 px-1 text-[10px]">FINANCE_COACH_PROVIDER=openai</code>).
                    </li>
                    <li>
                      <span className="font-semibold text-amber-200">OpenAI</span> stattdessen:{' '}
                      <code className="mt-1 block rounded bg-slate-950 p-2 font-mono text-[11px] text-slate-300">
                        OPENAI_API_KEY=sk-…
                      </code>
                      <span className="mt-1 block text-[11px] text-amber-200/80">Alternativ: </span>
                      <code className="mt-0.5 block rounded bg-slate-950 p-2 font-mono text-[11px] text-slate-400">AI_API_KEY=sk-…</code>
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
                      Datei speichern, <strong>Dev-Server stoppen und neu starten</strong> (<code className="rounded bg-slate-950 px-1">npm run dev</code>), dann dieses Panel erneut öffnen.
                    </li>
                    <li>
                      <span className="font-semibold text-amber-200">App online (z. B. Vercel):</span> Die Datei{' '}
                      <code className="rounded bg-slate-950 px-1 text-[11px]">.env.local</code> liegt nur auf deinem Rechner — im Vercel-Dashboard unter{' '}
                      <strong className="text-amber-100">Settings → Environment Variables</strong> dieselbe Variable{' '}
                      <code className="rounded bg-slate-950 px-1 text-[11px]">GEMINI_API_KEY</code> (oder <code className="rounded bg-slate-950 px-1 text-[11px]">OPENAI_API_KEY</code>) für{' '}
                      <strong>Production</strong> setzen und ein <strong>neues Deployment</strong> auslösen.
                    </li>
                  </ol>
                </div>
              )}
              {messages.length === 0 && (
                <p className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                  Fragen zu Geld & Routinen, oder <strong className="text-slate-300">Kassenbon-Fotos</strong> für die Speisekammer hochladen
                  (bis {COACH_MAX_IMAGES_PER_SEND} Bilder pro Nachricht). Auf <strong className="text-slate-300">Finanzen</strong> werden
                  Summen und Top-Kategorien mitgeschickt.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'ml-6 border border-emerald-800/50 bg-emerald-950/40 text-emerald-100'
                      : 'mr-4 border border-slate-700 bg-slate-800/60 text-slate-200'
                  }`}
                >
                  {m.images && m.images.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {m.images.map((im, j) => (
                        // eslint-disable-next-line @next/next/no-img-element -- Chat-Thumbnails, dynamische data-URLs
                        <img
                          key={j}
                          src={coachImageDataUrl(im)}
                          alt=""
                          className="max-h-40 max-w-[min(100%,14rem)] rounded-lg border border-emerald-900/60 object-contain"
                        />
                      ))}
                    </div>
                  )}
                  {m.content}
                </div>
              ))}
              {loading && (
                <p className="text-xs font-bold text-violet-400/90">Denkt nach …</p>
              )}
              <div ref={endRef} />
            </div>

            <div className="border-t border-slate-800 p-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = e.target.files
                  e.target.value = ''
                  if (!files?.length) return
                  const next: CoachImagePart[] = [...draftImages]
                  for (const file of [...files]) {
                    if (next.length >= COACH_MAX_IMAGES_PER_SEND) {
                      toast.error(`Maximal ${COACH_MAX_IMAGES_PER_SEND} Bilder pro Nachricht.`)
                      break
                    }
                    try {
                      next.push(await compressImageFileForCoach(file))
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Bild konnte nicht verarbeitet werden.')
                    }
                  }
                  setDraftImages(next)
                }}
              />
              {draftImages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {draftImages.map((im, idx) => (
                    <div key={idx} className="group relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element -- Vorschau data-URL */}
                      <img
                        src={coachImageDataUrl(im)}
                        alt=""
                        className="h-20 w-20 rounded-lg border border-slate-600 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setDraftImages((d) => d.filter((_, j) => j !== idx))}
                        className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-xs font-black text-white opacity-90 hover:bg-rose-500"
                        aria-label="Bild entfernen"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (kiConfigured === true && (input.trim() || draftImages.length > 0)) void send()
                  }
                }}
                rows={2}
                disabled={kiConfigured === false}
                placeholder={
                  kiConfigured === false
                    ? 'Zuerst GEMINI_API_KEY oder OPENAI_API_KEY in .env.local …'
                    : 'Frage oder Kontext … optional Kassenbon-Fotos unten anhängen.'
                }
                className="mb-2 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading || kiConfigured !== true || draftImages.length >= COACH_MAX_IMAGES_PER_SEND}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-xl border border-sky-700/60 bg-sky-950/50 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-900/40 disabled:opacity-40"
                >
                  Beleg-Foto
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMessages([])
                    setDraftImages([])
                    toast('Chat geleert.')
                  }}
                  className="rounded-xl border border-slate-600 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800"
                >
                  Verlauf leeren
                </button>
                <button
                  type="button"
                  disabled={
                    loading ||
                    (!input.trim() && draftImages.length === 0) ||
                    kiConfigured === false ||
                    kiConfigured === null
                  }
                  onClick={() => void send()}
                  className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-black text-white hover:bg-violet-500 disabled:opacity-40"
                >
                  Senden
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-600">
                Text, Kennzahlen und Bilder gehen an den konfigurierten KI-Dienst (Verarbeitung außerhalb der App). Keine
                Rechts- oder Steuerberatung; Belegfotos können personenbezogene Daten enthalten.
              </p>
            </div>
          </div>
        </div>
      )}
    </FinanceCoachCtx.Provider>
  )
}
