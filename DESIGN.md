---
version: 2
name: nitte-mart-after-dark
description: Nitte Mart's own design system. Dark-first and cinematic, built around a near-black canvas, deep indigo and one warm yellow accent, with tall condensed title-card headlines over photographs. It replaces the Airbnb-derived reference the project used before this redesign.

colors:
  dark:
    canvas: "#0b0b12"
    surface-soft: "#15151f"
    ink: "#f5f3ec"
    ink-body: "#c9c8d4"
    ink-muted: "#9a99ab"
    hairline: "#2a2a3a"
    hairline-soft: "#1e1e2a"
    control-border: "#7c7b92"
    accent: "#ffd60a"
    accent-active: "#e6bf00"
    on-accent: "#0b0b12"
    indigo: "#4338ca"
    indigo-text: "#a5b4fc"
    price: "#ffd60a"
    error: "#ff8a70"
    error-surface: "#2b1612"
    success: "#5fd08f"
    success-surface: "#12261b"
  light:
    canvas: "#faf8f2"
    surface-soft: "#f0ede4"
    ink: "#12111c"
    ink-body: "#3a3948"
    ink-muted: "#625f73"
    hairline: "#e4e0d6"
    hairline-soft: "#efece3"
    control-border: "#86839a"
    accent: "#ffd60a"
    accent-active: "#f2c800"
    on-accent: "#12111c"
    indigo: "#4338ca"
    indigo-text: "#4338ca"
    price: "#12111c"
    error: "#b42318"
    error-surface: "#fdecea"
    success: "#17693f"
    success-surface: "#e6f4ec"

typography:
  title-card:
    fontFamily: "Anton, Impact, 'Arial Narrow', sans-serif"
    fontWeight: 400
    textTransform: uppercase
    letterSpacing: 0.01em
    lineHeight: 0.95
  body:
    fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"

rounded:
  sm: 8px
  md: 14px
  lg: 20px
  full: 9999px
---

# Nitte Mart: "after dark"

The source of truth for values is [`src/app/globals.css`](src/app/globals.css). This file explains what the values are for and the rules for using them. If the two ever disagree, the CSS is what the site does, and this file should be corrected.

## The idea

NITTE sounds like "night", so the marketplace is the campus after dark: a near-black canvas, photographs graded down into it, and tall title-card headlines like the opening of a film. One warm yellow does the shouting. Everything else stays quiet so that it can.

The feel is borrowed from a few places and copied from none: game-launch sites for the full-bleed imagery and slow camera moves, product pages for one idea per screen, resale apps for photo-first cards, and dark productivity tools for restraint. The copy is cheeky, and it is always clear what to do next.

## Themes

**Dark is the default, for everyone.** The light theme exists and is fully supported, but a visitor gets it only by choosing it with the toggle in the header, the phone menu or the footer.

- The theme is the `data-theme` attribute on `<html>`: absent or `dark` is dark, `light` is light.
- The choice is stored in a `theme` cookie and read on the server in `layout.tsx`, so the first paint is already correct and nothing flashes.
- The operating system's light or dark setting is deliberately not consulted. The trade-off is that someone who prefers light everywhere has to press the toggle once.
- Components never use a `dark:` variant for colour. They use tokens (`bg-canvas`, `text-ink-muted`), and a theme redefines the tokens.

## Colour

| Token | Dark | Light | Used for |
| --- | --- | --- | --- |
| `canvas` | `#0b0b12` | `#faf8f2` | The page |
| `surface-soft` | `#15151f` | `#f0ede4` | Alternate scene bands, bubbles, skeletons, inset panels |
| `ink` | `#f5f3ec` (17.7:1) | `#12111c` (17.6:1) | Headlines, primary text |
| `ink-body` | `#c9c8d4` (11.9:1) | `#3a3948` (10.6:1) | Running text |
| `ink-muted` | `#9a99ab` (7.0:1) | `#625f73` (5.8:1) | Captions, meta, placeholders |
| `hairline` | `#2a2a3a` | `#e4e0d6` | Dividers, card borders (decoration) |
| `control-border` | `#7c7b92` (4.8:1) | `#86839a` (3.4:1) | Input and chip outlines |
| `accent` | `#ffd60a` | `#ffd60a` | Primary buttons, the SOLD stamp |
| `on-accent` | `#0b0b12` (13.9:1 on yellow) | `#12111c` | Text and icons on yellow |
| `indigo` | `#4338ca` | `#4338ca` | Your own chat bubbles (white text, 7.9:1) |
| `indigo-text` | `#a5b4fc` (9.8:1) | `#4338ca` (7.4:1) | Kickers above headlines |
| `price` | `#ffd60a` | `#12111c` | The price |
| `error` / `success` | `#ff8a70` / `#5fd08f` | `#b42318` / `#17693f` | Messages, with their `-surface` fills |

Ratios are against the canvas of the same theme and were calculated by hand, not measured with an audit tool.

### Rules for yellow

1. **Yellow is scarce.** Aim for one yellow thing per screenful: the primary action, or the price, or a SOLD stamp. If two compete, one of them should not be yellow.
2. **Yellow is never text on the light theme.** On the cream canvas it is about 1.4:1. That is why `price` is a separate token: yellow on dark, ink on light.
3. **Text on yellow is always `on-accent`**, never white.
4. **On the light theme a yellow button also gets a 1.5px ink outline** (one rule in `globals.css`). A yellow fill on cream is too close in lightness for its edge to be relied on.

### Text on photographs

The hero's headline, search box and pause button sit on a photograph that is dark in both themes, so they use literal white and yellow, not tokens. This is the only place literal colours are used for text.

