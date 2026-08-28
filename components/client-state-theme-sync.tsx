'use client'

import {
  CLIENT_STATE_APPLIED_EVENT,
  CLIENT_STATE_KEYS,
  CLIENT_STATE_READY_EVENT,
} from '@/lib/client-state/client-state-keys'
import { istCloudApplyAktiv } from '@/lib/client-state/client-state-guard'
import { istClientStatePullErledigt, pushClientState } from '@/lib/client-state/client-state-sync'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'

/** Theme zwischen Geräten abgleichen (next-themes schreibt nur localStorage). */
export function ClientStateThemeSync() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const skipPush = useRef(false)
  const [bereit, setBereit] = useState(istClientStatePullErledigt)

  useEffect(() => {
    const mark = () => setBereit(true)
    if (istClientStatePullErledigt()) mark()
    window.addEventListener(CLIENT_STATE_READY_EVENT, mark)
    return () => window.removeEventListener(CLIENT_STATE_READY_EVENT, mark)
  }, [])

  useEffect(() => {
    const onApplied = (ev: Event) => {
      const schluessel = (ev as CustomEvent<{ schluessel?: string }>).detail?.schluessel
      if (schluessel !== CLIENT_STATE_KEYS.theme) return
      const raw = window.localStorage.getItem('omnia-theme')
      if (raw !== 'light' && raw !== 'dark') return
      skipPush.current = true
      setTheme(raw)
    }
    window.addEventListener(CLIENT_STATE_APPLIED_EVENT, onApplied)
    return () => window.removeEventListener(CLIENT_STATE_APPLIED_EVENT, onApplied)
  }, [setTheme])

  useEffect(() => {
    if (!bereit || istCloudApplyAktiv()) return
    if (skipPush.current) {
      skipPush.current = false
      return
    }
    const t = theme === 'light' || theme === 'dark' ? theme : resolvedTheme === 'light' ? 'light' : 'dark'
    if (t !== 'light' && t !== 'dark') return
    pushClientState(CLIENT_STATE_KEYS.theme, t)
  }, [theme, resolvedTheme, bereit])

  return null
}
