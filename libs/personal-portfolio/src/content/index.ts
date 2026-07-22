import { hashgreenDex } from '../projects/hashgreen-dex/content';
import { hashgreenSwap } from '../projects/hashgreen-swap/content';
import { hoogiiWallet } from '../projects/hoogii-wallet/content';
import { opencgt } from '../projects/opencgt/content';
import type { CaseStudy } from './types';

const REGISTRY: Record<string, CaseStudy> = {
  [hoogiiWallet.slug]: hoogiiWallet,
  [hashgreenDex.slug]: hashgreenDex,
  [hashgreenSwap.slug]: hashgreenSwap,
  [opencgt.slug]: opencgt,
};

export function listCaseStudies(): CaseStudy[] {
  return Object.values(REGISTRY);
}

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return REGISTRY[slug];
}

export function hasCaseStudy(slug: string): boolean {
  return slug in REGISTRY;
}

export type {
  CaseStudy,
  InteractionKind,
  ProjectVariant,
  Section,
} from './types';
