'use client'

import { pullClientState } from '@/lib/client-state/client-state-sync'
import { ladeKalenderEintraegeVonQuelle } from '@/lib/haushalt-kalender'
import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'

/**
 * Nach dem Login: Browser-State aus der Cloud ziehen und Kalender spiegeln,
 * damit Laptop und Handy denselben Stand sehen.
 */
export function ClientStateBootstrap() {
  useEffect(() => {
    let stop = false

    async function lauf() {
      const { data } = await supabase.auth.getSession()
      if (stop || !data.session) return
      await pullClientState()
      if (stop) return
      const eintraege = await ladeKalenderEintraegeVonQuelle()
      const { pushClientState } = await import('@/lib/client-state/client-state-sync')
      pushClientState('kalender-meta', { anzahl: eintraege.length })
    }

    void lauf()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) return
      void lauf()
    })

    let lastVisiblePull = 0
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastVisiblePull < 15_000) return
      lastVisiblePull = Date.now()
      void lauf()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stop = true
      sub.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}
