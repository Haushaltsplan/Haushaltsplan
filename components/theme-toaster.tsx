'use client'

import { useTheme } from 'next-themes'
import { Toaster } from 'react-hot-toast'

export function ThemeToaster() {
  const { resolvedTheme } = useTheme()
  const isLight = resolvedTheme === 'light'

  return (
    <Toaster
      position="bottom-center"
      toastOptions={{
        style: isLight
          ? { background: '#ffffff', color: '#1e293b', border: '1px solid #e2e8f0' }
          : { background: '#1e293b', color: '#e2e8f0' },
        success: {
          iconTheme: isLight
            ? { primary: '#059669', secondary: '#ffffff' }
            : { primary: '#34d399', secondary: '#1e293b' },
        },
        error: {
          iconTheme: isLight
            ? { primary: '#e11d48', secondary: '#ffffff' }
            : { primary: '#fb7185', secondary: '#1e293b' },
        },
      }}
    />
  )
}
