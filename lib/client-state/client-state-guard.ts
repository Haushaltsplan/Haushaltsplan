/** Während Cloud-Stand aufs Gerät geschrieben wird, keine Push-Schleife. */

let applyDepth = 0

export function istCloudApplyAktiv(): boolean {
  return applyDepth > 0
}

export async function mitCloudApply<T>(fn: () => T | Promise<T>): Promise<T> {
  applyDepth += 1
  try {
    return await fn()
  } finally {
    applyDepth -= 1
  }
}
