'use client'

/**
 * App-Confirm statt window.confirm — Bottom-Sheet mit großen Buttons.
 */

import { omniaHapticMedium } from '@/lib/fitnessdaten/omnia-native-ux'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type ConfirmOpts = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmApi = {
  confirm: (opts: ConfirmOpts) => Promise<boolean>
}

const ConfirmCtx = createContext<ConfirmApi | null>(null)

let standaloneResolver: ((v: boolean) => void) | null = null
let standaloneSetter: ((opts: ConfirmOpts | null) => void) | null = null

/** Imperativ nutzbar auch ohne Hook (z. B. in Event-Handlern). */
export function appConfirm(opts: ConfirmOpts): Promise<boolean> {
  if (standaloneSetter) {
    return new Promise((resolve) => {
      standaloneResolver = resolve
      standaloneSetter?.(opts)
    })
  }
  // Fallback Browser
  return Promise.resolve(window.confirm([opts.title, opts.message].filter(Boolean).join('\n\n')))
}

export function useAppConfirm(): ConfirmApi {
  const ctx = useContext(ConfirmCtx)
  if (!ctx) {
    return { confirm: appConfirm }
  }
  return ctx
}

export function AppConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null)

  useEffect(() => {
    standaloneSetter = setOpts
    return () => {
      standaloneSetter = null
    }
  }, [])

  const resolve = useCallback((value: boolean) => {
    standaloneResolver?.(value)
    standaloneResolver = null
    setOpts(null)
  }, [])

  useEffect(() => {
    if (!opts) return
    const el = document.getElementById('omnia-confirm-sheet')
    const onClose = () => resolve(false)
    el?.addEventListener('omnia-request-close', onClose)
    return () => el?.removeEventListener('omnia-request-close', onClose)
  }, [opts, resolve])

  const api = useMemo<ConfirmApi>(
    () => ({
      confirm: (o) =>
        new Promise((res) => {
          standaloneResolver = res
          setOpts(o)
        }),
    }),
    [],
  )

  return (
    <ConfirmCtx.Provider value={api}>
      {children}
      {opts ? (
        <div
          id="omnia-confirm-sheet"
          data-omnia-confirm-open="true"
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="omnia-confirm-title"
          onClick={() => resolve(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-2xl"
            style={{ marginBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="omnia-confirm-title" className="text-lg font-semibold text-[var(--app-text)]">
              {opts.title}
            </h2>
            {opts.message ? (
              <p className="mt-2 text-sm text-[var(--app-text-muted)]">{opts.message}</p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                className={`app-touch-target app-press flex-1 rounded-xl px-4 py-3 text-sm font-semibold ${
                  opts.danger
                    ? 'bg-rose-600 text-white'
                    : 'bg-[var(--app-accent)] text-[#041016]'
                }`}
                onClick={() => {
                  void omniaHapticMedium()
                  resolve(true)
                }}
              >
                {opts.confirmLabel ?? 'Bestätigen'}
              </button>
              <button
                type="button"
                className="app-touch-target app-press flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--app-text)]"
                onClick={() => resolve(false)}
              >
                {opts.cancelLabel ?? 'Abbrechen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmCtx.Provider>
  )
}
