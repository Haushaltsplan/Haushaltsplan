/** Gemeinsame Textlogik für S&P-500- und Nasdaq-100-Tagesmovers (ohne Dubletten in beiden Dateien). */

import { decodeXmlText } from '@/lib/google-news-rss'

/**
 * Movers-KI: Prompt mit optional aktiviertem Google-Search-Grounding (nur Gemini — siehe `RunCoachCompletionOptions.geminiGoogleSearch`).
 */
export function kiMoverEinordnungSystemPrompt(mitGoogleSearchGrounding: boolean): string {
  const recherche = mitGoogleSearchGrounding
    ? `**Live-Recherche (Google Search Grounding):** Für diese Anfrage ist die **Websuche** eingeschaltet. Nutze sie **je Ticker** gezielt zu **Nachrichten und Marktkontext der letzten regulären US-Handelssitzung**. Orientiere dich inhaltlich an **erstklassigem Finanzjournalismus** (Niveau wie Bloomberg, Reuters, CNBC, Barron's). **Keine erfundenen Direktzitate**; **keine URL-Liste** und keine „Quellen:“-Sektion im Text; **keine** behauptete „Batch-Recherche“ außerhalb des Tools — arbeite mit den Suchergebnissen. Fehlen harte Firmen-Meldungen: **Analysten-Up-/Downgrades**, **Sektor-Trends**, **Sympathy Trades** bei direkten Konkurrenten, **Zins- oder Regulatorik-Sensitivität** des Sektors (z. B. Tech) prüfen.`
    : `**Ohne Live-Web:** Nutze **nur** die mitgelieferten Felder **„artikelFliesstextAusLink“** (Primär, wenn gefüllt), **„inhaltAuszugAusRss“**, **„zusammenfassungMehrererAuszuege“**. Simuliere **keine** Websuche und nenne **keine** fiktiven Bloomberg-/Reuters-Bezüge. **„ueberschriftNurDisambiguation“** nur zur Zuordnung — nicht wörtlich recyceln. Bei dünner Basis: Analysten-/Sektor-/Peer-/Makro-Logik **vorsichtig** aus Text + **„branche“**/**„sektor“** ableiten — **keine neuen Kennziffern erfinden**.`

  return `Du bist ein Senior-Equity-Analyst und Redakteur (Deutsch).

**Auftrag:** Für **jedes Symbol** in diesem Batch eine **fundierte Begründung** der **heutigen** Kursbewegung (**„aenderungProzent“**). Feld **„moverKontext“** sagt, ob die Aktie zu den **10 stärksten** oder **10 schwächsten** Tages-Movern des **S&P 500** bzw. **Nasdaq 100** gehört.

${recherche}

**Strikte Inhaltsregeln**
- **Länge:** Pro Symbol **genau 3 oder 4 vollständige Sätze** im Feld **„kurzfassung“**.
- **Keine Ausreden:** Formulierungen wie „keine ausführliche Meldung“, „Ursachen unklar“, „Marktschwankungen sind normal“ oder ähnliche **Platzhalter** sind **unzulässig**. Du lieferst immer eine **inhaltliche** Erklärung (über Unternehmensnews, Ratings, Sektor, Peers oder Makro).
- **Auslöser:** Benenne den **konkretesten** plausiblen Treiber (z. B. Earnings-Überraschung, Guidance, Upgrade/Downgrade, Sektor-News, Regulierung, Zinssensitivität), passend zur **Kursrichtung**.
- **Branche:** **„branche“** und **„sektor“** aus dem Payload **wörtlich** einbauen, sofern nicht leer.
- **Qualität:** Schließe mit einem **kurzen** Plausibilitäts-Urteil (im Sinne **beständiger vs. kurzfristiger** Bewegung / **Quality Compounder**-Folie) — **ohne Kauf-/Verkaufsempfehlung**.

**Ausgabe:** Nur ein **JSON-Objekt**: Schlüssel = **Ticker in GROSSBUCHSTABEN**, Wert = **{ "kurzfassung": "..." }**. Nur Symbole aus **diesem** Batch. Kein Markdown, keine Zwischenüberschriften (die App zeigt Index/Rang separat).

Keine Anlageberatung.

Antwort NUR als JSON-Objekt, keine Markdown-Fences, kein weiterer Text.`
}

