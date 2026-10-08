/**
 * Seeds three demo accounts, some listings and one conversation, so the app can
 * be reviewed without anyone having to create data by hand.
 *
 *   npm run seed:demo      # create accounts, insert listings if there are none
 *   npm run reseed:demo    # wipe the demo listings and wishlist, then re-insert
 *
 * Run `reseed:demo` right before submitting, so reviewers get clean data no
 * matter what was clicked during testing.
 *
 * WHY IT USES THE PUBLISHABLE KEY
 * This script holds no special privilege. It signs in as an ordinary user and
 * writes through the same public API the browser uses, so every statement is
 * subject to Row Level Security - including the deletes, which can only remove
 * rows the signed-in user owns. That makes a successful run meaningful: it
 * demonstrates the policies permit what they should. A service-role key would
 * bypass RLS and prove nothing, which is also why this project has none.
 *
 * WHERE THE PASSWORDS COME FROM
 * DEMO_SELLER_PASSWORD, DEMO_BUYER_PASSWORD and DEMO_OUTSIDER_PASSWORD in
 * .env.local, which is gitignored. They are deliberately NOT in this file: it lives in a public
 * repo, so a literal here would be as exposed as one in the README.
 *
 * PREREQUISITES
 *   1. All migrations in supabase/migrations/ applied.
 *   2. The Before User Created hook enabled.
 *   3. Email confirmation turned off, so sign-up returns a session directly.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { renderDemoImage } from "./demo-images.mjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const RESET = process.argv.includes("--reset");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.\n" +
      "Run via `npm run seed:demo`, which loads .env.local.",
  );
  process.exit(1);
}

/**
 * The passwords these accounts were originally created with, before they were
 * moved into the environment.
 *
 * They were committed to a public repo, so they must be treated as known to
 * anyone. They are kept here for exactly one purpose: signing in once to rotate
 * the password to the environment value. After the first run they stop working,
 * and this constant becomes dead weight that can be deleted.
 */
const BURNED_PASSWORDS = {
  "seller@reviewer.test": "DemoSeller#2026",
  "buyer@reviewer.test": "DemoBuyer#2026",
};

const SELLER = {
  email: "seller@reviewer.test",
  password: process.env.DEMO_SELLER_PASSWORD,
  fullName: "Ananya Rao",
};

const BUYER = {
  email: "buyer@reviewer.test",
  password: process.env.DEMO_BUYER_PASSWORD,
  fullName: "Rohit Menon",
};

/**
 * A third account that owns nothing and is in no conversation. It exists for
 * `npm run verify:rls`: proving that a chat is private needs someone who is
 * neither its buyer nor its seller to try to read it.
 */
const OUTSIDER = {
  email: "outsider@reviewer.test",
  password: process.env.DEMO_OUTSIDER_PASSWORD,
  fullName: "Kavya Nair",
};

/**
 * The author's own profile, as a showcase of what a filled-in profile looks
 * like: a photo, a bio, skills, a GitHub link and two Squad up posts. The
 * details below were supplied by the author. The photo is public/vedant.webp,
 * a compressed crop of a photograph the author provided.
 */
const VEDANT = {
  email: "vedant@reviewer.test",
  password: process.env.DEMO_VEDANT_PASSWORD,
  fullName: "Vedant Sharma",
  bio: "First-year CSE. I make films, beats and websites. Usually all three at once.",
  skills: ["react", "next.js", "supabase", "video-editing", "filmmaking", "graphic-design", "beatboxing"],
  github: "vedantdev37",
};

const VEDANT_POSTS = [
  {
    type: "skill_offer",
    title: "I'll edit your fest aftermovie",
    description:
      "Send me the raw footage from your fest, club event or hackathon and I will cut it into something people actually watch to the end. Colour, sound, titles, the lot. I have shot and edited a few of these. Tell me the date you need it by.",
    tags: ["video-editing", "filmmaking", "graphic-design"],
  },
  {
    type: "team_request",
    title: "Looking for a teammate for the next hackathon",
    description:
      "I build the frontend and the database (React, Next.js, Supabase) and I will make the demo video. I am looking for someone who enjoys the part I do not: a strong backend or ML person, or a designer with opinions. Message me and we will find a hackathon.",
    tags: ["react", "next.js", "supabase"],
    event_name: "the next hackathon",
  },
];

