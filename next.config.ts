import type { NextConfig } from "next";

/** Sicherheits-Header für alle Antworten (Schutz vor Clickjacking, MIME-Sniffing, Leaks). */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()",
  },
  // Erzwingt HTTPS im Browser (greift nur über HTTPS; lokal/HTTP unschädlich).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['jsdom', 'playwright', 'pdf-parse'],
  outputFileTracingExcludes: {
    '*': ['node_modules/playwright/**', 'node_modules/playwright-core/**'],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
