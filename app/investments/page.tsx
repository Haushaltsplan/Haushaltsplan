import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Investments',
  description: 'Portfolio in Parqet verfolgen',
}

export default function InvestmentsPage() {
  const parqetUrl =
    typeof process.env.NEXT_PUBLIC_PARQET_PORTFOLIO_URL === 'string'
      ? process.env.NEXT_PUBLIC_PARQET_PORTFOLIO_URL.trim()
      : ''
  const konfiguriert = parqetUrl.length > 0

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-in fade-in duration-500">
      <div className="rounded-[2.5rem] border border-violet-800/40 bg-slate-900 p-10 shadow-2xl shadow-black/40">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-violet-400/90">Investments</p>
        <h1 className="text-3xl font-black tracking-tight text-slate-100">Portfolio in Parqet</h1>
        <p className="mt-4 leading-relaxed text-slate-400">
          Depot, Allokation und Performance pflegst du in{' '}
          <strong className="text-slate-300">Parqet</strong>. Der Link kommt aus{' '}
          <code className="rounded bg-slate-950 px-1.5 py-0.5 text-xs text-slate-300">.env.local</code> (
          <code className="text-xs text-emerald-300/90">NEXT_PUBLIC_PARQET_PORTFOLIO_URL</code>) — es werden keine
          Kursdaten in dieser App importiert.
        </p>

        {konfiguriert ? (
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href={parqetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-8 py-4 text-center text-lg font-black text-white shadow-lg shadow-violet-950/40 transition-transform hover:bg-violet-500 active:scale-[0.98]"
            >
              Portfolio in Parqet öffnen
            </a>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Öffnet in einem neuen Tab. Bei geteilten Links beachte, wer die URL sieht.
            </p>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-amber-800/50 bg-amber-950/30 p-5 text-sm leading-relaxed text-amber-100">
            <p className="font-bold text-amber-200">Parqet-Link fehlt</p>
            <p className="mt-2">
              Lege im Projektroot in <code className="rounded bg-slate-950 px-1.5 py-0.5 text-xs">.env.local</code> eine
              Zeile an:
            </p>
            <code className="mt-3 block rounded-xl bg-slate-950 p-3 text-xs text-emerald-300/95">
              NEXT_PUBLIC_PARQET_PORTFOLIO_URL=https://app.parqet.com/p/dein-teilen-link
            </code>
            <p className="mt-3 text-xs text-amber-200/90">
              Datei speichern, Dev-Server neu starten (<code className="rounded bg-black/30 px-1">npm run dev</code>).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
