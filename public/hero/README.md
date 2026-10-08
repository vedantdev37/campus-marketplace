# Hero photos

The home page hero shows every image in this folder, in filename order, slowly
drifting sideways and crossfading from one to the next.

The three files here now are **placeholders** — flat illustrations drawn by
`scripts/make-hero-placeholders.mjs`. Replace them with real campus photographs
whenever you like.

## To use real photos

1. Delete the placeholder `.webp` files.
2. Add your own, named so they sort in the order you want:
   `01-main-gate.webp`, `02-library.webp`, `03-quad.webp`
3. Redeploy (or restart `npm run dev`). The list is read when the app is built.

## What works well

| | |
| --- | --- |
| **Shape** | Wide landscape, around 2:1. The hero is a wide, short band. |
| **Size** | About 2400 px wide. Larger adds download time for no visible gain. |
| **Format** | WebP at quality 75–80. Aim for under 300 KB each. |
| **How many** | 3 to 5. At most 6 are used. |
| **Subject** | Keep the important part away from the bottom third: the headline sits there, over a dark gradient. |
| **Motion** | The image is scaled up 8% and drifts 4% sideways, so the outer edges are cropped. Do not put anything essential at the very edge. |

To convert a photo, with `sharp` already installed in this project:

```bash
node -e "require('sharp')('photo.jpg').resize(2400).webp({quality:78}).toFile('public/hero/01-photo.webp')"
```

## Accessibility

Visitors who have asked their system to reduce motion see only the first image,
still, with no drift and no crossfade. So make the first file the one you most
want everyone to see.

The photos are decorative (the headline carries the meaning), so they have no
alt text.
