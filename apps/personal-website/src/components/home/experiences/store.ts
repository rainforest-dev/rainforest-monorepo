import type { ExperienceTag } from '@types';
import { atom } from 'nanostores';

export const $filter = atom<ExperienceTag | null>(null);
