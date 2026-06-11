import 'server-only'

import path from 'path'

/** Pfad für JSON-Caches — lokal `data/`, auf Vercel `/tmp` (read-only Deployment). */
export function dateiCachePfad(dateiname: string): string {
  const basis = process.env.VERCEL ? path.join('/tmp', 'omnia') : path.join(process.cwd(), 'data')
  return path.join(basis, dateiname)
}
