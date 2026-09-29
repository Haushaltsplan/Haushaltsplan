/** Whoop-Cloud-Auto-Sync — deaktiviert (kein Abo / keine Whoop-API). */

export function whoopCloudSyncFaellig(_force = false): boolean {
  return false
}

export async function versucheWhoopCloudAutoSync(_force = false): Promise<boolean> {
  return false
}

export function whoopCloudAutoSyncIntervallMs(): number {
  return 60 * 60_000
}
