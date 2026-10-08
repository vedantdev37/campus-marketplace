/**
 * Draws the placeholder images for the home page hero.
 *
 *   node scripts/make-hero-placeholders.mjs
 *
 * The hero shows whatever images are in public/hero/, in filename order. These
 * three are stand-ins - flat illustrations of a campus at different times of
 * day - so the panning and crossfading can be built and judged before real
 * photographs exist.
 *
 * TO USE REAL PHOTOS: delete these files and put your own in public/hero/.
 * See public/hero/README.md for the sizes that work.
 */

import { mkdir } from "node:fs/promises";

import sharp from "sharp";

const WIDTH = 2400;
const HEIGHT = 1100;

/** A row of simple buildings with lit or unlit windows. */
function buildings(baseY, colour, windowColour, seed) {
  const parts = [];
  let x = -40;
  let index = 0;

  while (x < WIDTH) {
    // Deterministic "random": the same seed always draws the same skyline.
    const width = 150 + ((seed * (index + 3) * 37) % 190);
    const height = 170 + ((seed * (index + 5) * 53) % 260);
    const top = baseY - height;

    parts.push(`<rect x="${x}" y="${top}" width="${width}" height="${height + 400}" fill="${colour}"/>`);

    for (let wy = top + 28; wy < baseY - 30; wy += 46) {
      for (let wx = x + 22; wx < x + width - 30; wx += 42) {
        if ((wx * 7 + wy * 3 + seed) % 5 !== 0) {
          parts.push(`<rect x="${wx}" y="${wy}" width="20" height="26" rx="2" fill="${windowColour}"/>`);
        }
      }
    }

    x += width + 18;
    index += 1;
  }

  return parts.join("");
}

function trees(baseY, colour, seed) {
  const parts = [];

  for (let x = 60; x < WIDTH; x += 150 + ((seed * x) % 130)) {
    const radius = 56 + ((seed + x) % 40);
    parts.push(`<rect x="${x - 7}" y="${baseY - 60}" width="14" height="80" fill="#3a2f28"/>`);
    parts.push(`<circle cx="${x}" cy="${baseY - 60 - radius * 0.6}" r="${radius}" fill="${colour}"/>`);
  }

  return parts.join("");
}

const SCENES = [
  {
    file: "01-morning.webp",
    sky: ["#f6d9b8", "#f3b98a", "#e8946c"],
    sun: { cx: 1750, cy: 420, r: 120, fill: "#fff1c9" },
    far: "#b98a78",
    near: "#7d5a52",
    windows: "#f8e0b0",
    tree: "#5d7a54",
    ground: "#4f4038",
    seed: 7,
  },
  {
    file: "02-afternoon.webp",
    sky: ["#8ec5e8", "#b9dcef", "#e6f1f5"],
    sun: { cx: 520, cy: 230, r: 90, fill: "#fffbe6" },
    far: "#9aa9b8",
    near: "#5f6f80",
    windows: "#dfeaf2",
    tree: "#4f7d4a",
    ground: "#3f4a43",
    seed: 11,
  },
  {
    file: "03-dusk.webp",
    sky: ["#1f2a4d", "#5a3d6b", "#d9714f"],
    sun: { cx: 1250, cy: 760, r: 150, fill: "#ffb36b" },
    far: "#3a3157",
    near: "#221d38",
    windows: "#ffd27a",
    tree: "#1f3a30",
    ground: "#15121f",
    seed: 13,
  },
];

function scene({ sky, sun, far, near, windows, tree, ground, seed }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${sky[0]}"/>
        <stop offset="0.55" stop-color="${sky[1]}"/>
        <stop offset="1" stop-color="${sky[2]}"/>
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#sky)"/>
    <circle cx="${sun.cx}" cy="${sun.cy}" r="${sun.r * 1.9}" fill="${sun.fill}" opacity="0.22"/>
    <circle cx="${sun.cx}" cy="${sun.cy}" r="${sun.r}" fill="${sun.fill}"/>
    ${buildings(820, far, windows, seed)}
    ${buildings(900, near, windows, seed + 4)}
    ${trees(940, tree, seed)}
    <rect y="940" width="${WIDTH}" height="${HEIGHT - 940}" fill="${ground}"/>
  </svg>`;
}

await mkdir("public/hero", { recursive: true });

for (const config of SCENES) {
  const path = `public/hero/${config.file}`;
  const info = await sharp(Buffer.from(scene(config))).webp({ quality: 78 }).toFile(path);
  console.log(`${path}  ${Math.round(info.size / 1024)} KB`);
}
