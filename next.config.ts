import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly set workspace root to avoid incorrect inference from parent lockfiles
  turbopack: {
    root: import.meta.dirname,
  },

  // Performance optimizations
  compress: true,
  poweredByHeader: false,

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.google.com',
        pathname: '/s2/favicons',
      },
    ],
  },

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js', 'lucide-react'],
  },
};

export default nextConfig;
