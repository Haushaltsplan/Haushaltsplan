import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
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
      <body className={`${inter.className} bg-slate-950 text-slate-200 min-h-screen antialiased`}>
        <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950 text-slate-200 shadow-2xl shadow-black/40">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-8">
              <Link
                href="/"
                className="truncate text-lg font-black tracking-tighter text-emerald-400 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 sm:text-xl md:text-2xl"
              >
                Haushaltsplan
              </Link>
              <SiteNav />
            </div>
            <div className="shrink-0 font-mono text-[10px] text-slate-600 sm:text-xs">v1.0.30</div>
          </div>
        </nav>

        {oeffentlicheUrl ? (
          <div className="border-b border-slate-800 bg-slate-900/80">
            <div className="mx-auto max-w-6xl px-4 py-2.5 text-center text-[12px] leading-snug text-slate-400 md:text-left">
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
          <div className="max-w-6xl mx-auto py-8 px-4">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
