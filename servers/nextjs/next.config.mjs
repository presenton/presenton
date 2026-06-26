const presentonHttpHostPort =
  process.env.PRESENTON_HTTP_HOST_PORT ||
  process.env.PRESENTON_HOST_HTTP_PORT ||
  process.env.PRESENTON_PUBLIC_PORT ||
  "5001";

const nextConfig = {
  reactStrictMode: false,
  distDir: ".next-build",
  output: "standalone",
  ...(process.env.NODE_ENV !== "production"
    ? {
        allowedDevOrigins: [
          "http://127.0.0.1:40001",
          "http://localhost:40001",
          "127.0.0.1",
          "localhost",
        ],
      }
    : {}),

  // Rewrites for development - proxy font requests to FastAPI backend
  async rewrites() {
    return [
      {
        source: '/app_data/fonts/:path*',
        destination: `http://localhost:${presentonHttpHostPort}/app_data/fonts/:path*`,
      },
    ];
  },

  images: {
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

export default nextConfig;
