# Sicherheit & Privatsphäre („nur für mich")

Diese App ist für die alleinige private Nutzung gedacht. Schutz auf mehreren Ebenen
(Defense in Depth). Die Code-Maßnahmen sind bereits umgesetzt; **die mit ⚠️ markierten
Schritte musst du einmalig selbst im Supabase-/Hosting-Dashboard erledigen** – sie sind
die wirksamsten gegen Fremdzugriff.

## Was der Code bereits absichert

1. **Datenbank: harte Abriegelung (Row Level Security).**
   Migration `supabase/migrations/20260531140000_privacy_hard_lockdown.sql`:
   - Entzieht dem öffentlichen `anon`-Schlüssel (steckt im Browser-Bundle) **jeden** Zugriff.
   - Aktiviert + **erzwingt** RLS auf allen persönlichen Tabellen.
   - Zugriff nur noch für `owner_user_id = auth.uid()` (also nur du, eingeloggt).
   - Ordnet bestehende Daten automatisch deinem Konto zu (Single-User).

2. **Alle `/api`-Routen sind angemeldet-only.**
   `proxy.ts` (Next.js-16-Proxy, früher Middleware) verlangt für jeden API-Aufruf ein gültiges Supabase-Token und prüft die
   E-Mail gegen `APP_ALLOWED_EMAILS`. So kann niemand ohne Login deine KI-Kontingente
   (Gemini/OpenAI) oder Server-Funktionen missbrauchen.

3. **Server-Routen ohne RLS-Bypass.**
   Die Speisekammer-Routen nutzen jetzt einen nutzergebundenen Client (kein Service-Role-Key
   mehr nötig), sodass auch dort RLS greift.

4. **Login eingeschränkt.**
   Die Login-Oberfläche legt **keine neuen Konten** an (`shouldCreateUser: false`) und lässt
   nur freigeschaltete E-Mails zu (`NEXT_PUBLIC_ALLOWED_EMAILS`).

5. **Sicherheits-Header** (Clickjacking-, MIME-Sniffing-Schutz, HSTS) in `next.config.ts`.

## Einmalige manuelle Schritte

### ⚠️ 1. Migration ausführen
Die neue Migration in Supabase einspielen (SQL Editor → Inhalt der Datei ausführen, oder per CLI):
`supabase/migrations/20260531140000_privacy_hard_lockdown.sql`.
Danach prüfen: Ohne Login zeigt die App keine Daten mehr; mit deinem Login ist alles da.

### ⚠️ 2. Selbst-Registrierung in Supabase deaktivieren
Supabase → **Authentication → Providers/Settings → "Allow new users to sign up"** ausschalten.
Damit kann sich niemand außer den bestehenden Konten (dir) registrieren.

### ⚠️ 3. Erlaubte E-Mail(s) setzen
In `.env.local` (lokal) **und** im Hosting (z. B. Vercel → Project Settings → Environment Variables):
```
APP_ALLOWED_EMAILS=deine@email.de
NEXT_PUBLIC_ALLOWED_EMAILS=deine@email.de
```
Danach neu deployen.

### ⚠️ 4. Redirect-URLs einschränken
Supabase → **Authentication → URL Configuration**: nur deine echte App-URL (und ggf.
`http://localhost:3000`) als **Site URL / Redirect URLs** eintragen. Verhindert Login-Link-Umleitung.

### ⚠️ 5. Service-Role-Key prüfen/rotieren
`SUPABASE_SERVICE_ROLE_KEY` wird vom App-Code **nicht mehr benötigt**. Falls er je öffentlich
gewesen sein könnte: Supabase → Project Settings → API → **Rotate**. Niemals im Browser/Client
verwenden oder committen.

### ⚠️ 6. Secrets nicht im Repo
`.env*` ist in `.gitignore` (außer `.env.example`). API-Keys (Gemini/OpenAI) nur in
`.env.local`/Hosting-Variablen, nie im Code. Bei Verdacht auf Leak: Schlüssel neu erzeugen.

### Empfohlen
- **2-Faktor / starkes Passwort** für dein Supabase- und Hosting-Konto.
- E-Mail-Konto, das den Magic-Link empfängt, gut absichern (es ist faktisch dein App-Login).
- Regelmäßig Supabase-Logs auf unbekannte Zugriffe prüfen.

## Bekannte, bewusste Ausnahme
Die **Investment-Watchlist** (`investment_portfolio_*`, nur Tickersymbole/Notizen – keine
persönlichen Finanzdaten) bleibt aus technischen Gründen (serverseitiges Rendern ohne Login)
vom owner-RLS ausgenommen. Die zugehörige `/api`-Route ist dennoch login-geschützt.
