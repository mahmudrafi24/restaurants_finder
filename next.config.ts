import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No reason to advertise the framework version to anyone probing the deployment.
  poweredByHeader: false,

  /**
   * Baseline security headers.
   *
   * A Content-Security-Policy is deliberately not set here: the value depends on the API origin,
   * which is environment-specific, and a wrong CSP breaks the app silently in production. When one
   * is added it belongs in middleware with a per-request nonce, not as a static header.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
