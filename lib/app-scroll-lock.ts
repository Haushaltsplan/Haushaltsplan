/** ID des einzigen App-Scroll-Containers (siehe `app/layout.tsx`). */
export const APP_MAIN_ID = 'app-main'

let scrollLockCount = 0

/** Hintergrund-Scroll sperren (z. B. Drawer/Modal). Refcount für verschachtelte Overlays. */
export function lockAppScroll(): () => void {
  scrollLockCount += 1
  document.documentElement.classList.add('app-scroll-locked')
  return () => {
    scrollLockCount = Math.max(0, scrollLockCount - 1)
    if (scrollLockCount === 0) {
      document.documentElement.classList.remove('app-scroll-locked')
    }
  }
}

export function getAppMain(): HTMLElement | null {
  return document.getElementById(APP_MAIN_ID)
}

export function scrollAppTo(top: number, behavior: ScrollBehavior = 'auto'): void {
  getAppMain()?.scrollTo({ top, behavior })
}
