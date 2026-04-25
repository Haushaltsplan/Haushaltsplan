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
      <p className="mt-2 text-sm text-slate-400">
        {dev ? (error?.message || 'Unbekannter Fehler') : 'Bitte Seite neu laden oder es später erneut versuchen.'}
      </p>
      {dev && error?.stack ? (
        <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-[10px] leading-snug text-slate-500">
          {error.stack}
        </pre>
      ) : null}
      {error.digest ? <p className="mt-2 text-xs text-slate-600">Fehler-ID: {error.digest}</p> : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-white"
      >
        Erneut versuchen
      </button>
    </div>
  )
}
