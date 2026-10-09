/**
 * Rotate the demo accounts' passwords.
 *
 *   npm run rotate:demo
 *
 * For each account: sign in with the current DEMO_*_PASSWORD, set a new random
 * password, sign out every session, confirm the new one works and the old one
 * is refused, then write the new value to .env.local. The new value is saved as
 * DEMO_*_PASSWORD_NEW before the account changes, so a crash cannot lose it.
 * Prints account names and outcomes only, never a password.
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ENV = ".env.local";

const ACCOUNTS = [
  ["seller@reviewer.test", "DEMO_SELLER_PASSWORD"],
  ["buyer@reviewer.test", "DEMO_BUYER_PASSWORD"],
  ["outsider@reviewer.test", "DEMO_OUTSIDER_PASSWORD"],
  ["vedant@reviewer.test", "DEMO_VEDANT_PASSWORD"],
];

const client = () =>
  createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const setEnv = (name, value) => {
  const text = readFileSync(ENV, "utf8");
  const line = new RegExp(`^${name}=.*$`, "m");
  writeFileSync(ENV, line.test(text) ? text.replace(line, `${name}=${value}`) : `${text.replace(/\s*$/, "")}\n${name}=${value}\n`);
};
const dropEnv = (name) => {
  const text = readFileSync(ENV, "utf8");
  writeFileSync(ENV, text.replace(new RegExp(`^${name}=.*\\r?\\n?`, "m"), ""));
};

let failures = 0;
for (const [email, name] of ACCOUNTS) {
  const oldPassword = process.env[name];
  if (!oldPassword) { console.log(`${email}: SKIP, ${name} is not set`); failures++; continue; }

  // Letters and digits plus a fixed suffix, so no character needs quoting in an env file.
  const next = randomBytes(15).toString("base64url").replace(/[-_]/g, "x") + "#9k";
  // Saved BEFORE the account changes, so a crash cannot lose the new value.
  setEnv(`${name}_NEW`, next);

  const supabase = client();
  const signIn = await supabase.auth.signInWithPassword({ email, password: oldPassword });
  if (signIn.error) { console.log(`${email}: FAIL sign-in with current password (${signIn.error.message})`); dropEnv(`${name}_NEW`); failures++; continue; }

  const update = await supabase.auth.updateUser({ password: next });
  if (update.error) { console.log(`${email}: FAIL update (${update.error.message})`); dropEnv(`${name}_NEW`); failures++; continue; }

  const out = await supabase.auth.signOut({ scope: "global" });

  const check = await client().auth.signInWithPassword({ email, password: next });
  const stale = await client().auth.signInWithPassword({ email, password: oldPassword });
  if (check.error || !stale.error) {
    console.log(`${email}: CHANGED BUT UNCONFIRMED (new works: ${!check.error}, old refused: ${Boolean(stale.error)}); new value kept as ${name}_NEW`);
    failures++;
    continue;
  }
  setEnv(name, next);
  dropEnv(`${name}_NEW`);
  console.log(`${email}: rotated; new password works, old one refused; global sign-out ${out.error ? "FAILED: " + out.error.message : "done"}`);
}
process.exit(failures ? 1 : 0);
