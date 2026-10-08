import { redirect } from "next/navigation";

import type { RawSearchParams } from "@/lib/listing-filters";

/**
 * The old address of the browse page. It is now the Buy tab of /explore.
 *
 * Kept as a redirect, with the query string carried over, because this URL is
 * in the README's instructions for reviewers, in bookmarks, and is where the
 * home page search used to point: `/listings?q=grewal` must still find Grewal.
 */
export default async function OldBrowsePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;

    if (first) {
      params.set(key, first);
    }
  }

  const query = params.toString();
  redirect(query ? `/explore?${query}` : "/explore");
}
