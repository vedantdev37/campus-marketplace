import type { ListingType } from "@/lib/types/listing";

/**
 * Three ways of saying the headline lines: English, Hinglish and Kanglish.
 *
 * Hinglish and Kanglish here are Hindi and Kannada written in English
 * letters, the way students actually text each other - not Devanagari or
 * Kannada script. That is also why the title cards can stay in Anton, which
 * has only Latin letters.
 *
 * WHAT IS TRANSLATED
 * Only the lines in this file: the hero, the six post tiles, the home section
 * titles and "See all". Navigation labels, forms, errors and everything a
 * user types stay in English in all three. A half-translated form is worse
 * than an English one, and an error message is not the place for a guess.
 *
 * WHO CHECKED THE WORDING
 * These lines were drafted with AI and shown to the author before shipping.
 * The Kanglish in particular should be read by a Kannada speaker.
 */

export const LANGUAGES = ["en", "hinglish", "kanglish"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  hinglish: "Hinglish",
  kanglish: "Kanglish",
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

type Lines = {
  heroLine1: string;
  heroLine2: string;
  heroBody: string;
  seeAll: string;
  locked: string;
  post: Record<ListingType, string>;
  section: Record<"buy" | "rent" | "free" | "squad" | "found", string>;
};

const LINES: Record<Language, Lines> = {
  en: {
    heroLine1: "Seniors leave.",
    heroLine2: "Their stuff doesn’t have to.",
    heroBody:
      "Textbooks, calculators, lab coats and hostel gear, passed on by students at your college. No shipping. You meet on campus.",
    seeAll: "See all",
    locked: "Locked to NITTE.",
    post: {
      sale: "Sell it",
      rent: "Rent it out",
      free: "Give it away",
      lost_found: "Found something",
      skill_offer: "Offer a skill",
      team_request: "Find teammates",
    },
    section: {
      buy: "Fresh drops",
      rent: "Rent it",
      free: "Free this week",
      squad: "Squad up",
      found: "Lost & Found",
    },
  },
  hinglish: {
    heroLine1: "Seniors chale jaate hain.",
    heroLine2: "Unka saamaan nahi.",
    heroBody:
      "Books, calculator, lab coat, hostel ka saamaan, aapke college ke students se. Shipping nahi. Campus pe milo.",
    seeAll: "Sab dekho",
    locked: "Sirf NITTE waalon ke liye.",
    post: {
      sale: "Bech do",
      rent: "Kiraye pe do",
      free: "Free mein de do",
      lost_found: "Kuch mila hai",
      skill_offer: "Skill offer karo",
      team_request: "Team dhoondo",
    },
    section: {
      buy: "Naya maal",
      rent: "Kiraye pe lo",
      free: "Is hafte free",
      squad: "Squad banao",
      found: "Khoya-paya",
    },
  },
  kanglish: {
    heroLine1: "Seniors hogthare.",
    heroLine2: "Avra saamaanu illiye irli.",
    heroBody:
      "Books, calculator, lab coat, hostel saamaanu, nimma college students inda. Shipping illa. Campus alle sigi.",
    seeAll: "Ella nodi",
    locked: "NITTE avrige maathra.",
    post: {
      sale: "Maari bidi",
      rent: "Baadige kodi",
      free: "Free aagi kodi",
      lost_found: "Yeno sikthu",
      skill_offer: "Skill offer maadi",
      team_request: "Team hudki",
    },
    section: {
      buy: "Hosa maal",
      rent: "Baadige thogoli",
      free: "Ee vaara free",
      squad: "Squad kattri",
      found: "Kaledu-sikkiddu",
    },
  },
};

export function linesFor(language: Language): Lines {
  return LINES[language];
}
