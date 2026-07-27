/** Routen ohne Login (z. B. WHOOP Privacy Policy beim OAuth, Magic-Link-Callback). */
export const PUBLIC_PATHS = ['/datenschutz', '/auth/confirm'] as const

export function istOeffentlicheRoute(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
