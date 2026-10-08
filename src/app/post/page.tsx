import type { Metadata } from "next";
import Link from "next/link";

import { ListingForm } from "@/components/listings/listing-form";
import { TypeBadge } from "@/components/listings/listing-card";
import { requireSessionUser } from "@/lib/auth";
import { campusDate } from "@/lib/campus-time";
import { linesFor } from "@/lib/i18n";
import { readLanguage } from "@/lib/language";
import { getPickupSpots } from "@/lib/listings";
import { isListingType, LISTING_TYPES, TYPE_INFO } from "@/lib/types/listing";

export const metadata: Metadata = {
  title: "Post · Nitte Mart",
};

/**
 * Posting, in two steps on one address.
 *
 * `/post` asks the only question that changes the form: what kind of post is
 * this? `/post?type=rent` is then the form for that kind. It is the same
 * ListingForm for all six, showing the fields that kind has. Keeping the
 * choice in the URL means the back button returns to the tiles, and a link
 * such as "Sell something" can go straight to the right form.
 */
export default async function PostPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const user = await requireSessionUser();
  const { type } = await searchParams;
  const lines = linesFor(await readLanguage());

  if (!isListingType(type)) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 bg-canvas px-4 py-8 text-ink md:px-6">
        <h1 className="title-card text-[44px] md:text-[64px]">What are you posting?</h1>
        <p className="mt-3 text-base text-ink-body">Pick one. The form changes to fit.</p>

        <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {LISTING_TYPES.map((value) => (
            <li key={value}>
              <Link
                href={`/post?type=${value}`}
                className="flex min-h-28 flex-col items-start gap-2 rounded-[14px] border border-control-border p-4 hover:bg-surface-soft"
              >
                <TypeBadge type={value} />
                <span className="text-lg leading-tight font-bold">{lines.post[value]}</span>
                <span className="text-sm text-ink-muted">{TYPE_INFO[value].postHint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const pickupSpots = await getPickupSpots();

  return (
    <div className="flex-1 bg-canvas text-ink">
      <main className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6">
        <Link
          href="/post"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline"
        >
          ← Post something else
        </Link>

        <div className="mt-2 flex items-center gap-3">
          <TypeBadge type={type} />
        </div>
        <h1 className="mt-2 text-[28px] leading-tight font-bold">{lines.post[type]}</h1>
        <p className="mt-1 mb-6 text-base text-ink-muted">
          It goes live for everyone on campus as soon as you publish.
        </p>

        {/* Keyed by type, so switching kind starts a clean form. */}
        <ListingForm
          key={type}
          userId={user.id}
          pickupSpots={pickupSpots}
          type={type}
          today={campusDate(new Date())}
        />
      </main>
    </div>
  );
}
