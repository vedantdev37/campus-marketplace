/**
 * Placeholder photos for the demo listings.
 *
 * Each image is drawn as SVG and rendered to WebP with sharp, so the seed
 * script needs no image files checked into the repo and no network access to a
 * stock-photo site. They are deliberately simple flat illustrations: obviously
 * placeholders, but enough that the grid, the sold treatment and the detail
 * page can be judged with pictures in them.
 *
 * To use real photos instead, upload them through the app's own edit form -
 * nothing here needs to change.
 */

import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 900;

/** Escapes text for use inside SVG markup. */
function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Breaks a title into lines of roughly `maxChars`, on word boundaries. */
function wrapText(text, maxChars, maxLines) {
  const lines = [];
  let current = "";

  for (const word of text.split(/\s+/)) {
    if (current !== "" && `${current} ${word}`.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current === "" ? word : `${current} ${word}`;
    }
  }

  if (current !== "") {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s,.-]+$/, "")}…`;
    return kept;
  }

  return lines;
}

/** A soft surface for the item to sit on, with a floor shadow under it. */
function backdrop(wall, floor) {
  return `
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${wall}"/>
    <rect y="640" width="${WIDTH}" height="260" fill="${floor}"/>
    <ellipse cx="600" cy="690" rx="330" ry="34" fill="#000000" opacity="0.13"/>`;
}

function book({ title, author, cover, accent }) {
  const lines = wrapText(title, 15, 4);
  const titleSvg = lines
    .map(
      (line, index) =>
        `<text x="600" y="${300 + index * 58}" font-family="Georgia, 'Times New Roman', serif" font-size="46" font-weight="700" text-anchor="middle" fill="#ffffff">${escapeXml(line)}</text>`,
    )
    .join("");

  return `
    ${backdrop("#efe7dc", "#d9cbb8")}
    <!-- page block, peeking out on the right and bottom -->
    <rect x="392" y="118" width="436" height="568" rx="6" fill="#f7f3ea"/>
    <rect x="380" y="110" width="430" height="560" rx="6" fill="${cover}"/>
    <rect x="380" y="110" width="34" height="560" rx="6" fill="#000000" opacity="0.18"/>
    <rect x="440" y="190" width="320" height="6" fill="${accent}"/>
    ${titleSvg}
    <rect x="440" y="560" width="320" height="6" fill="${accent}"/>
    <text x="600" y="620" font-family="Georgia, 'Times New Roman', serif" font-size="30" text-anchor="middle" fill="#ffffff" opacity="0.9">${escapeXml(author ?? "")}</text>`;
}

function calculator() {
  const keys = [];
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      const fill = row === 0 ? "#5b6472" : column === 4 ? "#c8553d" : "#2f3742";
      keys.push(
        `<rect x="${448 + column * 62}" y="${330 + row * 62}" width="48" height="44" rx="8" fill="${fill}"/>`,
      );
    }
  }

  return `
    ${backdrop("#e4ebf0", "#c9d5dd")}
    <rect x="410" y="100" width="380" height="580" rx="34" fill="#1d232b"/>
    <rect x="442" y="140" width="316" height="120" rx="10" fill="#b9c9a8"/>
    <text x="740" y="222" font-family="'Courier New', monospace" font-size="54" font-weight="700" text-anchor="end" fill="#26301f">3.14159</text>
    <text x="448" y="300" font-family="Arial, sans-serif" font-size="20" fill="#8793a3">fx-991EX</text>
    ${keys.join("")}`;
}

function lamp() {
  return `
    ${backdrop("#f1ece2", "#ddd2c0")}
    <polygon points="640,250 830,330 760,470 580,380" fill="#fff3c4" opacity="0.55"/>
    <ellipse cx="560" cy="668" rx="150" ry="26" fill="#2c3440"/>
    <rect x="548" y="430" width="24" height="240" rx="12" fill="#3a4452"/>
    <rect x="548" y="250" width="24" height="200" rx="12" fill="#3a4452" transform="rotate(32 560 440)"/>
    <circle cx="560" cy="440" r="20" fill="#56627a"/>
    <path d="M632 232 L772 250 L740 344 L612 322 Z" fill="#c8553d"/>
    <ellipse cx="676" cy="334" rx="62" ry="14" fill="#fff3c4"/>`;
}

function notes({ title }) {
  const lines = [];
  for (let index = 0; index < 11; index += 1) {
    const width = 300 - ((index * 53) % 120);
    lines.push(`<rect x="470" y="${290 + index * 30}" width="${width}" height="6" rx="3" fill="#7c8aa5" opacity="0.55"/>`);
  }

  const spiral = [];
  for (let index = 0; index < 14; index += 1) {
    spiral.push(`<circle cx="420" cy="${150 + index * 38}" r="11" fill="none" stroke="#5a6474" stroke-width="5"/>`);
  }

  return `
    ${backdrop("#e9eef2", "#cfd9df")}
    <rect x="420" y="126" width="420" height="556" rx="8" fill="#dfe5ea" transform="rotate(3 630 400)"/>
    <rect x="400" y="110" width="420" height="560" rx="8" fill="#fdfcf7"/>
    <rect x="452" y="110" width="3" height="560" fill="#e58f8f"/>
    <text x="470" y="200" font-family="'Segoe Script', 'Comic Sans MS', cursive" font-size="38" fill="#27407a">${escapeXml(wrapText(title, 18, 1)[0])}</text>
    <text x="470" y="250" font-family="'Segoe Script', 'Comic Sans MS', cursive" font-size="26" fill="#27407a" opacity="0.8">Unit 1 - 5, with diagrams</text>
    ${lines.join("")}
    ${spiral.join("")}`;
}

function chair() {
  return `
    ${backdrop("#ece9e4", "#d3cdc3")}
    <rect x="440" y="150" width="320" height="250" rx="26" fill="#3f6b8c"/>
    <rect x="440" y="150" width="320" height="250" rx="26" fill="#000000" opacity="0.08"/>
    <rect x="452" y="380" width="22" height="80" fill="#4a4f57"/>
    <rect x="726" y="380" width="22" height="80" fill="#4a4f57"/>
    <rect x="410" y="450" width="380" height="54" rx="20" fill="#4d7fa3"/>
    <rect x="438" y="500" width="20" height="186" fill="#4a4f57" transform="rotate(8 448 500)"/>
    <rect x="742" y="500" width="20" height="186" fill="#4a4f57" transform="rotate(-8 752 500)"/>
    <rect x="500" y="500" width="16" height="170" fill="#3c4047"/>
    <rect x="684" y="500" width="16" height="170" fill="#3c4047"/>`;
}

function labCoat() {
  return `
    ${backdrop("#e6eef2", "#cddae1")}
    <path d="M470 150 L560 120 L600 190 L640 120 L730 150 L820 300 L750 340 L720 290 L720 660 L480 660 L480 290 L450 340 L380 300 Z" fill="#fbfcfd" stroke="#c5d0d8" stroke-width="4"/>
    <path d="M560 120 L600 190 L640 120 L620 112 L600 150 L580 112 Z" fill="#e7edf1"/>
    <line x1="600" y1="190" x2="600" y2="660" stroke="#c5d0d8" stroke-width="4"/>
    <circle cx="582" cy="300" r="8" fill="#9fb0bc"/>
    <circle cx="582" cy="400" r="8" fill="#9fb0bc"/>
    <circle cx="582" cy="500" r="8" fill="#9fb0bc"/>
    <rect x="630" y="270" width="64" height="74" rx="4" fill="none" stroke="#c5d0d8" stroke-width="4"/>
    <rect x="648" y="252" width="8" height="44" rx="3" fill="#3f6b8c"/>
    <rect x="510" y="520" width="56" height="70" rx="4" fill="none" stroke="#c5d0d8" stroke-width="4"/>
    <rect x="634" y="520" width="56" height="70" rx="4" fill="none" stroke="#c5d0d8" stroke-width="4"/>`;
}

/** A mini drafter: a drawing board with its sliding arm and scale. */
function drafter() {
  return `
    ${backdrop("#ece6da", "#d8cfbd")}
    <rect x="300" y="200" width="600" height="420" rx="14" fill="#f7f3e9" stroke="#b9ad94" stroke-width="6"/>
    <rect x="330" y="300" width="540" height="26" rx="6" fill="#2f6f8f"/>
    <rect x="560" y="230" width="30" height="360" rx="6" fill="#2f6f8f"/>
    <circle cx="575" cy="313" r="26" fill="#1d4c63"/>
    <g stroke="#1d4c63" stroke-width="3">
      ${Array.from({ length: 16 }, (_, i) => `<line x1="${350 + i * 32}" y1="300" x2="${350 + i * 32}" y2="${i % 4 === 0 ? 286 : 292}"/>`).join("")}
    </g>`;
}

/** A steel water bottle. */
function bottle() {
  return `
    ${backdrop("#e4ecef", "#cbd8dd")}
    <rect x="555" y="170" width="90" height="60" rx="10" fill="#27445a"/>
    <rect x="520" y="225" width="160" height="440" rx="46" fill="#3d7ea6"/>
    <rect x="520" y="380" width="160" height="90" fill="#2c5f80"/>
    <rect x="548" y="250" width="22" height="380" rx="11" fill="#ffffff" opacity="0.25"/>`;
}

const PAINTERS = { book, calculator, lamp, notes, chair, labCoat, drafter, bottle };

/**
 * Renders one demo image.
 *
 * `art` names the illustration; the remaining fields are passed to it (a book
 * needs its title, author and colours). Returns WebP bytes, which is one of the
 * three types the Storage bucket accepts and by far the smallest.
 */
export async function renderDemoImage({ art, ...details }) {
  const paint = PAINTERS[art];

  if (!paint) {
    throw new Error(`No demo illustration called "${art}".`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${paint(details)}</svg>`;

  return sharp(Buffer.from(svg)).webp({ quality: 84 }).toBuffer();
}
