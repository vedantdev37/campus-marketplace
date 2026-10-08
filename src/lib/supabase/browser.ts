import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

/**
 * Supabase client for Client Components.
 *
 * Used for things that must happen in the browser. Today that is uploading a
 * listing photo straight to Storage (see listing-form.tsx); the Realtime
 * subscription for sold updates will use it too once that is built.
 *
 * Every query made through this client is still subject to Row Level Security,
 * which is what makes it safe to ship the publishable key to the browser.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
