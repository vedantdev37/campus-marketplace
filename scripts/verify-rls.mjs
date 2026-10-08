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
 * Run it after `npm run seed:demo`. It makes no changes to the database: every
 * write it attempts is expected to be rejected.
 *
 * The one thing it does write is a small local file, src/lib/security-run.json,
 * recording how the run went and when. The home page and the /security page
 * show that file, so the "tests passed" figure on the site is whatever this
 * script last measured - never a number typed into the page.
 */

import { writeFileSync } from "node:fs";

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
let skipped = 0;

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
    .eq("type", "sale")
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

  // --- 5b. An owner cannot forge a post's timestamps ---------------------
  // Explore and the public home page are ordered by created_at, and the home
  // page shows the most recently sold item. Both columns are set by triggers
  // (migration 0011), whatever a request says. These are the seller's own
  // rows, so RLS allows the writes: what must hold is that they change nothing.
  {
    const before = await seller
      .from("listings")
      .select("created_at, sold_at")
      .eq("id", target.id)
      .single();

    await seller.from("listings").update({ created_at: "2099-01-01T00:00:00Z" }).eq("id", target.id);

    const after = await seller
      .from("listings")
      .select("created_at, sold_at")
      .eq("id", target.id)
      .single();

    check(
      "an owner cannot move their post to the top by forging created_at",
      after.data?.created_at === before.data?.created_at,
      `created_at is now ${after.data?.created_at}`,
    );

    const { data: sold } = await seller
      .from("listings")
      .select("id, sold_at")
      .eq("seller_id", sellerId)
      .eq("status", "sold")
      .limit(1);

    if (sold?.[0]) {
      await seller.from("listings").update({ sold_at: "2099-01-01T00:00:00Z" }).eq("id", sold[0].id);

      const { data: soldAfter } = await seller
        .from("listings")
        .select("sold_at")
        .eq("id", sold[0].id)
        .single();

      check(
        "an owner cannot forge sold_at on a sold post",
        soldAfter?.sold_at === sold[0].sold_at,
        `sold_at is now ${soldAfter?.sold_at}`,
      );
    }
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

  // --- 6b. Nobody can write to someone else's wishlist ------------------
  // The seed gives the buyer one saved post. The seller tries to add a row in
  // the buyer's name, and then to remove the buyer's row.
  {
    const forged = await seller
      .from("wishlist_items")
      .insert({ user_id: buyerId, listing_id: target.id })
      .select("listing_id");

    check(
      "seller cannot add to the buyer's wishlist",
      Boolean(forged.error) || (forged.data?.length ?? 0) === 0,
      "the row was accepted",
    );

    const removed = await seller
      .from("wishlist_items")
      .delete()
      .eq("user_id", buyerId)
      .select("listing_id");

    check(
      "seller cannot remove items from the buyer's wishlist",
      !removed.error && (removed.data?.length ?? 0) === 0,
      removed.error ? `unexpected error: ${removed.error.message}` : `rows removed: ${removed.data?.length}`,
    );

    const { count } = await buyer
      .from("wishlist_items")
      .select("listing_id", { count: "exact", head: true })
      .eq("user_id", buyerId);

    check(
      "the buyer's wishlist still has its saved item afterwards",
      (count ?? 0) >= 1,
      `items left: ${count}`,
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

  // --- Chat: a conversation belongs to its buyer and seller only ---------
  // Uses the conversation that `seed:demo` creates between the buyer and the
  // seller. The attacker is a third signed-in account that is in neither role.
  {
    const outsiderPassword = process.env.DEMO_OUTSIDER_PASSWORD;

    if (!outsiderPassword) {
      console.error("DEMO_OUTSIDER_PASSWORD missing from .env.local.");
      process.exit(1);
    }

    const outsider = await signIn("outsider@reviewer.test", outsiderPassword);

    const { data: conversations } = await buyer
      .from("conversations")
      .select("id, listing_id, buyer_last_read_at, seller_last_read_at")
      .eq("buyer_id", buyerId)
      .eq("seller_id", sellerId)
      .limit(1);

    const conversation = conversations?.[0];

    if (!conversation) {
      console.error("\nNo demo conversation found. Run `npm run seed:demo` first.");
      process.exit(1);
    }

    const countMessages = async () => {
      const { count } = await buyer
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversation.id);
      return count ?? 0;
    };

    const messagesBefore = await countMessages();

    const { data: ownMessages } = await buyer
      .from("messages")
      .select("id")
      .eq("conversation_id", conversation.id)
      .eq("sender_id", buyerId)
      .limit(1);
    const ownMessageId = ownMessages?.[0]?.id;

    const { data: spots } = await buyer.from("pickup_spots").select("id").limit(1);
    const spotId = spots?.[0]?.id;

    /** A campus-time instant `days` from now, at the given hour. */
    const campusTime = (days, hour) => {
      const day = new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });
      return `${day}T${hour}:00:00+05:30`;
    };

    console.log(`\nChat: ${messagesBefore} messages in the buyer-seller conversation\n`);

    // -- Reading ---------------------------------------------------------
    for (const [table, column] of [
      ["conversations", "id"],
      ["messages", "conversation_id"],
      ["meetups", "conversation_id"],
    ]) {
      const { data, error } = await outsider.from(table).select("id").eq(column, conversation.id);

      check(
        `a third user cannot read ${table} of someone else's conversation`,
        !error && (data?.length ?? 0) === 0,
        error ? `unexpected error: ${error.message}` : `rows visible: ${data?.length}`,
      );
    }

    {
      const { data, error } = await outsider.rpc("my_inbox");

      check(
        "a third user's inbox does not list the conversation",
        !error && !(data ?? []).some((row) => row.conversation_id === conversation.id),
        error ? `unexpected error: ${error.message}` : "the conversation was listed",
      );
    }

    {
      const anon = newClient();
      const { data, error } = await anon.from("messages").select("id").limit(1);

      check(
        "signed-out requests cannot read messages",
        Boolean(error) || (data?.length ?? 0) === 0,
        !error && (data?.length ?? 0) > 0 ? "messages were readable without a session" : undefined,
      );
    }

    // -- Writing as the third user ----------------------------------------
    {
      const { error } = await outsider
        .from("messages")
        .insert({ conversation_id: conversation.id, body: "verify-rls: this must be refused" });

      check(
        "a third user cannot post in someone else's conversation",
        Boolean(error),
        error ? undefined : "THE MESSAGE WAS ACCEPTED and cannot be deleted through the API",
      );
    }

    {
      const { error } = await outsider.rpc("propose_meetup", {
        p_conversation_id: conversation.id,
        p_pickup_spot_id: spotId,
        p_meet_at: campusTime(3, "15"),
      });

      check(
        "a third user cannot propose a meetup in someone else's conversation",
        error?.message === "not_participant",
        error ? `refused, but for another reason: ${error.message}` : "the proposal was accepted",
      );
    }

    {
      await outsider.rpc("mark_conversation_read", { p_conversation_id: conversation.id });

      const { data } = await buyer
        .from("conversations")
        .select("buyer_last_read_at, seller_last_read_at")
        .eq("id", conversation.id)
        .single();

      check(
        "a third user cannot mark someone else's conversation as read",
        data?.buyer_last_read_at === conversation.buyer_last_read_at &&
          data?.seller_last_read_at === conversation.seller_last_read_at,
        "a read marker moved",
      );
    }

    // -- Participants cannot cheat either ---------------------------------
    {
      const { error } = await buyer
        .from("messages")
        .insert({ conversation_id: conversation.id, body: "verify-rls: forged", sender_id: sellerId });

      check(
        "a participant cannot post a message as the other person",
        Boolean(error),
        error ? undefined : "THE FORGED MESSAGE WAS ACCEPTED",
      );
    }

    {
      const { error } = await buyer.from("messages").insert({
        conversation_id: conversation.id,
        body: "verify-rls: fake system message",
        kind: "meetup_accepted",
      });

      check(
        "a participant cannot post a fake meetup event",
        Boolean(error),
        error ? undefined : "THE FAKE EVENT WAS ACCEPTED",
      );
    }

    if (ownMessageId) {
      const edit = await buyer
        .from("messages")
        .update({ body: "verify-rls: edited" })
        .eq("id", ownMessageId)
        .select("id");

      check(
        "a sent message cannot be edited",
        Boolean(edit.error) || (edit.data?.length ?? 0) === 0,
        "the edit was accepted",
      );

      const removal = await buyer.from("messages").delete().eq("id", ownMessageId).select("id");

      check(
        "a sent message cannot be deleted",
        Boolean(removal.error) || (removal.data?.length ?? 0) === 0,
        "the delete was accepted",
      );
    }

    for (const [description, body] of [
      ["a 1001-character message is rejected", "x".repeat(1001)],
      ["a whitespace-only message is rejected", "   \n  "],
    ]) {
      const { error } = await buyer
        .from("messages")
        .insert({ conversation_id: conversation.id, body });

      check(description, Boolean(error), error ? undefined : "the message was accepted");
    }

    {
      const { error } = await seller.rpc("start_conversation", {
        p_listing_id: target.id,
        p_body: "verify-rls: talking to myself",
      });

      check(
        "a seller cannot start a conversation about their own listing",
        error?.message === "own_listing",
        error ? `refused, but for another reason: ${error.message}` : "the conversation was created",
      );
    }

    {
      const { error } = await outsider
        .from("conversations")
        .insert({ listing_id: target.id, buyer_id: buyerId, seller_id: sellerId });

      check(
        "a conversation cannot be inserted directly, on anyone's behalf",
        Boolean(error),
        error ? undefined : "the row was accepted",
      );
    }

    // -- Meetups ----------------------------------------------------------
    {
      const { error } = await buyer.from("meetups").insert({
        conversation_id: conversation.id,
        proposed_by: sellerId,
        pickup_spot_id: spotId,
        meet_at: campusTime(3, "15"),
        status: "accepted",
      });

      check(
        "a meetup cannot be inserted directly as already accepted",
        Boolean(error),
        error ? undefined : "the row was accepted",
      );
    }

    {
      const { data, error } = await buyer
        .from("meetups")
        .update({ status: "accepted" })
        .eq("conversation_id", conversation.id)
        .select("id");

      check(
        "a meetup's status cannot be changed directly",
        Boolean(error) || (data?.length ?? 0) === 0,
        "the update was accepted",
      );
    }

    for (const [description, meetAt, reason] of [
      ["a meetup in the past is rejected", campusTime(-1, "15"), "meetup_in_past"],
      ["a meetup at 3 am campus time is rejected", campusTime(3, "03"), "meetup_outside_hours"],
      ["a meetup a year away is rejected", campusTime(365, "15"), "meetup_too_far"],
    ]) {
      const { error } = await buyer.rpc("propose_meetup", {
        p_conversation_id: conversation.id,
        p_pickup_spot_id: spotId,
        p_meet_at: meetAt,
      });

      check(
        description,
        error?.message === reason,
        error ? `refused, but for another reason: ${error.message}` : "the proposal was accepted",
      );
    }

    {
      // Needs a proposal that is still pending, which `reseed:demo` leaves in
      // place. Once someone has accepted it in the app there is nothing to
      // attack, and proposing one here would write to the demo conversation.
      const { data: pending } = await buyer
        .from("meetups")
        .select("id, proposed_by")
        .eq("conversation_id", conversation.id)
        .eq("status", "proposed")
        .maybeSingle();

      if (pending) {
        const proposer = pending.proposed_by === buyerId ? buyer : seller;
        const { error } = await proposer.rpc("accept_meetup", { p_meetup_id: pending.id });

        check(
          "the person who proposed a meetup cannot accept it themselves",
          error?.message === "meetup_not_acceptable",
          error ? `refused, but for another reason: ${error.message}` : "the proposal was accepted",
        );

        const outsiderAccept = await outsider.rpc("accept_meetup", { p_meetup_id: pending.id });

        check(
          "a third user cannot accept someone else's meetup",
          outsiderAccept.error?.message === "meetup_not_acceptable",
          outsiderAccept.error ? undefined : "the proposal was accepted",
        );
      } else {
        skipped += 2;
        console.log("  SKIP  self-accept checks: no pending proposal (run `npm run reseed:demo`)");
      }
    }

    {
      const messagesAfter = await countMessages();

      check(
        "the conversation has exactly the messages it started with",
        messagesAfter === messagesBefore,
        `before: ${messagesBefore}, after: ${messagesAfter}`,
      );
    }
  }

  // --- Six kinds of post: closing them, and the rules per type -----------
  // A rental, a giveaway and a found item are rows in the same table as a
  // sale (migration 0010). "Returned" and "claimed" are the owner changing
  // `status`, so the question is the same one as for a sale: can anyone else?
  {
    const outsiderPassword = process.env.DEMO_OUTSIDER_PASSWORD;
    const outsider = await signIn("outsider@reviewer.test", outsiderPassword);

    const { data: posts } = await buyer
      .from("listings")
      .select("id, type, status, title")
      .eq("seller_id", sellerId)
      .eq("status", "available")
      .in("type", ["rent", "lost_found", "free", "team_request"]);

    const byType = Object.fromEntries((posts ?? []).map((post) => [post.type, post]));

    for (const [type, description] of [
      ["rent", "a non-owner cannot mark someone else's rental as rented out or returned"],
      ["lost_found", "a non-owner cannot mark someone else's found item as claimed"],
      ["free", "a non-owner cannot mark someone else's giveaway as claimed"],
      ["team_request", "a non-owner cannot close someone else's team request"],
    ]) {
      const post = byType[type];

      if (!post) {
        skipped += 1;
        console.log(`  SKIP  ${description}: no seeded ${type} post (run \`npm run reseed:demo\`)`);
        continue;
      }

      const { data, error } = await outsider
        .from("listings")
        .update({ status: "sold" })
        .eq("id", post.id)
        .select("id");

      check(
        description,
        !error && (data?.length ?? 0) === 0,
        error ? `unexpected error: ${error.message}` : `rows affected: ${data?.length}`,
      );
    }

    if (byType.free) {
      const { data, error } = await seller
        .from("listings")
        .update({ type: "sale", price: 500 })
        .eq("id", byType.free.id)
        .select("id");

      check(
        "an owner cannot turn a FREE post into a sale after posting it",
        Boolean(error) || (data?.length ?? 0) === 0,
        "the type change was accepted",
      );
    }

    // The seller's OWN rows, so RLS allows the insert. What must stop these
    // is the per-type CHECK constraints: the app's validation is skipped by a
    // request made straight to the API.
    const base = {
      seller_id: sellerId,
      title: "verify-rls probe",
      description: "Inserted by verify-rls and expected to be rejected.",
    };

    for (const [description, row] of [
      ["a FREE post with a price on it is rejected", { ...base, type: "free", price: 250 }],
      ["a sale with a found-on date is rejected", { ...base, type: "sale", price: 10, found_on: "2026-01-01" }],
      ["a rental with no maximum days is rejected", { ...base, type: "rent", price: 30 }],
      ["a rental for 365 days is rejected", { ...base, type: "rent", price: 30, rent_max_days: 365 }],
      ["a post of a made-up type is rejected", { ...base, type: "auction", price: 10 }],
      ["an upper-case tag is rejected", { ...base, type: "skill_offer", price: 0, tags: ["React"] }],
      ["nine tags are rejected", { ...base, type: "team_request", price: 0, tags: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] }],
      ["tags on a sale are rejected", { ...base, type: "sale", price: 10, tags: ["react"] }],
    ]) {
      const { data, error } = await seller.from("listings").insert(row).select("id");

      check(description, Boolean(error), error ? undefined : "the row was accepted");

      if (!error && data?.[0]?.id) {
        await seller.from("listings").delete().eq("id", data[0].id);
      }
    }

    // -- Profiles: only your own, and only the columns meant to be edited ----
    {
      const { data, error } = await outsider
        .from("profiles")
        .update({ bio: "verify-rls: defaced" })
        .eq("id", sellerId)
        .select("id");

      check(
        "a user cannot edit someone else's profile",
        !error && (data?.length ?? 0) === 0,
        error ? `unexpected error: ${error.message}` : `rows affected: ${data?.length}`,
      );
    }

    for (const [description, change] of [
      ["a GitHub field holding a javascript: URL is rejected", { github_username: "javascript:alert(1)" }],
      ["a profile photo in another user's folder is rejected", { avatar_path: `${sellerId}/stolen.webp` }],
      ["a profile cannot change its own created_at", { created_at: "2000-01-01T00:00:00Z" }],
      ["an upper-case skill is rejected", { skills: ["React"] }],
    ]) {
      const { error } = await outsider
        .from("profiles")
        .update(change)
        .eq("id", (await outsider.auth.getUser()).data.user.id)
        .select("id");

      check(description, Boolean(error), error ? undefined : "the change was accepted");
    }

    // -- Squad up chats are as private as any other ---------------------------
    // A conversation about a team request is a row in the same tables as one
    // about a sale, so the same policies should cover it. This checks that
    // they do, against the one the seed creates.
    {
      const { data: teamChats } = await buyer
        .from("conversations")
        .select("id, listing:listings!conversations_listing_id_fkey(type)")
        .eq("buyer_id", buyerId);

      const teamChat = (teamChats ?? []).find((chat) => chat.listing?.type === "team_request");

      if (teamChat) {
        const messages = await outsider.from("messages").select("id").eq("conversation_id", teamChat.id);

        check(
          "a third user cannot read a Squad up conversation",
          !messages.error && (messages.data?.length ?? 0) === 0,
          messages.error ? `unexpected error: ${messages.error.message}` : `rows visible: ${messages.data?.length}`,
        );

        const post = await outsider
          .from("messages")
          .insert({ conversation_id: teamChat.id, body: "verify-rls: this must be refused" });

        check(
          "a third user cannot post in a Squad up conversation",
          Boolean(post.error),
          post.error ? undefined : "THE MESSAGE WAS ACCEPTED and cannot be deleted through the API",
        );
      } else {
        skipped += 2;
        console.log("  SKIP  Squad up chat checks: no seeded team conversation (run `npm run reseed:demo`)");
      }
    }

    // -- A closed post takes no new conversations ----------------------------
    {
      const { data: closedPosts } = await buyer
        .from("listings")
        .select("id")
        .eq("seller_id", sellerId)
        .eq("status", "sold")
        .limit(1);

      if (closedPosts?.[0]) {
        const { error } = await outsider.rpc("start_conversation", {
          p_listing_id: closedPosts[0].id,
          p_body: "verify-rls: is this still available?",
        });

        check(
          "a finished post refuses a new conversation",
          error?.message === "listing_sold",
          error ? `refused, but for another reason: ${error.message}` : "the conversation was created",
        );
      }
    }
  }

  // --- The public home page functions give away only what a card shows ----
  // Migration 0009 lets a signed-out visitor call three functions. These are
  // the opposite kind of check: the calls must SUCCEED, and what comes back
  // must contain nothing beyond the fields listed in that migration.
  {
    const anon = newClient();

    const onlyKeys = (rows, allowed) =>
      Array.isArray(rows) &&
      rows.length > 0 &&
      rows.every((row) => Object.keys(row).every((key) => allowed.includes(key)));

    {
      const { data, error } = await anon.rpc("home_listing_teasers");

      check(
        "home page teasers carry card fields only: no seller, no description",
        !error &&
          onlyKeys(data, [
            "id", "title", "price", "category", "condition", "status",
            "image_path", "course_code", "pickup_spot_name",
          ]),
        error ? `the call failed: ${error.message}` : `keys: ${Object.keys(data?.[0] ?? {})}`,
      );
    }

    {
      const { data, error } = await anon.rpc("home_sections");

      check(
        "home page sections carry card fields only: no poster, no description",
        !error &&
          onlyKeys(data, [
            "id", "type", "title", "price", "image_path", "pickup_spot_name",
            "tags", "rent_max_days", "found_on", "event_name", "event_date",
          ]),
        error ? `the call failed: ${error.message}` : `keys: ${Object.keys(data?.[0] ?? {})}`,
      );
    }

    {
      const { data, error } = await anon.rpc("public_stats");
      const row = Array.isArray(data) ? data[0] : data;

      check(
        "public stats are whole numbers and nothing else",
        !error && row && Object.values(row).every((value) => Number.isInteger(value)),
        error ? `the call failed: ${error.message}` : JSON.stringify(row),
      );
    }

    {
      const { data, error } = await anon.rpc("public_pickup_spots");

      check(
        "public pickup spots are names and descriptions only",
        !error && onlyKeys(data, ["name", "description"]),
        error ? `the call failed: ${error.message}` : `keys: ${Object.keys(data?.[0] ?? {})}`,
      );
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

  console.log(`\n${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ""}\n`);

  // Recorded whatever the outcome: a failing run is written down as failing.
  writeFileSync(
    new URL("../src/lib/security-run.json", import.meta.url),
    `${JSON.stringify({ passed, failed, skipped, total: passed + failed + skipped, ranAt: new Date().toISOString() }, null, 2)}\n`,
  );

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("\nUnexpected error:", error.message ?? error);
  process.exit(1);
});
