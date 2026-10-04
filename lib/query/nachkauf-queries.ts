'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  NachkaufErgebnissePaket,
  NachkaufPerformanceUebersicht,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'

export const nachkaufQueryKeys = {
  ergebnisse: ['nachkauf', 'ergebnisse'] as const,
  kaufempfehlung: ['nachkauf', 'kaufempfehlung'] as const,
  performance: ['nachkauf', 'performance'] as const,
}

export type NachkaufKaufempfehlungCache = {
  ki_text: string | null
  basis_allokation: unknown[]
  verkauf_allokation: unknown[]
} | null

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export function useNachkaufErgebnisseQuery(enabled = true) {
  return useQuery({
    queryKey: nachkaufQueryKeys.ergebnisse,
    enabled,
    queryFn: () => fetchJson<NachkaufErgebnissePaket>('/api/portfolio-analyse/nachkaeufe/ergebnisse'),
  })
}

export function useNachkaufKaufempfehlungQuery(enabled = true) {
  return useQuery({
    queryKey: nachkaufQueryKeys.kaufempfehlung,
    enabled,
    queryFn: async () => {
      const j = await fetchJson<{ daten?: NachkaufKaufempfehlungCache }>('/api/portfolio-analyse/nachkaeufe/kaufempfehlung')
      return j.daten ?? null
    },
  })
}

export function useNachkaufPerformanceQuery(enabled = true) {
  return useQuery({
    queryKey: nachkaufQueryKeys.performance,
    enabled,
    queryFn: async () => {
      const j = await fetchJson<{ ok?: boolean; daten?: NachkaufPerformanceUebersicht }>(
        '/api/portfolio-analyse/nachkaeufe/performance',
      )
      return j.ok && j.daten ? j.daten : null
    },
  })
}

export function useInvalidateNachkaufQueries() {
  const qc = useQueryClient()
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: nachkaufQueryKeys.ergebnisse }),
      qc.invalidateQueries({ queryKey: nachkaufQueryKeys.kaufempfehlung }),
      qc.invalidateQueries({ queryKey: nachkaufQueryKeys.performance }),
    ])
  }
}
