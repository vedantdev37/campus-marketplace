import { env } from "@/lib/env";

/** The Storage bucket holding listing photos. Created by migration 0003. */
export const LISTING_IMAGE_BUCKET = "listing-images";

/**
 * Upload limits, mirroring the bucket's own settings in migration 0003.
 *
 * The bucket enforces these whatever the client does; they are repeated here so
 * the form can say "that file is too large" before spending the upload.
 */
export const LISTING_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const LISTING_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** A reason the file cannot be used, or null when it is fine. */
export function listingImageProblem(file: { size: number; type: string }): string | null {
  if (!(LISTING_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Use a JPEG, PNG or WebP image.";
  }

  if (file.size > LISTING_IMAGE_MAX_BYTES) {
    return "That image is over 5 MB. Choose a smaller one.";
  }

  return null;
}

/**
 * Public URL for a stored listing image.
 *
 * Built from the project URL rather than fetched via
 * `supabase.storage.getPublicUrl()`, which would mean constructing a client
 * just to do string concatenation. Works in Server and Client Components alike.
 *
 * Rows store a bucket-relative path, so this is the only place that knows the
 * URL shape - moving buckets means changing this function, not rewriting rows.
 */
export function listingImageUrl(path: string | null): string | null {
  if (!path) {
    return null;
  }

  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LISTING_IMAGE_BUCKET}/${path}`;
}

/**
 * Storage object path for a user's upload: `<uid>/<random>.<ext>`.
 *
 * The leading uid segment is load-bearing: the Storage policies in migration
 * 0003 require the first path segment to equal the caller's own uid, so the
 * path itself is the ownership record. A random filename avoids one upload
 * silently overwriting another with the same name.
 */
export function buildListingImagePath(userId: string, fileName: string): string {
  const extension = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase()
    : "jpg";

  const safeExtension = /^(jpe?g|png|webp)$/.test(extension) ? extension : "jpg";

  return `${userId}/${crypto.randomUUID()}.${safeExtension}`;
}
