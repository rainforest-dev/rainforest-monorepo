/**
 * Test-only helpers. Not imported by any runtime code.
 */

/**
 * Narrows away `null`/`undefined`, failing the test with a readable message when the value is
 * missing.
 *
 * Replaces the non-null assertion (`!`) these tests used to rely on. `!` compiles to nothing, so a
 * parser returning `null` surfaced as `TypeError: Cannot read properties of null (reading 'claude')`
 * from somewhere inside a property chain — the message named the property, never the thing that was
 * actually absent. `must(mb, 'machine budget')` says which value was missing, which is the whole
 * point of a test failure.
 *
 * The `what` argument is required rather than optional: a message that only says "expected a value"
 * would be no better than the TypeError it replaces.
 */
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what} to be present, got ${String(value)}`);
  }
  return value;
}
