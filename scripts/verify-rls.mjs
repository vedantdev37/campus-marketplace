/**
 * Adversarial check on the security model.
 *
 *   npm run verify:rls
 *
 * Every assertion here is a thing that MUST FAIL. The UI hiding a button proves
 * nothing about the API, so this script skips the UI entirely and attacks the
 * public API directly as a signed-in non-owner - which is exactly what a
 * motivated user with the browser console open would do.
 *
 * Run it after `npm run seed:demo`. It makes no changes: every write it attempts
 * is expected to be rejected.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase env vars. Run via `npm run verify:rls`.");
  process.exit(1);
}

const SELLER_EMAIL = "seller@reviewer.test";
const BUYER_EMAIL = "buyer@reviewer.test";

/** Passwords that were committed to the public repo before being rotated. */
const BURNED_PASSWORD = "DemoSeller#2026";

let passed = 0;
let failed = 0;

function check(description, didHold, detail) {
  if (didHold) {
    passed += 1;
    console.log(`  PASS  ${description}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${description}`);
    if (detail) console.log(`        ${detail}`);
  }
}

function newClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email, password) {
  const supabase = newClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error(`\nCould not sign in as ${email}: ${error.message}`);
    console.error("Run `npm run seed:demo` first.");
    process.exit(1);
  }

  return supabase;
}

