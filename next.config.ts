import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client's local-file transport uses a native addon; keep it out
  // of the serverless bundle instead of letting Next try to trace/bundle it.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
