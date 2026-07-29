import { hashgreenDex } from '../projects/hashgreen-dex/content';
import { hashgreenDexZh } from '../projects/hashgreen-dex/content.zh';
import { hashgreenSwap } from '../projects/hashgreen-swap/content';
import { hashgreenSwapZh } from '../projects/hashgreen-swap/content.zh';
import { hoogiiWallet } from '../projects/hoogii-wallet/content';
import { hoogiiWalletZh } from '../projects/hoogii-wallet/content.zh';
import { opencgt } from '../projects/opencgt/content';
import { opencgtZh } from '../projects/opencgt/content.zh';
import type { CaseStudy, CaseStudyTranslation, Locale } from './types';

const REGISTRY: Record<string, CaseStudy> = {
  [hoogiiWallet.slug]: hoogiiWallet,
  [hashgreenDex.slug]: hashgreenDex,
  [hashgreenSwap.slug]: hashgreenSwap,
  [opencgt.slug]: opencgt,
};

// Per-locale overlays. English (REGISTRY) is the base; anything a translation
// omits falls back to English, so a half-translated project still renders.
const TRANSLATIONS: Record<Locale, Record<string, CaseStudyTranslation>> = {
  en: {},
  zh: {
    [hoogiiWallet.slug]: hoogiiWalletZh,
    [hashgreenDex.slug]: hashgreenDexZh,
    [hashgreenSwap.slug]: hashgreenSwapZh,
    [opencgt.slug]: opencgtZh,
  },
};

/**
 * Overlays a translation onto the English base, field by field, falling back to
 * English wherever the translation is absent. Sections match by `id`, so English
 * stays the single source of truth for structure/order.
 */
function localize(
  base: CaseStudy,
  tr: CaseStudyTranslation | undefined,
): CaseStudy {
  if (!tr) return base;
  return {
    ...base,
    tagline: tr.tagline ?? base.tagline,
    role: tr.role ?? base.role,
    period: tr.period ?? base.period,
    sections: base.sections.map((s) => {
      const st = tr.sections?.[s.id];
      if (!st) return s;
      return {
        ...s,
        title: st.title ?? s.title,
        feature: st.feature ?? s.feature,
        contribution: st.contribution ?? s.contribution,
        tech: st.tech ?? s.tech,
      };
    }),
  };
}

export function listCaseStudies(lang: Locale = 'en'): CaseStudy[] {
  const tr = TRANSLATIONS[lang];
  return Object.values(REGISTRY).map((cs) => localize(cs, tr[cs.slug]));
}

export function getCaseStudy(
  slug: string,
  lang: Locale = 'en',
): CaseStudy | undefined {
  const base = REGISTRY[slug];
  if (!base) return undefined;
  return localize(base, TRANSLATIONS[lang][slug]);
}

export function hasCaseStudy(slug: string): boolean {
  return slug in REGISTRY;
}

export type {
  CaseStudy,
  InteractionKind,
  Locale,
  ProjectVariant,
  Section,
} from './types';
