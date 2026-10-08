import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Director’s commentary · Nitte Mart",
  description: "Six things that went wrong while building Nitte Mart, and what each one taught me.",
};

/**
 * The wording of these entries was drafted with AI from the project's own
 * decision log and approved by the author, who speaks in them.
 */
const ENTRIES: { title: string; problem: string; did: string; learned: string }[] = [
  {
    title: "Locking sign-up to campus",
    problem:
      "The site’s public key lets anyone call the sign-up endpoint directly, without ever loading my form. A check for “@nmit.ac.in” in the form, or even in my server code, is decoration: one hand-written request walks past it.",
    did: "I put the rule inside the database’s own sign-up step: a hook that runs when a user is created, looks the email’s domain up in an allowlist table, and refuses by default. If a domain is not listed, it does not get in.",
    learned:
      "A rule is only a boundary if there is no way to reach the data without passing through it. Everything else is a hint to honest users.",
  },
  {
    title: "Who owns a listing",
    problem:
      "Hiding the Edit button stops nobody. Anyone with the browser console open can send the update the page never offered.",
    did: "Row Level Security on every table, and no service-role key anywhere in the project, so even my own server code cannot bypass it. Then I wrote a script that signs in as a stranger and attacks the API directly, and I run it against the real database.",
    learned:
      "A policy has two halves. “Using” decides which rows you may touch; “with check” decides what the row may look like afterwards. Without the second half, I could have edited my own listing and handed it to someone else.",
  },
  {
    title: "The write that failed silently",
    problem:
      "When the database refuses an update because of a policy, it does not raise an error. It changes zero rows and says nothing. My code saw “no error” and told the user it had worked.",
    did: "Every write now asks for the changed rows back and counts them. Zero rows means “not allowed”, and the user is told so. The test script counts rows too, or it would have passed for the wrong reason.",
    learned: "“No error” and “it worked” are two different statements. I had been treating them as one.",
  },
  {
    title: "The book lookup that found nothing",
    problem:
      "The plan was to scan a barcode and fill in the book from Google Books. With a valid key, it returned nothing for any of the twelve well-known print ISBNs I tried. Built as planned, nearly every scan would have said “book not found”.",
    did: "A second source, Open Library, as the fallback, and a field to type the MRP by hand when neither knows the price. If both fail, the form says so plainly and keeps the ISBN.",
    learned:
      "Make one real request to an API before designing a feature around it. Ten minutes with curl would have saved me building the wrong thing first.",
  },
  {
    title: "Meetups inside chat",
    problem:
      "“Let’s meet at the library” is not a plan. Without a time both people have agreed to, half of these handovers never happen.",
    did: "Either person proposes a spot and a time in the chat; the other accepts or suggests another. The database allows one active meetup per conversation, refuses a time in the past, and only allows 8 am to 8 pm, checked in campus time.",
    learned:
      "My server runs in UTC, five and a half hours behind campus. A time with no zone attached means two different moments in two places, so every time has to say which zone it is in.",
  },
  {
    title: "One model for six kinds of post",
    problem:
      "Renting, giving away, found items, skills and teammates each looked like they needed their own table, their own rules and their own pages.",
    did: "One “type” column on the table I already had, the rules for each type as database constraints, and one “finished” state that the app labels differently: sold, rented out, claimed, team full.",
    learned:
      "Reusing a state that already means the right thing is safer than adding a new one. Every old rule already understood “sold”; none of them would have understood “rented out”.",
  },
];

export default function CommentaryPage() {
  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 bg-canvas px-4 py-10 text-ink md:px-6 md:py-16">
      <p className="text-sm font-semibold tracking-[0.14em] text-indigo-text uppercase">
        Director&rsquo;s commentary
      </p>
      <h1 className="title-card mt-3 text-[48px] md:text-[88px]">What went wrong.</h1>

      <p className="mt-5 max-w-2xl text-base text-ink-body md:text-lg">
        Like a DVD director&rsquo;s commentary, but for code. Here&rsquo;s what went wrong and
        what it taught me.
      </p>

      <ol className="mt-10 flex flex-col gap-5">
        {ENTRIES.map((entry, index) => (
          <li key={entry.title} className="rounded-[14px] border border-hairline p-5 md:p-7">
            <p className="title-card text-[28px] text-ink-muted md:text-[36px]">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h2 className="mt-1 text-[22px] leading-tight font-semibold md:text-[26px]">{entry.title}</h2>

            <dl className="mt-4 flex flex-col gap-4 text-base">
              <div>
                <dt className="text-sm font-semibold tracking-wide text-ink-muted uppercase">The problem</dt>
                <dd className="mt-1 text-ink-body">{entry.problem}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold tracking-wide text-ink-muted uppercase">What I did</dt>
                <dd className="mt-1 text-ink-body">{entry.did}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold tracking-wide text-ink-muted uppercase">What I learned</dt>
                <dd className="mt-1 font-medium text-ink">{entry.learned}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/security"
          className="flex h-12 items-center justify-center rounded-lg bg-accent px-6 text-base font-semibold text-on-accent hover:bg-accent-active"
        >
          See the security receipts
        </Link>
        <Link
          href="/"
          className="flex h-12 items-center justify-center rounded-lg border border-ink px-6 text-base font-medium text-ink hover:bg-surface-soft"
        >
          Back to the start
        </Link>
      </div>
    </main>
  );
}
