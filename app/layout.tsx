import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { Inter } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import { SiteSidebar } from "@/components/site-sidebar";
import { MobileSwipePageNav } from "@/components/mobile-swipe-page-nav";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeToaster } from "@/components/theme-toaster";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: { default: "Omnia", template: "%s · Omnia" },
  description:
    "Omnia — Finanzen, Speisekammer, Kalender, Besitz, Investments und mehr an einem Ort.",
  applicationName: "Omnia",
  // app/apple-icon.png = 180×180 PNG fürs Home-Screen-Icon (nicht im icons-Array duplizieren)
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/omnia-192.png", sizes: "192x192", type: "image/png" },
      { url: "/omnia-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Omnia",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('omnia-theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${inter.className} min-h-screen min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)] antialiased`}
      >
        <ThemeProvider>
          <ThemeToaster />

          <div className="flex min-h-screen min-h-[100dvh]">
            <SiteSidebar />

            <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--app-bg)]">
              <nav className="sticky top-0 z-50 border-b border-[var(--app-border-strong)] bg-[var(--app-bg)]/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md md:hidden">
                <div className="flex h-[3.75rem] min-w-0 items-center justify-between gap-2 px-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Link
                      href="/"
                      className="relative shrink-0 p-0 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                      aria-label="Omnia – Startseite"
                    >
                      <Image
                        src="/icon.svg"
                        alt=""
                        width={96}
                        height={96}
                        unoptimized
                        className="h-10 w-10 object-contain"
                        priority
                      />
                    </Link>
                    <SiteNav />
                  </div>
                  <ThemeToggle />
                </div>
              </nav>

              <header className="sticky top-0 z-40 hidden h-12 shrink-0 items-center justify-end border-b border-[var(--app-border)] bg-[var(--app-bg)]/90 px-6 backdrop-blur-md md:flex">
                <ThemeToggle />
              </header>

              <Providers>
                <main className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 md:px-8 md:py-8">
                  <MobileSwipePageNav>{children}</MobileSwipePageNav>
                </main>
              </Providers>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