for (const [name, account] of [
  ["DEMO_SELLER_PASSWORD", SELLER],
  ["DEMO_BUYER_PASSWORD", BUYER],
  ["DEMO_OUTSIDER_PASSWORD", OUTSIDER],
  ["DEMO_VEDANT_PASSWORD", VEDANT],
]) {
  if (!account.password || account.password.length < 8) {
    console.error(
      `${name} is missing or too short in .env.local.\n` +
        "Set the demo passwords there (8+ characters) and re-run.",
    );
    process.exit(1);
  }
}

/**
 * `pickupSpot` is matched by name against the seeded pickup_spots rows.
 * `image` describes the placeholder photo to draw (see demo-images.mjs).
 * `condition_checks` uses the keys allowed for the listing's category; the
 * database trigger from migration 0006 rejects any that do not belong.
 *
 * The descriptions are written the way a student would write them. The course
 * codes follow the usual scheme-subject-semester pattern and are plausible,
 * not copied from a real syllabus: replace them with real ones if it matters.
 */
const SELLER_LISTINGS = [
  {
    title: "Grewal - Higher Engineering Mathematics (44th ed.)",
    description:
      "The maths bible. Got me through M1 and M2, with pencil ticks next to the problems that actually show up in the CIEs. No torn pages, spine is fine. Selling because I am finally, finally done with maths. Pick it up from the library.",
    price: 320,
    category: "books",
    condition: "good",
    course_code: "22MAT21",
    semester: 2,
    isbn: "9788193328491",
    book_author: "B.S. Grewal",
    original_price: 650,
    condition_checks: { all_pages_intact: true },
    pickupSpot: "Central Library",
    image: {
      art: "book",
      title: "Higher Engineering Mathematics",
      author: "B.S. Grewal",
      cover: "#8c2f39",
      accent: "#e9c46a",
    },
  },
  {
    title: "Data Structures and Algorithms in C++ (Goodrich)",
    description:
      "Bought in a burst of third-sem motivation, opened maybe four times. Zero highlighting, zero dog-ears. If you want a real reference for the DSA lab instead of last-minute YouTube at 2 am, this is the one.",
    price: 400,
    category: "books",
    condition: "like_new",
    course_code: "22CS32",
    semester: 3,
    isbn: "9780132847377",
    book_author: "Michael T. Goodrich",
    original_price: 899,
    condition_checks: { no_highlighting: true, all_pages_intact: true },
    pickupSpot: "Main Block Lobby",
    image: {
      art: "book",
      title: "Data Structures and Algorithms in C++",
      author: "Michael T. Goodrich",
      cover: "#1f4e5f",
      accent: "#f4a261",
    },
  },
  {
    title: "Casio FX-991EX scientific calculator",
    description:
      "Exam-legal and every button works. New battery went in last month. It has sat through every internal with me since first year and never once judged my answers. Selling because I got a hand-me-down. Slide cover included.",
    price: 850,
    category: "electronics",
    condition: "good",
    original_price: 1495,
    condition_checks: { battery_ok: true, screen_unscratched: true },
    pickupSpot: "Food Court",
    image: { art: "calculator" },
  },
  {
    title: "Study lamp with desk clamp, adjustable neck",
    description:
      "Warm white LED, three brightness levels, clamps to the hostel desk so it does not eat your table space. Survived two semesters of night-outs before externals. I am leaving the hostel, so it has to go.",
    price: 450,
    category: "hostel",
    condition: "good",
    pickupSpot: "Boys' Hostel Gate",
    image: { art: "lamp" },
  },
  {
    title: "Operating Systems handwritten notes, all 5 modules",
    description:
      "My full OS notes, module by module, with the diagrams that get drawn on the board and never make it to the slides. Spiral bound, and legible, I promise. These are what I revised from the night before. Photocopy them for your whole bench.",
    price: 150,
    category: "notes",
    condition: "good",
    course_code: "22CS44",
    semester: 4,
    pickupSpot: "Central Library",
    image: { art: "notes", title: "Operating Systems" },
  },
  {
    title: "Lab coat, full sleeve, size M",
    description:
      "White cotton lab coat, worn for one semester of chemistry lab and never again. Washed and ironed, all buttons present, both pockets intact, no stains and no acid burns. Do not pay full price for a new one you will wear twelve times.",
    price: 220,
    category: "lab",
    condition: "like_new",
    original_price: 450,
    condition_checks: { size: "M", no_stains: true },
    pickupSpot: "Main Block Lobby",
    image: { art: "labCoat" },
  },
  {
    title: "Folding study chair",
    description:
      "Metal frame, cushioned seat, folds flat behind the door. One scuff on a leg, otherwise solid. I cannot carry it home on the train, which is the only reason it is here.",
    price: 700,
    category: "furniture",
    condition: "fair",
    pickupSpot: "Girls' Hostel Gate",
    image: { art: "chair" },
  },
];

