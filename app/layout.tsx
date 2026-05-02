import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { Inter } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import { SiteSidebar } from "@/components/site-sidebar";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "react-hot-toast";

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
    <html lang="de">
      <body
        className={`${inter.className} min-h-screen min-h-[100dvh] bg-[#12141c] text-slate-200 antialiased`}
      >
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: { background: "#1e293b", color: "#e2e8f0" },
            success: {
              iconTheme: { primary: "#34d399", secondary: "#1e293b" },
            },
            error: {
              iconTheme: { primary: "#fb7185", secondary: "#1e293b" },
            },
          }}
        />

        <div className="flex min-h-screen min-h-[100dvh]">
          <SiteSidebar />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#12141c]">
            <nav className="sticky top-0 z-50 border-b border-zinc-800/90 bg-[#12141c]/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md md:hidden">
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
              </div>
            </nav>

            <Providers>
              <main className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 md:px-8 md:py-8">
                {children}
              </main>
            </Providers>
          </div>
        </div>
      </body>
    </html>
  );
}
