'use client'

import { appInputClass } from '@/lib/app-ui'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Gast = { userId: string; email: string; erstelltAm: string | null }

export function PortfolioGastEinstellungen() {
  const [gaeste, setGaeste] = useState<Gast[]>([])
  const [email, setEmail] = useState('')
  const [laden, setLaden] = useState(true)
  const [speichern, setSpeichern] = useState(false)

  const ladenListe = async () => {
    setLaden(true)
    try {
      const res = await fetch('/api/zugriff/portfolio-gast')
      const j = (await res.json()) as { ok?: boolean; gaeste?: Gast[]; fehler?: string }
      if (!res.ok || !j.ok) {
        toast.error(j.fehler || 'Gäste konnten nicht geladen werden.')
        return
      }
      setGaeste(j.gaeste ?? [])
    } catch {
      toast.error('Gäste konnten nicht geladen werden.')
    } finally {
      setLaden(false)
    }
  }

  useEffect(() => {
    void ladenListe()
  }, [])

  const einladen = async () => {
    const clean = email.trim()
    if (!clean) {
      toast.error('Bitte E-Mail eingeben.')
      return
    }
    setSpeichern(true)
    try {
      const res = await fetch('/api/zugriff/portfolio-gast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      })
      const j = (await res.json()) as { ok?: boolean; fehler?: string }
      if (!res.ok || !j.ok) {
        toast.error(j.fehler || 'Einladung fehlgeschlagen.')
        return
      }
      setEmail('')
      toast.success('Zugang angelegt. Der Freund meldet sich mit dieser E-Mail per Login-Link an.')
      await ladenListe()
    } catch {
      toast.error('Einladung fehlgeschlagen.')
    } finally {
      setSpeichern(false)
    }
  }

  const entfernen = async (g: Gast) => {
    if (!window.confirm(`${g.email} den Zugang entziehen? Dessen Portfolioanalyse-Daten werden gelöscht.`)) {
      return
    }
    try {
      const res = await fetch('/api/zugriff/portfolio-gast', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: g.userId }),
      })
      const j = (await res.json()) as { ok?: boolean; fehler?: string }
      if (!res.ok || !j.ok) {
        toast.error(j.fehler || 'Entfernen fehlgeschlagen.')
        return
      }
      toast.success('Zugang entzogen.')
      await ladenListe()
    } catch {
      toast.error('Entfernen fehlgeschlagen.')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-[var(--app-text-muted)]">
        Der Gast sieht nur die Portfolioanalyse — Finanzen, Kalender und alles andere bleiben unsichtbar.
        Sein Depot startet leer; er legt eigene Käufe, Watchlist und Scans an. Eure Daten bleiben getrennt.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void einladen()
          }}
          placeholder="freund@email.de"
          autoComplete="off"
          className={`${appInputClass} sm:flex-1`}
        />
        <button
          type="button"
          disabled={speichern}
          onClick={() => void einladen()}
          className="rounded-[0.875rem] bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-950/25 ring-1 ring-white/10 transition hover:from-indigo-400 hover:to-indigo-500 disabled:opacity-40"
        >
          {speichern ? 'Anlegen …' : 'Zugang anlegen'}
        </button>
      </div>

      {laden ? (
        <p className="text-sm text-[var(--app-text-muted)]">Lade Gäste …</p>
      ) : gaeste.length === 0 ? (
        <p className="text-sm italic text-[var(--app-text-muted)]">Noch kein Portfolio-Gast.</p>
      ) : (
        <ul className="divide-y divide-[var(--app-border)] rounded-[0.875rem] border border-[var(--app-border)]">
          {gaeste.map((g) => (
            <li key={g.userId} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="truncate text-sm text-[var(--app-text)]">{g.email}</span>
              <button
                type="button"
                onClick={() => void entfernen(g)}
                className="shrink-0 text-xs font-semibold text-rose-400 hover:text-rose-300"
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