/**
 * Which photograph each demo post uses, by title.
 *
 * The key is a file name. For each one the script looks, in this order, for:
 *
 *   1. public/demo-photos/<key>.jpg|jpeg|png|webp   your own photo, if you put
 *                                                   one there: it always wins
 *   2. scripts/demo-photos/<key>.webp               the stock photo committed
 *                                                   with the project (credits
 *                                                   in docs/credits.md)
 *   3. the drawn illustration from demo-images.mjs  if neither exists
 *
 * So the seed works with no photos at all, and one listing's photo can be
 * replaced by dropping in a single file.
 */
const PHOTO_FOR = {
  "Grewal - Higher Engineering Mathematics (44th ed.)": "maths-book",
  "Data Structures and Algorithms in C++ (Goodrich)": "dsa-book",
  "Casio FX-991EX scientific calculator": "calculator",
  "Study lamp with desk clamp, adjustable neck": "lamp",
  "Operating Systems handwritten notes, all 5 modules": "os-notes",
  "Lab coat, full sleeve, size M": "lab-coat-rack",
  "Folding study chair": "chair",
  "Mini drafter with case": "drafter",
  "Lab coat for the week, size L": "lab-coat",
  "First-year chemistry notes, take them": "chem-notes",
  "Desk lamp, works, slightly wobbly": "free-lamp",
  "Blue steel water bottle": "bottle",
  "Calculator left in a classroom": "lost-calculator",
};

const OWN_PHOTOS_DIR = new URL("../public/demo-photos/", import.meta.url);
const STOCK_PHOTOS_DIR = new URL("./demo-photos/", import.meta.url);

/** The photograph for a post as WebP bytes, or null if there is none. */
async function loadDemoPhoto(title) {
  const key = PHOTO_FOR[title];

  if (!key) {
    return null;
  }

  for (const extension of ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG"]) {
    const own = new URL(`${key}.${extension}`, OWN_PHOTOS_DIR);

    if (existsSync(own)) {
      // A phone photo can be 5 MB and stored sideways. Turn it upright, crop
      // it to the 4:3 a listing shows, and compress it.
      return sharp(await readFile(own))
        .rotate()
        .resize(1200, 900, { fit: "cover", position: sharp.strategy.attention })
        .webp({ quality: 80 })
        .toBuffer();
    }
  }

  const stock = new URL(`${key}.webp`, STOCK_PHOTOS_DIR);
  return existsSync(stock) ? readFile(stock) : null;
}

/** A campus-time date `days` from today, as YYYY-MM-DD. */
function campusDay(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
}

/**
 * The other five kinds of post (migration 0010). Same table, same insert; what
 * differs is `type` and the one or two fields that kind uses. `found_on` and
 * `event_date` are worked out when the script runs, so they are always recent.
 */
