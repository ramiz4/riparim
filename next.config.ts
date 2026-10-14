import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  // Preserve the original request origin for internal locale rewrites.
  skipProxyUrlNormalize: true,
  // Node uses the same App Router code with a different runtime adapter.
  webpack(config, { webpack }) {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^@\/lib\/runtime\/env$/,
        resolve("lib/runtime/node-env.ts"),
      ),
    );
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^@\/lib\/notifications\/smtp$/,
        resolve("lib/notifications/node-smtp.ts"),
      ),
    );
    return config;
  },
};
export default nextConfig;
