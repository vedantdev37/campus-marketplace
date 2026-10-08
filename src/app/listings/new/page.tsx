import type { Metadata } from "next";
import Link from "next/link";

import { ListingForm } from "@/components/listings/listing-form";
import { requireSessionUser } from "@/lib/auth";
import { getPickupSpots } from "@/lib/listings";

export const metadata: Metadata = {
  title: "Sell an item · Nitte Mart",
};

export default async function NewListingPage() {
  const user = await requireSessionUser();
  const pickupSpots = await getPickupSpots();

  return (
    <div className="flex-1 bg-canvas text-ink">
      <main className="mx-auto w-full max-w-2xl px-6 py-8">
        <Link href="/listings" className="text-sm font-medium text-ink underline">
          ← Back to browse
        </Link>

        <h1 className="mt-3 text-[28px] leading-[1.43] font-bold">Sell an item</h1>
        <p className="mt-1 mb-6 text-base text-ink-muted">
          It goes live for everyone on campus as soon as you publish.
        </p>

        <ListingForm userId={user.id} pickupSpots={pickupSpots} />
      </main>
    </div>
  );
}
