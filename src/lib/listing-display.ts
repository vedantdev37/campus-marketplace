import { formatCampusDay } from "@/lib/campus-time";
import { formatPrice } from "@/lib/pricing";
import { TYPE_INFO, type Listing, type ListingType } from "@/lib/types/listing";

/**
 * How a post of each kind describes itself in one short line: the thing a
 * price is for a sale. Used on cards, on the detail page and in link names, so
 * all three always say the same thing.
 */
export function priceLine(listing: Listing): string {
  switch (listing.type) {
    case "sale":
      return formatPrice(listing.price);
    case "rent":
      return `${formatPrice(listing.price)}/day`;
    case "free":
      return "FREE";
    case "lost_found":
      return listing.pickup_spot ? `Found at ${listing.pickup_spot.name}` : "Found on campus";
    case "skill_offer":
      return "Skill on offer";
    case "team_request":
      return listing.event_name ? `For ${listing.event_name}` : "Looking for teammates";
  }
}

/**
 * The same idea where only the type and the price are known (the inbox, a
 * chat's header): a price for a sale or a rental, and the kind of post for
 * everything else. A team request must never read as "0 rupees".
 */
export function shortPriceLine(type: ListingType, price: number): string {
  if (type === "sale") {
    return formatPrice(price);
  }

  return type === "rent" ? `${formatPrice(price)}/day` : TYPE_INFO[type].badge;
}

/** The second, quieter line under it. */
export function metaLine(listing: Listing): string {
  switch (listing.type) {
    case "rent":
      return listing.rent_max_days
        ? `Up to ${listing.rent_max_days} ${listing.rent_max_days === 1 ? "day" : "days"}`
        : "";
    case "lost_found":
      return listing.found_on ? `Found ${formatCampusDay(`${listing.found_on}T12:00:00+05:30`)}` : "";
    case "skill_offer":
    case "team_request":
      return [
        listing.event_date ? formatCampusDay(`${listing.event_date}T12:00:00+05:30`) : null,
        listing.tags.slice(0, 3).join(" · "),
      ]
        .filter(Boolean)
        .join(" · ");
    default:
      return listing.pickup_spot?.name ?? "";
  }
}

/** The label for a post that is finished: Sold, Rented out, Claimed, Team full. */
export function closedLabel(type: ListingType): string {
  return TYPE_INFO[type].closed;
}

/**
 * Badge colours, one per kind of post. Every badge also carries its word, so
 * the colour only helps the eye find a kind quickly and is never the only
 * thing that tells two kinds apart. White text on each is at least 4.5:1.
 * None of them is yellow: yellow stays for the primary action and SOLD.
 */
export const TYPE_BADGE_CLASS: Record<ListingType, string> = {
  sale: "bg-[#4338ca]",
  rent: "bg-[#0f766e]",
  free: "bg-[#15803d]",
  lost_found: "bg-[#c2410c]",
  skill_offer: "bg-[#be185d]",
  team_request: "bg-[#0369a1]",
};
