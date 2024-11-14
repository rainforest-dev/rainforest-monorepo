import { Description, IExperience, ISkill, Skill } from '@types';
import type { i18n as I18nInstance, TFunction } from 'i18next';
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';

import { isServerSide } from '..';
import { fallbackLng, getOptions, supportedLngs } from './settings';

export const createInstance = (
  instance: I18nInstance = i18next.createInstance()
): I18nInstance => {
  instance
    .use(LanguageDetector)
    .use(
      resourcesToBackend(
        (lng: string, ns: string) =>
          import(`../../../locales/${lng}/${ns}.json`)
      )
    );

  return instance;
};

const initI18next = async (lng: string, ns?: string | string[]) => {
  const instance = createInstance();
  await instance.init({
    ...getOptions(lng, ns),
  });
  return instance;
};

export const initI18nextClient = async (instance = createInstance()) => {
  await instance.init({
    ...getOptions(),
    lng: undefined,
    detection: {
      order: ['path', 'htmlTag', 'cookie', 'navigator'],
    },
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    preload: isServerSide ? supportedLngs : [],
  });
  return instance;
};

export const useTranslation = async (
  lng: string = fallbackLng,
  ns?: string | string[]
): Promise<{ t: TFunction; i18n: I18nInstance }> => {
  const instance = await initI18next(lng, ns);
  return {
    t: instance.getFixedT(lng, Array.isArray(ns) ? ns[0] : ns),
    i18n: instance,
  };
};

export const translateDescription = (
  t: TFunction,
  description: Description
) => {
  if (Array.isArray(description)) {
    return description.map((desc) => t(desc));
  }
  return t(description);
};

export const translateExperience = (
  t: TFunction,
  experience: IExperience
): IExperience => {
  return {
    ...experience,
    organization: {
      ...experience.organization,
      name: t(experience.organization.name),
      department: experience.organization.department
        ? t(experience.organization.department)
        : undefined,
    },
    position: t(experience.position),
    description: experience.description
      ? translateDescription(t, experience.description)
      : undefined,
    projects: experience.projects?.map((project) => ({
      ...project,
      name: t(project.name),
      description: project.description
        ? translateDescription(t, project.description)
        : undefined,
    })),
  };
};

export const translateSkill = (t: TFunction, skill: ISkill): Skill => ({
  ...skill,
  label: t(skill.key),
  description: translateDescription(t, skill.description),
});

export * from './route';
export * from './settings';
