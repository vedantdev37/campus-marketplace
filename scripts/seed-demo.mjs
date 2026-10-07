/**
 * Seeds two demo accounts and some listings, so the app can be reviewed
 * without anyone having to create data by hand.
 *
 * Run it with:
 *   npm run seed:demo
 *
 * WHY IT USES THE PUBLISHABLE KEY
 * This script holds no special privilege. It signs in as an ordinary user and
 * writes through the same public API the browser uses, so every insert is
 * subject to Row Level Security. That makes a successful run meaningful: it
 * demonstrates the policies permit what they should. A service-role key would
 * bypass RLS and prove nothing - which is also why the project does not have
 * one.
 *
 * PREREQUISITES
 *   1. All migrations in supabase/migrations/ applied.
 *   2. The Before User Created hook enabled (otherwise sign-up is ungated).
 *   3. Email confirmation turned off, so sign-up returns a session directly.
 *
 * Safe to re-run: existing accounts are signed into rather than recreated, and
 * listings are only inserted if the seller has none.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.\n" +
      "Run via `npm run seed:demo`, which loads .env.local.",
  );
  process.exit(1);
}

/**
 * Published demo credentials on an RFC 2606 reserved domain that cannot receive
 * mail. Documented in the README. Not secrets.
 */
const SELLER = {
  email: "seller@reviewer.test",
  password: "DemoSeller#2026",
  fullName: "Ananya Rao",
};

const BUYER = {
  email: "buyer@reviewer.test",
  password: "DemoBuyer#2026",
  fullName: "Rohit Menon",
};

/** `pickupSpot` is matched by name against the seeded pickup_spots rows. */
const SELLER_LISTINGS = [
  {
    title: "Higher Engineering Mathematics - B.S. Grewal",
    description:
      "44th edition. Covers the full first-year syllabus. A few pencil marks in the calculus chapters, nothing torn. Collected it for Maths-II and no longer need it.",
    price: 320,
    category: "books",
    condition: "good",
    course_code: "21MA21",
    semester: 2,
    isbn: "9788193328491",
    book_author: "B.S. Grewal",
    original_price: 650,
    pickupSpot: "Central Library",
  },
  {
    title: "Data Structures and Algorithms in C++",
    description:
      "Second-hand but barely opened - I ended up using lecture notes instead. No highlighting anywhere. Ideal if you want a reference for the DSA lab.",
    price: 400,
    category: "books",
    condition: "like_new",
    course_code: "21CS32",
    semester: 3,
    isbn: "9780132847377",
    book_author: "Michael T. Goodrich",
    original_price: 899,
    pickupSpot: "Main Block Lobby",
  },
  {
    title: "Casio FX-991EX scientific calculator",
    description:
      "Allowed in exams, all functions working, battery replaced last month. Selling because I bought a graphing one. Comes with the slide cover.",
    price: 850,
    category: "electronics",
    condition: "good",
    pickupSpot: "Food Court",
  },
  {
    title: "Study table lamp, adjustable neck",
    description:
      "Warm white LED, three brightness levels, clamps to a desk edge. Used it through two semesters in the hostel. Clamp and cable both fine.",
    price: 450,
    category: "hostel",
    condition: "good",
    pickupSpot: "Boys' Hostel Gate",
  },
  {
    title: "Operating Systems handwritten notes, full syllabus",
    description:
      "Complete unit-wise notes with diagrams, the ones I revised from. Spiral bound, all five units, legible handwriting. Scored well off these.",
    price: 150,
    category: "notes",
    condition: "good",
    course_code: "21CS43",
    semester: 4,
    pickupSpot: "Central Library",
  },
  {
    title: "Folding study chair",
    description:
      "Metal frame with cushioned seat, folds flat for storage. One scuff on a leg, otherwise sturdy. Too bulky to take home at the end of the year.",
    price: 700,
    category: "furniture",
    condition: "fair",
    pickupSpot: "Girls' Hostel Gate",
  },
];

/** The listing marked sold, so reviewers can see the sold treatment. */
const SOLD_TITLE = "Folding study chair";

function fail(message, error) {
  console.error(`\n  FAILED: ${message}`);

  if (error) {
    console.error(`  ${error.message ?? error}`);

    // PGRST205 = table missing from the schema cache.
    if (error.code === "PGRST205" || /schema cache/i.test(error.message ?? "")) {
      console.error(
        "\n  It looks like the migrations have not been applied yet.\n" +
          "  Run supabase/migrations/0001..0005 in the Supabase SQL Editor first.",
      );
    }

    if (error.status === 403 || /not allowed/i.test(error.message ?? "")) {
      console.error(
        "\n  A 403 on sign-up usually means reviewer.test is missing from\n" +
          "  signup_allowed_domains - check that 0005_seed.sql ran.",
      );
    }
  }

  process.exit(1);
}

