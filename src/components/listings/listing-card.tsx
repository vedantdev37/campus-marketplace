import Image from "next/image";
import Link from "next/link";

import { SaveButton } from "@/components/listings/save-button";
import { dealMeter } from "@/lib/deal-meter";
import { closedLabel, metaLine, priceLine, TYPE_BADGE_CLASS } from "@/lib/listing-display";
import { listingImageUrl } from "@/lib/storage";
import { TYPE_INFO, type Listing, type ListingType } from "@/lib/types/listing";

/** The word and colour that say what kind of post this is. */
export function TypeBadge({ type, className = "" }: { type: ListingType; className?: string }) {
  return (
    <span
      className={[
        "rounded-[3px] px-1.5 py-1 text-[11px] leading-none font-bold tracking-wide text-white uppercase",
        TYPE_BADGE_CLASS[type],
        className,
      ].join(" ")}
    >
      {TYPE_INFO[type].badge}
    </span>
  );
}

/**
 * One post in a grid, whatever kind it is. DESIGN.md `polaroid-card`: a pale
 * photo-print frame with a square picture and a handwritten caption.
 *
 * WHAT KIND OF POST IT IS
 * A badge on the photo, in the top-left, with the word (SALE, RENT, FREE...).
 * The colour differs per kind but the word is always there.
 *
 * A FINISHED POST is marked four ways at once, and only one of them is colour:
 *
 *   - a stamp across the photo (SOLD, RENTED OUT, CLAIMED, TEAM FULL)
 *   - the same word beside the price line
 *   - the price line struck through
 *   - the photo desaturated
 *
 * SOLD is the loud one - yellow, with "Mission passed" under it. The other
 * end states use the quieter ink stamp, so a page of mixed posts has one kind
 * of shouting, not four.
 *
 * The frame is pale in both themes, so the text on it uses fixed dark colours
 * and not theme tokens: a caption must not turn white on a white print.
 */
export function ListingCard({
  listing,
  saved,
}: {
  listing: Listing;
  /**
   * Whether the viewer has saved this post. Leave it out to show no heart at
   * all - for a signed-out visitor, or on a list of your own posts.
   */
  saved?: boolean;
}) {
  const isClosed = listing.status === "sold";

  // The deal meter needs a price when new. Cards drawn from the public home
  // page functions do not carry one, so they show no verdict - except a free
  // item, which needs no arithmetic.
  const deal = isClosed
    ? null
    : dealMeter({
        type: listing.type,
        price: listing.price,
        originalPrice: listing.original_price,
        condition: listing.condition,
        category: listing.category,
      });
  const imageUrl = listingImageUrl(listing.image_path);
  const closed = closedLabel(listing.type);
  const price = priceLine(listing);
  const meta = metaLine(listing);

  return (
    // The heart is a sibling of the link, laid over the photo: the whole card
    // is one link, and a button cannot live inside a link.
    <div className="relative flex flex-1 flex-col">
    <Link
      href={`/listings/${listing.id}`}
      // Spelled out, so it begins with the state and reads in a sensible order.
      aria-label={`${isClosed ? `${closed}: ` : ""}${TYPE_INFO[listing.type].badge}: ${listing.title}, ${price}`}
      className="polaroid group flex flex-1 flex-col rounded-[4px] bg-polaroid p-1.5 pb-2.5 shadow-float motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-0.5"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-[2px] bg-[#dedad0]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            // Two columns on phones, three or four above - telling the browser
            // this stops it downloading a full-width image for a narrow slot.
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 300px"
            className={[
              "object-cover motion-safe:transition-[filter] motion-safe:duration-300",
              isClosed ? "grayscale" : "",
            ].join(" ")}
          />
        ) : (
          // A skill or a call for teammates may have no photo. The tags stand
          // in for it, so the square is never an empty grey box.
          <div
            className={[
              "flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center",
              isClosed ? "bg-[#6b6976]" : TYPE_BADGE_CLASS[listing.type],
            ].join(" ")}
          >
            {listing.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="max-w-full truncate rounded-full bg-black/25 px-2.5 py-1 text-xs font-semibold text-white"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <TypeBadge type={listing.type} className="absolute top-1.5 left-1.5" />

        {isClosed ? (
          // Hidden from assistive technology: the link's name already begins
          // with the state.
          <span
            aria-hidden="true"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/35"
          >
            <span
              className={[
                "sold-stamp title-card -rotate-6 border-2 px-2.5 pt-1.5 pb-1 text-center",
                listing.type === "sale"
                  ? "border-on-accent bg-accent text-[26px] text-on-accent md:text-[32px]"
                  : "border-white bg-[#12111c] text-[18px] text-white md:text-[22px]",
              ].join(" ")}
            >
              {closed}
              {listing.type === "sale" ? (
                <span className="block font-sans text-[10px] leading-tight font-bold tracking-[0.1em] normal-case">
                  Mission passed
                </span>
              ) : null}
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 px-1 pt-2 text-[#12111c]">
        <h3 className="caption-hand line-clamp-2 text-[16px] leading-tight font-bold">
          {listing.title}
        </h3>

        {/* Prices stay in the body face: a handwriting font is for the
            caption, and a number someone will pay must be unmistakable. */}
        {/* Price on the left, verdict on the right, on one line: a card with a
            verdict is then no taller than one without, and prices in a row
            stay level. */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-1">
          <p className="text-[14px] leading-tight font-extrabold tabular-nums">
            <span className={isClosed ? "font-semibold text-[#55535f] line-through" : ""}>{price}</span>
            {isClosed ? <span className="ml-1.5">{closed}</span> : null}
          </p>

          {deal ? (
            // The verdict is the word. The mark repeats it as a shape; no
            // colour is involved, so it reads the same in greyscale.
            <p className="rounded-full border border-[#12111c] px-2 py-0.5 text-[11px] leading-tight font-bold whitespace-nowrap">
              <span aria-hidden="true">{deal.mark} </span>
              {deal.label}
            </p>
          ) : null}
        </div>

        {meta ? <p className="truncate text-[12px] leading-tight text-[#55535f]">{meta}</p> : null}
      </div>
    </Link>

    {saved === undefined ? null : (
      <SaveButton listingId={listing.id} initialSaved={saved} className="absolute top-1 right-1" />
    )}
    </div>
  );
}
