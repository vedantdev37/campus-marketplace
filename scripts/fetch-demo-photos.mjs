/**
 * Downloads the stock photos used for the demo listings and saves compressed
 * copies in scripts/demo-photos/.
 *
 *   node scripts/fetch-demo-photos.mjs
 *
 * It only needs running again if the list below changes: the compressed files
 * are committed, so seeding never depends on the network or on these photos
 * staying online.
 *
 * WHERE THEY COME FROM
 * Every photo is from Unsplash, chosen from results filtered to the free
 * Unsplash License (not Unsplash+), and none shows a person. The photographer
 * and a link for each are in docs/credits.md, which this script writes from
 * the same list - so a photo cannot be added here without being credited.
 *
 * The download goes through Unsplash's own download endpoint, which is how
 * they ask for a download to be counted for the photographer.
 */

import { mkdir, writeFile } from "node:fs/promises";

import sharp from "sharp";

const OUT_DIR = new URL("./demo-photos/", import.meta.url);

/**
 * key (used by seed-demo.mjs) -> Unsplash photo, photographer and what it
 * shows. Each name is the one on that photo's own Unsplash page ("Photo by
 * ..."), read from the page and not guessed from the username.
 */
export const PHOTOS = [
  { key: "maths-book", id: "lUaaKCUANVI", by: "Kimberly Farmer", user: "kimberlyfarmer", shows: "A stack of books" },
  { key: "dsa-book", id: "esCc1qx6TVw", by: "Ehud Neuhaus", user: "paramir", shows: "A book beside a laptop" },
  { key: "calculator", id: "sUU5rv3n9sw", by: "Gavin Allanwood", user: "fp4", shows: "A scientific calculator with its cover open" },
  { key: "lamp", id: "mbLODxRuk0o", by: "Luigy Ghost", user: "luigy_ghost", shows: "A black adjustable desk lamp" },
  { key: "os-notes", id: "LJ2ksdahQZ8", by: "Bozhin Karaivanov", user: "bkaraivanov", shows: "Formulas on paper" },
  { key: "lab-coat", id: "euYdDX8xnzk", by: "Brooke Balentine", user: "brookebalentine", shows: "Lab coats hanging in a lab" },
  { key: "lab-coat-rack", id: "mQ158AIvL8w", by: "Olga Serjantu", user: "olgaserjantu", shows: "A white coat on a coat stand" },
  { key: "chair", id: "iFBIdX54BOk", by: "Keagan Henman", user: "henmankk", shows: "A padded metal folding chair" },
  { key: "drafter", id: "dQf7RZhMOJU", by: "Fleur", user: "yer_a_wizard", shows: "Drafting instruments on a table" },
  { key: "chem-notes", id: "iiaUVel-cJE", by: "Kelly Sikkema", user: "kellysikkema", shows: "A spiral notebook beside a pen" },
  { key: "free-lamp", id: "3A4XZUopCJA", by: "Andrej Lišakov", user: "lishakov", shows: "A balanced-arm desk lamp" },
  { key: "bottle", id: "csQEHjxz8VU", by: "Steinar Engeland", user: "steinart", shows: "A blue steel bottle", position: "north" },
  { key: "lost-calculator", id: "Hlbfm6J7VR8", by: "dostonxd", user: "dostonxd", shows: "A calculator on a table" },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const photo of PHOTOS) {
    const response = await fetch(`https://unsplash.com/photos/${photo.id}/download?force=true&w=1600`, {
      headers: { "User-Agent": "NitteMart demo seed (student project)" },
    });

    if (!response.ok) {
      throw new Error(`Could not download ${photo.key} (${photo.id}): HTTP ${response.status}`);
    }

    const original = Buffer.from(await response.arrayBuffer());

    // 4:3 at 1200 px wide: the shape of the photo on a listing page. `attention`
    // keeps the most detailed part of the picture when it has to crop.
    const webp = await sharp(original)
      .rotate()
      .resize(1200, 900, { fit: "cover", position: photo.position ?? sharp.strategy.attention })
      .webp({ quality: 80 })
      .toBuffer();

    await writeFile(new URL(`${photo.key}.webp`, OUT_DIR), webp);
    console.log(`  ${photo.key.padEnd(16)} ${Math.round(original.length / 1024)} KB -> ${Math.round(webp.length / 1024)} KB`);
  }

  const rows = PHOTOS.map(
    (photo) =>
      `| ${photo.shows} | [${photo.by}](https://unsplash.com/@${photo.user}) | [unsplash.com/photos/${photo.id}](https://unsplash.com/photos/${photo.id}) |`,
  ).join("\n");

  await writeFile(
    new URL("../docs/credits.md", import.meta.url),
    `# Photo credits

The photographs on the demo listings are stock photos from
[Unsplash](https://unsplash.com), used under the
[Unsplash License](https://unsplash.com/license), which allows free use
without permission. Credit is not required by that licence; it is given here
because the photographers did the work.

They illustrate the demo data only. They are not photographs of the actual
items described, and none of them shows a person. A real listing shows the
photo its seller uploaded.

| What it shows | Photographer | Source |
| --- | --- | --- |
${rows}

Each file was downloaded once by \`scripts/fetch-demo-photos.mjs\`, cropped to
4:3 and compressed to WebP, and committed under \`scripts/demo-photos/\`. To
use your own photo for a demo listing instead, put a file with the same name
(for example \`calculator.jpg\`) in \`public/demo-photos/\` and run
\`npm run reseed:demo\`: your file is preferred.

The hero images on the home page are generated placeholders, not photographs.
The profile photo on the showcase profile is the author's own.
`,
  );

  console.log("\nWrote docs/credits.md");
}

// Only when run directly: seed-demo.mjs imports PHOTOS from this file.
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("fetch-demo-photos.mjs")) {
  main().catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
}
