import { getGitHubUrl } from '@utils';
import { info } from '@utils/constants';
import { useTranslation } from '@utils/i18n';

export interface ProfileIdentity {
  headline: string;
  location: { city: string; country: string };
  links: { website: string; github: string };
}

export async function getProfileIdentity(
  lang: 'en' | 'zh' = 'en',
): Promise<ProfileIdentity> {
  const { t } = await useTranslation(lang, ['common']);
  return {
    headline: t('info-job-position'),
    location: {
      city: t('info-location', { context: 'city' }),
      country: t('info-location', { context: 'country' }),
    },
    links: {
      website: info.links.website,
      github: getGitHubUrl(info.links.github),
    },
  };
}
