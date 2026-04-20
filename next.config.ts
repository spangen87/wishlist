import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const withPWAConfig = withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // Override the default "pages" cache to add a 3-second timeout.
      // Without this, NetworkFirst waits indefinitely — causing slow loads on Vercel cold starts.
      {
        urlPattern: ({ url: { pathname }, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
          sameOrigin && !pathname.startsWith("/api/"),
        handler: "NetworkFirst" as const,
        options: {
          cacheName: "pages",
          networkTimeoutSeconds: 3,
        },
      },
      // Override the "pages-rsc" cache (RSC navigation fetches) with a timeout.
      {
        urlPattern: ({
          request,
          url: { pathname },
          sameOrigin,
        }: {
          request: Request;
          url: URL;
          sameOrigin: boolean;
        }) =>
          request.headers.get("RSC") === "1" &&
          sameOrigin &&
          !pathname.startsWith("/api/"),
        handler: "NetworkFirst" as const,
        options: {
          cacheName: "pages-rsc",
          networkTimeoutSeconds: 3,
        },
      },
      // Override the "pages-rsc-prefetch" cache (RSC prefetch fetches) with a timeout.
      {
        urlPattern: ({
          request,
          url: { pathname },
          sameOrigin,
        }: {
          request: Request;
          url: URL;
          sameOrigin: boolean;
        }) =>
          request.headers.get("RSC") === "1" &&
          request.headers.get("Next-Router-Prefetch") === "1" &&
          sameOrigin &&
          !pathname.startsWith("/api/"),
        handler: "NetworkFirst" as const,
        options: {
          cacheName: "pages-rsc-prefetch",
          networkTimeoutSeconds: 3,
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withPWAConfig(nextConfig);
