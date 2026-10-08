/**
 * ISBN normalisation and check-digit validation.
 *
 * Lives in its own module, with no server-only import, because three places
 * need exactly the same rule: the form (to reject a typo before a round trip),
 * the zod schema used by the Server Action, and the book lookup. When this was
 * inside the server-only lookup module the form schema could not reuse it and
 * fell back to a loose pattern that accepted "----------".
 */

/**
 * Strips the hyphens and spaces people copy from a back cover, and upper-cases
 * the X that an ISBN-10 may end in.
 *
 * Returns null unless the result is a well-formed ISBN-10 or ISBN-13 with a
 * correct check digit. Checking the digit means a mistyped or misread number is
 * caught without spending a network request on it.
 */
export function normalizeIsbn(rawIsbn: string): string | null {
  const isbn = rawIsbn.replace(/[\s-]/g, "").toUpperCase();

  if (/^\d{9}[\dX]$/.test(isbn)) {
    return hasValidIsbn10CheckDigit(isbn) ? isbn : null;
  }

  if (/^\d{13}$/.test(isbn)) {
    return hasValidIsbn13CheckDigit(isbn) ? isbn : null;
  }

  return null;
}

/**
 * ISBN-10: weight the digits 10 down to 1; the total must divide by 11.
 * The last character may be X, standing for the value 10.
 */
function hasValidIsbn10CheckDigit(isbn: string): boolean {
  let sum = 0;

  for (let index = 0; index < 10; index += 1) {
    const character = isbn[index];
    const value = character === "X" ? 10 : Number(character);
    sum += value * (10 - index);
  }

  return sum % 11 === 0;
}

/** ISBN-13: weight the digits 1, 3, 1, 3, ...; the total must divide by 10. */
function hasValidIsbn13CheckDigit(isbn: string): boolean {
  let sum = 0;

  for (let index = 0; index < 13; index += 1) {
    const weight = index % 2 === 0 ? 1 : 3;
    sum += Number(isbn[index]) * weight;
  }

  return sum % 10 === 0;
}

/**
 * Is this barcode value a book?
 *
 * A book's barcode is an EAN-13 in the "Bookland" range, which starts 978 or
 * 979. A camera pointed at a desk sees other barcodes too (a pen, a snack), so
 * anything outside that range is ignored rather than looked up.
 */
export function isBookBarcode(value: string): boolean {
  return /^97[89]\d{10}$/.test(value) && normalizeIsbn(value) !== null;
}
