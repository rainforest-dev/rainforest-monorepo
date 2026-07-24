// Cookieless, recruiter-focused conversion tracking. Posts interactions to
// /api/event, which forwards them to GA4 server-side. No cookies and no storage,
// so it needs no consent banner. Events:
//   outbound_click { target: github | linkedin | email }
//   contact_submit            (the contact form "submits" via a mailto: link)
//   resume_view               (visiting /resume)
//   case_study_view { slug }  (visiting a /portfolio/<slug> page)

type Params = Record<string, string>;

function send(event: string, params: Params = {}): void {
  try {
    const body = JSON.stringify({ event, params });
    const blob = new Blob([body], { type: 'application/json' });
    // sendBeacon survives the navigation an outbound-link click triggers.
    if (!navigator.sendBeacon?.('/api/event', blob)) {
      void fetch('/api/event', {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'content-type': 'application/json' },
      }).catch(() => undefined);
    }
  } catch {
    // best-effort
  }
}

// One delegated click listener for the whole document, bound once per page.
const w = window as unknown as { __convClickBound?: boolean };
if (!w.__convClickBound) {
  w.__convClickBound = true;
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as Element | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      // The contact form's submit button is a mailto: link — the real conversion.
      if (href.startsWith('mailto:') && anchor.closest('contact-form')) {
        send('contact_submit');
        return;
      }
      if (/linkedin\.com/i.test(href)) send('outbound_click', { target: 'linkedin' });
      else if (/github\.com/i.test(href)) send('outbound_click', { target: 'github' });
      else if (href.startsWith('mailto:')) send('outbound_click', { target: 'email' });
    },
    { capture: true },
  );
}

// Page-view conversions. Runs on initial load (module executes on every full page
// load) and after each view-transition swap (for client-side navigations).
function trackPageView(): void {
  const path = location.pathname.replace(/^\/zh(?=\/|$)/, '') || '/';
  if (path === '/resume') send('resume_view');
  const caseStudy = path.match(/^\/portfolio\/([^/]+)\/?$/);
  if (caseStudy) send('case_study_view', { slug: caseStudy[1] });
}

trackPageView();
document.addEventListener('astro:after-swap', trackPageView);