async function main() {
  console.log("\nVerifying Row Level Security\n");

  const sellerPassword = process.env.DEMO_SELLER_PASSWORD;
  const buyerPassword = process.env.DEMO_BUYER_PASSWORD;

  if (!sellerPassword || !buyerPassword) {
    console.error("DEMO_SELLER_PASSWORD / DEMO_BUYER_PASSWORD missing from .env.local.");
    process.exit(1);
  }

  // --- 1. The rotated-away password must no longer work ------------------
  {
    const supabase = newClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: SELLER_EMAIL,
      password: BURNED_PASSWORD,
    });

    check(
      "the password that leaked into git history is rejected",
      Boolean(error),
      error ? undefined : "SIGN-IN SUCCEEDED - rotate it with `npm run reseed:demo`",
    );
  }

  const seller = await signIn(SELLER_EMAIL, sellerPassword);
  const buyer = await signIn(BUYER_EMAIL, buyerPassword);

  const { data: sellerAuth } = await seller.auth.getUser();
  const { data: buyerAuth } = await buyer.auth.getUser();
  const sellerId = sellerAuth?.user?.id;
  const buyerId = buyerAuth?.user?.id;

  // A listing owned by the seller, read as the buyer (reads are permitted).
  const { data: targets } = await buyer
    .from("listings")
    .select("id, title, price, status, seller_id")
    .eq("seller_id", sellerId)
    .eq("status", "available")
    .limit(1);

  const target = targets?.[0];

  if (!target) {
    console.error("\nNo available seller listing found. Run `npm run seed:demo` first.");
    process.exit(1);
  }

  console.log(`\nTarget listing: "${target.title}" (owned by the seller)\n`);

  // --- 2. A non-owner must not be able to edit --------------------------
  {
    const { data, error } = await buyer
      .from("listings")
      .update({ price: 1 })
      .eq("id", target.id)
      .select("id");

    // RLS does not error on a blocked UPDATE - the row simply falls outside the
    // policy, so zero rows match and nothing changes. Checking only for an
    // error would wrongly report a pass, so the row count is what matters.
    check(
      "buyer cannot change another user's price",
      !error && (data?.length ?? 0) === 0,
      error ? `unexpected error: ${error.message}` : `rows affected: ${data?.length}`,
    );
  }

  // --- 3. A non-owner must not be able to mark it sold -------------------
  {
    const { data, error } = await buyer
      .from("listings")
      .update({ status: "sold" })
      .eq("id", target.id)
      .select("id");

    check(
      "buyer cannot mark another user's listing sold",
      !error && (data?.length ?? 0) === 0,
      error ? `unexpected error: ${error.message}` : `rows affected: ${data?.length}`,
    );
  }

  // --- 4. A non-owner must not be able to delete ------------------------
  {
    const { data, error } = await buyer
      .from("listings")
      .delete()
      .eq("id", target.id)
      .select("id");

    check(
      "buyer cannot delete another user's listing",
      !error && (data?.length ?? 0) === 0,
      error ? `unexpected error: ${error.message}` : `rows affected: ${data?.length}`,
    );
  }

  // --- 5. seller_id cannot be reassigned --------------------------------
  // The WITH CHECK half of the update policy exists for this: without it an
  // owner could hand their listing to someone else, or claim another's.
  {
    const { data, error } = await seller
      .from("listings")
      .update({ seller_id: buyerId })
      .eq("id", target.id)
      .select("id");

    check(
      "seller cannot reassign their listing to another user",
      Boolean(error) || (data?.length ?? 0) === 0,
      !error && (data?.length ?? 0) > 0 ? "the reassignment was accepted" : undefined,
    );
  }

  // --- 6. Wishlists are private ----------------------------------------
  {
    const { data, error } = await seller
      .from("wishlist_items")
      .select("listing_id")
      .eq("user_id", buyerId);

    check(
      "seller cannot read the buyer's wishlist",
      !error && (data?.length ?? 0) === 0,
      error ? `unexpected error: ${error.message}` : `rows visible: ${data?.length}`,
    );
  }

  // --- 7. The allowlist table must be unreachable -----------------------
  // RLS is on with no policies, so a signed-in user gets nothing.
  {
    const { data, error } = await buyer.from("signup_allowed_domains").select("domain");

    check(
      "signup_allowed_domains is not readable by a signed-in user",
      Boolean(error) || (data?.length ?? 0) === 0,
      !error && (data?.length ?? 0) > 0 ? "the allowlist was readable" : undefined,
    );
  }

  // --- 8. Browsing requires a session -----------------------------------
  {
    const anon = newClient();
    const { data, error } = await anon.from("listings").select("id").limit(1);

    check(
      "signed-out requests cannot read listings",
      Boolean(error) || (data?.length ?? 0) === 0,
      !error && (data?.length ?? 0) > 0 ? "listings were readable without a session" : undefined,
    );
  }

  // --- Checklist and photo rules hold for direct API writes --------------
  // These rows are the seller's OWN, so RLS allows the insert. What must stop
  // them is the trigger and constraints from migration 0006: the app's zod
  // validation is skipped entirely by a request made straight to the API.
  {
    const base = {
      seller_id: sellerId,
      title: "verify-rls probe",
      description: "Inserted by verify-rls and expected to be rejected.",
      price: 10,
      condition: "good",
    };

    const probes = [
      ["a checklist key from another category is rejected", { ...base, category: "books", condition_checks: { charger_included: true } }],
      ["a script-like string where a tick belongs is rejected", { ...base, category: "electronics", condition_checks: { battery_ok: "<script>alert(1)</script>" } }],
      ["a photo path in another user's folder is rejected", { ...base, category: "other", condition_checks: {}, image_path: `${buyerId}/stolen.png` }],
    ];

    for (const [description, row] of probes) {
      const { data, error } = await seller.from("listings").insert(row).select("id");

      check(description, Boolean(error), error ? undefined : "the row was accepted");

      // If one ever gets through, do not leave it behind.
      if (!error && data?.[0]?.id) {
        await seller.from("listings").delete().eq("id", data[0].id);
      }
    }
  }

  // --- 9. Nothing above actually changed anything -----------------------
  {
    const { data } = await buyer
      .from("listings")
      .select("price, status, seller_id")
      .eq("id", target.id)
      .single();

    const unchanged =
      Number(data?.price) === Number(target.price) &&
      data?.status === target.status &&
      data?.seller_id === target.seller_id;

    check(
      "the target listing is byte-for-byte unchanged after all attacks",
      unchanged,
      unchanged ? undefined : `now: ${JSON.stringify(data)}`,
    );
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("\nUnexpected error:", error.message ?? error);
  process.exit(1);
});
