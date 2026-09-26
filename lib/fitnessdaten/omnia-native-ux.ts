/**
 * Haptics + Keep-Awake Helfer für die native Omnia-App.
 */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'

export async function omniaHapticLight(): Promise<void> {
  if (!istOmniaNativeApp()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    /* ignore */
  }
}

export async function omniaHapticMedium(): Promise<void> {
  if (!istOmniaNativeApp()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch {
    /* ignore */
  }
}

export async function omniaHapticError(): Promise<void> {
  if (!istOmniaNativeApp()) return
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    await Haptics.notification({ type: NotificationType.Error })
  } catch {
    /* ignore */
  }
}

export async function omniaHapticSuccess(): Promise<void> {
  if (!istOmniaNativeApp()) return
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    await Haptics.notification({ type: NotificationType.Success })
  } catch {
    /* ignore */
  }
}

export async function omniaKeepAwake(an: boolean): Promise<void> {
  if (!istOmniaNativeApp()) return
  try {
    const { KeepAwake } = await import('@capacitor-community/keep-awake')
    if (an) await KeepAwake.keepAwake()
    else await KeepAwake.allowSleep()
  } catch {
    /* ignore */
  }
}
