export const supportedLocales = ['en', 'zh'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export * from './constants.js';
export * from './utils.js';
