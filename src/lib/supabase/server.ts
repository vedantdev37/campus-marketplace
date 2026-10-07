import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * A new client is created per request, never shared. The library stores the
 * session in cookies, so a shared client would serve one user's session to
 * another.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),

        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Next.js forbids writing cookies while rendering a Server
            // Component. This throw is expected there and safe to swallow:
            // proxy.ts runs before render and performs the token refresh,
            // writing the refreshed cookies to the response itself.
            //
            // Swallowing it in a Server Action would be a bug - but actions
            // can write cookies, so this branch is not reached there.
          }
        },
      },
    },
  );
}
