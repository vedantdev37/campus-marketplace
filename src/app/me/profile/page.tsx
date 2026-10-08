import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProfileForm } from "@/components/profile/profile-form";
import { requireSessionUser } from "@/lib/auth";
import { getProfile } from "@/lib/profiles";

export const metadata: Metadata = {
  title: "Edit profile · Nitte Mart",
};

export default async function EditProfilePage() {
  const user = await requireSessionUser();
  const profile = await getProfile(user.id);

  if (!profile) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 bg-canvas px-4 py-8 text-ink md:px-6">
      <Link href="/me" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline">
        ← Back to Me
      </Link>

      <h1 className="mt-2 mb-6 text-[28px] leading-tight font-bold">Edit profile</h1>

      <ProfileForm profile={profile} />
    </main>
  );
}
