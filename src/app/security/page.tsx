import type { Metadata } from "next";
import Link from "next/link";

import { formatCampusDateTime } from "@/lib/campus-time";
import securityRun from "@/lib/security-run.json";

export const metadata: Metadata = {
  title: "Security receipts · Nitte Mart",
  description:
    "What Nitte Mart's security tests try to do, in plain language, and how the last run went.",
};

const SCRIPT_URL =
  "https://github.com/vedantdev37/campus-marketplace/blob/main/scripts/verify-rls.mjs";

/**
 * Each group is a set of attacks from scripts/verify-rls.mjs, said in plain
 * language. The wording here is a description of that script and has to be
 * kept in step with it by hand; the COUNT at the top of the page is not
 * written here at all - it is read from the file the script writes.
 */
const GROUPS: { title: string; who: string; attempts: string[] }[] = [
  {
    title: "Someone else's listing",
    who: "A signed-in student who is not the seller",
    attempts: [
      "Change the price of another student's listing.",
      "Mark another student's listing as sold.",
      "Delete another student's listing.",
      "As the seller: hand a listing over to a different account.",
    ],
  },
  {
    title: "Getting in without an account",
    who: "Someone who is not signed in",
    attempts: [
      "Read the listings.",
      "Read chat messages.",
      "Read the list of email domains that are allowed to sign up.",
      "Sign in with a demo password that was once published by mistake and has since been changed.",
    ],
  },
  {
    title: "What a listing is allowed to contain",
    who: "A seller, writing straight to the database and skipping the form",
    attempts: [
      "Add a checklist item that belongs to another category.",
      "Put a piece of script where a tick should be.",
      "Use a photo stored in another student's folder.",
    ],
  },
  {
    title: "Other people's chats",
    who: "A third student who is neither the buyer nor the seller",
    attempts: [
      "Read the conversation, its messages or its meetup.",
      "Find the conversation in their own inbox.",
      "Post a message into it.",
      "Propose or accept a meetup in it.",
      "Mark it as read on someone else's behalf.",
    ],
  },
  {
    title: "Cheating inside your own chat",
    who: "The buyer or the seller",
    attempts: [
      "Send a message that claims to be from the other person.",
      "Post a fake “meetup accepted” notice.",
      "Edit or delete a message after sending it.",
      "Send an empty message, or one over 1000 characters.",
      "Start a chat about their own listing.",
      "Create a conversation or a meetup directly, without going through the app's rules.",
    ],
  },
  {
    title: "Meetups",
    who: "The buyer or the seller",
    attempts: [
      "Accept a meetup they proposed themselves.",
      "Change a meetup's status directly.",
      "Propose a time in the past.",
      "Propose 3 am. Meetups are between 8 am and 8 pm, campus time.",
      "Propose a date a year away.",
    ],
  },
];

export default function SecurityPage() {
  const allPassed = securityRun.failed === 0 && securityRun.passed > 0;

  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 bg-canvas px-4 py-10 text-ink md:px-6 md:py-16">
      <p className="text-sm font-semibold tracking-[0.14em] text-indigo-text uppercase">
        Security receipts
      </p>
      <h1 className="title-card mt-3 text-[48px] md:text-[88px]">Don&rsquo;t trust us. Check.</h1>

      <p className="mt-5 max-w-2xl text-base text-ink-body md:text-lg">
        Hiding a button stops nobody. Anyone with a browser console can send a request the page
        never offered. So the rules about who can see and change what live in the database, and
        a script attacks them the way a curious student would: directly, skipping this website.
      </p>

      {/* The result of the last run, read from the file the script writes. */}
      <section
        aria-label="Last test run"
        className={[
          "mt-8 rounded-[14px] border p-6",
          allPassed ? "border-hairline bg-success-surface" : "border-error bg-error-surface",
        ].join(" ")}
      >
        <p className="title-card text-[56px] md:text-[72px]">
          {securityRun.passed}
          <span className="text-ink-muted">/{securityRun.total}</span>
        </p>
        <p className="mt-1 text-base font-semibold">
          {allPassed
            ? "attacks refused on the last run"
            : `checks passed on the last run. ${securityRun.failed} failed${securityRun.skipped ? `, ${securityRun.skipped} could not run` : ""}.`}
        </p>
        <p className="mt-1 text-sm text-ink-body">
          Last run {formatCampusDateTime(securityRun.ranAt)}, campus time, against the live
          database. This number is written by the test script when it runs. Nobody types it in.
        </p>
      </section>

      <h2 className="mt-12 text-[22px] leading-tight font-semibold md:text-[26px]">
        What the script tries
      </h2>
      <p className="mt-2 text-base text-ink-body">
        Every line below is something that must fail. If one ever works, the run fails.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {GROUPS.map((group) => (
          <section key={group.title} className="rounded-[14px] border border-hairline p-5 md:p-6">
            <h3 className="text-lg font-semibold">{group.title}</h3>
            <p className="mt-0.5 text-sm text-ink-muted">Who tries: {group.who}</p>

            <ul className="mt-3 flex flex-col gap-2 text-base text-ink-body">
              {group.attempts.map((attempt) => (
                <li key={attempt} className="flex gap-3">
                  {/* "Refused" is the word; the mark only repeats it. */}
                  <span aria-hidden="true" className="mt-0.5 shrink-0 font-semibold text-ink">
                    ✕
                  </span>
                  <span>
                    {attempt} <span className="font-semibold text-ink">Refused.</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <h2 className="mt-12 text-[22px] leading-tight font-semibold md:text-[26px]">
        Who can sign up, exactly
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-base text-ink-body">
        <p>
          The home page says “Locked to NITTE”. The precise rule: an account needs an email
          address ending in <strong className="text-ink">@nmit.ac.in</strong>. Anything else is
          refused by a check inside the database&rsquo;s own sign-up step, which a hand-written
          request cannot route around.
        </p>
        <p>
          There is one exception, and it is deliberate. Addresses ending in{" "}
          <strong className="text-ink">@reviewer.test</strong> are also accepted, so that the
          people assessing this project can try signing up. “.test” is reserved and can never be
          a real email domain. In a real launch that line would be deleted.
        </p>
        <p>
          One more thing worth knowing: for this demo, new accounts are not asked to confirm
          their email. So the check is on what the address looks like, not on whether you own
          it. A real launch would turn confirmation on.
        </p>
      </div>

      <h2 className="mt-12 text-[22px] leading-tight font-semibold md:text-[26px]">
        What this does not prove
      </h2>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-base text-ink-body">
        <li>It is a student&rsquo;s test script, not a professional security audit.</li>
        <li>Photo uploads have their own rules, and the script does not attack those yet.</li>
        <li>It tests the rules that exist. It cannot find a rule nobody thought to write.</li>
        <li>
          Three checks are the other way round: they confirm the public home page gets only
          what a listing card shows, and nothing about who is selling.
        </li>
      </ul>

      <h2 className="mt-12 text-[22px] leading-tight font-semibold md:text-[26px]">
        Run it yourself
      </h2>
      <p className="mt-2 text-base text-ink-body">
        The script is in the repository, and the README explains the set-up. Then:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-[14px] bg-surface-soft p-4 font-mono text-sm text-ink">
        <code>npm run verify:rls</code>
      </pre>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a
          href={SCRIPT_URL}
          className="flex h-12 items-center justify-center rounded-lg bg-accent px-6 text-base font-semibold text-on-accent hover:bg-accent-active"
        >
          Read the script on GitHub
        </a>
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
