import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "";
const WS_SERVER_URL = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
const CLERK_DOMAIN = "*.clerk.accounts.dev accounts.google.com";

const serverOrigin = (() => {
  try {
    return SERVER_URL ? new URL(SERVER_URL).origin : "";
  } catch {
    return "";
  }
})();

const wsOrigin = (() => {
  try {
    return WS_SERVER_URL ? WS_SERVER_URL.replace(/^ws/, "http") : "";
  } catch {
    return "";
  }
})();

const isDev = process.env.NODE_ENV !== "production";
const scriptEval = isDev ? `'unsafe-eval'` : "";
const devWs = isDev ? `ws://localhost:4000 ws://localhost:4000/` : "";

// Previously this only set `media-src`, leaving every other directive
// (script-src, object-src, frame-ancestors, ...) unrestricted — a CSP
// header that looks present but provides close to no XSS protection.
// Mirrors enatega-multivendor-admin/next.config.mjs, adapted to this
// app's own asset/API domains.
const ContentSecurityPolicy = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' ${scriptEval} https://maps.googleapis.com https://maps.gstatic.com https://accounts.google.com https://*.clerk.accounts.dev https://www.googletagmanager.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  `img-src 'self' data: blob: https:`,
  `media-src 'self' https://*.amazonaws.com https://*.s3.amazonaws.com https://assets.enatega.com data: blob:`,
  `connect-src 'self' ${serverOrigin} ${wsOrigin} ${devWs} wss: ws: https://maps.googleapis.com https://firebaseinstallations.googleapis.com https://firestore.googleapis.com https://fcmregistrations.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firebase.googleapis.com https://res.cloudinary.com https://*.clerk.accounts.dev ${CLERK_DOMAIN}`,
  `frame-src 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `worker-src blob: 'self'`,
  `manifest-src 'self'`,
]
  .join("; ")
  .trim();

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(woff|woff2|eot|ttf|otf)$/i,
      type: "asset/resource",
      dependency: { not: ["url"] },
    });
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  images: {
    // domains: ["storage.googleapis.com"],
    unoptimized: true,
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      // Dummy
      {
        protocol: "https",
        hostname: "images.ctfassets.net",
      },
      //////////
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "enatega.com",
      },
      {
        protocol: "https",
        hostname: "www.lifcobooks.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        hostname: "example.com",
        protocol: "https",
      },
      {
        protocol: "https",
        hostname: "encrypted-tbn0.gstatic.com",
      },
      {
        protocol: "https",
        hostname: "t4.ftcdn.net",
      },
      {
        protocol: "https",
        hostname: "static.vecteezy.com",
      },
      {
        protocol: "https",
        hostname: "cdn-icons-png.flaticon.com",
      },
      {
        protocol: "https",
        hostname: "images.ctfassets.net",
      },
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
      {
        protocol: "https",
        hostname: "images.deliveryhero.io",
      },
      {
        protocol: "https",
        hostname: "enatega-backend.s3.eu-north-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
    ], // Add placehold.co as an allowed domain
  },
};

export default withNextIntl(nextConfig);
