import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
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
  title: { default: "Haushaltsplan", template: "%s · Haushaltsplan" },
  description: "Haushaltsplan — Finanzen, Speisekammer, Besitz, Investments",
  applicationName: "Haushaltsplan",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Haushaltsplan",
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
  const oeffentlicheUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "")

  return (
    <html lang="de">
      <body
        className={`${inter.className} bg-slate-950 text-slate-200 min-h-screen min-h-[100dvh] antialiased`}
      >
        <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950 pt-[env(safe-area-inset-top,0px)] text-slate-200 shadow-2xl shadow-black/40">
          <div className="mx-auto flex h-16 max-w-6xl min-w-0 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4">
            <div className="flex min-w-0 flex-1 items-center">
              <SiteNav />
            </div>
            <div className="hidden shrink-0 font-mono text-xs text-slate-600 sm:block">v1.0.30</div>
          </div>
        </nav>

        {oeffentlicheUrl ? (
          <div className="border-b border-slate-800 bg-slate-900/80">
            <div className="mx-auto min-w-0 max-w-6xl px-3 py-2.5 text-center text-[12px] leading-snug text-slate-400 sm:px-4 md:text-left">
              <span className="font-semibold text-slate-300">Öffentliche Adresse </span>
              (Lesezeichen, teilen, unterwegs im Browser):{' '}
              <a
                href={oeffentlicheUrl}
                className="break-all font-mono text-[11px] text-sky-300 underline decoration-sky-700 underline-offset-2 hover:text-sky-200"
              >
                {oeffentlicheUrl}
              </a>
            </div>
          </div>
        ) : null}

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

        <Providers>
          <div className="mx-auto min-w-0 w-full max-w-6xl px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-8">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
