import { readdirSync } from "node:fs";
import path from "node:path";

import type { NextConfig } from "next";

/**
 * The hero photos, listed once when the app is built.
 *
 * Whatever image files are in public/hero/ are used, in filename order, so
 * swapping the placeholders for real campus photographs needs no code change.
 * See src/lib/hero-images.ts for why this is done here and not per request.
 */
function listHeroImages(): string[] {
  try {
    return readdirSync(path.join(process.cwd(), "public", "hero"))
      .filter((file) => /\.(webp|jpe?g|png|avif)$/i.test(file))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 6)
      .map((file) => `/hero/${file}`);
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  // Cache Components (Next 16 PPR) is deliberately NOT enabled.
  // It makes reading cookies() outside a <Suspense> boundary a build error,
  // and @supabase/ssr reads cookies on every authenticated request. This app
  // also needs reads to be fresh (realtime sold updates), so dynamic-by-default
  // is the behaviour we want. See docs/architecture.md.
  //
  // cacheComponents + partialPrefetching must be set together; both are off.

  env: {
    HERO_IMAGES: JSON.stringify(listHeroImages()),
  },

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
