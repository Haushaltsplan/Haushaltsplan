---
name: portfolio-analyse-audit
description: >-
  Portfolio-Analyse & Nachkauf-Radar Qualitäts-Audit. Nutzen nach Änderungen an
  lib/portfolio-analyse/, vor Deploy, wenn der Nutzer Bugs/Kinderkrankheiten
  meldet, oder wenn KI-Review Widersprüche findet (JSON-Truncation, Ticker-Chaos,
  Insider-Desync, KI ignoriert Trim-Signale, Live-Fallback).
---

# Portfolio-Analyse Audit

Systematische Prüfung gegen wiederkehrende Fehlerklassen — **nicht** nur das genannte Beispiel-Ticker fixen.

## Wann ausführen

- Nach jeder größeren Änderung in `lib/portfolio-analyse/` oder `components/portfolio-analyse/`
- Wenn der Nutzer Audit, Qualitätscheck oder „Kinderkrankheiten“ erwähnt
- Vor manuellem Deploy (Nutzer deployt selbst)
- Nach Bugbot-/Review-Hinweisen zu Daten-Widersprüchen

## Ablauf (Pflicht)

1. **Audit starten**
   ```bash
   npm run audit:portfolio -- --fix-hints
   ```
2. **Alle `error`-Befunde beheben** — klassenübergreifend (`.cursor/rules/beispiel-gilt-fuer-klasse.mdc`).
3. **Warnungen prüfen** — beheben wenn im gleichen Muster wie der Befund.
4. **Audit erneut** bis Exit-Code 0 (Errors = 0).
5. Kurz dem Nutzer melden: was geprüft, was gefixt, was `--strict` Warnungen offen ließen.

## Bekannte Fehlerklassen → Regel

| Klasse | Symptom | Fix-Richtung |
|--------|---------|--------------|
| JSON-Truncation | `JSON.parse` auf `datenSignale` crasht | Kompaktes Objekt, nie `kuerze(JSON.stringify(...))` |
| Live-Fallback | Alle `fundamentaldaten.ok: false` | Timeout ≥ Macrotrends+5s; Teilpakete behalten |
| KI vs. Radar | „Keine Verkäufe“ bei `ueberpruefen` | `filterBeobachtungsKandidaten` + Prompt-Sektion |
| Insider-Desync | Netto vs. `insiderKaeufe[]` | EU zuerst; Netto ≠ nur Käufe-Liste |
| Ticker-Chaos | `.DE` / `H11` statt `NFLX`/`HLMA` | `analyseTickerFuerPosition(isin, symbolYahoo)` |

## Auto-Fix-Heuristiken

- **Ticker**: Ersetze blindes `.split('.')[0]` für Scan/Insider/Performance durch `analyseTickerFuerPosition`.
- **JSON**: Ersetze String-Truncation durch `datenSignaleKompakt` oder numerisches Teilmenge-Objekt.
- **Timeout**: `LOAD_TIMEOUT_MS >= FETCH_TIMEOUT_MS + 5000` in Berater-Server.
- **Kaufempfehlung**: Beobachtungs-Kandidaten immer in Prompt; kein pauschales „Keine Verkaufs-Signale“.

## Nicht im Scope des schnellen Audits

- Live-API-Smoke (Macrotrends/Yahoo) — optional separater Rescan in der UI
- Supabase-Migrationen anwenden — Nutzer manuell
- Commits — nur auf explizite Anfrage

## Erweitern

Neue Bug-Klasse → Regel in `scripts/portfolio-analyse-audit/rules.mjs` + ggf. Contract-Case in `contract.ts`.
