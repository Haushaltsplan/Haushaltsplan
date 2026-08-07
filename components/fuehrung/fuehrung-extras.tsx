'use client'

import { useEffect, useState } from 'react'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import { requestFuehrungNotificationPermission } from '@/lib/fuehrung/erinnerungen'
import { baueWochenReview, istSonntag, type FuehrungWochenReview } from '@/lib/fuehrung/wochen-review'
import type { FuehrungState } from '@/lib/fuehrung/store'
import { appInputClass, appSecondaryBtnClass } from '@/lib/app-ui'

export function FuehrungErinnerungenPanel({
  state,
  onChange,
}: {
  state: FuehrungState
  onChange: (patch: Partial<FuehrungState['erinnerungen']>) => void
}) {
  const er = state.erinnerungen
  const [perm, setPerm] = useState<string>('default')

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPerm(Notification.permission)
  }, [])

  async function aktiviere() {
    const p = await requestFuehrungNotificationPermission()
    setPerm(p)
    if (p === 'granted') onChange({ aktiv: true })
  }

  return (
    <PageSection titleId="fuehrung-erinnerungen" title="Erinnerungen" density="compact">
      <PageSectionPanel density="compact" className="space-y-3">
        <p className="text-xs text-[var(--app-text-muted)]">
          Morgen: ein Mantra-Satz · Abend 17:30: Abend-Check. Am zuverlässigsten mit geöffneter App/PWA.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (er.aktiv) onChange({ aktiv: false })
              else void aktiviere()
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              er.aktiv
                ? 'bg-teal-600/20 text-teal-700 ring-1 ring-teal-500/40 dark:text-teal-300'
                : 'bg-teal-600 text-white hover:bg-teal-500'
            }`}
          >
            {er.aktiv ? 'Erinnerungen an ✓' : 'Erinnerungen aktivieren'}
          </button>
          {perm === 'denied' ? (
            <span className="text-xs text-rose-600 dark:text-rose-400">
              Browser-Benachrichtigungen blockiert — in den Einstellungen erlauben.
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="app-eyebrow text-[10px]">Morgen</span>
            <input
              type="time"
              value={`${String(er.morgenStunde).padStart(2, '0')}:${String(er.morgenMinute).padStart(2, '0')}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number)
                onChange({ morgenStunde: h || 0, morgenMinute: m || 0 })
              }}
              className={`${appInputClass} mt-1`}
            />
          </label>
          <label className="block text-xs">
            <span className="app-eyebrow text-[10px]">Abend-Check</span>
            <input
              type="time"
              value={`${String(er.abendStunde).padStart(2, '0')}:${String(er.abendMinute).padStart(2, '0')}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number)
                onChange({ abendStunde: h || 17, abendMinute: m || 30 })
              }}
              className={`${appInputClass} mt-1`}
            />
          </label>
        </div>
      </PageSectionPanel>
    </PageSection>
  )
}

export function FuehrungReviewPanel({
  state,
  onDismissWeek,
}: {
  state: FuehrungState
  onDismissWeek: (wochenKey: string) => void
}) {
  const review = baueWochenReview(state)
  const [copied, setCopied] = useState(false)
  const sonntag = istSonntag()

  return (
    <div className="space-y-3">
      {sonntag && state.lastWochenReviewKey !== review.wochenKey ? (
        <div className="rounded-[var(--app-radius-lg)] border border-teal-500/35 bg-teal-500/10 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
            Sonntag · Wochen-Review
          </p>
          <p className="mt-1 text-sm text-[var(--app-text)]">
            Kurzer Rückblick — was du dem Chef zeigen könntest.
          </p>
          <button
            type="button"
            className={`mt-2 ${appSecondaryBtnClass}`}
            onClick={() => onDismissWeek(review.wochenKey)}
          >
            Für diese Woche gelesen
          </button>
        </div>
      ) : null}

      <PageSection titleId="fuehrung-review" title={`Review ${review.wochenKey}`} density="compact">
        <PageSectionPanel density="compact">
          <ReviewKpis review={review} />
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--app-surface-muted)] p-3 text-xs leading-relaxed text-[var(--app-text)] ring-1 ring-[var(--app-border)]">
            {review.text}
          </pre>
          <button
            type="button"
            className="mt-3 rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(review.text)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1600)
              } catch {
                /* ignore */
              }
            }}
          >
            {copied ? 'Kopiert' : 'Review kopieren'}
          </button>
        </PageSectionPanel>
      </PageSection>
    </div>
  )
}

function ReviewKpis({ review }: { review: FuehrungWochenReview }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Mini label="Redirects" value={String(review.redirects)} />
      <Mini label="Nein/Später" value={String(review.neins)} />
      <Mini label="Fokus Min" value={String(review.fokusMin)} />
      <Mini label="Streak" value={`${review.streak}d`} />
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-2 text-center ring-1 ring-[var(--app-border)]">
      <p className="text-sm font-bold tabular-nums text-[var(--app-text)]">{value}</p>
      <p className="text-[9px] text-[var(--app-text-muted)]">{label}</p>
    </div>
  )
}

export function FuehrungSparringPanel({
  state,
  onSave,
}: {
  state: FuehrungState
  onSave: (eintrag: FuehrungState['sparring'][0]) => void
}) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    einordnung: string
    einordnungText: string
    saetze: string[]
    tipp: string
  } | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/fuehrung/sparring')
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(false))
  }, [])

  async function run() {
    const situation = text.trim()
    if (situation.length < 8) {
      setError('Bitte die Situation etwas genauer beschreiben.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/fuehrung/sparring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          situation,
          context: {
            personen: state.personen.slice(0, 12).map((p) => ({
              name: p.name,
              muster: p.muster,
              strategie: p.strategie,
            })),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Anfrage fehlgeschlagen.')
        return
      }
      const eintrag = {
        id: `${Date.now()}`,
        frage: situation,
        einordnung: String(data.einordnung ?? ''),
        einordnungText: String(data.einordnungText ?? ''),
        saetze: Array.isArray(data.saetze) ? data.saetze : [],
        tipp: String(data.tipp ?? ''),
        createdAt: new Date().toISOString(),
      }
      setResult(eintrag)
      onSave(eintrag)
    } catch {
      setError('Netzwerkfehler — bitte erneut versuchen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <PageSection titleId="fuehrung-sparring" title="KI-Sparring" density="compact">
        <PageSectionPanel density="compact">
          <p className="text-xs text-[var(--app-text-muted)]">
            Situation schildern → Einordnung + 2–3 Sätze, die du sagen kannst.
          </p>
          {configured === false ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              KI nicht konfiguriert (GEMINI_API_KEY / OPENAI_API_KEY).
            </p>
          ) : null}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="z. B. Kollege aus dem Lager fragt zum dritten Mal heute, wie er eine Retoure bucht, obwohl er das schon kann …"
            className={`${appInputClass} mt-3 resize-y`}
          />
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading || configured === false}
            className="mt-2 rounded-xl bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
          >
            {loading ? 'Denkt nach …' : 'Sparring starten'}
          </button>
          {error ? <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
        </PageSectionPanel>
      </PageSection>

      {result ? (
        <PageSection titleId="fuehrung-sparring-out" title="Antwort" density="compact">
          <PageSectionPanel density="compact" className="space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                {result.einordnung}
              </p>
              <p className="mt-1 text-sm text-[var(--app-text)]">{result.einordnungText}</p>
            </div>
            <div className="space-y-2">
              {result.saetze.map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-[var(--app-surface-muted)] px-3 py-2.5 ring-1 ring-[var(--app-border)]"
                >
                  <p className="text-sm font-medium text-[var(--app-text)]">„{s}“</p>
                  <button
                    type="button"
                    className={`mt-1.5 ${appSecondaryBtnClass}`}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(s)
                        setCopied(String(i))
                        window.setTimeout(() => setCopied(null), 1200)
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    {copied === String(i) ? 'Kopiert' : 'Kopieren'}
                  </button>
                </div>
              ))}
            </div>
            {result.tipp ? (
              <p className="text-xs text-[var(--app-text-muted)]">Tipp: {result.tipp}</p>
            ) : null}
          </PageSectionPanel>
        </PageSection>
      ) : null}

      {state.sparring.length > 0 ? (
        <PageSection titleId="fuehrung-sparring-hist" title="Letzte Sparrings" density="compact">
          <div className="divide-y divide-[var(--app-border)]">
            {state.sparring.slice(0, 8).map((s) => (
              <PageSectionPanel key={s.id} density="compact">
                <p className="text-[10px] font-bold uppercase text-[var(--app-text-muted)]">
                  {s.einordnung} · {s.createdAt.slice(0, 10)}
                </p>
                <p className="mt-1 text-xs text-[var(--app-text-muted)] line-clamp-2">{s.frage}</p>
                <p className="mt-1 text-sm text-[var(--app-text)]">{s.saetze[0]}</p>
              </PageSectionPanel>
            ))}
          </div>
        </PageSection>
      ) : null}
    </div>
  )
}
