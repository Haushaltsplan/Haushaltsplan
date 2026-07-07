/** Serialisierbarer Zwischenstand für inkrementellen SEC-Segment-Cache. */

import type { SecDetailBlockDef } from '@/lib/portfolio-analyse/sec-edgar-detail-extraktion'
import type { SecSegmentRoh } from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

export type SecSegmentHistorieRohZustand = {
  kategorieMaps: Record<string, Record<string, SecSegmentRoh[]>>
  kategorieMeta: Record<string, Record<string, number>>
  kategorieDefs: Record<string, SecDetailBlockDef>
  oiMap: Record<string, SecSegmentRoh[]>
  oiMeta: Record<string, number>
  mitarbeiterProJahr: Record<string, number>
  kundenProJahr: Record<string, { name: string | null; anteilPct: number } | null>
  backlogProJahr: Record<string, number>
  verarbeiteteAccessions: string[]
}
