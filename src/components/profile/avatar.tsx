"use client";

import Image from "next/image";
import { useState } from "react";

import { listingImageUrl } from "@/lib/storage";

/**
 * A profile photo, or the person's initials when they have none.
 *
 * The initials are a real fallback and not a broken-image placeholder: most
 * students will never upload a photo, so this is what most profiles look like.
 * They are also what shows if a photo fails to load - a stored path can
 * outlive its file - instead of the browser's alt text squeezed into a circle.
 */
export function Avatar({
  name,
  initials,
  avatarPath,
  size,
}: {
  name: string;
  initials: string;
  avatarPath: string | null;
  /** Pixels. */
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const url = failed ? null : listingImageUrl(avatarPath);

  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {url ? (
        <Image
          src={url}
          alt={`Photo of ${name}`}
          fill
          sizes={`${size}px`}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
