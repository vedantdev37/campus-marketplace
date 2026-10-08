import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "@/lib/pricing";
import { listingImageUrl } from "@/lib/storage";
import { CATEGORY_LABELS, CONDITION_LABELS, type Listing } from "@/lib/types/listing";

/**
 * One listing in a grid. DESIGN.md `listing-card`: the photo is the card. It
 * is tall (4:5), the price sits on it, and the text beneath is two short lines.
 *
 * SOLD listings are marked four ways at once, and only one of them is colour:
 *
 *   - a SOLD stamp across the photo (text)
 *   - the word "Sold" beside the price (text)
 *   - the price struck through (shape)
 *   - the photo desaturated (colour)
 *
 * Desaturation alone would be invisible to someone who cannot perceive it, and
 * meaningless on a photo that was grey to begin with, so the stamp and the
 * strike-through carry the same information without it. The whole card is one
 * link, and its accessible name starts with "Sold" for the same reason.
 *
 * The stamp has the `sold-stamp` class. Inside a scroll-reveal container (the
 * home page) it wipes in; anywhere else it is simply there.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const isSold = listing.status === "sold";
  const imageUrl = listingImageUrl(listing.image_path);

  return (
    <Link
      href={`/listings/${listing.id}`}
      // Spelled out, so it begins with the status and reads in a sensible
      // order. Left to its contents, the name started with the price, because
      // the price pill comes before the title in the markup.
      aria-label={`${isSold ? "Sold: " : ""}${listing.title}, ${formatPrice(listing.price)}, ${CONDITION_LABELS[listing.condition]} condition`}
      className="group flex flex-col rounded-[14px]"
    >
      {/* The hairline gives the tile an edge on a band of the same colour. */}
      <div className="relative aspect-4/5 w-full overflow-hidden rounded-[14px] border border-hairline bg-surface-soft">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            // Two columns on phones, three or four above - telling the browser
            // this stops it downloading a full-width image for a narrow slot.
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 320px"
            className={[
              // Every photo fills the tile. Books used to be fitted inside it,
              // which suited the old 4:3 tile; in this portrait one a cover
              // loses almost nothing, and a letterboxed photo looked broken.
              "object-cover",
              // When a listing sells while someone is looking, the change fades
              // in rather than snapping - unless they asked for reduced motion.
              "motion-safe:transition-[filter,transform] motion-safe:duration-300",
              isSold ? "grayscale" : "motion-safe:group-hover:scale-[1.04]",
            ].join(" ")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">
            {CATEGORY_LABELS[listing.category]}
          </div>
        )}

        {isSold ? (
          // Centred, tilted, loud: the one place a card shouts. The dim layer
          // behind it keeps the stamp legible over any photograph.
          // Hidden from assistive technology: the link's name already begins
          // with "Sold", and hearing it three times helps nobody.
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/35">
            <span className="sold-stamp title-card -rotate-6 border-2 border-on-accent bg-accent px-3 pt-1.5 pb-1 text-[28px] text-on-accent md:text-[34px]">
              Sold
            </span>
          </span>
        ) : null}

        {/* The price rides on the photo. Its own solid plate, so it is
            readable whatever the photo looks like. */}
        <p className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-[15px] leading-none text-ink tabular-nums">
          <span className={isSold ? "text-ink-muted line-through" : "font-extrabold"}>
            {formatPrice(listing.price)}
          </span>
          {isSold ? <span className="font-bold">Sold</span> : null}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 pt-2.5">
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
      </div>
    </Link>
  );
}
