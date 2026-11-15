import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    serverActions: {
      // History import sends one Extended Streaming History file per action call; Spotify's
      // files are around 10–15 MB. Keep in step with MAX_IMPORT_FILE_BYTES (30 MB) plus overhead.
      bodySizeLimit: "31mb",
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
