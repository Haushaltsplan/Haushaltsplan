/** Maximal gespeicherte / geladene Buchungen pro Nutzer (Supabase wird paginiert). */
export const PORTFOLIO_MAX_BUCHUNGEN = 10_000

/** PostgREST/Supabase liefert pro Request typisch max. 1000 Zeilen — Lade-Schleife in Seiten. */
export const PORTFOLIO_DB_SEITEN_GROESSE = 1000

/** Upsert-Paketgröße (Request-Größe & Stabilität). */
export const PORTFOLIO_UPSERT_BATCH = 500
