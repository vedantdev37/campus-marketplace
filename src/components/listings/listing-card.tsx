import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "@/lib/pricing";
import { listingImageUrl } from "@/lib/storage";
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  type Listing,
} from "@/lib/types/listing";

/**
 * One listing in a grid.
 *
 * Sold listings are made distinct three ways at once, not one: the photo is
 * desaturated, the whole card is dimmed, and a SOLD pill sits over the image.
 * Relying on dimming alone would fail for anyone who cannot perceive the
 * contrast difference, so the pill carries the same information as text.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const isSold = listing.status === "sold";
  const imageUrl = listingImageUrl(listing.image_path);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={[
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-shadow hover:shadow-md",
        // When a listing sells while someone is looking, the change fades in
        // rather than snapping - unless they have asked for reduced motion.
        "motion-safe:transition-opacity motion-safe:duration-300",
        isSold ? "opacity-70" : "",
      ].join(" ")}
    >
      <div className="relative aspect-4/3 w-full bg-surface-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={listing.title}
            fill
            // Two columns on phones, three from `sm` up - telling the browser
            // this avoids it downloading a full-width image for a third-width slot.
            sizes="(max-width: 640px) 50vw, 33vw"
            // A book cover is portrait: cropped to this 4:3 frame it loses its
            // title, so books are fitted inside the frame rather than filling it.
            className={[
              listing.category === "books" ? "object-contain" : "object-cover",
              "motion-safe:transition-[filter] motion-safe:duration-300",
              isSold ? "grayscale" : "",
            ].join(" ")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            {CATEGORY_LABELS[listing.category]}
          </div>
        )}

        {isSold ? (
          <span className="absolute top-2 left-2 rounded-full bg-foreground/85 px-2 py-0.5 text-xs font-semibold tracking-wide text-background uppercase">
            Sold
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium">{listing.title}</h3>

        <p className="text-base font-semibold">{formatPrice(listing.price)}</p>

        <p className="mt-auto text-xs text-muted">
          {CONDITION_LABELS[listing.condition]}
          {listing.pickup_spot ? ` · ${listing.pickup_spot.name}` : ""}
        </p>

        {listing.course_code ? (
          <span className="mt-1 w-fit rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-muted">
            {listing.course_code}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
