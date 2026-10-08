import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ListingForm } from "@/components/listings/listing-form";
import { requireSessionUser } from "@/lib/auth";
import { isUuid } from "@/lib/uuid";
import { getListing, getPickupSpots } from "@/lib/listings";

export const metadata: Metadata = {
  title: "Edit listing · Campus Marketplace",
};

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser();
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const [listing, pickupSpots] = await Promise.all([getListing(id), getPickupSpots()]);

  // Someone else's listing gets the same 404 as one that does not exist, rather
  // than a "forbidden" page: the edit form for a listing you do not own is not
  // a thing that exists, and a distinct response would only confirm the id is
  // real. This is the page-level check; updateListingAction re-checks, and RLS
  // refuses the write regardless.
  if (!listing || listing.seller_id !== user.id) {
    notFound();
  }

  return (
    <div className="flex-1 bg-canvas text-ink">
      <main className="mx-auto w-full max-w-2xl px-6 py-8">
        <Link href={`/listings/${listing.id}`} className="text-sm font-medium text-ink underline">
          ← Back to listing
        </Link>

        <h1 className="mt-3 mb-6 text-[28px] leading-[1.43] font-bold">Edit listing</h1>

        <ListingForm userId={user.id} pickupSpots={pickupSpots} listing={listing} />
      </main>
    </div>
  );
}
