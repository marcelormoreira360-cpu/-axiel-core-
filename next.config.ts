import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "fontkit", "restructure", "iconv-lite"],
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableLogger: true,
  tunnelRoute: "/monitoring",
});