/** Grobe Plausibilität: sehr starke Gewinner ohne gleichzeitige Gegenbotschaft nicht mit „Sturz/Einbruch“-Schlagzeilen mischen (Rest macht Datum/„when:“). */
export function schlagzeilePasstZuTagesbewegungGrob(titel: string, aenderungProzent: number): boolean {
  if (Math.abs(aenderungProzent) < 5.5) return true
  const starkNegativ =
    /\b(stürzt\s+ab|bricht\s+ein|einbruch|rutsch.*ab|rutsche.*tiefer|minus\s+von\s+\d|\-\s*\d+\s*%[\s\w]*(verlust|minus))\b/i.test(titel)
  const starkPositiv =
    /\b(schnellt\s+nach\s+oben|springt\s+(nach\s+)?oben|gewinnt\s+kräftig|plus\s+von\s+\d|\+\s*\d+\s*%[\s\w]*(gewinn|plus))\b/i.test(titel)
  if (aenderungProzent >= 5.5 && starkNegativ && !starkPositiv) return false
  if (aenderungProzent <= -5.5 && starkPositiv && !starkNegativ) return false
  return true
}

function wiederholeOutletSuffixAbschneiden(t: string): string {
  let s = t
  const muster =
    /\s+((Investing\.com(\s+(Deutsch|Deutschland|Germany|English|ES|España))?)|(Reuters(\s+\w+)?)|(Bloomberg(\s+\w+)?)|(CNBC\b[^.]*?)|(MarketWatch\b[^.]*?)|(Yahoo\s+Finance\b[^.]*?)|(The\s+)?Wall\s+Street\s+Journal\b[^.]*|(Financial\s+Times|FT\.com)\b[^.]*|(Seeking\s+Alpha)\b[^.]*|(Business\s+Insider)\b[^.]*|(Der\s+Aktionär)\b[^.]*|(Capital\.de)\b[^.]*|(Finanzen\.net)\b[^.]*)$/iu
  for (let i = 0; i < 6; i++) {
    const next = s.replace(muster, '').trim()
    if (next === s) break
    s = next
  }
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * RSS-Beschreibung für Movers: Entities/HTML, NBSP, häufige Quellen-Zitate am Ende,
 * optional doppelte „Firma:“ am Anfang entfernen.
 */
export function beschreibungAusRssBlock(raw: string, firmaName?: string | null): string {
  let t = decodeXmlText(raw)
  t = t.replace(/\u00a0/g, ' ')
  t = wiederholeOutletSuffixAbschneiden(t)

  const firma = firmaName?.replace(/\s+/g, ' ').trim()
  if (firma && firma.length >= 3) {
    const esc = firma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp(`^${esc}\\s*:\\s*`, 'i'), '').trim()
  }

  return t.replace(/\s+/g, ' ').trim()
}

function snippetsUeberlappenGenug(a: string, b: string): boolean {
  const kuerzer = a.length <= b.length ? a : b
  const laenger = a.length <= b.length ? b : a
  const prefix = kuerzer.slice(0, Math.min(42, kuerzer.length))
  return prefix.length >= 14 && laenger.includes(prefix)
}

/** Aus bereits mit beschreibungAusRssBlock bereinigten Snippets eine zusammenhängende Kurzfassung bauen (bis zu drei nicht überlappende Teile). */
export function rssBeschreibungenZuKurzfassung(bereinigteSnippets: string[]): string | null {
  const cleaned = bereinigteSnippets.map((s: string) => s.replace(/\s+/g, ' ').trim()).filter((s: string) => s.length >= 18)
  if (cleaned.length === 0) return null

  cleaned.sort((a: string, b: string) => b.length - a.length)
  const parts: string[] = [cleaned[0]]

  for (let i = 1; i < cleaned.length && parts.length < 3; i++) {
    const cand = cleaned[i]
    if (parts.some((p) => snippetsUeberlappenGenug(p, cand))) continue
    parts.push(cand)
  }

  const base = parts.join(' ').replace(/\s+/g, ' ').trim()
  return base.length > 820 ? `${base.slice(0, 817)}…` : base
}

