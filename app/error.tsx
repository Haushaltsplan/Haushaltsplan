'use client'

/**
 * Fängt Laufzeitfehler in der App-Route-Hierarchie (nicht in Root-Layout-Children-Fehlern
 * davor). In Development siehst du die Fehlermeldung direkt; in Production bleibt sie generisch.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const dev = process.env.NODE_ENV === 'development'
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-rose-800/50 bg-rose-950/35 p-6 text-left shadow-xl">
      <h1 className="text-lg font-bold text-rose-100">Etwas ist schiefgelaufen</h1>
      <p className="mt-2 text-sm text-[var(--app-text-muted)]">
        {dev ? (error?.message || 'Unbekannter Fehler') : 'Bitte Seite neu laden oder es später erneut versuchen.'}
      </p>
      {dev && error?.stack ? (
        <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2 text-[10px] leading-snug text-[var(--app-text-muted)]">
          {error.stack}
        </pre>
      ) : null}
      {error.digest ? <p className="mt-2 text-xs text-[var(--app-text-muted)]">Fehler-ID: {error.digest}</p> : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-xl bg-[var(--app-surface-muted)] px-4 py-2.5 text-sm font-bold text-[var(--app-text)] transition hover:bg-[var(--app-surface-hover)]"
      >
        Erneut versuchen
      </button>
    </div>
  )
}
