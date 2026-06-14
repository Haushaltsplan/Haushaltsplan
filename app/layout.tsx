import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SiteMobileChrome } from "@/components/site-mobile-chrome";
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
    "Omnia — Finanzen, Speisekammer, Kalender, Besitz, Markt & Prompts und mehr an einem Ort.",
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
              <SiteMobileChrome />

              <header className="sticky top-0 z-40 hidden h-12 shrink-0 items-center justify-end border-b border-[var(--app-border)] bg-[var(--app-bg)]/90 px-6 backdrop-blur-md md:flex">
                <ThemeToggle />
              </header>

              <Providers>
                <main className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-3 py-4 pb-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.5rem))] sm:px-6 sm:py-6 md:px-8 md:py-8 md:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
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