const OTHER_POSTS = [
  {
    type: "rent",
    title: "Mini drafter with case",
    description:
      "You need it for exactly one ED lab a week, so do not buy one. Clean, the arm slides smoothly, case included. Give it back the same evening and we are friends.",
    price: 30,
    rent_max_days: 3,
    category: "other",
    condition: "good",
    pickupSpot: "Main Block Lobby",
    image: { art: "drafter" },
  },
  {
    type: "rent",
    title: "Lab coat for the week, size L",
    description:
      "Forgot yours at home and the lab is tomorrow? Borrow mine. Washed after every use. Return it clean, please.",
    price: 20,
    rent_max_days: 7,
    category: "lab",
    condition: "good",
    condition_checks: { size: "L", no_stains: true },
    pickupSpot: "Girls' Hostel Gate",
    image: { art: "labCoat" },
  },
  {
    type: "free",
    title: "First-year chemistry notes, take them",
    description:
      "Cleared my shelf. Full set of sem 1 chemistry notes, a bit dog-eared but complete. Free to whoever asks first. Juniors, this one is for you.",
    category: "notes",
    condition: "fair",
    pickupSpot: "Central Library",
    image: { art: "notes", title: "Chemistry" },
  },
  {
    type: "free",
    title: "Desk lamp, works, slightly wobbly",
    description:
      "The neck droops unless you prop it. The light is fine. Not worth selling, too good to throw away. Come and take it.",
    category: "hostel",
    condition: "fair",
    pickupSpot: "Boys' Hostel Gate",
    image: { art: "lamp" },
  },
  {
    type: "lost_found",
    title: "Blue steel water bottle",
    description:
      "Found on a bench near the food court after lunch. It has a sticker on it. Tell me what the sticker is and it is yours.",
    found_on: campusDay(-1),
    pickupSpot: "Food Court",
    image: { art: "bottle" },
  },
  {
    type: "lost_found",
    title: "Calculator left in a classroom",
    description:
      "Picked up from a desk in the main block after the last class. There is a name scratched on the back. Tell me the name to claim it.",
    found_on: campusDay(-2),
    pickupSpot: "Main Block Lobby",
    image: { art: "calculator" },
  },
  {
    type: "team_request",
    title: "Need a backend dev for Saturday's hackathon",
    description:
      "Two of us so far, both frontend. We have the idea and the UI, and nobody who wants to touch a database. If you like Postgres or Node, come and save us.",
    tags: ["node", "postgres", "apis"],
    event_name: "Saturday hackathon",
    event_date: campusDay(5),
  },
  {
    type: "skill_offer",
    title: "I will make your project report look good",
    description:
      "Formatting, diagrams, a proper cover page and a contents list that matches. I have done four of these. Send me the draft two days before the deadline, not two hours.",
    tags: ["latex", "figma", "design"],
  },
];

/** The listing marked sold, so reviewers can see the sold treatment. */
const SOLD_TITLE = "Folding study chair";

/** The listing the demo buyer has asked about. */
const CHAT_TITLE = "Casio FX-991EX scientific calculator";

/**
 * 4:30 pm campus time, two days from now, as an ISO string with an explicit
 * offset - so it means the same instant whatever zone this script runs in.
 */
function demoMeetupTime() {
  const day = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

  return `${day}T16:30:00+05:30`;
}

