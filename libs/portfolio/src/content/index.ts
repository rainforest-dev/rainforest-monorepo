import { hoogiiWallet } from './hoogii-wallet';
import type { CaseStudy } from './types';

const REGISTRY: Record<string, CaseStudy> = {
  [hoogiiWallet.slug]: hoogiiWallet,
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

export type { CaseStudy, InteractionKind, ProjectVariant, Section } from './types';
