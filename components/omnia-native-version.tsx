'use client'

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { useEffect, useState } from 'react'

/** Zeigt native versionName/versionCode + Web-Hinweis. */
export function OmniaNativeVersionLabel({ className = '' }: { className?: string }) {
  const [label, setLabel] = useState('Omnia Web')

  useEffect(() => {
    if (!istOmniaNativeApp()) {
      setLabel('Omnia Web')
      return
    }
    void (async () => {
      try {
        const { App } = await import('@capacitor/app')
        const info = await App.getInfo()
        setLabel(`Omnia ${info.version} (${info.build})`)
      } catch {
        setLabel('Omnia Native')
      }
    })()
  }, [])

  return <p className={`font-mono text-[10px] text-[var(--app-text-muted)] ${className}`}>{label}</p>
}
