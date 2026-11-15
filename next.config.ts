import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    serverActions: {
      // History import sends compact chunks (IMPORT_CHUNK_SIZE entries, ~1–2 MB); stays
      // below the 4.5 MB request limit of serverless hosting.
      bodySizeLimit: "4mb",
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
