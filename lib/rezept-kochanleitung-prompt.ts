/**
 * Regeln für extrem ausführliche, in sich schlüssige Kochanleitungen (Rezept-Coach).
 * Ziel: Schritt-für-Schritt, eine Handlung pro Array-Eintrag, mit Zeiten/Grad wo sinnvoll.
 */

import type { RezeptGericht } from '@/lib/rezept-coach-types'

export const REZEPT_KOCHSCHRITTE_LEITFADEN = `

**Kochanleitung (\`kochschritte\`) — PFLICHT, so ausführlich, dass JEDE Person es nachkochen kann, auch ohne Erfahrung:**

- Liefere **mindestens 16**, bei aufwendigen Gerichten **22–32** (oder bei sehr einfachen Gerichten 14–16) **getrennte** Schritte im Array. Lieber **zu viele** kurze Schritte als zu wenig.
- **Jeder String = genau EINE** klar abgeschlossene Aktion. Verboten: „Zwiebeln und Möhren vorbereiten“ in EINEM Schritt — stattdessen: erst Zwiebeln, dann in einem neuen Schritt Möhren, jeweils mit Schnitt/Größe.
- **Reihenfolge:** Arbeitsplatz/Equipment → ggf. Nudelwasser/Ofen rechtzeitig vorbereiten → **Mise en place** (Zutaten wiegen, scheiden, in Schälchen legen) → braten/sieden/bachen → würzen → probieren → anrichten.
- **Messen, nicht raten:** wo möglich **Salz/Pfeffer/Öl** mit „ca. 1 Prise / 1 EL“ benennen; Backen mit **Ober-/Unter- oder Umluft in °C**; Pfannen mit **mittlerer** bis **mittel-starker** Hitze (Herd 1–9: z. B. Stufe 6 von 9); **Minuten** angeben, optional „2–3 Min, bis…“.
- **Sinneseindrücke:** „Wenn die Ränder leicht bräunen“, „wenn feiner Dampf aufsteigt“, „wenn kein rosa rohes Fleisch mehr sichtbar ist“ — damit Niemand raten muss.
- **Pausen nutzen:** „Währenddessen: … (anderen Topf)“ in einem eigenen Schritt.
- **Risiko:** 1–2 Sätze z. B. scharfes Messer, heißes Fett, Topfgriffe — kurz, nicht belehrend.
- **Garprobe** wo relevant (Nudeln, Fleisch, Kartoffeln): wie testen, ohne Medizin zu betreiben.
- **Fertig anrichten** als eigene Schritte: „Vor dem Servieren: 2–3 Min ruhen lassen (warum)“, „Käse frisch reiben und darauf“, „Teller vorbereiten“.
- **Keine** leeren Sätze, keine doppelte Nummerierung im Text, **kein** „nach Belieben“ ohne vorhergehende Richtmenge, wenn absehbar.
`.trim()

/** Nachfrage im Chat: \`kochschritte\` nochmals viel länger, übrige Felder unverändert. */
export function buildMehrKochanleitungPrompt(gericht: RezeptGericht): string {
  const json = JSON.stringify(gericht, null, 2)
  return `Du hast dieses Rezept (JSON) bereits vorgeschlagen. Bitte antworte **nur** erneut mit **demselben** JSON-Schema (ein Objekt mit \`rezepte\`-Array, **einem** Eintrag, gleiche \`kategorie\`, \`titel\`, \`portionen\`, \`zutaten\` — **identische Mengen und Namen**).

**Einzig erlaubte Änderung:** ersetze \`kochschritte\` durch eine **wesentlich längere, absolut idiotensichere** Anleitung:

- **Mindestens 28** Schritte, bei großen Menüs bis **45**; jeder Array-Eintrag = **eine** Handlung.
- Noch feiner herunterbrechen als bisher: z. B. Topf aussuchen, Wasserhahn, Salz **in Gramm/Prisen** schätzen, wann rühren, wann **nicht** rühren.
- Zeiten, Temperaturen, Sicht- und Riechhinweise, typische Anfängerfehler vermeiden (z. B. „Fett muss heiß sein, bevor Fleisch in die Pfanne kommt“ in eigenem Schritt).
- Wenn sinnvoll: Unterschied Backofen Umluft vs. statisch benennen.

Aktuelles Rezept (exakt beibehalten außer kochschritte, die du neu schreibst):

\`\`\`json
${json}
\`\`\`
`
}
