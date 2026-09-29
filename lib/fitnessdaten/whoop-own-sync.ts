/**
 * Eigener Sync der Whoop-Tageswerte (ohne Whoop-Cloud).
 *
 * Die Persistenz läuft über den bestehenden Client-State:
 * - Schlüssel `fitness-daily` / `fitness-profil` in `omnia_client_state`
 * - Bootstrap: `ClientStateBootstrap` in Omnia-Auth
 *
 * BLE schreibt lokal → Client-State-Merge push/pull zwischen Geräten.
 * Kein Whoop-OAuth, keine api.prod.whoop.com.
 */
export const WHOOP_OWN_SYNC_KEYS = ['fitness-daily', 'fitness-profil'] as const
