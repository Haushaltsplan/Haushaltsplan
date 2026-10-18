# Angebote — Datenquellen

Privates Modul `/angebote`. Unoffizielle Clients gegen öffentlich erreichbare Endpunkte der Händler bzw. Marktguru. Keine öffentlichen Scraping-APIs ohne Auth.

## Strategie

1. **Direktadapter** parallel laden (Timeout + Retry in `lib/angebote/http.ts`).
2. Pro Kette: erfolgreicher Direktbestand wird **nicht** mit Marktguru vermischt.
3. Bei Direkt-Fehler (oder Ketten ohne Direktadapter): **Marktguru**-Fallback.
4. Snapshot pro Owner + PLZ + ISO-Woche in `angebote_snapshot` (15‑Min-Cache, `force` erzwingt Rescan).

## Direktquellen

| Händler | Adapter | Endpoint / Seite | Hinweise |
|---------|---------|------------------|----------|
| REWE | `adapters/rewe.ts` | `shop.rewe.de/api/products` + Marktguru | HTML oft 403; Shop-API mit Market-ID, sonst Marktguru (`rewe` + `rewe-center`) |
| ALDI Süd | `adapters/aldi.ts` | `api.aldi-sued.de/v3/product-search` (`Wochenangebote`) | Akamai kann 403 liefern (IP/Region) |
| ALDI Nord | `adapters/aldi.ts` | `aldi-nord.de/angebote.html` → `__NEXT_DATA__` | Nur bei PLZ 0–3 aktiv |
| EDEKA | `adapters/edeka.ts` | `edeka.de/eh/service/eh/offers?marketId=` | `marketId` aus Marktsuche oder `1` national |
| Lidl | `adapters/lidl.ts` | `stores.lidlplus.com` + `offers.lidlplus.com` | Lidl-Plus App-Headers; Filiale per PLZ |
| Kaufland | `adapters/kaufland.ts` | `kaufland.de/.klstorefront/v1/offers` | Kann sich ändern → Fallback Marktguru |

ALDI-Region: PLZ-Erste Ziffer `0–3` → Nord, sonst Süd (`plz-maerkte.ts`).

## Marktguru

- Keys aus `marktguru.de` Config-JSON (`x-apikey`, `x-clientkey`), gecacht ~6 h.
- Suche: `api.marktguru.de/api/v1/offers/search?as=web&q=&zipCode=PLZ`
- Genutzt für PENNY, Netto, Globus und als Fallback für Direktketten.

## Bekannte Bruchstellen

- Händler ändern JSON-Shapes ohne Ankündigung → Adapter wirft, UI zeigt Quellen-Badge.
- Rate-Limits: vorsichtige Timeouts, max. 1 Full-Scan / 15 min (außer Aktualisieren).
- Nominatim (PLZ→Geo für Lidl) verlangt sinnvollen User-Agent.

## Migration

`supabase/migrations/20261018140000_angebote.sql` — Tabellen `angebote_einstellung`, `angebote_snapshot` mit RLS.