function fail(message, error) {
  console.error(`\n  FAILED: ${message}`);

  if (error) {
    console.error(`  ${error.message ?? error}`);

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

/**
 * Uploads a demo post's photo (a photograph if there is one for it, a drawn
 * placeholder if not) into the seller's own folder.
 *
 * Uploaded as the seller, through the public API, so it is subject to the same
 * Storage policy as a photo uploaded from the form: the first path segment
 * must be the uploader's uid. The returned path is what the listing stores.
 */
async function uploadDemoImage(client, userId, image, title) {
  const bytes = (await loadDemoPhoto(title)) ?? (await renderDemoImage(image));
  const path = `${userId}/${crypto.randomUUID()}.webp`;

  const { error } = await client.storage
    .from("listing-images")
    .upload(path, bytes, { contentType: "image/webp", cacheControl: "31536000" });

  if (error) {
    fail("could not upload a demo image", error);
  }

  return path;
}

/**
 * Empties a user's Storage folder.
 *
 * The reset deletes listing rows directly rather than through the app's delete
 * action, so nothing would otherwise remove their photos and each reseed would
 * leave another set of orphaned files behind.
 */
async function clearImageFolder(client, userId) {
  const { data: files, error } = await client.storage
    .from("listing-images")
    .list(userId, { limit: 1000 });

  if (error) {
    fail("could not list the seller's images", error);
  }

  if (!files || files.length === 0) {
    return 0;
  }

  const { error: removeError } = await client.storage
    .from("listing-images")
    .remove(files.map((file) => `${userId}/${file.name}`));

  if (removeError) {
    fail("could not remove old demo images", removeError);
  }

  return files.length;
}

/** A fresh client per account: each one carries exactly one user's session. */
function newClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Signs up, or signs in if the account exists, rotating the password off the
 * burned value when necessary. Returns a signed-in client.
 */
async function ensureAccount({ email, password, fullName }) {
  const supabase = newClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (!signUpError && signUpData.session) {
    console.log(`  created   ${email}`);
    return supabase;
  }

  if (!signUpError && !signUpData.session) {
    fail(
      `signing up ${email} returned no session - email confirmation is still on. ` +
        "Turn it off in Supabase -> Authentication -> Sign In / Providers -> Email.",
    );
  }

  const alreadyExists =
    signUpError?.code === "user_already_exists" || signUpError?.code === "email_exists";

  if (signUpError && !alreadyExists) {
    fail(`could not sign up ${email}`, signUpError);
  }

  // Existing account: try the current password first.
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (!signInError) {
    console.log(`  signed in ${email}`);
    return supabase;
  }

  // Fall back to the password this account was created with before the
  // rotation, then change it immediately so the burned value stops working.
  const burned = BURNED_PASSWORDS[email];

  if (!burned) {
    fail(`account ${email} exists but the configured password did not work`, signInError);
  }

  const { error: legacyError } = await supabase.auth.signInWithPassword({
    email,
    password: burned,
  });

  if (legacyError) {
    fail(
      `account ${email} exists but neither the configured nor the original ` +
        "password worked. Reset it in the Supabase dashboard, or delete the user and re-run.",
      legacyError,
    );
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });

  if (updateError) {
    fail(`could not rotate the password for ${email}`, updateError);
  }

  console.log(`  rotated   ${email}  (was using the committed password)`);
  return supabase;
}

/**
 * Removes the demo data.
 *
 * Deleting the seller's listings also clears any wishlist rows, conversations,
 * messages and meetups pointing at them, through the ON DELETE CASCADE foreign
 * keys - so one delete is enough and there are no orphans to tidy up.
 *
 * These deletes run under RLS as the seller, so they physically cannot remove
 * another user's listings even if the filter were wrong.
 */
async function resetDemoData(sellerClient, sellerId, buyerClient, buyerId) {
  const { error: listingsError } = await sellerClient
    .from("listings")
    .delete()
    .eq("seller_id", sellerId);

  if (listingsError) {
    fail("could not delete the seller's listings", listingsError);
  }

  if (buyerId) {
    const { error: wishlistError } = await buyerClient
      .from("wishlist_items")
      .delete()
      .eq("user_id", buyerId);

    if (wishlistError) {
      fail("could not clear the buyer's wishlist", wishlistError);
    }
  }

  // The buyer is meant to have no posts of their own. Anything they posted
  // while the app was being tried out goes too, with its photos.
  if (buyerId) {
    const { error: buyerListingsError } = await buyerClient
      .from("listings")
      .delete()
      .eq("seller_id", buyerId);

    if (buyerListingsError) {
      fail("could not delete the buyer's listings", buyerListingsError);
    }

    await clearImageFolder(buyerClient, buyerId);
  }

  // Profiles edited while trying the app go back to blank, and their photos
  // were removed with the folder above.
  if (buyerId) {
    const { error: buyerProfileError } = await buyerClient
      .from("profiles")
      .update({ full_name: BUYER.fullName, bio: null, skills: [], github_username: null, avatar_path: null })
      .eq("id", buyerId);

    if (buyerProfileError) {
      fail("could not reset the buyer's profile", buyerProfileError);
    }
  }

  const removed = await clearImageFolder(sellerClient, sellerId);

  console.log(`  cleared existing demo listings, chats, wishlist and ${removed} stored image(s)`);
}

async function main() {
  console.log(`\nSeeding demo data${RESET ? " (reset)" : ""}\n`);

  console.log("Accounts:");
  const sellerClient = await ensureAccount(SELLER);
  const buyerClient = await ensureAccount(BUYER);
  await ensureAccount(OUTSIDER);
  const vedantClient = await ensureAccount(VEDANT);
  const { data: vedantAuth } = await vedantClient.auth.getUser();
  const vedantId = vedantAuth?.user?.id;

  const { data: sellerAuth } = await sellerClient.auth.getUser();
  const sellerId = sellerAuth?.user?.id;

  const { data: buyerAuth } = await buyerClient.auth.getUser();
  const buyerId = buyerAuth?.user?.id;

  if (!sellerId) {
    fail("could not read the seller's user id after signing in");
  }

  if (RESET) {
    console.log("\nReset:");
    await resetDemoData(sellerClient, sellerId, buyerClient, buyerId);
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
    console.log(
      `\nListings: seller already has ${count}, leaving them alone.` +
        "\n  (use `npm run reseed:demo` to replace them)",
    );
  } else {
    const rows = [];

    for (const { pickupSpot, image, ...listing } of SELLER_LISTINGS) {
      rows.push({
        ...listing,
        // Explicit on every row: in a bulk insert a key missing from one row is
        // sent as null rather than left to the column default, and this column
        // is not null.
        condition_checks: listing.condition_checks ?? {},
        seller_id: sellerId,
        pickup_spot_id: spotIdByName.get(pickupSpot) ?? null,
        image_path: await uploadDemoImage(sellerClient, sellerId, image, listing.title),
      });
    }

    for (const { pickupSpot, image, ...post } of OTHER_POSTS) {
      rows.push({
        ...post,
        seller_id: sellerId,
        pickup_spot_id: pickupSpot ? (spotIdByName.get(pickupSpot) ?? null) : null,
        image_path: image ? await uploadDemoImage(sellerClient, sellerId, image, post.title) : null,
      });
    }

    // Every row carries every key. In a bulk insert a key missing from one row
    // is sent as null, not left to the column default - and several of these
    // columns are NOT NULL with a default (type, tags, category, condition).
    const complete = rows.map((row) => ({
      type: "sale",
      price: 0,
      category: "other",
      condition: "good",
      condition_checks: {},
      tags: [],
      rent_max_days: null,
      found_on: null,
      event_name: null,
      event_date: null,
      course_code: null,
      semester: null,
      isbn: null,
      book_author: null,
      original_price: null,
      ...row,
    }));

    const { data: inserted, error: insertError } = await sellerClient
      .from("listings")
      .insert(complete)
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
  const { data: available, error: availableError } = await buyerClient
    .from("listings")
    .select("id, title")
    .eq("type", "sale")
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

  // --- One conversation, with a meetup waiting for the seller ------------
  // Every step goes through the same database functions the app calls, as the
  // user who would be making it. The proposal is left pending on purpose: a
  // reviewer signing in as the seller finds something to accept.
  const { count: chatCount, error: chatCountError } = await buyerClient
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", buyerId)
    // With the seller specifically: the buyer may also be talking to the
    // showcase profile, and that conversation is not this one.
    .eq("seller_id", sellerId);

  if (chatCountError) {
    fail("could not count the buyer's conversations", chatCountError);
  }

  if ((chatCount ?? 0) > 0) {
    console.log("\nChat: the buyer already has a conversation, leaving it alone.");
  } else {
    const { data: chatListing, error: chatListingError } = await buyerClient
      .from("listings")
      .select("id, pickup_spot_id")
      .eq("seller_id", sellerId)
      .eq("type", "sale")
      .eq("title", CHAT_TITLE)
      .eq("status", "available")
      .maybeSingle();

    if (chatListingError) {
      fail("could not find the listing to chat about", chatListingError);
    }

    if (chatListing) {
      const { data: conversationId, error: startError } = await buyerClient.rpc(
        "start_conversation",
        {
          p_listing_id: chatListing.id,
          p_body: "Hey, is the calculator still available? Need it before the internals. Does the cover come with it?",
        },
      );

      if (startError) {
        fail("could not start the demo conversation", startError);
      }

      const { error: replyError } = await sellerClient.from("messages").insert({
        conversation_id: conversationId,
        body: "Yep, still here, cover included. I am free after 4 most days. When works for you?",
      });

      if (replyError) {
        fail("could not post the seller's reply", replyError);
      }

      const { error: proposeError } = await buyerClient.rpc("propose_meetup", {
        p_conversation_id: conversationId,
        p_pickup_spot_id: chatListing.pickup_spot_id ?? spots?.[0]?.id,
        p_meet_at: demoMeetupTime(),
      });

      if (proposeError) {
        fail("could not propose the demo meetup", proposeError);
      }

      console.log("\nChat: buyer asked about the calculator, seller replied, buyer proposed a meetup");
    }
  }

  // --- The showcase profile ----------------------------------------------
  // Written as that user, through the same public API, so the column-level
  // grant and the CHECK constraints on `profiles` (migration 0010) apply to
  // it exactly as they would to an edit made in the app.
  if (vedantId) {
    if (RESET) {
      const { error } = await vedantClient.from("listings").delete().eq("seller_id", vedantId);

      if (error) {
        fail("could not delete the showcase posts", error);
      }

      await clearImageFolder(vedantClient, vedantId);
    }

    let avatarPath = null;
    const photo = new URL("../public/vedant.webp", import.meta.url);

    if (existsSync(photo)) {
      const { data: profile } = await vedantClient
        .from("profiles")
        .select("avatar_path")
        .eq("id", vedantId)
        .maybeSingle();

      // After a reset the Storage folder has just been emptied, so whatever
      // path the row holds now points at nothing. Keeping it would leave a
      // broken image on the one profile meant to show a photo.
      avatarPath = RESET ? null : (profile?.avatar_path ?? null);

      if (!avatarPath) {
        avatarPath = `${vedantId}/${crypto.randomUUID()}.webp`;

        const { error } = await vedantClient.storage
          .from("listing-images")
          .upload(avatarPath, await readFile(photo), { contentType: "image/webp", cacheControl: "31536000" });

        if (error) {
          fail("could not upload the showcase profile photo", error);
        }
      }
    }

    const { data: saved, error: profileError } = await vedantClient
      .from("profiles")
      .update({
        full_name: VEDANT.fullName,
        bio: VEDANT.bio,
        skills: VEDANT.skills,
        github_username: VEDANT.github,
        avatar_path: avatarPath,
      })
      .eq("id", vedantId)
      .select("id");

    if (profileError || (saved?.length ?? 0) === 0) {
      fail("could not save the showcase profile", profileError);
    }

    const { count: postCount } = await vedantClient
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", vedantId);

    if ((postCount ?? 0) === 0) {
      const { error } = await vedantClient.from("listings").insert(
        VEDANT_POSTS.map((post) => ({
          price: 0,
          category: "other",
          condition: "good",
          condition_checks: {},
          event_name: null,
          event_date: null,
          ...post,
          seller_id: vedantId,
        })),
      );

      if (error) {
        fail("could not insert the showcase posts", error);
      }
    }

    // One Squad up conversation: the buyer answering the call for a teammate.
    // It gives reviewers a chat on a non-sale post to look at, and gives
    // verify:rls a team conversation for a third user to try to read.
    const { data: teamPost } = await buyerClient
      .from("listings")
      .select("id")
      .eq("seller_id", vedantId)
      .eq("type", "team_request")
      .eq("status", "available")
      .limit(1)
      .maybeSingle();

    if (teamPost && buyerId) {
      const { count: existing } = await buyerClient
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", teamPost.id)
        .eq("buyer_id", buyerId);

      if ((existing ?? 0) === 0) {
        const { error } = await buyerClient.rpc("start_conversation", {
          p_listing_id: teamPost.id,
          p_body: "I'm interested in joining. I do backend: Node and Postgres. Which hackathon are you thinking of?",
        });

        if (error) {
          fail("could not start the Squad up conversation", error);
        }
      }
    }

    console.log(`\nShowcase profile: ${VEDANT.fullName}${avatarPath ? ", with photo" : ", no photo found"}, ${VEDANT_POSTS.length} posts`);
  }

  console.log("\nDone.");
  console.log("  seller@reviewer.test / buyer@reviewer.test / outsider@reviewer.test / vedant@reviewer.test");
  console.log("  Passwords: DEMO_*_PASSWORD in .env.local\n");
}

main().catch((error) => fail("unexpected error", error));
