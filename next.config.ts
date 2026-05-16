import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "fontkit", "restructure", "iconv-lite"],
};

export default nextConfig;
