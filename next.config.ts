import type { NextConfig } from "next";
import os from "node:os";

/**
 * Co-op over a LAN: other players open http://<host-lan-ip>:3000 in their own
 * browser. Since Next.js 16 the DEV server refuses dev-only resources (the HMR
 * socket etc.) from any origin that isn't "localhost" unless it is listed in
 * `allowedDevOrigins` — and when that is blocked, React never hydrates on the
 * joining player's machine, so every button on the page is dead.
 *
 * We allow (a) this machine's real LAN addresses and (b) the standard private
 * network ranges so a changed DHCP address doesn't need a config edit.
 * This only affects `next dev`; production builds are unaffected.
 */
function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const addr of list ?? []) {
      const isV4 = (addr.family as string | number) === "IPv4" || (addr.family as string | number) === 4;
      if (isV4 && !addr.internal) out.push(addr.address);
    }
  }
  return out;
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [...new Set([...lanAddresses(), "192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"])],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
