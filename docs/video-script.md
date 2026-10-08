# Walkthrough video: shot list (3:00)

Target 2:50, hard limit 3:00. Record against the live site,
<https://nmit-campus-marketplace.vercel.app>, after `npm run reseed:demo`.

**Devices.** PHONE = a real phone, screen-recorded, signed in as the **buyer**.
LAPTOP = browser at normal width, signed in as the **seller**. SPLIT = both on
screen at once (phone mirrored or filmed beside the laptop).

**Before recording**

- Reseed, then sign in on both devices so no shot waits on a login form.
- Have a textbook with a barcode on the desk. Fallback if the scan misbehaves:
  type the ISBN, which runs the same lookup.
- Laptop: one tab on the seller's own listing, one on `/security`.
- The seeded chat already has a meetup proposal waiting for the seller.
- Shot 3 creates a real account on the live database. Use a throwaway
  `@reviewer.test` address.

| # | Time | Device | On screen | Say |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:10 | PHONE | Home page hero, one slow scroll past the six tiles to "Fresh drops" | "This is Nitte Mart: a marketplace only my campus can get into. Sell, rent, give away, find teammates, and meet at the library to hand it over." |
| 2 | 0:10–0:22 | LAPTOP | `/signup` with a `gmail.com` address, submit, the refusal message | "Gmail is refused. Not by the form: by a hook inside the database, so calling the API directly gets the same answer." |
| 3 | 0:22–0:32 | LAPTOP | Same form with a new `@reviewer.test` address, lands signed in | "A campus address gets in. Reviewers can use any reviewer.test email." |
| 4 | 0:32–0:55 | PHONE | Post, Sell, category Books, Scan barcode, point at the book; title, author and cover fill in; type the MRP and a price; the deal meter changes | "Posting a textbook. Scan the barcode and Google Books, with Open Library as the fallback, fills in the details. Enter the MRP and the deal meter tells me if my price is fair." |
| 5 | 0:55–1:10 | LAPTOP | Explore: search `22CS32`, then a category and a pickup spot filter, then the Rent tab | "Search by course code to find the exact book your subject needs. Filter by category and pickup spot." |
| 6 | 1:10–1:28 | LAPTOP | Seller's own listing: Edit, change the price, save. Owner controls visible | "On my own listing I can edit, mark sold and delete." |
| 7 | 1:28–1:42 | PHONE | Buyer opens the same listing: no owner controls. Cut to LAPTOP `/security`, the 66 of 66 figure | "The buyer sees none of that, and hiding buttons is not the security. Row Level Security refuses the write in the database. Sixty-six scripted attacks, all refused." |
| 8 | 1:42–2:05 | SPLIT | Buyer sends a message; it appears on the seller's laptop with no refresh. Seller accepts the proposed meetup; the bar turns green on both | "Chat is private to the two of us and live. The buyer proposed a time and place; I accept, and both sides see the meetup." |
| 9 | 2:05–2:22 | SPLIT | Phone on Explore showing the item. Seller presses Mark as sold on the laptop; the phone's card gets the SOLD stamp without a touch | "I mark it sold on the laptop. The phone updates by itself. No refresh." |
| 10 | 2:22–2:32 | PHONE | A listing with a deal badge on the card, then its detail page with the fair-price line | "Every priced post with an MRP gets a verdict in words: steal deal, fair price, bit high." |
| 11 | 2:32–2:48 | PHONE | Explore tabs: Rent (a per-day price), Free, Squad up (a team request, tap "I'm in", the chat opens prefilled) | "It is not only buying. Rent a calculator for a day, give things away, or find a teammate for Saturday's hackathon." |
| 12 | 2:48–2:58 | LAPTOP | Footer disclaimer, then the README open on GitHub | "Next.js and Supabase, built with AI assistance, all declared in the repo. Thanks for watching." |

**If it runs long, cut in this order:** shot 10, shot 3, the filter half of shot 5.

**Never show:** `.env.local`, `SUBMISSION.md`, a password being typed in clear,
the Supabase or Vercel dashboards.
