import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ListingCard } from "@/components/listings/listing-card";
import { Avatar } from "@/components/profile/avatar";
import { requireSessionUser } from "@/lib/auth";
import { getOpenPostsBy, getProfile, initialsOf } from "@/lib/profiles";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = {
  title: "Profile · Nitte Mart",
};

/**
 * Someone's public face on the site: who they are, what they can do, and what
 * they have posted. Signed-in students only - the proxy sends everyone else to
 * sign in, and the profiles table is closed to signed-out requests anyway.
 */
export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser();
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const profile = await getProfile(id);

  if (!profile) {
    notFound();
  }

  const posts = await getOpenPostsBy(id);
  const isMe = profile.id === user.id;
  const name = profile.full_name || "A student";

  return (
    <main className="mx-auto w-full max-w-[1080px] flex-1 bg-canvas px-4 py-8 text-ink md:px-6 md:py-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar name={name} initials={initialsOf(name)} avatarPath={profile.avatar_path} size={96} />

        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-extrabold break-words md:text-[36px]">{name}</h1>

          {profile.bio ? (
            <p className="mt-2 max-w-xl text-base whitespace-pre-line text-ink-body">{profile.bio}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            {profile.github_username ? (
              // Built from a stored USERNAME, which the database limits to the
              // characters GitHub allows. There is no stored URL to go wrong.
              <a
                href={`https://github.com/${profile.github_username}`}
                rel="noopener noreferrer"
                target="_blank"
                className="inline-flex min-h-11 items-center text-base font-semibold text-ink underline"
              >
                github.com/{profile.github_username}
              </a>
            ) : null}

            {isMe ? (
              <Link
                href="/me/profile"
                className="inline-flex min-h-11 items-center text-base font-semibold text-ink underline"
              >
                Edit my profile
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {profile.skills.length > 0 ? (
        <section aria-labelledby="skills-heading" className="mt-8">
          <h2 id="skills-heading" className="text-lg font-semibold">
            Skills
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <li key={skill}>
                <Link
                  href={`/explore?tab=squad&tag=${encodeURIComponent(skill)}`}
                  className="flex min-h-11 items-center rounded-full border border-control-border px-4 text-sm font-medium text-ink hover:bg-surface-soft"
                >
                  {skill}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="posts-heading" className="mt-10">
        <h2 id="posts-heading" className="text-lg font-semibold">
          Open posts ({posts.length})
        </h2>

        {posts.length === 0 ? (
          <p className="mt-2 text-base text-ink-body">
            {isMe ? "You have nothing open right now." : `${name} has nothing open right now.`}
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
            {posts.map((listing) => (
              <li key={listing.id} className="flex flex-col">
                <ListingCard listing={listing} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
