import type { Metadata } from 'next'
import Link from 'next/link'
import { PageChrome, PageHero } from '@/components/page-shell'

export const metadata: Metadata = {
  title: 'Datenschutz',
  description: 'Datenschutzerklärung für die persönliche Web-App Omnia.',
  robots: { index: true, follow: true },
}

const KONTAKT_EMAIL = 'andreasmaier1507@gmail.com'

export default function DatenschutzPage() {
  return (
    <PageChrome density="compact" className="max-w-2xl">
      <PageHero
        density="compact"
        eyebrow="Rechtliches"
        title="Datenschutzerklärung"
        description={
          <>
            Für die persönliche Web-App <strong className="font-semibold text-[var(--app-text)]">Omnia</strong>{' '}
            (mein-haushalt). Stand: Juni 2025
          </>
        }
      />

      <article className="space-y-8 text-sm leading-relaxed text-[var(--app-text-muted)]">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--app-text)]">1. Verantwortlicher</h2>
          <p>
            Betreiber und Verantwortlicher im Sinne der DSGVO ist der private Nutzer der App Omnia.
            Kontakt:{' '}
            <a
              href={`mailto:${KONTAKT_EMAIL}`}
              className="text-teal-600 underline-offset-2 hover:underline dark:text-teal-400"
            >
              {KONTAKT_EMAIL}
            </a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--app-text)]">2. Geltungsbereich</h2>
          <p>
            Omnia ist eine <strong className="font-semibold text-[var(--app-text)]">private, nicht-öffentliche</strong>{' '}
            Anwendung für den persönlichen Gebrauch (Haushalt, Finanzen, Fitness, Kalender u. a.). Der Zugang ist
            technisch auf freigeschaltete Konten beschränkt. Diese Datenschutzerklärung beschreibt, wie Daten in
            diesem persönlichen Kontext verarbeitet werden — insbesondere im Zusammenhang mit optionalen
            WHOOP-Anbindungen.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--app-text)]">3. Welche Daten verarbeitet werden</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-[var(--app-text)]">Konto &amp; Login:</strong> E-Mail-Adresse und Sitzungsdaten über
              Supabase Auth (Magic Link).
            </li>
            <li>
              <strong className="text-[var(--app-text)]">App-Inhalte:</strong> persönliche Einträge (z. B. Finanzen,
              Speisekammer, Kalender, Besitz, Portfolio) in Supabase, jeweils nur für den angemeldeten Nutzer.
            </li>
            <li>
              <strong className="text-[var(--app-text)]">Fitness &amp; WHOOP (optional):</strong> Herzfrequenz, Schlaf,
              Recovery, Strain, SpO₂, Workouts, Profil- und Körpermaße — je nach Nutzung lokal per Bluetooth,
              per CSV-Import, oder über die WHOOP-Cloud-API.
            </li>
            <li>
              <strong className="text-[var(--app-text)]">Gerätedaten:</strong> technische Daten im Browser (localStorage,
              Cookies für WHOOP-OAuth-Tokens auf dem Server).
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--app-text)]">4. WHOOP Cloud (OAuth)</h2>
          <p>
            Wenn du dein WHOOP-Konto verbindest, holt Omnia auf deine ausdrückliche Freigabe hin Daten über die
            offizielle WHOOP-API (Scopes u. a. Recovery, Schlaf, Zyklen, Workouts, Profil, Körpermaße). Dafür
            werden OAuth-Tokens serverseitig in verschlüsselten HTTP-only-Cookies gespeichert und nur zur
            Synchronisation deiner eigenen Daten verwendet.
          </p>
          <p>
            WHOOP verarbeitet Daten nach eigenen Richtlinien:{' '}
            <a
              href="https://www.whoop.com/us/en/privacy-policy/"
              className="text-teal-600 underline-offset-2 hover:underline dark:text-teal-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              WHOOP Privacy Policy
            </a>
            . Omnia gibt WHOOP-Daten <strong className="font-semibold text-[var(--app-text)]">nicht an Dritte weiter</strong>{' '}
            und nutzt sie ausschließlich zur Anzeige und Auswertung in deiner privaten App.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--app-text)]">5. Lokale Fitnessdaten &amp; Bluetooth</h2>
          <p>
            Live-Daten vom WHOOP-Armband können direkt per Web Bluetooth in deinem Browser gelesen werden. Diese
            Verarbeitung erfolgt lokal auf deinem Gerät; Omnia speichert aggregierte Tages- und Verlaufsdaten in
            localStorage deines Browsers, bis du sie löschst oder exportierst.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--app-text)]">6. Speicherorte</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-[var(--app-text)]">Browser (localStorage):</strong> Fitness-Snapshots, Tagesarchive,
              Profil, Import-Metadaten.
            </li>
            <li>
              <strong className="text-[var(--app-text)]">Supabase (EU/Hosting nach Projekt-Konfiguration):</strong>{' '}
              angemeldete App-Daten mit Row-Level-Security — nur dein Konto.
            </li>
            <li>
              <strong className="text-[var(--app-text)]">Hosting (z. B. Vercel):</strong> Auslieferung der App; Server-Logs
              des Hosters können technische Zugriffsdaten enthalten.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--app-text)]">7. Weitere Dienste (optional)</h2>
          <p>Je nach genutzter Funktion können Anfragen an folgende Anbieter gehen — immer nur im Rahmen deiner Nutzung:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Supabase (Authentifizierung &amp; Datenbank)</li>
            <li>WHOOP (Cloud-Fitnessdaten, falls verbunden)</li>
            <li>Google Gemini / OpenAI (KI-Funktionen, z. B. Kassenbon, Natur-Erkennung — nur bei aktiver Nutzung)</li>
            <li>Finnhub, Yahoo u. a. (Markt-/Portfolio-Kursdaten)</li>
          </ul>
          <p>Es findet kein Verkauf personenbezogener Daten statt.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--app-text)]">8. Zweck &amp; Rechtsgrundlage</h2>
          <p>
            Verarbeitung erfolgt zur Bereitstellung der privaten App-Funktionen und — bei WHOOP-OAuth — auf Grundlage
            deiner Einwilligung beim Verbinden des Kontos (Art. 6 Abs. 1 lit. a DSGVO) sowie zur Vertragserfüllung
            bzw. berechtigten Interessen an der persönlichen Datenverwaltung (Art. 6 Abs. 1 lit. b/f DSGVO).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--app-text)]">9. Speicherdauer</h2>
          <p>
            Daten bleiben gespeichert, solange du die App nutzt. Fitness-Tagesarchive werden rollierend begrenzt
            (z. B. 365 Tage). WHOOP-Verbindung kannst du jederzeit in der App trennen; OAuth-Cookies werden dann
            entfernt.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--app-text)]">10. Deine Rechte</h2>
          <p>
            Du hast Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch
            gegen die Verarbeitung — soweit anwendbar. Wende dich dafür an die Kontaktadresse oben. Du kannst eine
            erteilte WHOOP-Einwilligung durch Trennen des Kontos widerrufen.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--app-text)]">11. Sicherheit</h2>
          <p>
            Zugang zur App ist login-geschützt; API-Routen erfordern eine gültige Sitzung. Datenbank-Zugriff ist per
            Row-Level-Security auf den angemeldeten Nutzer beschränkt. Geheimnisse (API-Keys, OAuth Client Secret)
            werden nicht im Quellcode veröffentlicht.
          </p>
        </section>

        <p className="border-t border-[var(--app-border)] pt-6">
          <Link
            href="/"
            className="text-teal-600 underline-offset-2 hover:underline dark:text-teal-400"
          >
            ← Zurück zur App
          </Link>
        </p>
      </article>
    </PageChrome>
  )
}
