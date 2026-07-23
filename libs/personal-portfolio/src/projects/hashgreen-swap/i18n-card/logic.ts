export type SwapLocale = 'en' | 'zh-CN' | 'zh-TW';

interface LocaleDict {
  intlLocale: string;
  title: string;
  pay: string;
  receive: string;
  min: string;
  impact: string;
  fee: string;
  est: string;
}

/** Per-namespace dictionary — mirrors `public/locales/{en,zh-CN,zh-TW}`. */
const DICT: Record<SwapLocale, LocaleDict> = {
  en: {
    intlLocale: 'en-US',
    title: 'Swap summary',
    pay: 'You pay',
    receive: 'You receive',
    min: 'Minimum received',
    impact: 'Price impact',
    fee: 'Liquidity fee',
    est: 'Est. value',
  },
  'zh-CN': {
    intlLocale: 'zh-CN',
    title: '交易摘要',
    pay: '支付',
    receive: '获得',
    min: '最少获得',
    impact: '价格影响',
    fee: '流动性手续费',
    est: '预估价值',
  },
  'zh-TW': {
    intlLocale: 'zh-TW',
    title: '交易摘要',
    pay: '支付',
    receive: '獲得',
    min: '最少獲得',
    impact: '價格影響',
    fee: '流動性手續費',
    est: '預估價值',
  },
};

export const SWAP_LOCALES: SwapLocale[] = ['en', 'zh-CN', 'zh-TW'];

export interface SwapSummaryValues {
  pay: number;
  payAsset: string;
  receive: number;
  receiveAsset: string;
  minReceive: number;
  priceImpactPct: number;
  fee: number;
  feeAsset: string;
  estUsd: number;
}

export interface SwapSummaryRow {
  label: string;
  value: string;
}

export interface SwapSummary {
  title: string;
  rows: SwapSummaryRow[];
  estLabel: string;
  estValue: string;
}

function formatNumber(intlLocale: string, n: number, dp = 2): string {
  try {
    return new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(n);
  } catch {
    return n.toFixed(dp);
  }
}

function formatCurrency(intlLocale: string, n: number): string {
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: 'USD',
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

/**
 * Re-renders a swap-summary card from the shared dictionary — labels and
 * locale-aware number formatting flip together, mirroring
 * `i18next-chained-backend` swapping the active namespace.
 */
export function formatSwapSummary(
  locale: SwapLocale,
  values: SwapSummaryValues,
): SwapSummary {
  const dict = DICT[locale] ?? DICT.en;
  return {
    title: dict.title,
    rows: [
      {
        label: dict.pay,
        value: `${formatNumber(dict.intlLocale, values.pay)} ${values.payAsset}`,
      },
      {
        label: dict.receive,
        value: `${formatNumber(dict.intlLocale, values.receive)} ${values.receiveAsset}`,
      },
      {
        label: dict.min,
        value: `${formatNumber(dict.intlLocale, values.minReceive)} ${values.receiveAsset}`,
      },
      {
        label: dict.impact,
        value: `${formatNumber(dict.intlLocale, values.priceImpactPct)}%`,
      },
      {
        label: dict.fee,
        value: `${formatNumber(dict.intlLocale, values.fee)} ${values.feeAsset}`,
      },
    ],
    estLabel: dict.est,
    estValue: formatCurrency(dict.intlLocale, values.estUsd),
  };
}