function schlagzeileOutletAbschneiden(titel: string): string {
  let s = titel.replace(/\s+/g, ' ').trim()
  const outletAmEnde =
    /^(Reuters|Bloomberg|CNBC|The Wall Street Journal|Wall Street Journal|WSJ|Financial Times|FT|MarketWatch|Barron'?s|Investing\.com(\s+Deutsch)?|Yahoo Finance|Forbes|The Economist|Associated Press|AP News|BBC|CNN Business|Fox Business|Seeking Alpha|Benzinga|TipRanks|The Motley Fool|Business Insider)\s*$/i

  const pipeTeile = s.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean)
  if (pipeTeile.length >= 2 && outletAmEnde.test(pipeTeile[pipeTeile.length - 1])) {
    s = pipeTeile.slice(0, -1).join(' ')
  }

  const gedankStrichTeile = s.split(/\s+[–—]\s+/).map((p) => p.trim()).filter(Boolean)
  if (gedankStrichTeile.length >= 2) {
    const last = gedankStrichTeile[gedankStrichTeile.length - 1]
    if (last.length < 52 && outletAmEnde.test(last)) {
      s = gedankStrichTeile.slice(0, -1).join(' – ')
    }
  }

  return s.replace(/\s+/g, ' ').trim()
}

function grobeSatzanzahl(text: string): number {
  const roh = text.replace(/\s+/g, ' ').trim()
  const teile = roh.split(/[.!?]+/).map((x) => x.trim()).filter((x) => x.replace(/\s+/g, '').length >= 12)
  return teile.length
}

/** Erste \`maxSaetze\` Sätze aus Fließtext kappen (u. a. für RSS-Fallback ohne LLM). */
export function textAufSaetzeUndLaengeBegrenzen(text: string, maxSaetze: number, maxZeichen: number): string {
  const merged = text.replace(/\s+/g, ' ').trim()
  if (merged.length < 12) return merged

  const rohTeile = merged.split(/[.!?]+/).map((x) => x.trim()).filter((x) => x.replace(/\s+/g, '').length > 18)
  if (rohTeile.length === 0) {
    return merged.length > maxZeichen ? `${merged.slice(0, maxZeichen - 1)}…` : merged
  }

  const gekuerzt = rohTeile.slice(0, maxSaetze).join('. ')
  const mitPunkt = gekuerzt.endsWith('.') || gekuerzt.endsWith('?') || gekuerzt.endsWith('!') ? gekuerzt : `${gekuerzt}.`
  return mitPunkt.length > maxZeichen ? `${mitPunkt.slice(0, maxZeichen - 1)}…` : mitPunkt
}

/** Eine Zeile für die Karte: Branche · Sektor (Rohbezeichnungen aus den Konstituenten-Daten). */
export function moverBrancheAnzeige(branche: string | null, sektor: string | null): string | null {
  const b = branche?.replace(/\s+/g, ' ').trim()
  const s = sektor?.replace(/\s+/g, ' ').trim()
  if (!b && !s) return null
  if (b && s && b.toLowerCase() !== s.toLowerCase()) return `${b} · ${s}`
  return b ?? s ?? null
}

/**
 * Extraktive Kurzfassung aus **einem** Artikelkörper — **ohne LLM**.
 * Es wird nur der **längste einzelne** Körper verwendet (kein Zusammenkleben mehrerer URLs/Snippets).
 */
export function kurzfassungAusArtikelKoerper(
  koerperTexte: string[],
  maxSaetze: number,
  maxZeichen: number,
): string | null {
  const cleaned = koerperTexte.map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => t.length > 80)
  if (cleaned.length === 0) return null
  const groesster = cleaned.reduce((a, b) => (b.length > a.length ? b : a))
  if (groesster.length < 120) return null

  return textAufSaetzeUndLaengeBegrenzen(groesster, maxSaetze, maxZeichen)
}

function laengersterMeldungsauszug(bereinigteSnippets: string[]): string | null {
  const cleaned = bereinigteSnippets.map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 55)
  if (cleaned.length === 0) return null
  return cleaned.reduce((a, b) => (b.length > a.length ? b : a))
}

/**
 * Mehrere RSS-/Überschriftenfragmente oder Broker-Krümel in einem String — nicht als Einordnung zeigen.
 */
