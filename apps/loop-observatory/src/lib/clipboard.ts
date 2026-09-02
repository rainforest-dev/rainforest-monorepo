/**
 * Copying text on a page that is deliberately not a secure context.
 *
 * The Observatory's setup flow is served over plain `http` on a tailnet IP on
 * purpose -- see the ENROLL_APP_URL comment in `SetupPanel.vue`: the machine
 * being enrolled has to reach this app unattended, and the Cloudflare-fronted
 * hostname would route it into a login it cannot complete. The cost is that
 * `navigator.clipboard` is `undefined` there in Chrome and Safari, so the
 * obvious one-liner would do nothing while the button printed `copied`.
 *
 * Deliberately free of `node:` imports and of Vue: both callers are
 * client-hydrated islands, and the rule this encodes -- report the refusal --
 * is worth stating in one place.
 */

/**
 * `document.execCommand` is deprecated and is the only thing that works on a
 * non-secure origin. Its boolean return is checked: it reports refusal rather
 * than throwing, which is exactly the case that would otherwise render as
 * success.
 */
function legacyCopy(text: string): boolean {
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  // Off-screen rather than hidden: `display: none` cannot hold a selection.
  el.style.cssText = 'position:fixed;top:-9999px;opacity:0';
  document.body.appendChild(el);

  const selection = document.getSelection();
  const previous =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  el.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  el.remove();

  // Put back whatever the reader had selected before pressing the button.
  if (previous && selection) {
    selection.removeAllRanges();
    selection.addRange(previous);
  }
  return ok;
}

/** True only when the text actually reached the clipboard. */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  if (navigator.clipboard?.writeText) {
    const ok = await navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false);
    if (ok) return true;
  }
  return legacyCopy(text);
}

/** How long a `copied` / `select it` label stays before reverting. */
export const COPY_FEEDBACK_MS = 1600;
