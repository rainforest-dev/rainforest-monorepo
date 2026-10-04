/**
 * A capability probe must answer, or be treated as a no.
 *
 * `availability()` is documented as a quick lookup and usually returns in under a millisecond —
 * but it is not guaranteed to settle. Measured 2026-07-29 in Chromium 150:
 * `Translator.availability({sourceLanguage:'en', targetLanguage:'zh-Hant'})` never resolved, while
 * `LanguageModel.availability()` and `Summarizer.availability()` both answered in 0ms in the same
 * page. A probe that hangs is worse than one that fails, because nothing downstream can tell the
 * difference between "still checking" and "will never answer":
 *
 * - a component gating its own render on the result stays invisible forever, with no error
 * - a `Promise.all` over several probes is held hostage by the slowest
 *
 * Both were real. The support table hung on the third probe, and TranslateButton — which awaits the
 * same detector in `onMounted` — would have rendered nothing at all, silently.
 */
export const PROBE_TIMEOUT_MS = 5_000;

/**
 * Resolves to `fallback` if `probe` has not settled within {@link PROBE_TIMEOUT_MS}.
 *
 * The losing probe is abandoned rather than cancelled — `availability()` takes no signal — so it
 * may still settle later into nothing. That is acceptable for a lookup with no side effects.
 */
export function withProbeTimeout<T>(
  probe: Promise<T>,
  fallback: T,
): Promise<T> {
  return Promise.race([
    probe,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), PROBE_TIMEOUT_MS);
    }),
  ]);
}
