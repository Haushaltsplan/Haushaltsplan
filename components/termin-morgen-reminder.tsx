'use client'

import { ladeKalenderEintraege } from '@/lib/haushalt-kalender'
import {
  bauHinweisText,
  heuteAlsIsoDatumLocal,
  HINWEIS_FENSTER_MINUTEN,
  ladeTerminReminderEinstellungen,
  sammleKalenderHinweisZeilenFuerTag,
  sollTerminHinweisZuenden,
  speichereTerminReminderEinstellungen,
  TERMIN_REMINDER_EVENT,
  type TerminReminderSettings,
} from '@/lib/termin-morgen-reminder'
import { useCallback, useEffect, useState } from 'react'

const TICK_MS = 45_000

function darfWebNotifications() {
  return typeof window !== 'undefined' && (window.isSecureContext || window.location?.hostname === 'localhost')
}

/**
 * Tägliche Erinnerung (lokale Uhrzeit, Standard 7:00) — sofern an dem Tag
 * mindestens ein Kalendereintrag (alle Kategorien) vorgesehen ist.
 * Benötigt Browser-Benachrichtigungs-Erlaubnis; am zuverlässigsten, wenn
 * der Tab oder die PWA im Hintergrund offen ist.
 */
export function TerminMorgenReminderRunner() {
  const pruef = useCallback(() => {
    if (!darfWebNotifications() || typeof Notification === 'undefined') return
    const einst = ladeTerminReminderEinstellungen()
    if (!einst.enabled) return
    if (Notification.permission !== 'granted') return
    const eintraege = ladeKalenderEintraege()
    const jetzt = new Date()
    const r = sollTerminHinweisZuenden(eintraege, einst, jetzt, HINWEIS_FENSTER_MINUTEN)
    if (!r.zuenden) return
    const { uberschrift, text } = bauHinweisText(r.zeilen)
    try {
      new Notification(uberschrift, {
        body: text,
        tag: 'mein-haushalt-termin-tagescheck',
      })
    } catch {
      return
    }
    speichereTerminReminderEinstellungen({ ...einst, letzterHinweisTag: r.heuteIso })
  }, [])

  useEffect(() => {
    if (!darfWebNotifications() || typeof Notification === 'undefined') return
    pruef()
    const t = window.setInterval(() => {
      pruef()
    }, TICK_MS)
    const onEinstellung = () => {
      pruef()
    }
    window.addEventListener(TERMIN_REMINDER_EVENT, onEinstellung)
    return () => {
      window.clearInterval(t)
      window.removeEventListener(TERMIN_REMINDER_EVENT, onEinstellung)
    }
  }, [pruef])

  return null
}

export function TerminMorgenReminderEinstellungen() {
  const [einst, setEinst] = useState<TerminReminderSettings | null>(null)

  const refresh = useCallback(() => {
    setEinst(ladeTerminReminderEinstellungen())
  }, [])

  useEffect(() => {
    refresh()
    const onE = () => refresh()
    window.addEventListener(TERMIN_REMINDER_EVENT, onE)
    return () => window.removeEventListener(TERMIN_REMINDER_EVENT, onE)
  }, [refresh])

  if (!einst) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-500">
        Erinnerung wird geladen…
      </div>
    )
  }

  const sicher = darfWebNotifications()
  const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  function aendereStunde(raw: string) {
    if (einst == null) return
    const s = einst
    const v = Math.min(23, Math.max(0, Number.parseInt(raw, 10) || 0))
    const next: TerminReminderSettings = {
      stunde: v,
      enabled: s.enabled,
      letzterHinweisTag: s.letzterHinweisTag,
    }
    speichereTerminReminderEinstellungen(next)
    refresh()
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md shadow-black/20">
      <div className="border-b border-slate-800 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-black text-slate-100 sm:text-base">Tägliche Kalender-Erinnerung</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 sm:text-xs">
          Wenn an einem Tag <strong className="text-slate-200/90">irgendein</strong> Kalendereintrag hinterlegt ist (Termin,
          Geburtstag, Urlaub, Feiertag, Erinnerung, Sonstiges), erscheint (falls erlaubt) in einem kurzen Fenster ab der
          eingestellten Uhr eine Benachrichtigung. Es wird pro Tag nur einmal erinnert. Ohne laufendes
          Hintergrund-Tab/Server: bei komplett geschlossenem Browser kann die Erinnerung ausbleiben.
        </p>
      </div>
      <div className="space-y-3 px-4 py-4 sm:px-5">
        {!sicher ? (
          <p className="text-xs text-amber-200/90">
            Benachrichtigungen sind in diesem Kontext (ohne sichere https-Verbindung) meist deaktiviert. Nutze{' '}
            <strong className="text-amber-100/95">https</strong> oder rufe die App lokal per <code className="font-mono">localhost</code> auf.
          </p>
        ) : null}

        {perm === 'unsupported' ? (
          <p className="text-xs text-slate-500">Dieser Browser unterstützt keine System-Benachrichtigungen.</p>
        ) : (
          <>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-teal-600 focus:ring-teal-500/40"
                checked={einst.enabled}
                onChange={async (ev) => {
                  const an = ev.target.checked
                  if (an) {
                    if (Notification.permission === 'default') {
                      const p = await Notification.requestPermission()
                      if (p !== 'granted') {
                        speichereTerminReminderEinstellungen({ ...einst, enabled: false })
                        refresh()
                        return
                      }
                    } else if (Notification.permission === 'denied') {
                      speichereTerminReminderEinstellungen({ ...einst, enabled: false })
                      refresh()
                      return
                    }
                  }
                  speichereTerminReminderEinstellungen({ ...einst, enabled: an })
                  refresh()
                }}
              />
              <span>
                <span className="block text-sm font-bold text-slate-100">Benachrichtigung nutzen</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  Standard: 7:00 Uhr, Fenster ca. {HINWEIS_FENSTER_MINUTEN} Minuten (lokale Rechnerzeit)
                </span>
              </span>
            </label>

            {perm === 'denied' ? (
              <p className="text-xs text-rose-200/90">
                Benachrichtigungen sind blockiert. In den Browsereinstellungen für diese Seite bitte <strong>„Erlauben“</strong>{' '}
                wählen, dann die Option oben erneut aktivieren.
              </p>
            ) : null}

            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                Uhr (lokal)
                <input
                  type="number"
                  min={0}
                  max={23}
                  className="mt-1 w-20 rounded-lg border border-slate-700 bg-slate-950 py-2 px-2.5 text-sm font-bold text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/45"
                  value={einst.stunde}
                  onChange={(e) => aendereStunde(e.target.value)}
                  disabled={!einst.enabled}
                />
              </label>
              <button
                type="button"
                className="rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
                disabled={perm !== 'granted' || !einst.enabled}
                onClick={() => {
                  const t = sammleKalenderHinweisZeilenFuerTag(ladeKalenderEintraege(), heuteAlsIsoDatumLocal())
                  const { uberschrift, text } = bauHinweisText(
                    t.length ? t : ['Termin: Beispiel 10:00 Uhr', 'Erinnerung: Einkaufsliste'],
                  )
                  try {
                    new Notification(uberschrift, { body: text, tag: 'mein-haushalt-termin-test' })
                  } catch {
                    // ignore
                  }
                }}
                title="Sendet sofort eine Testmeldung (wenn der Browser Benachrichtigungen erlaubt)"
              >
                Testmeldung
              </button>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-600">
              In der Meldung erscheint pro Eintrag <strong className="text-slate-400">Kategorielabel: Titel</strong>, z. B. „Geburtstag: …“
              oder „Urlaub: …“.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
