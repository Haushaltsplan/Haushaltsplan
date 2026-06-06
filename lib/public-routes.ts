/** Routen ohne Login (z. B. WHOOP Privacy Policy beim OAuth). */
export const PUBLIC_PATHS = ['/datenschutz'] as const

export function istOeffentlicheRoute(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
