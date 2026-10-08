import { redirect } from "next/navigation";

/** The old address of My Listings, which is now part of /me. */
export default function OldMyListingsPage() {
  redirect("/me");
}
