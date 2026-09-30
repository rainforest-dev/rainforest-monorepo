const ATTR = 'data-overlays';

export function holdOverlay(): () => void {
  const root = document.documentElement;
  root.setAttribute(ATTR, String(Number(root.getAttribute(ATTR) ?? '0') + 1));
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    const left = Number(root.getAttribute(ATTR) ?? '1') - 1;
    if (left > 0) root.setAttribute(ATTR, String(left));
    else root.removeAttribute(ATTR);
  };
}

export const isOverlayOpen = () => document.documentElement.hasAttribute(ATTR);
