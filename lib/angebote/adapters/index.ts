import 'server-only'

import { reweAdapter } from '@/lib/angebote/adapters/rewe'
import { aldiNordAdapter, aldiSuedAdapter } from '@/lib/angebote/adapters/aldi'
import { edekaAdapter } from '@/lib/angebote/adapters/edeka'
import { lidlAdapter } from '@/lib/angebote/adapters/lidl'
import { kauflandAdapter } from '@/lib/angebote/adapters/kaufland'
import type { AngeboteAdapter } from '@/lib/angebote/adapters/types'
import type { HaendlerId } from '@/lib/angebote/types'

export const DIREKT_ADAPTERS: readonly AngeboteAdapter[] = [
  reweAdapter,
  aldiSuedAdapter,
  aldiNordAdapter,
  edekaAdapter,
  lidlAdapter,
  kauflandAdapter,
]

export function direktAdapterFuer(haendler: HaendlerId): AngeboteAdapter | undefined {
  return DIREKT_ADAPTERS.find((a) => a.haendler === haendler)
}
