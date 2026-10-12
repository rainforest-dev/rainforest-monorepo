import type { LanguageOptions } from './language-model';

const HAN = /\p{Script=Han}/u;

export type QueryLanguage = 'zh' | 'en';

export const queryLanguage = (raw: string): QueryLanguage =>
  HAN.test(raw) ? 'zh' : 'en';

export const languagesFor = (lang: string): LanguageOptions => ({
  input: [...new Set(['en', lang])],
  output: ['en'],
});
