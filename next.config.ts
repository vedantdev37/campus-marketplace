import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (Next 16 PPR) is deliberately NOT enabled.
  // It makes reading cookies() outside a <Suspense> boundary a build error,
  // and @supabase/ssr reads cookies on every authenticated request. This app
  // also needs reads to be fresh (realtime sold updates), so dynamic-by-default
  // is the behaviour we want. See docs/architecture.md.
  //
  // cacheComponents + partialPrefetching must be set together; both are off.

  images: {
    remotePatterns: [
      // Listing images uploaded to Supabase Storage.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      // Book covers returned by the Google Books API.
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "books.googleusercontent.com" },
    ],
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
