import { z } from "zod";

import { campusInstant, hourLabel } from "@/lib/campus-time";
import {
  MEETUP_FIRST_HOUR,
  MEETUP_LAST_HOUR,
  MEETUP_MAX_DAYS_AHEAD,
  MESSAGE_MAX_LENGTH,
} from "@/lib/types/chat";
import { isUuid } from "@/lib/uuid";

/**
 * Validation for chat messages and meetup proposals.
 *
 * Used by the forms for immediate feedback and again in the Server Actions.
 * Neither is the last word: the same limits are a CHECK on `messages` and are
 * re-tested inside `propose_meetup()` (migration 0008), because a signed-in
 * user can call the database directly and skip this file.
 */

export const messageBodySchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, { error: "Write a message first." })
      .max(MESSAGE_MAX_LENGTH, { error: `Keep it under ${MESSAGE_MAX_LENGTH} characters.` }),
  );

const uuidSchema = z.string().refine(isUuid, { error: "Choose a pickup spot." });

const FIRST = hourLabel(MEETUP_FIRST_HOUR);
const LAST = hourLabel(MEETUP_LAST_HOUR);

/**
 * A proposed meetup: a spot, a date and a time, all in campus time.
 *
 * `now` is a parameter so the "in the future" rule is decided by the caller's
 * clock - the server's, in the action - and so the rule can be reasoned about
 * without waiting for a particular time of day.
 */
export function meetupSchema(now: Date = new Date()) {
  return z
    .object({
      pickupSpotId: uuidSchema,
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Choose a date." }),
      time: z.string().regex(/^\d{2}:\d{2}$/, { error: "Choose a time." }),
    })
    .transform((value, context) => {
      const meetAt = campusInstant(value.date, value.time);

      if (!meetAt) {
        context.addIssue({ code: "custom", path: ["date"], message: "That is not a real date." });
        return z.NEVER;
      }

      // Zero-padded HH:MM strings sort the same way the times do.
      if (value.time < FIRST || value.time > LAST) {
        context.addIssue({
          code: "custom",
          path: ["time"],
          message: "Pick a time between 8 am and 8 pm.",
        });
        return z.NEVER;
      }

      if (meetAt.getTime() <= now.getTime()) {
        context.addIssue({
          code: "custom",
          path: ["time"],
          message: "That time has already passed.",
        });
        return z.NEVER;
      }

      if (meetAt.getTime() > now.getTime() + MEETUP_MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
        context.addIssue({
          code: "custom",
          path: ["date"],
          message: `Pick a date within the next ${MEETUP_MAX_DAYS_AHEAD} days.`,
        });
        return z.NEVER;
      }

      return { pickupSpotId: value.pickupSpotId, meetAt: meetAt.toISOString() };
    });
}

export type MeetupInput = { pickupSpotId: string; date: string; time: string };
