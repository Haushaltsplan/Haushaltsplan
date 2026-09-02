'use client'

import { setzeClientZugriff } from '@/lib/zugriff-client'
import { istOeffentlicheRoute } from '@/lib/public-routes'
import { supabase } from '@/lib/supabase'
import {
  gastSeiteErlaubt,
  omniaRolleAusUser,
  ownerEmailsPublic,
  PORTFOLIO_ANALYSE_PFAD,
  type OmniaRolle,
} from '@/lib/zugriff-rollen'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

export function ZugriffGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [rolle, setRolle] = useState<OmniaRolle>('none')
  const [bereit, setBereit] = useState(false)

  useEffect(() => {
    let mounted = true
    const apply = (next: OmniaRolle, userId: string | null) => {
      if (!mounted) return
      setzeClientZugriff({ userId, rolle: next })
      setRolle(next)
      setBereit(true)
    }

    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null
      apply(omniaRolleAusUser(user, ownerEmailsPublic()), user?.id ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user ?? null
      apply(omniaRolleAusUser(user, ownerEmailsPublic()), user?.id ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!bereit || rolle !== 'portfolio_gast') return
    if (istOeffentlicheRoute(pathname)) return
    if (gastSeiteErlaubt(pathname)) return
    router.replace(PORTFOLIO_ANALYSE_PFAD)
  }, [bereit, rolle, pathname, router])

  if (rolle === 'portfolio_gast' && !istOeffentlicheRoute(pathname) && !gastSeiteErlaubt(pathname)) {
    return (
      <div className="py-10 text-center text-sm text-[var(--app-text-muted)]">
        Weiterleitung zur Portfolioanalyse …
      </div>
    )
  }

  return <>{children}</>
}

export function useOmniaRolle(): OmniaRolle {
  const [rolle, setRolle] = useState<OmniaRolle>(() => {
    if (typeof window === 'undefined') return 'none'
    return 'none'
  })

  useEffect(() => {
    let mounted = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setRolle(omniaRolleAusUser(data.session?.user, ownerEmailsPublic()))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return
      setRolle(omniaRolleAusUser(session?.user, ownerEmailsPublic()))
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return rolle
}
