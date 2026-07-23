// Lighthouse CI configuration.
//
// personal-website is SSR on Vercel (`output: 'server'`), so there is no static
// `dist/` to serve locally for a faithful audit, and a dev server would score
// unrealistically low. Instead we audit the DEPLOYED site: production by
// default, or any URL passed via LHCI_BASE_URL (e.g. a Vercel preview
// deployment) — set it in the workflow_dispatch input.
//
// Budgets are assertions at "warn": they surface Core Web Vitals / category
// regressions in the CI log and the public report, without failing the run.
// Tighten specific ones to "error" once the numbers are consistently green.
const base = (process.env.LHCI_BASE_URL || 'https://rainforest.tools').replace(
  /\/+$/,
  '',
);

module.exports = {
  ci: {
    collect: {
      url: [
        `${base}/`,
        `${base}/resume`,
        // Enable once the portfolio redesign is live in production:
        // `${base}/portfolio`,
        // `${base}/portfolio/hashgreen-swap`,
      ],
      // Median of 3 runs — dampens the variance of a single remote audit.
      numberOfRuns: 3,
    },
    assert: {
      // Default Lighthouse form factor is mobile (throttled), which is the
      // meaningful target for Core Web Vitals.
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      // Publishes each report to Google's temporary public storage (~7 days)
      // and prints the link in the job log — no server or secret required.
      target: 'temporary-public-storage',
    },
  },
};
