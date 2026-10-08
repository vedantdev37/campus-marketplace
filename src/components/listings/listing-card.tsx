import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "@/lib/pricing";
import { listingImageUrl } from "@/lib/storage";
import { CATEGORY_LABELS, CONDITION_LABELS, type Listing } from "@/lib/types/listing";

/**
 * One listing in a grid. DESIGN.md `listing-card`: no border or shadow, a
 * rounded photo, then title, meta and price as plain text beneath it.
 *
 * SOLD listings are marked four ways at once, and only one of them is colour:
 *
 *   - a SOLD pill over the photo (text)
 *   - the word "Sold" beside the price (text)
 *   - the price struck through (shape)
 *   - the photo desaturated (colour)
 *
 * Desaturation alone would be invisible to someone who cannot perceive it, and
 * meaningless on a photo that was grey to begin with, so the label and the
 * strike-through carry the same information without it. The whole card is one
 * link, and its accessible name starts with "Sold" for the same reason.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const isSold = listing.status === "sold";
  const imageUrl = listingImageUrl(listing.image_path);

  return (
    <Link href={`/listings/${listing.id}`} className="group flex flex-col rounded-[14px]">
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-[14px] bg-surface-soft">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            // Two columns on phones, three or four above - telling the browser
            // this stops it downloading a full-width image for a narrow slot.
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 320px"
            className={[
              // A book cover is portrait: cropped to this frame it loses its
              // title, so books are fitted inside it rather than filling it.
              listing.category === "books" ? "object-contain" : "object-cover",
              // When a listing sells while someone is looking, the change fades
              // in rather than snapping - unless they asked for reduced motion.
              "motion-safe:transition-[filter,transform] motion-safe:duration-300",
              isSold ? "grayscale" : "motion-safe:group-hover:scale-[1.03]",
            ].join(" ")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">
            {CATEGORY_LABELS[listing.category]}
          </div>
        )}

        {isSold ? (
          <span className="absolute top-3 left-3 rounded-full bg-ink px-2.5 py-1 text-[11px] leading-none font-semibold tracking-wide text-canvas uppercase">
            Sold
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 pt-3">
        <h3
          className={[
            "line-clamp-2 text-base leading-snug font-semibold",
            isSold ? "text-ink-muted" : "text-ink",
          ].join(" ")}
        >
          {isSold ? <span className="sr-only">Sold: </span> : null}
          {listing.title}
        </h3>

        <p className="text-sm text-ink-muted">
          {CONDITION_LABELS[listing.condition]}
          {listing.pickup_spot ? ` · ${listing.pickup_spot.name}` : ""}
          {listing.course_code ? ` · ${listing.course_code}` : ""}
        </p>

        <p className="mt-1 text-base text-ink tabular-nums">
          <span className={isSold ? "text-ink-muted line-through" : "font-semibold"}>
            {formatPrice(listing.price)}
          </span>
          {isSold ? <span className="ml-2 font-semibold">Sold</span> : null}
        </p>
      </div>
    </Link>
  );
}
