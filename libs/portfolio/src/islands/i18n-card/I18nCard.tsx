import { type JSX, useState } from 'react';

import { formatSwapSummary, SWAP_LOCALES, type SwapLocale } from './logic';

const LOCALE_LABEL: Record<SwapLocale, string> = {
  en: 'EN',
  'zh-CN': '简',
  'zh-TW': '繁',
};

/** A fixed, fabricated quote result — the card re-renders it per locale/theme. */
const SUMMARY_VALUES = {
  pay: 1000,
  payAsset: 'XCH',
  receive: 364.29,
  receiveAsset: 'hUSDC',
  minReceive: 362.47,
  priceImpactPct: 4.13,
  fee: 30,
  feeAsset: 'XCH',
  estUsd: 364.29,
};

export function I18nCard(): JSX.Element {
  const [locale, setLocale] = useState<SwapLocale>('en');
  const [dark, setDark] = useState(true);

  const summary = formatSwapSummary(locale, SUMMARY_VALUES);

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div
          role="group"
          aria-label="Language"
          className="bg-muted/40 inline-flex gap-1 rounded-lg p-1"
        >
          {SWAP_LOCALES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={locale === option}
              onClick={() => setLocale(option)}
              className={`h-8 rounded-md px-4 text-sm font-semibold ${
                locale === option
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {LOCALE_LABEL[option]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {dark ? 'dark' : 'light'}
          </span>
          <input
            type="checkbox"
            checked={!dark}
            onChange={(e) => setDark(!e.target.checked)}
            aria-label="Toggle light theme"
            className="accent-primary h-5 w-9"
          />
        </label>
      </div>

      <div
        className={`mx-auto max-w-sm rounded-xl border p-5 ${
          dark
            ? 'border-primary/30 bg-muted/60 text-foreground'
            : 'border-primary/20 bg-background text-foreground shadow-md'
        }`}
      >
        <div className="mb-3 text-base font-bold">{summary.title}</div>
        <dl className="flex flex-col gap-0.5">
          {summary.rows.map((row) => (
            <div
              key={row.label}
              className="bg-muted/40 flex justify-between rounded-md px-2.5 py-2 text-sm"
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-semibold">{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-muted-foreground text-xs">
            {summary.estLabel}
          </span>
          <span className="text-primary font-mono text-sm font-bold">
            {summary.estValue}
          </span>
        </div>
      </div>
    </div>
  );
}

export default I18nCard;
