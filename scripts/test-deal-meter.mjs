/**
 * Tests for the deal meter's arithmetic.
 *
 *   npm run test:deal
 *
 * Loads src/lib/deal-meter.ts directly (Node strips the type annotations) and
 * checks the formula against values worked out by hand. No framework: each
 * line is one assertion, and a failure throws with what was expected.
 */

import assert from "node:assert/strict";

import { dealMeter } from "../src/lib/deal-meter.ts";

const sale = (overrides) =>
  dealMeter({ type: "sale", price: 250, originalPrice: 600, condition: "fair", category: "books", ...overrides });

let count = 0;
const check = (name, run) => {
  run();
  count += 1;
  console.log(`  PASS  ${name}`);
};

console.log("\nDeal meter\n");

check("the worked example: MRP 600, used book, asking 250 is a steal", () => {
  // 600 x 0.55 x 1 = 330. 250 / 330 = 0.76, which is under 0.85.
  assert.equal(sale().fair, 330);
  assert.equal(sale().verdict, "steal");
});

check("fair price = MRP x condition x category, rounded to a rupee", () => {
  assert.equal(sale({ condition: "good" }).fair, 390); // 600 x 0.65
  assert.equal(sale({ condition: "new" }).fair, 540); // 600 x 0.9
  assert.equal(sale({ condition: "poor" }).fair, 210); // 600 x 0.35
  assert.equal(sale({ originalPrice: 1495, condition: "good", category: "electronics" }).fair, 777); // 1495 x 0.65 x 0.8 = 777.4
});

check("electronics are worth less than a book of the same MRP and condition", () => {
  const book = sale({ condition: "good", category: "books" }).fair;
  const gadget = sale({ condition: "good", category: "electronics" }).fair;
  assert.ok(gadget < book, `${gadget} should be below ${book}`);
});

check("the four bands, at their edges", () => {
  const at = (price) => sale({ price, originalPrice: 1000, condition: "good", category: "books" }).verdict; // fair = 650
  assert.equal(at(552), "steal"); // 0.85 x 650 = 552.5
  assert.equal(at(553), "fair");
  assert.equal(at(747), "fair"); // 1.15 x 650 = 747.5
  assert.equal(at(748), "bit_high");
  assert.equal(at(910), "bit_high"); // 1.40 x 650 = 910 exactly
  assert.equal(at(911), "overpriced");
});

check("the reasoning line shows every number that went in", () => {
  assert.equal(
    sale().reasoning,
    "MRP ₹600 · used · fair ≈ ₹330 · asking ₹250 → Steal deal",
  );
});

check("no MRP, no verdict", () => {
  assert.equal(sale({ originalPrice: null }), null);
  assert.equal(sale({ originalPrice: 0 }), null);
  assert.equal(sale({ originalPrice: Number.NaN }), null);
});

check("a free item cannot be beaten, with or without an MRP", () => {
  const free = dealMeter({ type: "free", price: 0, originalPrice: null, condition: "fair", category: "notes" });
  assert.equal(free.verdict, "free");
  assert.equal(free.label, "Can’t beat free");
  assert.equal(free.fair, null);
});

check("rentals, skills, teams and found items have no meter", () => {
  for (const type of ["rent", "skill_offer", "team_request", "lost_found"]) {
    assert.equal(dealMeter({ type, price: 30, originalPrice: 600, condition: "good", category: "other" }), null);
  }
});

check("an unknown condition or category gives no verdict, not a wrong one", () => {
  assert.equal(sale({ condition: "mint" }), null);
  assert.equal(sale({ category: "vehicles" }), null);
});

console.log(`\n${count} passed\n`);
