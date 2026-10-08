import { redirect } from "next/navigation";

/** The old address of the sell form. Posting now starts at /post. */
export default function OldNewListingPage() {
  redirect("/post?type=sale");
}