/** A fresh client per account: each one carries exactly one user's session. */
function newClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Signs up, or signs in if the account already exists. Returns a client. */
async function ensureAccount({ email, password, fullName }) {
  const supabase = newClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (!signUpError && signUpData.session) {
    console.log(`  created  ${email}`);
    return supabase;
  }

  const alreadyExists =
    signUpError?.code === "user_already_exists" ||
    signUpError?.code === "email_exists";

  if (signUpError && !alreadyExists) {
    fail(`could not sign up ${email}`, signUpError);
  }

  if (!signUpError && !signUpData.session) {
    fail(
      `signing up ${email} returned no session - email confirmation is still on. ` +
        "Turn off 'Confirm email' in Supabase -> Authentication -> Sign In / Providers -> Email.",
    );
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    fail(`account ${email} exists but the demo password did not work`, signInError);
  }

  console.log(`  existing ${email}`);
  return supabase;
}

async function main() {
  console.log("\nSeeding demo data\n");

  console.log("Accounts:");
  const sellerClient = await ensureAccount(SELLER);
  const buyerClient = await ensureAccount(BUYER);

  const { data: sellerAuth } = await sellerClient.auth.getUser();
  const sellerId = sellerAuth?.user?.id;

  if (!sellerId) {
    fail("could not read the seller's user id after signing in");
  }

  // --- Pickup spots -----------------------------------------------------
  const { data: spots, error: spotsError } = await sellerClient
    .from("pickup_spots")
    .select("id, name");

  if (spotsError) {
    fail("could not read pickup_spots", spotsError);
  }

  const spotIdByName = new Map((spots ?? []).map((spot) => [spot.name, spot.id]));
  console.log(`\nPickup spots: ${spotIdByName.size} found`);

  // --- Listings ---------------------------------------------------------
  const { count, error: countError } = await sellerClient
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", sellerId);

  if (countError) {
    fail("could not count the seller's existing listings", countError);
  }

  if ((count ?? 0) > 0) {
    console.log(`\nListings: seller already has ${count}, leaving them alone.`);
  } else {
    const rows = SELLER_LISTINGS.map(({ pickupSpot, ...listing }) => ({
      ...listing,
      seller_id: sellerId,
      pickup_spot_id: spotIdByName.get(pickupSpot) ?? null,
    }));

    const { data: inserted, error: insertError } = await sellerClient
      .from("listings")
      .insert(rows)
      .select("id, title");

    if (insertError) {
      fail("could not insert listings", insertError);
    }

    console.log(`\nListings: inserted ${inserted?.length ?? 0}`);

    // Marked sold via UPDATE rather than inserted as sold, so the
    // listings_before_update trigger fills in sold_at - the same path the app
    // takes when a seller marks something sold.
    const soldRow = inserted?.find((row) => row.title === SOLD_TITLE);

    if (soldRow) {
      const { error: soldError } = await sellerClient
        .from("listings")
        .update({ status: "sold" })
        .eq("id", soldRow.id);

      if (soldError) {
        fail("could not mark a listing sold", soldError);
      }

      console.log(`  marked sold: ${SOLD_TITLE}`);
    }
  }

  // --- Buyer wishlist ---------------------------------------------------
  const { data: buyerAuth } = await buyerClient.auth.getUser();
  const buyerId = buyerAuth?.user?.id;

  const { data: available, error: availableError } = await buyerClient
    .from("listings")
    .select("id, title")
    .eq("status", "available")
    .limit(1);

  if (availableError) {
    fail("could not read listings as the buyer", availableError);
  }

  if (buyerId && available?.length) {
    const { error: wishlistError } = await buyerClient
      .from("wishlist_items")
      .upsert(
        { user_id: buyerId, listing_id: available[0].id },
        { onConflict: "user_id,listing_id", ignoreDuplicates: true },
      );

    if (wishlistError) {
      fail("could not add a wishlist item", wishlistError);
    }

    console.log(`\nWishlist: buyer saved "${available[0].title}"`);
  }

  console.log("\nDone.\n");
  console.log("  Seller:  seller@reviewer.test / DemoSeller#2026");
  console.log("  Buyer:   buyer@reviewer.test  / DemoBuyer#2026\n");
}

main().catch((error) => fail("unexpected error", error));
