import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { OmniaAppShell } from "@/components/omnia-app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToaster } from "@/components/theme-toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f4f1' },
    { media: '(prefers-color-scheme: dark)', color: '#08090d' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: { default: "Omnia", template: "%s · Omnia" },
  description:
    "Omnia — Finanzen, Speisekammer, Kalender, Etsy KI Agent, Portfolio, Markt & Prompts und mehr an einem Ort.",
  applicationName: "Omnia",
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
            __html: `(function(){try{var t=localStorage.getItem('omnia-theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}var ua=navigator.userAgent||'';if(/OmniaWhoopCapacitor/i.test(ua)){document.documentElement.setAttribute('data-omnia-app','whoop')}else if(/OmniaCapacitor/i.test(ua)){document.documentElement.setAttribute('data-omnia-app','haushalt')}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${inter.className} h-[100dvh] overflow-hidden text-[var(--app-text)] antialiased`}
      >
        <ThemeProvider>
          <ThemeToaster />
          <OmniaAppShell>{children}</OmniaAppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
