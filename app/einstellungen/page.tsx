import type { Metadata } from 'next'
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
    </div>
  )
}
