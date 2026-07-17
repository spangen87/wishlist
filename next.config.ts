import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-eval' required in dev for React Fast Refresh (webpack HMR)
              // apis.google.com is required by Firebase Auth Web SDK (iframe + token refresh helper)
              isDev
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com"
                : "script-src 'self' 'unsafe-inline' https://apis.google.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              // In dev the browser must reach the local Firebase emulators (auth + firestore)
              isDev
                ? "connect-src 'self' https://*.googleapis.com https://apis.google.com https://*.firebaseio.com wss://*.firebaseio.com http://127.0.0.1:9099 http://127.0.0.1:8080 http://localhost:9099 http://localhost:8080"
                : "connect-src 'self' https://*.googleapis.com https://apis.google.com https://*.firebaseio.com wss://*.firebaseio.com",
              "font-src 'self'",
              // Firebase Auth opens an iframe at <projectId>.firebaseapp.com for popup/redirect/token flows
              "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