export function moversTextIstSchlagzeilenSalat(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length < 72) return false

  if ((t.match(/;/g) ?? []).length >= 2) return true
  if ((t.match(/\|/g) ?? []).length >= 2) return true

  if (/\bfinanzen\.\s*ch\b/i.test(t)) return true
  if (/\.\s+(de|ch|fr|at)\s+[A-Za-zÄÖÜäöü]/i.test(t)) return true

  const enHead =
    /\b(Stock\s+Up|Stock\s+Down|Results\s+Climb|Revenue\s+Growth|Earnings\s+Beat|To\s+Cut\s+\d+\s*%|FY\s*\d{2}|Q[1-4]\s+Results)\b/i.test(t)
  const deTail =
    /\b(Abstufung|BOTSI|von\s+Rang\s+\d+|Vierteljährlich|Optionshandel\s+treibt|Rekordhoch)\b/i.test(t)
  if (enHead && deTail) return true

  if ((/BOTSI|Advisor[\s\-]*Abstufung|®[\s\-]*Advisor/i.test(t)) && /\b(Q[1-4]|Quartals|Umsatz|earnings|EPS)\b/i.test(t))
    return true

  return false
}

/** Fallback-Kette ohne LLM: nur ein einzelner RSS-Auszug oder neutraler deutscher Satz — nie mehrere Snippets kleben. */
export function moverKurzfassungOhneKi(input: {
  koerperTexte: string[]
  meldungsAuszuege: string[]
  prozent: number
}): string {
  let ausArtikel = kurzfassungAusArtikelKoerper(input.koerperTexte, 4, 560)
  if (ausArtikel && moversTextIstSchlagzeilenSalat(ausArtikel)) ausArtikel = null

  const rssBasis = laengersterMeldungsauszug(input.meldungsAuszuege)
  let rssKurz =
    rssBasis && rssBasis.length >= 90 ? textAufSaetzeUndLaengeBegrenzen(rssBasis, 4, 560) : null
  if (rssKurz && moversTextIstSchlagzeilenSalat(rssKurz)) rssKurz = null

  return (
    ausArtikel ??
    rssKurz ??
    begruendungFallbackAusNews({ inhaltsKurzfassung: null, prozent: input.prozent })
  )
}

/**
 * Nur RSS-Inhaltsauszüge (vorher zusammengeführt). Ohne API-KI oft zu kurz für echte Mehrsatz-Zusammenfassung.
 */
export function begruendungFallbackAusNews(input: { inhaltsKurzfassung: string | null; prozent: number }): string {
  const { inhaltsKurzfassung, prozent } = input
  const pct = `${prozent >= 0 ? '+' : ''}${prozent.toFixed(2)} %`

  const s = (inhaltsKurzfassung ?? '').replace(/\s+/g, ' ').trim()
  if (s.length >= 40) return s

  return `Zu dieser Tagesbewegung (${pct}) liegt keine ausführliche Meldung vor — starke Schwankungen haben oft mehrere Ursachen.`
}

/** KI-Kurzfassung für Movers: 3–4 Sätze, keine Platzhalter/Quellen-Marken, nicht nur Schlagzeile. */
export function kiMoverKurzfassungAkzeptieren(
  roh: string | undefined,
  schlagzeilen: Array<{ titel: string }>,
): string | null {
  if (!roh) return null
  const r = roh.replace(/\s+/g, ' ').trim()
  if (r.length < 140 || r.length > 1200) return null

  const saetze = grobeSatzanzahl(r)
  if (saetze < 3 || saetze > 4) return null

  const lower = r.toLowerCase()
  const platzhalterVerboten =
    /keine (ausreichenden |direkten )?informationen|liegen keine|keine belastbare|nichts weiter (zu|über)|marktschwankungen sind|schwankungen sind normal|normal für den markt|keine news|ohne konkrete meldung|lässt sich nicht begründen|nicht begründbar|keine ausführliche meldung|ursachen sind unklar/i.test(
      lower,
    )
  if (platzhalterVerboten) return null

  const zuMeta =
    /^(laut (den )?(aktuellen )?(schlagzeilen|nachrichten|medien|medienberichten)|nach (den )?(medien|meldungen|berichten)\b|die schlagzeilen\b|schlagzeilen (deuten|weisen)|berichte(n)? verweisen|in den nachrichten steht|ein artikel |der bericht |quellen |laut quelle)/i.test(
      r,
    )
  if (zuMeta) return null

  for (const s of schlagzeilen) {
    const k = schlagzeileOutletAbschneiden(s.titel)
    if (k.length < 20) continue
    const probeLen = Math.min(52, k.length)
    const probe = k.slice(0, probeLen).toLowerCase()
    if (probe.length >= 24 && lower.includes(probe)) return null
  }

  if (moversTextIstSchlagzeilenSalat(r)) return null

  return r
}
