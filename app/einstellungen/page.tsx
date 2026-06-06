import type { Metadata } from 'next'
import Link from 'next/link'
import { AppLockEinstellungen } from '@/components/app-lock-einstellungen'

export const metadata: Metadata = {
  title: 'Einstellungen',
}

export default function EinstellungenPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-100">Einstellungen</h1>
        <p className="mt-1 text-sm text-slate-400">Sicherheit & App-Sperre.</p>
      </header>
      <AppLockEinstellungen />
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-sm font-semibold text-slate-100">Rechtliches</h2>
        <p className="mt-2 text-sm text-slate-400">
          Datenschutzerklärung für Omnia — wird u. a. beim WHOOP-OAuth angezeigt.
        </p>
        <Link
          href="/datenschutz"
          className="mt-4 inline-flex text-sm font-medium text-teal-400 underline-offset-2 hover:underline"
        >
          Datenschutzerklärung öffnen →
        </Link>
      </section>
    </div>
  )
}