## Type

Two typefaces, one job each.

- **Anton** (class `title-card`): headlines only. Always upper-case, line-height 0.95, tracking 0.01em. Chosen over Bebas Neue, which has no lower-case letters at all.
- **Plus Jakarta Sans**: everything that is read or typed.

| Use | Face | Size |
| --- | --- | --- |
| Hero headline | Anton | `clamp(44px, 8.4vw, 116px)` |
| Scene headline | Anton | 44px, 88px from `md` |
| Counters, 404 and stamp text | Anton | 48 to 84px |
| Page titles inside the app | Jakarta 600 | 26px |
| Listing title | Jakarta 800 | 28px, 40px from `md` |
| Price on a listing | Jakarta 800, tabular | 56px |
| Body | Jakarta 400 | 16px, 18px in scenes |
| Captions and meta | Jakarta 400 to 500 | 14px |
| Kicker | Jakarta 600, upper-case, 0.14em | 14px |

**Where Anton must not be used:** body text, form labels and inputs, chat messages, prices, and anything a user typed (listing titles, names). It is a display face with no weights; in a sentence it is hard to read, and a seller's title in tall capitals looks like shouting. Its rupee sign has not been checked, which is one more reason prices stay in Jakarta.

## Shape and elevation

- Radii: 8px for buttons and inputs, 14px for cards and panels, 20px for the listing photo and price card, fully round for chips, pills and icon buttons.
- One shadow tier (`shadow-float`), used for menus and dialogs. Depth otherwise comes from the two surface tones and from photographs.
- Minimum tap target 44px. Primary actions are 48px tall, 56px on the listing page.
- Focus is a 2px ink outline, 2px off the element. Text inputs show focus with an ink border instead.

## Components

- **Primary button:** yellow fill, `on-accent` text, 8px radius, 48px tall. Disabled: `surface-soft` fill, muted text.
- **Secondary button:** transparent, 1px ink outline, ink text.
- **Chip:** fully round, 1px `control-border`, 14px medium text. Used for facts on a listing and pickup spots.
- **Listing card:** the photo is the card. 4:5, 14px radius, the price on a solid canvas-coloured pill at the bottom-left of the photo, then a two-line title and one line of meta.
- **SOLD, marked four ways, never by colour alone:** a tilted yellow SOLD stamp over a dimmed photo, the word "Sold" beside the price, the price struck through, and the photo desaturated. The card link's accessible name begins with "Sold".
- **Listing page:** a large 4:3 photo, category kicker, title, fact chips, description, "What's in the box" (the seller's checklist), then details. The price card on the right holds the 56px price, the fair-price guide, the meetup and the chat action. On a phone a sticky bar keeps the price and the chat action in reach.
- **Chat:** your messages are indigo with white text, theirs are `surface-soft`. The meetup bar turns `success-surface` once a meetup is agreed.
- **Text input:** canvas fill, 1px `control-border`, 8px radius, 56px tall; ink border on focus.

## The home page: five scenes

One idea per screen, each with a kicker, a title card and a short paragraph.

1. **Hero.** Campus photographs drifting slowly, graded dark with an indigo multiply, under still film grain. Title card, one sentence, the search box, and how a reviewer can sign up.
2. **Scan it. List it.** An illustration of the ISBN scanner in three steps.
3. **Meet on campus.** A sample chat with an agreed meetup, and the pickup spots as chips.
4. **Locked to NITTE.** Live counts and the security test result, linking to `/security`.
5. **Fresh drops.** Recent listings, including one that has sold.

Then the end credits and the site footer, which carries the disclaimer on every page.

**Every number on the page is read, not written.** Counts come from `public_stats()`; the test figure comes from `src/lib/security-run.json`, which `npm run verify:rls` writes. If a source cannot be read, that part of the page is left out.

## Motion

- **Scroll reveals:** fade and rise 28px over 700ms. One `IntersectionObserver` for the page (`RevealObserver`); no scroll listeners.
- **Digit rollers:** each digit is a column of 0 to 9 that slides to its value over 1.4s when its scene arrives.
- **SOLD stamp:** wipes in from the left with `clip-path` on the home page.
- **Scan demo:** plays once when it scrolls into view, then rests on its last frame. It does not loop.
- **Parallax:** a 24px drift, only in browsers with native scroll-driven animations. Elsewhere the element stays still.
- **Hero drift:** 30 seconds each way, with a pause button, because it moves on its own for more than five seconds.

Rules:

1. Only `opacity`, `transform` and `clip-path` are animated.
2. **Content is visible by default.** The script hides what is below the fold and reveals it; with JavaScript off or slow, nothing is missing.
3. **Reduced motion means the final frame, still.** All of the above sits inside `prefers-reduced-motion: no-preference`, and the hero shows its first photograph without moving.

## Voice

Cheeky, and clear. The joke comes first and the instruction second, but the instruction is always there.

- An empty state says what is empty and what to do: "Clean sheet. No messages yet." followed by how a conversation starts.
- A blocking error says what went wrong and the next step: "NITTE emails only. Your Gmail can wait outside the gate. Use your @nmit.ac.in address."
- Anything destructive is asked plainly, with no joke: "Delete this listing? Its conversations and any meetup will be deleted too."
- Screen-reader-only text is never a joke.

## Known gaps

- The logo is not chosen. The header uses a text wordmark in Anton and the favicon is the letters NM.
- The hero photographs are generated placeholders.
- Contrast ratios were calculated, not measured. No screen reader has been used.
- The loading skeletons still use the older page widths, so the layout shifts slightly when content arrives.
