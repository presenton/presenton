import path from "node:path";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";

const nextjsRoot = path.dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const isElectronBuild = process.env.PRESENTON_ELECTRON_BUILD === "true";
const isElectronRuntime = process.env.PRESENTON_ELECTRON === "true";

const nextConfig = {
  reactStrictMode: false,
  distDir: ".next-build",
  output: "standalone",
  turbopack: {
    root: nextjsRoot,
  },
  async headers() {
    return [
      {
        source: "/vendor/fonts/:path*",
        // Sandboxed community previews load public fonts from an opaque origin.
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
  ...(process.env.NODE_ENV !== "production"
    ? {
        allowedDevOrigins: [
          "127.0.0.1",
          "localhost",
        ],
      }
    : {}),

  images: {
    // A packaged Electron app is installed under a read-only directory such as
    // /opt/Presenton. Next's optimizer writes to <distDir>/cache, so emit direct
    // image URLs for that build instead of attempting runtime cache writes.
    unoptimized: isElectronBuild || isElectronRuntime,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-7c765f3726084c52bcd5d180d51f1255.r2.dev",
      },
      {
        protocol: "https",
        hostname: "pptgen-public.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "pptgen-public.s3.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "img.icons8.com",
      },
      {
        protocol: "https",
        hostname: "present-for-me.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "yefhrkuqbjcblofdcpnr.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "unsplash.com",
      },
    ],
  },
  
};

export default withNextIntl(nextConfig);
