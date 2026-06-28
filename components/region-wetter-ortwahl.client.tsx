'use client'

import type { WetterOrtId } from '@/lib/region-haarbach'
import { Suspense, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

function OrtwahlInner({ aktuell }: { aktuell: WetterOrtId }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onChange = useCallback(
    (id: WetterOrtId) => {
      if (id === aktuell) return
      const q = new URLSearchParams(searchParams.toString())
      if (id === 'haarbach') q.delete('ort')
      else q.set('ort', id)
      const s = q.toString()
      const path = pathname || '/'
      router.push(s ? `${path}?${s}` : path, { scroll: false })
    },
    [aktuell, pathname, router, searchParams],
  )

  return (
    <label className="flex shrink-0 items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-sky-300/90">
      <span className="hidden text-sky-500/80 sm:inline">Ort</span>
      <select
        value={aktuell}
        onChange={(e) => onChange(e.target.value as WetterOrtId)}
        className="max-w-[11rem] rounded-lg border border-sky-700/45 bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-[12px] font-semibold normal-case tracking-normal text-[var(--app-text)] outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500/45"
      >
        <option value="haarbach">Haarbach</option>
        <option value="leogang">Leogang</option>
      </select>
    </label>
  )
}

export function RegionWetterOrtwahlClient({ aktuell }: { aktuell: WetterOrtId }) {
  return (
    <Suspense
      fallback={
        <select
          disabled
          className="max-w-[11rem] rounded-lg border border-sky-700/45 bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-[12px] text-[var(--app-text-muted)]"
          defaultValue={aktuell}
        >
          <option value="haarbach">Haarbach</option>
          <option value="leogang">Leogang</option>
        </select>
      }
    >
      <OrtwahlInner aktuell={aktuell} />
    </Suspense>
  )
}
